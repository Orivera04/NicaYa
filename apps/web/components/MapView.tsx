"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from "maplibre-gl";

export type MapPoint = { lat: number; lng: number; label?: string };
type RequestMarker = MapPoint & { id: string; title: string; subtitle?: string };
type Props = { origin?: MapPoint; destination?: MapPoint; rider?: MapPoint; routeFrom?: MapPoint; routeTo?: MapPoint; secondaryRouteFrom?: MapPoint; secondaryRouteTo?: MapPoint; focus?: MapPoint; recenterVersion?: number; requests?: RequestMarker[]; onPick?: (point: MapPoint) => void; onOriginMove?: (point: MapPoint) => void; onDestinationMove?: (point: MapPoint) => void; onRequestClick?: (id: string) => void; className?: string };
type Runtime = typeof import("maplibre-gl");

const mapStyle: StyleSpecification = {
  version: 8,
  sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap" } },
  layers: [{ id: "osm", type: "raster", source: "osm", minzoom: 0, maxzoom: 19 }],
};
const routeKey = (origin?: MapPoint, destination?: MapPoint) => origin && destination ? `${origin.lat.toFixed(5)},${origin.lng.toFixed(5)}:${destination.lat.toFixed(5)},${destination.lng.toFixed(5)}` : "";
const markerSvg = (kind: "rider" | "passenger" | "destination" | "request") => {
  const color = kind === "rider" ? "#2563eb" : kind === "passenger" ? "#a855f7" : kind === "destination" ? "#f97316" : "#7c3aed";
  const shape = kind === "rider" ? '<path d="M5 16h14l-2.2-4H9l-4 4m4-4 1.2-3h3.6l2 3M7.2 16a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Zm10 0a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4ZM13 7h2"/>' : kind === "passenger" ? '<circle cx="12" cy="8" r="3"/><path d="M5.5 20c.7-3.5 3-5 6.5-5s5.8 1.5 6.5 5"/>' : kind === "destination" ? '<path d="M7 3v18M8 4h10l-2.4 4L18 12H8"/>' : '<path d="M12 21s7-5.3 7-12a7 7 0 1 0-14 0c0 6.7 7 12 7 12Z"/><circle cx="12" cy="9" r="2"/>';
  return `<span class="motoya-map-icon" style="background:${color}"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${shape}</svg></span>`;
};

export function MapView({ origin, destination, rider, routeFrom, routeTo, secondaryRouteFrom, secondaryRouteTo, focus, recenterVersion = 0, requests = [], onPick, onOriginMove, onDestinationMove, onRequestClick, className }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const runtime = useRef<Runtime | null>(null);
  const markers = useRef<Array<{ remove: () => void }>>([]);
  const fittedRoute = useRef("");
  const lastFocus = useRef("");
  const [route, setRoute] = useState<MapPoint[]>([]);
  const [secondaryRoute, setSecondaryRoute] = useState<MapPoint[]>([]);
  const props = useRef({ origin, destination, rider, routeFrom, routeTo, secondaryRouteFrom, secondaryRouteTo, requests, onPick, onOriginMove, onDestinationMove, onRequestClick });
  props.current = { origin, destination, rider, routeFrom, routeTo, secondaryRouteFrom, secondaryRouteTo, requests, onPick, onOriginMove, onDestinationMove, onRequestClick };
  const pickupLeg = routeFrom && routeTo && origin && destination && routeTo.lat === origin.lat && routeTo.lng === origin.lng;
  const nextRouteFrom = secondaryRouteFrom || (pickupLeg ? origin : undefined);
  const nextRouteTo = secondaryRouteTo || (pickupLeg ? destination : undefined);

  useEffect(() => {
    const from = routeFrom || origin; const to = routeTo || destination;
    const key = routeKey(from, to);
    if (!key || !from || !to) { setRoute([]); return; }
    let live = true; const controller = new AbortController();
    fetch(`https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=false`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Route unavailable")))
      .then((data: { routes?: Array<{ geometry?: { coordinates?: [number, number][] } }> }) => { const points = data.routes?.[0]?.geometry?.coordinates?.map(([lng, lat]) => ({ lat, lng })) || []; if (live) setRoute(points); })
      .catch(() => { if (live) setRoute([]); });
    return () => { live = false; controller.abort(); };
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng, routeFrom?.lat, routeFrom?.lng, routeTo?.lat, routeTo?.lng]);

  useEffect(() => {
    const key = routeKey(nextRouteFrom, nextRouteTo);
    if (!key || !nextRouteFrom || !nextRouteTo) { setSecondaryRoute([]); return; }
    let live = true; const controller = new AbortController();
    fetch(`https://router.project-osrm.org/route/v1/driving/${nextRouteFrom.lng},${nextRouteFrom.lat};${nextRouteTo.lng},${nextRouteTo.lat}?overview=full&geometries=geojson&steps=false`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Route unavailable")))
      .then((data: { routes?: Array<{ geometry?: { coordinates?: [number, number][] } }> }) => { const points = data.routes?.[0]?.geometry?.coordinates?.map(([lng, lat]) => ({ lat, lng })) || []; if (live) setSecondaryRoute(points); })
      .catch(() => { if (live) setSecondaryRoute([]); });
    return () => { live = false; controller.abort(); };
  }, [nextRouteFrom?.lat, nextRouteFrom?.lng, nextRouteTo?.lat, nextRouteTo?.lng]);

  const render = () => {
    const instance = map.current; const lib = runtime.current;
    if (!instance || !lib || !instance.isStyleLoaded()) return;
    markers.current.forEach((marker) => marker.remove()); markers.current = [];
    const current = props.current;
    const from = current.routeFrom || current.origin; const to = current.routeTo || current.destination;
    const routeData = { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: (route.length > 1 ? route : from && to ? [from, to] : []).map((point) => [point.lng, point.lat]) } };
    const source = instance.getSource("motoya-route") as GeoJSONSource | undefined;
    if (source) source.setData(routeData);
    else { instance.addSource("motoya-route", { type: "geojson", data: routeData }); instance.addLayer({ id: "motoya-route-line", type: "line", source: "motoya-route", paint: { "line-color": "#f97316", "line-width": 5, "line-opacity": .92 } }); }
    const isPickupLeg = current.routeFrom && current.routeTo && current.origin && current.destination && current.routeTo.lat === current.origin.lat && current.routeTo.lng === current.origin.lng;
    const secondaryFrom = current.secondaryRouteFrom || (isPickupLeg ? current.origin : undefined); const secondaryTo = current.secondaryRouteTo || (isPickupLeg ? current.destination : undefined);
    const secondaryData = { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: (secondaryRoute.length > 1 ? secondaryRoute : secondaryFrom && secondaryTo ? [secondaryFrom, secondaryTo] : []).map((point) => [point.lng, point.lat]) } };
    const secondarySource = instance.getSource("motoya-secondary-route") as GeoJSONSource | undefined;
    if (secondarySource) secondarySource.setData(secondaryData);
    else { instance.addSource("motoya-secondary-route", { type: "geojson", data: secondaryData }); instance.addLayer({ id: "motoya-secondary-route-line", type: "line", source: "motoya-secondary-route", paint: { "line-color": "#a855f7", "line-width": 4, "line-opacity": .76, "line-dasharray": [2, 1.5] } }); }
    const addMarker = (point: MapPoint | undefined, kind: "rider" | "passenger" | "destination" | "request", draggable: boolean, tooltip: string, moved?: (point: MapPoint) => void, clicked?: () => void) => {
      if (!point) return;
      const element = document.createElement("button"); element.type = "button"; element.className = "motoya-map-marker"; element.setAttribute("aria-label", tooltip); element.innerHTML = markerSvg(kind);
      if (clicked) element.addEventListener("click", clicked);
      const marker = new lib.Marker({ element, draggable, anchor: "center" }).setLngLat([point.lng, point.lat]).addTo(instance);
      if (moved) marker.on("dragend", () => { const next = marker.getLngLat(); moved({ lat: next.lat, lng: next.lng }); });
      markers.current.push(marker);
    };
    addMarker(current.origin, "passenger", Boolean(current.onOriginMove), "Pasajero · punto de recogida", current.onOriginMove);
    addMarker(current.destination, "destination", Boolean(current.onDestinationMove), "Destino", current.onDestinationMove);
    addMarker(current.rider, "rider", false, "Rider · motocicleta");
    current.requests.forEach((request) => addMarker(request, "request", false, request.title, undefined, () => props.current.onRequestClick?.(request.id)));
    const visibleRoute = [...route, ...secondaryRoute];
    const key = `${to?.lat.toFixed(5) || ""},${to?.lng.toFixed(5) || ""}:${secondaryTo?.lat.toFixed(5) || ""},${secondaryTo?.lng.toFixed(5) || ""}`;
    if (visibleRoute.length > 1 && key && fittedRoute.current !== key) { const bounds = visibleRoute.reduce((currentBounds, point) => currentBounds.extend([point.lng, point.lat]), new lib.LngLatBounds([visibleRoute[0].lng, visibleRoute[0].lat], [visibleRoute[0].lng, visibleRoute[0].lat])); instance.fitBounds(bounds, { padding: 54, maxZoom: 15, duration: 700 }); fittedRoute.current = key; }
  };

  useEffect(() => {
    let active = true;
    import("maplibre-gl").then((lib) => {
      if (!host.current || !active) return;
      runtime.current = lib;
      const center = rider || origin || { lat: 12.1364, lng: -86.2514 };
      const instance = new lib.Map({ container: host.current, style: mapStyle, center: [center.lng, center.lat], zoom: 13, dragRotate: true, pitchWithRotate: false, touchZoomRotate: true });
      instance.addControl(new lib.NavigationControl({ showCompass: true, showZoom: true, visualizePitch: false }), "bottom-right");
      instance.on("click", (event) => props.current.onPick?.({ lat: event.lngLat.lat, lng: event.lngLat.lng, label: "Ubicación seleccionada" }));
      instance.on("load", render); map.current = instance;
    });
    return () => { active = false; markers.current.forEach((marker) => marker.remove()); markers.current = []; map.current?.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    render();
    const key = focus ? `${focus.lat.toFixed(6)},${focus.lng.toFixed(6)}:${recenterVersion}` : "";
    if (map.current && focus && (route.length < 2 || recenterVersion > 0) && key !== lastFocus.current) { map.current.flyTo({ center: [focus.lng, focus.lat], zoom: 15, essential: true }); lastFocus.current = key; }
  }, [origin, destination, rider, routeFrom, routeTo, secondaryRouteFrom, secondaryRouteTo, focus, recenterVersion, requests, route, secondaryRoute, onOriginMove, onDestinationMove, onRequestClick]);
  return <div ref={host} className={`relative isolate z-0 h-72 w-full overflow-hidden rounded-2xl bg-slate-200 ${className || ""}`} aria-label="Mapa interactivo" />;
}
