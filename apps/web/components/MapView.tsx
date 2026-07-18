"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import { getMapTileUrls, MAP_TILE_THEMES, type MapTheme } from "@/config/map.config";
import { getSession } from "@/lib/api";

export type MapPoint = { lat: number; lng: number; label?: string; heading?: number; accuracy?: number };
type RequestMarker = MapPoint & { id: string; title: string; subtitle?: string };
type FitPadding = { top: number; right: number; bottom: number; left: number };
type Props = { origin?: MapPoint; destination?: MapPoint; rider?: MapPoint; riderConnected?: boolean; riderWithPassenger?: boolean; routeFrom?: MapPoint; routeTo?: MapPoint; secondaryRouteFrom?: MapPoint; secondaryRouteTo?: MapPoint; focus?: MapPoint; recenterVersion?: number; requests?: RequestMarker[]; fitPadding?: FitPadding; onPick?: (point: MapPoint) => void; onOriginMove?: (point: MapPoint) => void; onDestinationMove?: (point: MapPoint) => void; onOriginClick?: () => void; onDestinationClick?: () => void; onRequestClick?: (id: string) => void; showFocusControl?: boolean; className?: string };
type Runtime = typeof import("maplibre-gl");

const createMapStyle = (theme: MapTheme, devicePixelRatio = 1): StyleSpecification => {
  const positron = MAP_TILE_THEMES.positron;
  const voyager = MAP_TILE_THEMES.voyager;
  const dark = MAP_TILE_THEMES.dark;
  return {
    version: 8,
    sources: {
      "motoya-base-positron": { type: "raster", tiles: getMapTileUrls(positron, devicePixelRatio), tileSize: 256, attribution: positron.attribution, maxzoom: positron.maxZoom },
      "motoya-base-voyager": { type: "raster", tiles: getMapTileUrls(voyager, devicePixelRatio), tileSize: 256, attribution: voyager.attribution, maxzoom: voyager.maxZoom },
      "motoya-base-dark": { type: "raster", tiles: getMapTileUrls(dark, devicePixelRatio), tileSize: 256, attribution: dark.attribution, maxzoom: dark.maxZoom },
    },
    layers: (Object.keys(MAP_TILE_THEMES) as MapTheme[]).map((name) => ({ id: `motoya-base-${name}`, type: "raster" as const, source: `motoya-base-${name}`, minzoom: 0, maxzoom: MAP_TILE_THEMES[name].maxZoom, layout: { visibility: name === theme ? "visible" as const : "none" as const } })),
  };
};
const applyMapTheme = (instance: MapLibreMap, theme: MapTheme) => {
  (Object.keys(MAP_TILE_THEMES) as MapTheme[]).forEach((name) => instance.setLayoutProperty(`motoya-base-${name}`, "visibility", name === theme ? "visible" : "none"));
};
const themeStorageKey = () => {
  const user = getSession()?.user;
  return user ? `motoya-map-theme:${user.role.toLowerCase()}:${user.id}` : "motoya-map-theme:guest";
};
const routeKey = (origin?: MapPoint, destination?: MapPoint) => origin && destination ? `${origin.lat.toFixed(5)},${origin.lng.toFixed(5)}:${destination.lat.toFixed(5)},${destination.lng.toFixed(5)}` : "";
const distanceMeters = (left?: MapPoint, right?: MapPoint) => {
  if (!left || !right) return Number.POSITIVE_INFINITY;
  const latitude = (left.lat + right.lat) / 2 * Math.PI / 180;
  const latitudeDistance = (right.lat - left.lat) * 111_320;
  const longitudeDistance = (right.lng - left.lng) * 111_320 * Math.cos(latitude);
  return Math.hypot(latitudeDistance, longitudeDistance);
};
const markerSvg = (kind: "rider" | "riderWithPassenger" | "passenger" | "destination" | "request", heading?: number, riderConnected = false) => {
  const color = kind === "rider" || kind === "riderWithPassenger" ? "#2563eb" : kind === "passenger" ? "#a855f7" : kind === "destination" ? "#f97316" : "#7c3aed";
  const shape = kind === "rider" || kind === "riderWithPassenger" ? '<circle cx="6.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/><path d="m6.5 17.5 4.2-7h3.6l3.2 7M10.7 10.5 9 8h4.3m.6 2.5 2.2-2.6M11 14h5.2"/>' : kind === "passenger" ? '<circle cx="12" cy="8" r="3"/><path d="M5.5 20c.7-3.5 3-5 6.5-5s5.8 1.5 6.5 5"/>' : kind === "destination" ? '<path d="M7 3v18M8 4h10l-2.4 4L18 12H8"/>' : '<path d="M12 21s7-5.3 7-12a7 7 0 1 0-14 0c0 6.7 7 12 7 12Z"/><circle cx="12" cy="9" r="2"/>';
  const direction = kind === "rider" || kind === "riderWithPassenger" ? `<span class="motoya-direction-beam" style="--heading:${Number.isFinite(heading) ? heading : 0}deg"></span>` : "";
  return `<span class="motoya-map-icon${kind === "rider" || kind === "riderWithPassenger" ? " motoya-rider-marker" : ""}${kind === "passenger" ? " motoya-passenger-marker" : ""}${kind === "riderWithPassenger" ? " motoya-rider-passenger" : ""}${riderConnected && (kind === "rider" || kind === "riderWithPassenger") ? " motoya-rider-live" : ""}" style="background:${color}">${direction}<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${shape}</svg>${kind === "riderWithPassenger" ? '<span class="motoya-passenger-badge"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><circle cx="12" cy="8" r="3"/><path d="M5.5 20c.7-3.5 3-5 6.5-5s5.8 1.5 6.5 5"/></svg></span>' : ""}</span>`;
};

export function MapView({ origin, destination, rider, riderConnected = false, riderWithPassenger = false, routeFrom, routeTo, secondaryRouteFrom, secondaryRouteTo, focus, recenterVersion = 0, requests = [], fitPadding, onPick, onOriginMove, onDestinationMove, onOriginClick, onDestinationClick, onRequestClick, showFocusControl = false, className }: Props) {
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
  const [theme, setTheme] = useState<MapTheme>("positron");
  const [focusLost, setFocusLost] = useState(false);
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const props = useRef({ origin, destination, rider, riderConnected, riderWithPassenger, routeFrom, routeTo, secondaryRouteFrom, secondaryRouteTo, focus, requests, onPick, onOriginMove, onDestinationMove, onOriginClick, onDestinationClick, onRequestClick });
  props.current = { origin, destination, rider, riderConnected, riderWithPassenger, routeFrom, routeTo, secondaryRouteFrom, secondaryRouteTo, focus, requests, onPick, onOriginMove, onDestinationMove, onOriginClick, onDestinationClick, onRequestClick };
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
      const element = document.createElement("button"); element.type = "button"; element.className = `motoya-map-marker${clicked ? " motoya-action-marker" : ""}`; element.setAttribute("aria-label", tooltip); element.innerHTML = markerSvg(kind, point.heading, current.riderConnected);
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
    const paddingKey = fitPadding ? `${fitPadding.top}:${fitPadding.right}:${fitPadding.bottom}:${fitPadding.left}` : "default";
    if (visibleRoute.length > 1 && key && fittedRoute.current !== `${key}:${paddingKey}`) { const bounds = visibleRoute.reduce((currentBounds, point) => currentBounds.extend([point.lng, point.lat]), new lib.LngLatBounds([visibleRoute[0].lng, visibleRoute[0].lat], [visibleRoute[0].lng, visibleRoute[0].lat])); instance.fitBounds(bounds, { padding: fitPadding || 54, maxZoom: 15, duration: 700 }); fittedRoute.current = `${key}:${paddingKey}`; }
  };

  useEffect(() => {
    let active = true;
    import("maplibre-gl").then((lib) => {
      if (!host.current || !active) return;
      runtime.current = lib;
      const center = rider || origin || { lat: 12.1364, lng: -86.2514 };
      const mapStyle = createMapStyle("positron", window.devicePixelRatio);
      const instance = new lib.Map({ container: host.current, style: mapStyle, center: [center.lng, center.lat], zoom: 13, dragRotate: true, pitchWithRotate: false, touchZoomRotate: true });
      instance.addControl(new lib.NavigationControl({ showCompass: true, showZoom: true, visualizePitch: false }), "bottom-right");
      instance.on("click", (event) => props.current.onPick?.({ lat: event.lngLat.lat, lng: event.lngLat.lng, label: "Ubicación seleccionada" }));
      const updateFocusVisibility = () => {
        const point = props.current.rider || props.current.focus || props.current.origin;
        if (!point) return setFocusLost(false);
        setFocusLost(!instance.getBounds().contains([point.lng, point.lat]));
      };
      const ready = () => { applyMapTheme(instance, themeRef.current); setLoading(false); setMapError(false); render(); updateFocusVisibility(); };
      instance.on("load", ready);
      instance.on("style.load", ready);
      instance.on("error", (event) => { if ((event as { sourceId?: string }).sourceId?.startsWith("motoya-base-")) { setLoading(false); setMapError(true); } });
      instance.on("moveend", updateFocusVisibility);
      map.current = instance;
    }).catch(() => { if (active) { setLoading(false); setMapError(true); } });
    return () => { active = false; markers.current.forEach((marker) => marker.remove()); markers.current = []; map.current?.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    const savedTheme = window.localStorage.getItem(themeStorageKey());
    if (savedTheme === "positron" || savedTheme === "voyager" || savedTheme === "dark") setTheme(savedTheme);
  }, []);
  useEffect(() => {
    if (map.current?.isStyleLoaded()) applyMapTheme(map.current, theme);
  }, [theme]);
  useEffect(() => {
    render();
    const key = focus ? `${focus.lat.toFixed(6)},${focus.lng.toFixed(6)}:${recenterVersion}` : "";
    if (map.current && focus && (route.length < 2 || recenterVersion > 0) && key !== lastFocus.current) { map.current.flyTo({ center: [focus.lng, focus.lat], zoom: 15, essential: true }); lastFocus.current = key; }
  }, [origin, destination, rider, riderWithPassenger, routeFrom, routeTo, secondaryRouteFrom, secondaryRouteTo, focus, recenterVersion, requests, route, secondaryRoute, onOriginMove, onDestinationMove, onOriginClick, onDestinationClick, onRequestClick]);
  const retryMap = () => {
    if (!map.current) return;
    setLoading(true);
    setMapError(false);
    map.current.setStyle(createMapStyle(theme, window.devicePixelRatio));
  };
  const switchTheme = () => {
    const nextTheme: MapTheme = theme === "positron" ? "voyager" : theme === "voyager" ? "dark" : "positron";
    window.localStorage.setItem(themeStorageKey(), nextTheme);
    setTheme(nextTheme);
  };
  const focusMap = () => {
    const point = rider || focus || origin || destination;
    if (!map.current || !point) return;
    map.current.flyTo({ center: [point.lng, point.lat], zoom: 15, essential: true });
    setFocusLost(false);
  };

  return <div data-theme={theme} className={`map-view relative isolate z-0 h-72 w-full overflow-hidden rounded-2xl bg-slate-200 ${className || ""}`}>
    <div ref={host} className="map-view__canvas" aria-label="Mapa interactivo" />
    <div className="map-action-controls" aria-label="Controles de mapa">
      <button type="button" className="map-theme-toggle" data-theme={theme} onClick={switchTheme} aria-label="Cambiar tema del mapa" title={theme === "positron" ? "Mapa con más color" : theme === "voyager" ? "Mapa oscuro" : "Mapa claro"}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Zm-8 9 8 4.5 8-4.5M4 16.5 12 21l8-4.5" /></svg></button>
      {(focusLost || showFocusControl) && <button type="button" className="map-focus-control" onClick={focusMap} aria-label="Centrar el foco del mapa" title="Centrar mapa"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></svg></button>}
    </div>
    {loading && <div className="map-state map-state--loading" role="status"><i /><span>Cargando mapa…</span></div>}
    {routeUnavailable && !loading && <div className="map-state map-state--route" role="status">No pudimos trazar la ruta. Puedes ajustar los puntos o continuar con la estimación.</div>}
    {mapError && <div className="map-state map-state--error" role="alert"><b>No pudimos cargar el mapa.</b><span>Comprueba tu conexión e inténtalo nuevamente.</span><button type="button" onClick={retryMap}>Reintentar</button></div>}
  </div>;
}
