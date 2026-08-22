import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Camera, GeoJSONSource, Layer, Map, ViewAnnotation, type CameraRef, type LngLat } from "@maplibre/maplibre-react-native";
import { getRouteMatch, type Place, type Trip } from "../api";
import { theme } from "../theme";

type Props = {
  trip?: Trip | null;
  origin?: Place;
  destination?: Place;
  currentLocation?: Place | null;
  route?: Place[];
  editable?: boolean;
  onMapPress?: (place: Place) => void;
  onOriginPress?: () => void;
  onDestinationPress?: () => void;
  label?: string;
  height?: number;
  fill?: boolean;
  searching?: boolean;
  hideLabel?: boolean;
  followPoint?: Place | null;
};

type MapPoint = { lat: number; lng: number };
type LivePlace = Place & { accuracy?: number | null; heading?: number | null; capturedAt?: string; createdAt?: string };
type PinKind = "origin" | "destination" | "rider" | "riderStart" | "client";
const MAP_STYLE = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
const DEFAULT_CENTER: LngLat = [-86.2514, 12.1364];
const NAVIGATION_ZOOM = 16.2;
const MAX_TRACK_ACCURACY_METERS = 75;
const toLngLat = (place: MapPoint): LngLat => [place.lng, place.lat];
const lineFeature = (points: MapPoint[]) => ({ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: points.map(toLngLat) } });
const multiLineFeature = (segments: MapPoint[][]) => ({ type: "Feature" as const, properties: {}, geometry: { type: "MultiLineString" as const, coordinates: segments.map(segment => segment.map(toLngLat)) } });
const cutMarkerHalo = (segments: MapPoint[][], marker: MapPoint | null, radiusMeters = 27) => {
  if (!marker) return segments;
  return segments.flatMap(segment => {
    const parts: MapPoint[][] = []; let part: MapPoint[] = [];
    for (const point of segment) {
      if (metersBetween(point, marker) < radiusMeters) { if (part.length > 1) parts.push(part); part = []; }
      else part.push(point);
    }
    if (part.length > 1) parts.push(part); return parts;
  });
};
const toRadians = (degrees: number) => degrees * Math.PI / 180;
const toDegrees = (radians: number) => radians * 180 / Math.PI;
const normalizeBearing = (bearing: number) => (bearing % 360 + 360) % 360;
const metersBetween = (a: MapPoint, b: MapPoint) => {
  const radius = 6_371_000;
  const dLat = toRadians(b.lat - a.lat); const dLng = toRadians(b.lng - a.lng);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};
const bearingBetween = (from: MapPoint, to: MapPoint) => {
  const dLng = toRadians(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(toRadians(to.lat));
  const x = Math.cos(toRadians(from.lat)) * Math.sin(toRadians(to.lat)) - Math.sin(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.cos(dLng);
  return normalizeBearing(toDegrees(Math.atan2(y, x)));
};
const pointAhead = (point: MapPoint, bearing: number, meters: number): MapPoint => {
  const distance = meters / 6_371_000; const heading = toRadians(bearing); const lat = toRadians(point.lat); const lng = toRadians(point.lng);
  const nextLat = Math.asin(Math.sin(lat) * Math.cos(distance) + Math.cos(lat) * Math.sin(distance) * Math.cos(heading));
  const nextLng = lng + Math.atan2(Math.sin(heading) * Math.sin(distance) * Math.cos(lat), Math.cos(distance) - Math.sin(lat) * Math.sin(nextLat));
  return { lat: toDegrees(nextLat), lng: toDegrees(nextLng) };
};
const validHeading = (heading: unknown): number | undefined => typeof heading === "number" && Number.isFinite(heading) && heading >= 0 && heading < 360 ? heading : undefined;
const pointTime = (point: LivePlace) => {
  const value = point.capturedAt || point.createdAt;
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : undefined;
};

/** Filters duplicate, inaccurate and physically impossible GPS readings before drawing them. */
function cleanTrack(points: LivePlace[]): MapPoint[] {
  const accepted: LivePlace[] = [];
  for (const point of points) {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng) || (point.accuracy != null && point.accuracy > MAX_TRACK_ACCURACY_METERS)) continue;
    const previous = accepted.at(-1);
    if (!previous) { accepted.push(point); continue; }
    const distance = metersBetween(previous, point);
    const previousTime = pointTime(previous); const currentTime = pointTime(point);
    const elapsedSeconds = previousTime && currentTime ? Math.max(1, (currentTime - previousTime) / 1_000) : 8;
    const maxPlausibleDistance = Math.max(90, elapsedSeconds * 42 + (previous.accuracy || 0) + (point.accuracy || 0));
    if (distance < 4 || distance > maxPlausibleDistance) continue;
    accepted.push(point);
  }
  return accepted.map(({ lat, lng }) => ({ lat, lng }));
}

function useMatchedTrack(points: MapPoint[]) {
  const [segments, setSegments] = useState<MapPoint[][]>([]);
  const requestRef = useRef<{ point: MapPoint; at: number } | null>(null);
  const recent = useMemo(() => points.slice(-45), [points]);
  const key = useMemo(() => recent.map(point => `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`).join(";"), [recent]);
  useEffect(() => {
    if (recent.length < 2) { setSegments([]); return; }
    const last = recent.at(-1)!; const previousRequest = requestRef.current;
    if (previousRequest && Date.now() - previousRequest.at < 3_000 && metersBetween(previousRequest.point, last) < 12) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      requestRef.current = { point: last, at: Date.now() };
      void getRouteMatch(recent).then(result => { if (!cancelled) setSegments(result.segments); }).catch(() => { if (!cancelled) setSegments([]); });
    }, 650);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [key, recent]);
  return segments;
}

function useInterpolatedRider(target: LivePlace | null) {
  const [shown, setShown] = useState<LivePlace | null>(target);
  const shownRef = useRef<LivePlace | null>(target);
  useEffect(() => {
    if (!target) { shownRef.current = null; setShown(null); return; }
    const from = shownRef.current;
    if (!from || metersBetween(from, target) > 750) { shownRef.current = target; setShown(target); return; }
    const distance = metersBetween(from, target);
    const duration = Math.max(650, Math.min(3_600, distance * 42));
    const startedAt = Date.now(); let animationFrame = 0; let lastPaint = 0;
    const tick = () => {
      const now = Date.now(); const progress = Math.min(1, (now - startedAt) / duration); const eased = progress * (2 - progress);
      const next = { ...target, lat: from.lat + (target.lat - from.lat) * eased, lng: from.lng + (target.lng - from.lng) * eased };
      if (now - lastPaint >= 70 || progress === 1) { shownRef.current = next; setShown(next); lastPaint = now; }
      if (progress < 1) animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [target?.lat, target?.lng, target?.heading, target?.capturedAt]);
  return shown;
}

const PIN_DETAILS: Record<PinKind, { icon: string; label: string }> = {
  origin: { icon: "↑", label: "Salida" }, destination: { icon: "⌖", label: "Destino" }, rider: { icon: "🏍", label: "Moto" }, riderStart: { icon: "↗", label: "Inicio rider" }, client: { icon: "●", label: "Pasajero" }
};

function Pin({ kind, text, onPress, pulsing = false }: { kind: PinKind; text: string; onPress?: () => void; pulsing?: boolean }) {
  const detail = PIN_DETAILS[kind]; const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => { if (!pulsing) { pulse.stopAnimation(); pulse.setValue(0); return; } const animation = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 1050, useNativeDriver: true }), Animated.timing(pulse, { toValue: 0, duration: 1050, useNativeDriver: true })])); animation.start(); return () => animation.stop(); }, [pulse, pulsing]);
  const pulseStyle = { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [.42, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.82] }) }] };
  const markerStyle = pulsing ? { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.075] }) }] } : undefined;
  return <Pressable accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={`${detail.label}: ${text}`} disabled={!onPress} onPress={onPress} style={[styles.pin, styles[`pin_${kind}`], onPress && styles.pinInteractive]}>
    {pulsing ? <Animated.View pointerEvents="none" style={[styles.pinPulse, kind === "rider" ? styles.pinPulse_rider : styles.pinPulse_client, pulseStyle]} /> : null}
    <Animated.View style={markerStyle}><View style={[styles.pinIconWrap, styles[`pinIconWrap_${kind}`]]}><Text style={[styles.pinIcon, kind === "rider" && styles.riderPinIcon]}>{detail.icon}</Text></View></Animated.View>
    <Text numberOfLines={1} style={styles.pinLabel}>{text}</Text><View style={[styles.pinPointer, styles[`pinPointer_${kind}`]]} />
  </Pressable>;
}

export function TripMap({ trip, origin, destination, currentLocation, route = [], editable = false, onMapPress, onOriginPress, onDestinationPress, label, height = 340, fill = false, searching = false, hideLabel = false, followPoint }: Props) {
  const cameraRef = useRef<CameraRef>(null); const [following, setFollowing] = useState(true); const bearingRef = useRef<number | null>(null);
  const tripOrigin = trip ? { lat: trip.originLat, lng: trip.originLng, address: trip.originAddress } : origin;
  const tripDestination = trip ? { lat: trip.destinationLat, lng: trip.destinationLng, address: trip.destinationAddress } : destination;
  const rider = useMemo<LivePlace | null>(() => (currentLocation || (trip?.riderLat != null && trip?.riderLng != null ? { lat: trip.riderLat, lng: trip.riderLng, address: "Rider", heading: trip.riderHeading ?? undefined } : null)) as LivePlace | null, [currentLocation?.lat, currentLocation?.lng, (currentLocation as LivePlace | null)?.heading, (currentLocation as LivePlace | null)?.capturedAt, trip?.riderLat, trip?.riderLng, trip?.riderHeading]);
  const rawHistory = useMemo(() => {
    const locations = (trip?.locations || []) as LivePlace[]; const start = trip?.startLocation as LivePlace | null | undefined;
    if (!start) return locations;
    const first = locations[0];
    return first && metersBetween(start, first) < 3 ? locations : [start, ...locations];
  }, [trip?.locations, trip?.startLocation]);
  const history = useMemo(() => cleanTrack(rawHistory), [rawHistory]);
  const matchedTrack = useMatchedTrack(history);
  // Only render geometry returned by the road matcher. Raw GPS positions move
  // the marker immediately, but never create a diagonal trace off the street.
  const travelledTrack = matchedTrack;
  const riderStart = useMemo<LivePlace | null>(() => trip?.startLocation ? trip.startLocation as LivePlace : history[0] ? { ...history[0], address: "Inicio del rider" } : null, [trip?.startLocation, history]);
  const planned = useMemo(() => route.map(point => ({ lat: point.lat, lng: point.lng })), [route]);
  const renderedRider = useInterpolatedRider(rider);
  // Reserve a small transparent halo around the live marker so no route can render through the motorcycle icon.
  const protectedPlanned = useMemo(() => cutMarkerHalo(planned.length > 1 ? [planned] : [], renderedRider), [planned, renderedRider?.lat, renderedRider?.lng]);
  const protectedTravelled = useMemo(() => cutMarkerHalo(travelledTrack, renderedRider), [travelledTrack, renderedRider?.lat, renderedRider?.lng]);
  const liveFocus = useMemo(() => followPoint || rider || (searching ? tripOrigin : undefined), [followPoint?.lat, followPoint?.lng, rider?.lat, rider?.lng, searching, tripOrigin?.lat, tripOrigin?.lng]);
  const focusPoints = useMemo(() => [tripOrigin, searching ? undefined : tripDestination].filter(Boolean) as Place[], [tripOrigin?.lat, tripOrigin?.lng, tripDestination?.lat, tripDestination?.lng, searching]);
  const derivedHeading = history.length >= 2 && metersBetween(history.at(-2)!, history.at(-1)!) >= 7 ? bearingBetween(history.at(-2)!, history.at(-1)!) : undefined;
  const candidateHeading = validHeading(rider?.heading) ?? validHeading(trip?.riderHeading) ?? derivedHeading;
  if (candidateHeading !== undefined) { const previous = bearingRef.current; const difference = previous === null ? 0 : ((candidateHeading - previous + 540) % 360) - 180; bearingRef.current = normalizeBearing((previous ?? candidateHeading) + difference * .32); }
  const navigationBearing = bearingRef.current ?? 0;
  const moveCamera = useCallback((restoreFollowing = false) => {
    if (restoreFollowing) setFollowing(true);
    if (liveFocus) {
      const center = candidateHeading === undefined ? liveFocus : pointAhead(liveFocus, navigationBearing, 86);
      cameraRef.current?.easeTo({ center: toLngLat(center), zoom: NAVIGATION_ZOOM, bearing: candidateHeading === undefined ? undefined : navigationBearing, pitch: candidateHeading === undefined ? 0 : 42, duration: 850, easing: "ease" });
      return;
    }
    if (!focusPoints.length) return;
    if (focusPoints.length === 1) { cameraRef.current?.easeTo({ center: toLngLat(focusPoints[0]), zoom: 16, duration: 450, easing: "ease" }); return; }
    const lats = focusPoints.map(point => point.lat); const lngs = focusPoints.map(point => point.lng);
    cameraRef.current?.fitBounds([Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)], { padding: { top: 56, right: 34, bottom: 116, left: 34 }, duration: 550, easing: "ease" });
  }, [candidateHeading, focusPoints, liveFocus, navigationBearing]);
  useEffect(() => { if (!following) return; const timeout = setTimeout(() => moveCamera(), 180); return () => clearTimeout(timeout); }, [following, liveFocus?.lat, liveFocus?.lng, candidateHeading, moveCamera]);
  useEffect(() => { if (liveFocus || !following) return; const timeout = setTimeout(() => moveCamera(), 300); return () => clearTimeout(timeout); }, [following, focusPoints, liveFocus, moveCamera]);
  return <View style={[styles.shell, fill ? styles.shellFill : { height }]}>
    <Map style={StyleSheet.absoluteFill} mapStyle={MAP_STYLE} logo={false} attribution androidView="texture" compass tintColor={theme.panel} onPress={event => { if (!editable || !onMapPress) return; const [lng, lat] = event.nativeEvent.lngLat; onMapPress({ lat, lng, address: "Ubicación seleccionada" }); }} onRegionWillChange={event => { if (event.nativeEvent.userInteraction) setFollowing(false); }}>
      <Camera ref={cameraRef} initialViewState={{ center: DEFAULT_CENTER, zoom: 11 }} />
      {!searching && protectedPlanned.length ? <GeoJSONSource id="planned-route" data={multiLineFeature(protectedPlanned)}><Layer id="planned-route-glow" type="line" paint={{ "line-color": "#3BA7FF", "line-width": 14, "line-opacity": .2, "line-blur": 3 }} layout={{ "line-cap": "round", "line-join": "round" }} /><Layer id="planned-route-outline" type="line" paint={{ "line-color": "#1265E4", "line-width": 9, "line-opacity": .98 }} layout={{ "line-cap": "round", "line-join": "round" }} /><Layer id="planned-route-core" type="line" paint={{ "line-color": "#FFFFFF", "line-width": 3, "line-opacity": .98, "line-dasharray": [1.1, .72] }} layout={{ "line-cap": "round", "line-join": "round" }} /></GeoJSONSource> : null}
      {!searching && protectedTravelled.length ? <GeoJSONSource id="travelled-route" data={multiLineFeature(protectedTravelled)}><Layer id="travelled-route-shadow" type="line" paint={{ "line-color": "#7D3AC7", "line-width": 11, "line-opacity": .18, "line-blur": 2 }} layout={{ "line-cap": "round", "line-join": "round" }} /><Layer id="travelled-route-outline" type="line" paint={{ "line-color": "#8E4AD0", "line-width": 7, "line-opacity": .9 }} layout={{ "line-cap": "round", "line-join": "round" }} /><Layer id="travelled-route-core" type="line" paint={{ "line-color": "#FFFFFF", "line-width": 2.5, "line-opacity": .96, "line-dasharray": [1, 1] }} layout={{ "line-cap": "round", "line-join": "round" }} /></GeoJSONSource> : null}
      {!searching && tripOrigin ? <ViewAnnotation id="origin" lngLat={toLngLat(tripOrigin)} anchor="bottom"><Pin kind="origin" text="Salida" onPress={onOriginPress} /></ViewAnnotation> : null}
      {!searching && tripDestination ? <ViewAnnotation id="destination" lngLat={toLngLat(tripDestination)} anchor="bottom"><Pin kind="destination" text="Destino" onPress={onDestinationPress} /></ViewAnnotation> : null}
      {!searching && riderStart && (!renderedRider || metersBetween(riderStart, renderedRider) > 14) ? <ViewAnnotation id="rider-start" lngLat={toLngLat(riderStart)} anchor="bottom"><Pin kind="riderStart" text="Inicio rider" /></ViewAnnotation> : null}
      {!searching && renderedRider ? <ViewAnnotation id="rider" lngLat={toLngLat(renderedRider)} anchor="bottom"><Pin kind="rider" text="Moto" pulsing={Boolean(trip)} /></ViewAnnotation> : null}
      {(searching || trip?.status === "RIDER_ON_THE_WAY") && tripOrigin ? <ViewAnnotation id="client" lngLat={toLngLat(tripOrigin)} anchor="bottom"><Pin kind="client" text={searching ? "Tú" : "Pasajero"} onPress={onOriginPress} pulsing={searching} /></ViewAnnotation> : null}
    </Map>
    {!hideLabel ? <View pointerEvents="none" style={styles.chip}><Text style={styles.chipText}>{label || (editable ? "Toca el mapa para corregir el destino" : trip?.status === "IN_PROGRESS" ? "Viaje en curso" : "Mapa en vivo")}</Text></View> : null}
    {!following ? <Pressable accessibilityRole="button" accessibilityLabel="Volver al modo navegación" style={styles.focus} onPress={() => moveCamera(true)}><Text style={styles.focusText}>◎ Recentrar</Text></Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  shell: { overflow: "hidden", borderRadius: 28, backgroundColor: "#DCE9E3", marginVertical: 14 }, shellFill: { flex: 1, marginVertical: 0, borderRadius: 0 },
  chip: { position: "absolute", top: 14, left: 14, right: 68, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: "rgba(7,11,28,.88)" }, chipText: { color: theme.white, fontSize: 12, fontWeight: "800" },
  focus: { position: "absolute", right: 14, bottom: 14, minHeight: 46, paddingHorizontal: 14, borderRadius: 23, backgroundColor: theme.panel, alignItems: "center", justifyContent: "center", elevation: 6 }, focusText: { color: theme.white, fontSize: 12, fontWeight: "900" },
  pin: { minWidth: 55, alignItems: "center", justifyContent: "center", elevation: 20, zIndex: 20, shadowColor: "#00143F", shadowOpacity: .32, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } }, pin_origin: {}, pin_destination: {}, pin_rider: { zIndex: 30 }, pin_riderStart: {}, pin_client: {}, pinPulse: { position: "absolute", top: 1, width: 48, height: 48, borderRadius: 24, borderWidth: 2 }, pinPulse_client: { borderColor: theme.violet, backgroundColor: "rgba(157,78,221,.22)" }, pinPulse_rider: { borderColor: "#176BDE", backgroundColor: "rgba(23,107,222,.20)" },
  pinIconWrap: { width: 48, height: 48, borderRadius: 19, borderWidth: 3, borderColor: theme.white, alignItems: "center", justifyContent: "center" }, pinIconWrap_origin: { backgroundColor: "#0C9B8B" }, pinIconWrap_destination: { backgroundColor: theme.orange }, pinIconWrap_rider: { backgroundColor: "#176BDE" }, pinIconWrap_riderStart: { backgroundColor: "#314265" }, pinIconWrap_client: { backgroundColor: theme.violet }, pinIcon: { color: theme.white, fontSize: 21, fontWeight: "900", lineHeight: 25 }, riderPinIcon: { fontSize: 22 },
  pinLabel: { maxWidth: 72, marginTop: -1, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 9, overflow: "hidden", color: theme.white, backgroundColor: "rgba(7,11,28,.92)", fontSize: 10, fontWeight: "900", textAlign: "center" }, pinPointer: { width: 0, height: 0, marginTop: -1, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 8, borderLeftColor: "transparent", borderRightColor: "transparent" }, pinPointer_origin: { borderTopColor: "#0C9B8B" }, pinPointer_destination: { borderTopColor: theme.orange }, pinPointer_rider: { borderTopColor: "#176BDE" }, pinPointer_riderStart: { borderTopColor: "#314265" }, pinPointer_client: { borderTopColor: theme.violet }, pinInteractive: { transform: [{ scale: 1.05 }] }
});