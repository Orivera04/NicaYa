"use client";

import { useEffect, useRef } from "react";
import type { LatLngLiteral, Map as LeafletMap } from "leaflet";

export type MapPoint = LatLngLiteral & { label?: string };
type RequestMarker = MapPoint & { id: string; title: string; subtitle?: string };
type Props = { origin?: MapPoint; destination?: MapPoint; rider?: MapPoint; focus?: MapPoint; requests?: RequestMarker[]; onPick?: (point: MapPoint) => void; onOriginMove?: (point: MapPoint) => void; onDestinationMove?: (point: MapPoint) => void; onRequestClick?: (id: string) => void; className?: string };
const icon = (color: string) => `<span style="display:block;width:22px;height:22px;border-radius:9999px;background:${color};border:3px solid white;box-shadow:0 1px 5px #334155"></span>`;

export function MapView({ origin, destination, rider, focus, requests = [], onPick, onOriginMove, onDestinationMove, onRequestClick, className }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const props = useRef({ origin, destination, rider, requests, onPick, onOriginMove, onDestinationMove, onRequestClick });
  props.current = { origin, destination, rider, requests, onPick, onOriginMove, onDestinationMove, onRequestClick };
  const draw = () => {
    if (!map.current) return;
    import("leaflet").then(({ default: L }) => {
      const instance = map.current!;
      instance.eachLayer((layer) => { if (layer instanceof L.Marker || layer instanceof L.Polyline) instance.removeLayer(layer); });
      const current = props.current;
      const addMarker = (point: MapPoint | undefined, color: string, tooltip: string, draggable: boolean, moved?: (point: MapPoint) => void) => {
        if (!point) return;
        const marker = L.marker(point, { draggable, icon: L.divIcon({ className: "motoya-map-pin", html: icon(color), iconSize: [22, 22], iconAnchor: [11, 11] }) }).addTo(instance).bindTooltip(tooltip);
        if (moved) marker.on("dragend", () => { const next = marker.getLatLng(); moved({ lat: next.lat, lng: next.lng }); });
      };
      addMarker(current.origin, "#16a34a", "Origen: arrastra para corregir", Boolean(current.onOriginMove), current.onOriginMove);
      addMarker(current.destination, "#f97316", "Destino: arrastra para corregir", Boolean(current.onDestinationMove), current.onDestinationMove);
      addMarker(current.rider, "#2563eb", "Tu ubicación", false);
      if (current.origin && current.destination) L.polyline([current.origin, current.destination], { color: "#f97316", dashArray: "6 8" }).addTo(instance);
      current.requests.forEach((request) => L.marker(request, { icon: L.divIcon({ className: "motoya-map-pin", html: icon("#a855f7"), iconSize: [22, 22], iconAnchor: [11, 11] }) }).addTo(instance).bindTooltip(request.title).on("click", () => props.current.onRequestClick?.(request.id)));
    });
  };
  useEffect(() => {
    let active = true; let cleanup = () => {};
    import("leaflet").then(({ default: L }) => {
      if (!host.current || !active) return;
      const center = rider || origin || { lat: 12.1364, lng: -86.2514 };
      const instance = L.map(host.current, { zoomControl: false }).setView(center, 13);
      map.current = instance; L.control.zoom({ position: "bottomright" }).addTo(instance);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(instance);
      instance.on("click", (event) => props.current.onPick?.({ lat: event.latlng.lat, lng: event.latlng.lng, label: "Ubicación seleccionada" }));
      draw(); cleanup = () => instance.remove();
    });
    return () => { active = false; cleanup(); map.current = null; };
  }, []);
  useEffect(() => { draw(); if (map.current && focus) map.current.flyTo(focus, 15, { animate: true }); }, [origin, destination, rider, focus, requests, onOriginMove, onDestinationMove, onRequestClick]);
  return <div ref={host} className={`relative isolate z-0 h-72 w-full overflow-hidden rounded-2xl bg-slate-200 ${className || ""}`} aria-label="Mapa interactivo" />;
}
