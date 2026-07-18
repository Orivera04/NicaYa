"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import { getMapTileUrls, MAP_TILE_CONFIG } from "@/config/map.config";

export type MapPoint = { lat: number; lng: number; label?: string };
type RequestMarker = MapPoint & { id: string; title: string; subtitle?: string };
type Props = { origin?: MapPoint; destination?: MapPoint; rider?: MapPoint; riderWithPassenger?: boolean; routeFrom?: MapPoint; routeTo?: MapPoint; secondaryRouteFrom?: MapPoint; secondaryRouteTo?: MapPoint; focus?: MapPoint; recenterVersion?: number; requests?: RequestMarker[]; onPick?: (point: MapPoint) => void; onOriginMove?: (point: MapPoint) => void; onDestinationMove?: (point: MapPoint) => void; onOriginClick?: () => void; onDestinationClick?: () => void; onRequestClick?: (id: string) => void; className?: string };
type Runtime = typeof import("maplibre-gl");

const createMapStyle = (devicePixelRatio = 1): StyleSpecification => ({
  version: 8,
  sources: { "carto-positron": { type: "raster", tiles: getMapTileUrls(MAP_TILE_CONFIG, devicePixelRatio), tileSize: 256, attribution: MAP_TILE_CONFIG.attribution, maxzoom: MAP_TILE_CONFIG.maxZoom } },
  layers: [{ id: "carto-positron", type: "raster", source: "carto-positron", minzoom: 0, maxzoom: MAP_TILE_CONFIG.maxZoom }],
});
const routeKey = (origin?: MapPoint, destination?: MapPoint) => origin && destination ? `${origin.lat.toFixed(5)},${origin.lng.toFixed(5)}:${destination.lat.toFixed(5)},${destination.lng.toFixed(5)}` : "";
const distanceMeters = (left?: MapPoint, right?: MapPoint) => {
  if (!left || !right) return Number.POSITIVE_INFINITY;
  const latitude = (left.lat + right.lat) / 2 * Math.PI / 180;
  const latitudeDistance = (right.lat - left.lat) * 111_320;
  const longitudeDistance = (right.lng - left.lng) * 111_320 * Math.cos(latitude);
  return Math.hypot(latitudeDistance, longitudeDistance);
};
const markerSvg = (kind: "rider" | "riderWithPassenger" | "passenger" | "destination" | "request") => {
  const color = kind === "rider" || kind === "riderWithPassenger" ? "#2563eb" : kind === "passenger" ? "#a855f7" : kind === "destination" ? "#f97316" : "#7c3aed";
  const shape = kind === "rider" || kind === "riderWithPassenger" ? '<path d="M5 16h14l-2.2-4H9l-4 4m4-4 1.2-3h3.6l2 3M7.2 16a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Zm10 0a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4ZM13 7h2"/>' : kind === "passenger" ? '<circle cx="12" cy="8" r="3"/><path d="M5.5 20c.7-3.5 3-5 6.5-5s5.8 1.5 6.5 5"/>' : kind === "destination" ? '<path d="M7 3v18M8 4h10l-2.4 4L18 12H8"/>' : '<path d="M12 21s7-5.3 7-12a7 7 0 1 0-14 0c0 6.7 7 12 7 12Z"/><circle cx="12" cy="9" r="2"/>';
  return `<span class="motoya-map-icon${kind === "riderWithPassenger" ? " motoya-rider-passenger" : ""}" style="background:${color}"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${shape}</svg>${kind === "riderWithPassenger" ? '<span class="motoya-passenger-badge"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><circle cx="12" cy="8" r="3"/><path d="M5.5 20c.7-3.5 3-5 6.5-5s5.8 1.5 6.5 5"/></svg></span>' : ""}</span>`;
};

export function MapView({ origin, destination, rider, riderWithPassenger = false, routeFrom, routeTo, secondaryRouteFrom, secondaryRouteTo, focus, recenterVersion = 0, requests = [], onPick, onOriginMove, onDestinationMove, onOriginClick, onDestinationClick, onRequestClick, className }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const runtime = useRef<Runtime | null>(null);
  const markers = useRef<Array<{ remove: () => void }>>([]);
  const fittedRoute = useRef("");
  const lastFocus = useRef("");
  const [route, setRoute] = useState<MapPoint[]>([]);
  const [secondaryRoute, setSecondaryRoute] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState(false);
  const [routeUnavailable, setRouteUnavailable] = useState(false);
  const props = useRef({ origin, destination, rider, riderWithPassenger, routeFrom, routeTo, secondaryRouteFrom, secondaryRouteTo, requests, onPick, onOriginMove, onDestinationMove, onOriginClick, onDestinationClick, onRequestClick });
  props.current = { origin, destination, rider, riderWithPassenger, routeFrom, routeTo, secondaryRouteFrom, secondaryRouteTo, requests, onPick, onOriginMove, onDestinationMove, onOriginClick, onDestinationClick, onRequestClick };
  const pickupLeg = routeFrom && routeTo && origin && destination && routeTo.lat === origin.lat && routeTo.lng === origin.lng;
  const nextRouteFrom = secondaryRouteFrom || (pickupLeg ? origin : undefined);
  const nextRouteTo = secondaryRouteTo || (pickupLeg ? destination : undefined);

  useEffect(() => {
    const from = routeFrom || origin; const to = routeTo || destination;
    const key = routeKey(from, to);
    if (!key || !from || !to) { setRoute([]); setRouteUnavailable(false); return; }
    let live = true; const controller = new AbortController();
    fetch(`https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=false`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Route unavailable")))
      .then((data: { routes?: Array<{ geometry?: { coordinates?: [number, number][] } }> }) => { const points = data.routes?.[0]?.geometry?.coordinates?.map(([lng, lat]) => ({ lat, lng })) || []; if (live) { setRoute(points); setRouteUnavailable(points.length < 2); } })
      .catch(() => { if (live) { setRoute([]); setRouteUnavailable(true); } });
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
    const routeGoesToDestination = Boolean(current.routeTo && current.destination && current.routeTo.lat === current.destination.lat && current.routeTo.lng === current.destination.lng);
    const riderNearPickup = distanceMeters(current.rider, current.origin) <= 80;
    const riderWithPassenger = current.riderWithPassenger || routeGoesToDestination || Boolean(current.onDestinationClick) || (riderNearPickup && !current.onOriginClick);
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
    const addMarker = (point: MapPoint | undefined, kind: "rider" | "riderWithPassenger" | "passenger" | "destination" | "request", draggable: boolean, tooltip: string, moved?: (point: MapPoint) => void, clicked?: () => void) => {
      if (!point) return;
      const element = document.createElement("button"); element.type = "button"; element.className = `motoya-map-marker${clicked ? " motoya-action-marker" : ""}`; element.setAttribute("aria-label", tooltip); element.innerHTML = markerSvg(kind);
      if (clicked) element.addEventListener("click", clicked);
      const marker = new lib.Marker({ element, draggable, anchor: "center" }).setLngLat([point.lng, point.lat]).addTo(instance);
      if (moved) marker.on("dragend", () => { const next = marker.getLngLat(); moved({ lat: next.lat, lng: next.lng }); });
      markers.current.push(marker);
    };
    if (!riderWithPassenger) addMarker(current.origin, "passenger", Boolean(current.onOriginMove), current.onOriginClick ? "Confirmar llegada al pasajero" : "Pasajero · punto de recogida", current.onOriginMove, current.onOriginClick);
    addMarker(current.destination, "destination", Boolean(current.onDestinationMove), current.onDestinationClick ? "Iniciar viaje hacia el destino" : "Destino", current.onDestinationMove, current.onDestinationClick);
    addMarker(current.rider, riderWithPassenger ? "riderWithPassenger" : "rider", false, riderWithPassenger ? "Rider con pasajero" : "Rider · motocicleta");
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
      const mapStyle = createMapStyle(window.devicePixelRatio);
      const instance = new lib.Map({ container: host.current, style: mapStyle, center: [center.lng, center.lat], zoom: 13, dragRotate: true, pitchWithRotate: false, touchZoomRotate: true });
      instance.addControl(new lib.NavigationControl({ showCompass: true, showZoom: true, visualizePitch: false }), "bottom-right");
      instance.on("click", (event) => props.current.onPick?.({ lat: event.lngLat.lat, lng: event.lngLat.lng, label: "Ubicación seleccionada" }));
      const ready = () => { setLoading(false); setMapError(false); render(); };
      instance.on("load", ready);
      instance.on("style.load", ready);
      instance.on("error", (event) => { if ((event as { sourceId?: string }).sourceId === "carto-positron") { setLoading(false); setMapError(true); } });
      map.current = instance;
    }).catch(() => { if (active) { setLoading(false); setMapError(true); } });
    return () => { active = false; markers.current.forEach((marker) => marker.remove()); markers.current = []; map.current?.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    render();
    const key = focus ? `${focus.lat.toFixed(6)},${focus.lng.toFixed(6)}:${recenterVersion}` : "";
    if (map.current && focus && (route.length < 2 || recenterVersion > 0) && key !== lastFocus.current) { map.current.flyTo({ center: [focus.lng, focus.lat], zoom: 15, essential: true }); lastFocus.current = key; }
  }, [origin, destination, rider, riderWithPassenger, routeFrom, routeTo, secondaryRouteFrom, secondaryRouteTo, focus, recenterVersion, requests, route, secondaryRoute, onOriginMove, onDestinationMove, onOriginClick, onDestinationClick, onRequestClick]);
  const retryMap = () => {
    if (!map.current) return;
    setLoading(true);
    setMapError(false);
    map.current.setStyle(createMapStyle(window.devicePixelRatio));
  };

  return <div className={`relative isolate z-0 h-72 w-full overflow-hidden rounded-2xl bg-slate-200 ${className || ""}`}>
    <div ref={host} className="map-view__canvas" aria-label="Mapa interactivo" />
    {loading && <div className="map-state map-state--loading" role="status"><i /><span>Cargando mapa…</span></div>}
    {routeUnavailable && !loading && <div className="map-state map-state--route" role="status">No pudimos trazar la ruta. Puedes ajustar los puntos o continuar con la estimación.</div>}
    {mapError && <div className="map-state map-state--error" role="alert"><b>No pudimos cargar el mapa.</b><span>Comprueba tu conexión e inténtalo nuevamente.</span><button type="button" onClick={retryMap}>Reintentar</button></div>}
  </div>;
}
