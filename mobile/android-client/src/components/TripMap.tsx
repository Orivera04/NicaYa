import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Camera, GeoJSONSource, Layer, Map, ViewAnnotation, type CameraRef, type LngLat } from "@maplibre/maplibre-react-native";
import type { Place, Trip } from "../api";
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
};

type MapPoint = { lat: number; lng: number };
type PinKind = "origin" | "destination" | "rider" | "client";
const MAP_STYLE = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
const DEFAULT_CENTER: LngLat = [-86.2514, 12.1364];
const toLngLat = (place: MapPoint): LngLat => [place.lng, place.lat];
const lineFeature = (points: MapPoint[]) => ({ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: points.map(toLngLat) } });

const PIN_DETAILS: Record<PinKind, { icon: string; label: string }> = {
  origin: { icon: "↑", label: "Salida" },
  destination: { icon: "⌖", label: "Destino" },
  rider: { icon: "🏍", label: "Moto" },
  client: { icon: "●", label: "Pasajero" }
};

function Pin({ kind, text, onPress }: { kind: PinKind; text: string; onPress?: () => void }) {
  const detail = PIN_DETAILS[kind];
  return <Pressable accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={`${detail.label}: ${text}`} disabled={!onPress} onPress={onPress} style={[styles.pin, styles[`pin_${kind}`], onPress && styles.pinInteractive]}>
    <View style={[styles.pinIconWrap, styles[`pinIconWrap_${kind}`]]}><Text style={[styles.pinIcon, kind === "rider" && styles.riderPinIcon]}>{detail.icon}</Text></View>
    <Text numberOfLines={1} style={styles.pinLabel}>{text}</Text>
    <View style={[styles.pinPointer, styles[`pinPointer_${kind}`]]} />
  </Pressable>;
}

export function TripMap({ trip, origin, destination, currentLocation, route = [], editable = false, onMapPress, onOriginPress, onDestinationPress, label, height = 340, fill = false, searching = false, hideLabel = false }: Props) {
  const cameraRef = useRef<CameraRef>(null);
  const [focused, setFocused] = useState(true);
  const tripOrigin = trip ? { lat: trip.originLat, lng: trip.originLng, address: trip.originAddress } : origin;
  const tripDestination = trip ? { lat: trip.destinationLat, lng: trip.destinationLng, address: trip.destinationAddress } : destination;
  const rider = trip?.riderLat != null && trip?.riderLng != null ? { lat: trip.riderLat, lng: trip.riderLng, address: "Rider" } : currentLocation;
  const history = useMemo(() => (trip?.locations || []).map(point => ({ lat: point.lat, lng: point.lng })), [trip?.locations]);
  const planned = useMemo(() => route.map(point => ({ lat: point.lat, lng: point.lng })), [route]);
  const focusPoints = useMemo(() => [tripOrigin, searching ? undefined : tripDestination, searching ? undefined : rider].filter(Boolean) as Place[], [tripOrigin?.lat, tripOrigin?.lng, tripDestination?.lat, tripDestination?.lng, rider?.lat, rider?.lng, searching]);
  const focus = () => {
    if (!focusPoints.length) return;
    setFocused(true);
    if (focusPoints.length === 1) { cameraRef.current?.easeTo({ center: toLngLat(focusPoints[0]), zoom: 15, duration: 450, easing: "ease" }); return; }
    const lats = focusPoints.map(point => point.lat); const lngs = focusPoints.map(point => point.lng);
    cameraRef.current?.fitBounds([Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)], { padding: { top: 70, right: 58, bottom: 130, left: 58 }, duration: 550, easing: "ease" });
  };
  useEffect(() => { const timeout = setTimeout(focus, 300); return () => clearTimeout(timeout); }, [trip?.id, trip?.status, rider?.lat, rider?.lng, tripOrigin?.lat, tripOrigin?.lng, tripDestination?.lat, tripDestination?.lng]);
  return <View style={[styles.shell, fill ? styles.shellFill : { height }]}>
    <Map style={StyleSheet.absoluteFill} mapStyle={MAP_STYLE} logo={false} attribution androidView="texture" compass tintColor={theme.panel} onPress={event => { if (!editable || !onMapPress) return; const [lng, lat] = event.nativeEvent.lngLat; onMapPress({ lat, lng, address: "Ubicación seleccionada" }); }} onRegionWillChange={event => { if (event.nativeEvent.userInteraction) setFocused(false); }}>
      <Camera ref={cameraRef} initialViewState={{ center: DEFAULT_CENTER, zoom: 11 }} />
      {!searching && planned.length > 1 ? <GeoJSONSource id="planned-route" data={lineFeature(planned)}><Layer id="planned-route-line" type="line" paint={{ "line-color": theme.violet, "line-width": 5, "line-opacity": .9 }} layout={{ "line-cap": "round", "line-join": "round" }} /></GeoJSONSource> : null}
      {!searching && history.length > 1 ? <GeoJSONSource id="travelled-route" data={lineFeature(history)}><Layer id="travelled-route-line" type="line" paint={{ "line-color": theme.cyan, "line-width": 6, "line-opacity": 1 }} layout={{ "line-cap": "round", "line-join": "round" }} /></GeoJSONSource> : null}
      {!searching && tripOrigin ? <ViewAnnotation id="origin" lngLat={toLngLat(tripOrigin)} anchor="bottom"><Pin kind="origin" text="Salida" onPress={onOriginPress} /></ViewAnnotation> : null}
      {!searching && tripDestination ? <ViewAnnotation id="destination" lngLat={toLngLat(tripDestination)} anchor="bottom"><Pin kind="destination" text="Destino" onPress={onDestinationPress} /></ViewAnnotation> : null}
      {!searching && rider ? <ViewAnnotation id="rider" lngLat={toLngLat(rider)} anchor="bottom"><Pin kind="rider" text="Moto" /></ViewAnnotation> : null}
      {(searching || trip?.status === "RIDER_ON_THE_WAY") && tripOrigin ? <ViewAnnotation id="client" lngLat={toLngLat(tripOrigin)} anchor="bottom"><Pin kind="client" text={searching ? "Tú" : "Pasajero"} onPress={onOriginPress} /></ViewAnnotation> : null}
    </Map>
    {!hideLabel ? <View pointerEvents="none" style={styles.chip}><Text style={styles.chipText}>{label || (editable ? "Toca el mapa para corregir el destino" : trip?.status === "IN_PROGRESS" ? "Viaje en curso" : "Mapa en vivo")}</Text></View> : null}
    {!focused ? <Pressable accessibilityLabel="Centrar mapa" style={styles.focus} onPress={focus}><Text style={styles.focusText}>◎</Text></Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  shell: { overflow: "hidden", borderRadius: 28, backgroundColor: "#DCE9E3", marginVertical: 14 },
  shellFill: { flex: 1, marginVertical: 0, borderRadius: 0 },
  chip: { position: "absolute", top: 14, left: 14, right: 68, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: "rgba(7,11,28,.88)" },
  chipText: { color: theme.white, fontSize: 12, fontWeight: "800" },
  focus: { position: "absolute", right: 14, bottom: 14, width: 48, height: 48, borderRadius: 24, backgroundColor: theme.panel, alignItems: "center", justifyContent: "center", elevation: 6 },
  focusText: { color: theme.white, fontSize: 26, lineHeight: 30 },
  pin: { minWidth: 55, alignItems: "center", justifyContent: "center", elevation: 8, shadowColor: "#00143F", shadowOpacity: .32, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
  pin_origin: {}, pin_destination: {}, pin_rider: {}, pin_client: {},
  pinIconWrap: { width: 48, height: 48, borderRadius: 19, borderWidth: 3, borderColor: theme.white, alignItems: "center", justifyContent: "center" },
  pinIconWrap_origin: { backgroundColor: "#0C9B8B" }, pinIconWrap_destination: { backgroundColor: theme.orange }, pinIconWrap_rider: { backgroundColor: "#176BDE" }, pinIconWrap_client: { backgroundColor: theme.violet },
  pinIcon: { color: theme.white, fontSize: 21, fontWeight: "900", lineHeight: 25 }, riderPinIcon: { fontSize: 22 },
  pinLabel: { maxWidth: 72, marginTop: -1, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 9, overflow: "hidden", color: theme.white, backgroundColor: "rgba(7,11,28,.92)", fontSize: 10, fontWeight: "900", textAlign: "center" },
  pinPointer: { width: 0, height: 0, marginTop: -1, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 8, borderLeftColor: "transparent", borderRightColor: "transparent" },
  pinPointer_origin: { borderTopColor: "#0C9B8B" }, pinPointer_destination: { borderTopColor: theme.orange }, pinPointer_rider: { borderTopColor: "#176BDE" }, pinPointer_client: { borderTopColor: theme.violet },
  pinInteractive: { transform: [{ scale: 1.05 }] }
});