import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, type LatLng, type MapPressEvent } from "react-native-maps";
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
  label?: string;
  height?: number;
};

const defaultRegion = { latitude: 12.1364, longitude: -86.2514, latitudeDelta: 0.08, longitudeDelta: 0.08 };
const toLatLng = (place: { lat: number; lng: number }): LatLng => ({ latitude: place.lat, longitude: place.lng });

function Pin({ kind, text }: { kind: "origin" | "destination" | "rider" | "client"; text: string }) {
  return <View style={[styles.pin, styles[`pin_${kind}`]]}><Text style={styles.pinIcon}>{kind === "rider" ? "⌁" : kind === "client" ? "●" : "⚑"}</Text><Text style={styles.pinLabel}>{text}</Text></View>;
}

export function TripMap({ trip, origin, destination, currentLocation, route = [], editable = false, onMapPress, label, height = 340 }: Props) {
  const mapRef = useRef<MapView>(null);
  const isProgrammaticFocus = useRef(false);
  const [focused, setFocused] = useState(true);
  const tripOrigin = trip ? { lat: trip.originLat, lng: trip.originLng, address: trip.originAddress } : origin;
  const tripDestination = trip ? { lat: trip.destinationLat, lng: trip.destinationLng, address: trip.destinationAddress } : destination;
  const rider = trip?.riderLat != null && trip?.riderLng != null ? { lat: trip.riderLat, lng: trip.riderLng, address: "Rider" } : currentLocation;
  const history = useMemo(() => (trip?.locations || []).map(toLatLng), [trip?.locations]);
  const planned = useMemo(() => route.map(toLatLng), [route]);
  const points = useMemo(() => [tripOrigin, tripDestination, rider].filter(Boolean) as Place[], [tripOrigin?.lat, tripOrigin?.lng, tripDestination?.lat, tripDestination?.lng, rider?.lat, rider?.lng]);
  const focus = () => {
    if (!points.length) return;
    isProgrammaticFocus.current = true;
    if (points.length === 1) mapRef.current?.animateToRegion({ latitude: points[0].lat, longitude: points[0].lng, latitudeDelta: 0.025, longitudeDelta: 0.025 }, 450);
    else mapRef.current?.fitToCoordinates(points.map(toLatLng), { edgePadding: { top: 70, right: 60, bottom: 120, left: 60 }, animated: true });
    setFocused(true);
  };
  useEffect(() => { const timeout = setTimeout(focus, 250); return () => clearTimeout(timeout); }, [trip?.id, trip?.status, rider?.lat, rider?.lng, tripOrigin?.lat, tripDestination?.lat]);
  const press = (event: MapPressEvent) => {
    if (!editable || !onMapPress) return;
    const { latitude, longitude } = event.nativeEvent.coordinate;
    onMapPress({ lat: latitude, lng: longitude, address: "Punto seleccionado en el mapa" });
  };
  return <View style={[styles.shell, { height }]}>
    <MapView ref={mapRef} provider={PROVIDER_DEFAULT} style={StyleSheet.absoluteFill} initialRegion={defaultRegion} onPress={press} onPanDrag={() => { isProgrammaticFocus.current = false; setFocused(false); }} onRegionChangeComplete={() => { if (isProgrammaticFocus.current) { isProgrammaticFocus.current = false; setFocused(true); } else setFocused(false); }} rotateEnabled pitchEnabled showsCompass showsUserLocation={false} toolbarEnabled={false} mapType="standard">
      {planned.length > 1 ? <Polyline coordinates={planned} strokeColor={theme.violet} strokeWidth={5} lineDashPattern={[9, 8]} /> : null}
      {history.length > 1 ? <Polyline coordinates={history} strokeColor={theme.cyan} strokeWidth={6} /> : null}
      {tripOrigin ? <Marker coordinate={toLatLng(tripOrigin)} anchor={{ x: 0.5, y: 1 }}><Pin kind="origin" text="Salida" /></Marker> : null}
      {tripDestination ? <Marker coordinate={toLatLng(tripDestination)} anchor={{ x: 0.5, y: 1 }}><Pin kind="destination" text="Destino" /></Marker> : null}
      {rider ? <Marker coordinate={toLatLng(rider)} anchor={{ x: 0.5, y: 0.5 }} rotation={rider === currentLocation ? 0 : undefined} flat><Pin kind="rider" text="Moto" /></Marker> : null}
      {trip?.status === "RIDER_ON_THE_WAY" && tripOrigin ? <Marker coordinate={toLatLng(tripOrigin)} anchor={{ x: 0.5, y: 0.5 }}><Pin kind="client" text="Pasajero" /></Marker> : null}
    </MapView>
    <View style={styles.chip}><Text style={styles.chipText}>{label || (editable ? "Toca el mapa para corregir el destino" : trip?.status === "IN_PROGRESS" ? "Viaje en curso" : "Mapa en vivo")}</Text></View>
    {!focused ? <Pressable accessibilityLabel="Centrar mapa" style={styles.focus} onPress={focus}><Text style={styles.focusText}>◎</Text></Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  shell: { overflow: "hidden", borderRadius: 28, backgroundColor: "#DCE9E3", marginVertical: 14 },
  chip: { position: "absolute", top: 14, left: 14, right: 68, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: "rgba(7,11,28,.88)" },
  chipText: { color: theme.white, fontSize: 12, fontWeight: "800" },
  focus: { position: "absolute", right: 14, bottom: 14, width: 48, height: 48, borderRadius: 24, backgroundColor: theme.panel, alignItems: "center", justifyContent: "center", elevation: 6 },
  focusText: { color: theme.white, fontSize: 30, lineHeight: 32 },
  pin: { minWidth: 42, minHeight: 42, borderRadius: 18, paddingHorizontal: 7, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: theme.white, elevation: 7, shadowColor: "#00143F", shadowOpacity: .32, shadowRadius: 12 },
  pin_origin: { backgroundColor: "#0C9B8B" }, pin_destination: { backgroundColor: theme.orange }, pin_rider: { backgroundColor: "#176BDE" }, pin_client: { backgroundColor: theme.violet },
  pinIcon: { color: theme.white, fontSize: 18, fontWeight: "900" }, pinLabel: { color: theme.white, fontSize: 9, fontWeight: "900", marginTop: -2 },
});
