"use client";
import { useEffect, useRef } from "react";
import type { LatLngLiteral, Map as LeafletMap } from "leaflet";

export type MapPoint = LatLngLiteral & { label?: string };
type RequestMarker = MapPoint & { id: string; title: string; subtitle?: string };
type Props = { origin?: MapPoint; destination?: MapPoint; rider?: MapPoint; requests?: RequestMarker[]; onPick?: (point: MapPoint) => void; onRequestClick?: (id: string) => void };

export function MapView({ origin, destination, rider, requests = [], onPick, onRequestClick }: Props) {
  const host = useRef<HTMLDivElement>(null); const map = useRef<LeafletMap | null>(null);
  useEffect(() => { let active = true; let cleanup = () => {};
    import("leaflet").then(({ default: L }) => { if (!host.current || !active) return; const center = rider || origin || { lat: 12.1364, lng: -86.2514 }; const instance = L.map(host.current, { zoomControl: false }).setView(center, 13); map.current = instance; L.control.zoom({ position: "bottomright" }).addTo(instance); L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(instance);
      instance.on("click", (event) => onPick?.({ lat: event.latlng.lat, lng: event.latlng.lng, label: "Ubicación seleccionada" })); cleanup = () => instance.remove();
    }); return () => { active = false; cleanup(); map.current = null; };
  }, []);
  useEffect(() => { if (!map.current) return; import("leaflet").then(({ default: L }) => { const instance = map.current!; instance.eachLayer(layer => { if (layer instanceof L.CircleMarker || layer instanceof L.Polyline) instance.removeLayer(layer); }); const add = (p: MapPoint | undefined, color: string, text: string) => p && L.circleMarker(p, { radius: 10, color, fillColor: color, fillOpacity: .9, weight: 3 }).addTo(instance).bindTooltip(text); add(origin, "#16a34a", "Origen"); add(destination, "#f97316", "Destino"); add(rider, "#2563eb", "Tu ubicación"); if (origin && destination) L.polyline([origin, destination], { color: "#f97316", dashArray: "6 8" }).addTo(instance); requests.forEach(r => L.circleMarker(r, { radius: 9, color: "#7c3aed", fillColor: "#a855f7", fillOpacity: .9 }).addTo(instance).bindTooltip(r.title).on("click", () => onRequestClick?.(r.id))); }); }, [origin, destination, rider, requests, onRequestClick]);
  return <div ref={host} className="h-72 w-full overflow-hidden rounded-2xl bg-slate-200" aria-label="Mapa interactivo" />;
}
