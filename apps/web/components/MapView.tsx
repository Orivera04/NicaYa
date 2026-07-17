"use client";

import { useEffect, useRef, useState } from "react";
import type { LatLngLiteral, Map as LeafletMap } from "leaflet";

export type MapPoint = LatLngLiteral & { label?: string };
type RequestMarker = MapPoint & { id: string; title: string; subtitle?: string };
type Props = { origin?: MapPoint; destination?: MapPoint; rider?: MapPoint; focus?: MapPoint; requests?: RequestMarker[]; onPick?: (point: MapPoint) => void; onOriginMove?: (point: MapPoint) => void; onDestinationMove?: (point: MapPoint) => void; onRequestClick?: (id: string) => void; className?: string };

const markerSvg = (kind: "rider" | "passenger" | "destination" | "request") => {
  const color = kind === "rider" ? "#2563eb" : kind === "passenger" ? "#a855f7" : kind === "destination" ? "#f97316" : "#7c3aed";
  const shape = kind === "rider"
    ? '<path d="M5 16h14l-2.2-4H9l-4 4m4-4 1.2-3h3.6l2 3M7.2 16a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Zm10 0a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4ZM13 7h2"/>'
    : kind === "passenger" ? '<circle cx="12" cy="8" r="3"/><path d="M5.5 20c.7-3.5 3-5 6.5-5s5.8 1.5 6.5 5"/>'
    : kind === "destination" ? '<path d="M7 3v18M8 4h10l-2.4 4L18 12H8"/>'
    : '<path d="M12 21s7-5.3 7-12a7 7 0 1 0-14 0c0 6.7 7 12 7 12Z"/><circle cx="12" cy="9" r="2"/>';
  return `<span style="display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 5px 14px rgba(15,23,42,.35)"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${shape}</svg></span>`;
};
const routeKey = (origin?: MapPoint, destination?: MapPoint) => origin && destination ? `${origin.lat.toFixed(5)},${origin.lng.toFixed(5)}:${destination.lat.toFixed(5)},${destination.lng.toFixed(5)}` : "";

export function MapView({ origin, destination, rider, focus, requests = [], onPick, onOriginMove, onDestinationMove, onRequestClick, className }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const fittedRoute = useRef("");
  const [route, setRoute] = useState<MapPoint[]>([]);
  const props = useRef({ origin, destination, rider, requests, onPick, onOriginMove, onDestinationMove, onRequestClick });
  props.current = { origin, destination, rider, requests, onPick, onOriginMove, onDestinationMove, onRequestClick };

  useEffect(() => {
    const key = routeKey(origin, destination);
    if (!key || !origin || !destination) { setRoute([]); return; }
    let live = true;
    const controller = new AbortController();
    fetch(`https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=false`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Route unavailable")))
      .then((data: { routes?: Array<{ geometry?: { coordinates?: [number, number][] } }> }) => {
        const coordinates = data.routes?.[0]?.geometry?.coordinates;
        if (live) setRoute(coordinates?.map(([lng, lat]) => ({ lat, lng })) || []);
      })
      .catch(() => { if (live) setRoute([]); });
    return () => { live = false; controller.abort(); };
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng]);

  const draw = () => {
    if (!map.current) return;
    import("leaflet").then(({ default: L }) => {
      const instance = map.current!;
      instance.eachLayer((layer) => { if (layer instanceof L.Marker || layer instanceof L.Polyline) instance.removeLayer(layer); });
      const current = props.current;
      const addMarker = (point: MapPoint | undefined, kind: "rider" | "passenger" | "destination" | "request", tooltip: string, draggable = false, moved?: (point: MapPoint) => void, click?: () => void) => {
        if (!point) return;
        const marker = L.marker(point, { draggable, icon: L.divIcon({ className: "motoya-map-marker", html: markerSvg(kind), iconSize: [38, 38], iconAnchor: [19, 19] }) }).addTo(instance).bindTooltip(tooltip);
        if (moved) marker.on("dragend", () => { const next = marker.getLatLng(); moved({ lat: next.lat, lng: next.lng }); });
        if (click) marker.on("click", click);
      };
      if (route.length > 1) L.polyline(route, { color: "#f97316", weight: 5, opacity: .9, lineJoin: "round" }).addTo(instance);
      else if (current.origin && current.destination) L.polyline([current.origin, current.destination], { color: "#f97316", weight: 4, dashArray: "7 9", opacity: .75 }).addTo(instance);
      addMarker(current.origin, "passenger", "Pasajero · punto de recogida", Boolean(current.onOriginMove), current.onOriginMove);
      addMarker(current.destination, "destination", "Destino", Boolean(current.onDestinationMove), current.onDestinationMove);
      addMarker(current.rider, "rider", "Rider · motocicleta");
      current.requests.forEach((request) => addMarker(request, "request", request.title, false, undefined, () => props.current.onRequestClick?.(request.id)));
      const key = routeKey(current.origin, current.destination);
      if (route.length > 1 && key && fittedRoute.current !== key) { instance.fitBounds(L.latLngBounds(route), { padding: [42, 42], maxZoom: 15 }); fittedRoute.current = key; }
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
  useEffect(() => { draw(); if (map.current && focus && route.length < 2) map.current.flyTo(focus, 15, { animate: true }); }, [origin, destination, rider, focus, requests, route, onOriginMove, onDestinationMove, onRequestClick]);
  return <div ref={host} className={`relative isolate z-0 h-72 w-full overflow-hidden rounded-2xl bg-slate-200 ${className || ""}`} aria-label="Mapa interactivo" />;
}
