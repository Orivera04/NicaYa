"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import { getMapTileUrls, MAP_TILE_THEMES, type MapTheme } from "@/config/map.config";
import { getSession } from "@/lib/api";

export type MapPoint = { lat: number; lng: number; label?: string; heading?: number; accuracy?: number };
type RequestMarker = MapPoint & { id: string; title: string; subtitle?: string };
type FitPadding = { top: number; right: number; bottom: number; left: number };
type Props = { origin?: MapPoint; destination?: MapPoint; rider?: MapPoint; riderConnected?: boolean; riderWithPassenger?: boolean; routeFrom?: MapPoint; routeTo?: MapPoint; secondaryRouteFrom?: MapPoint; secondaryRouteTo?: MapPoint; traveledPath?: MapPoint[]; startFlag?: MapPoint; pickupFlag?: MapPoint; focus?: MapPoint; recenterVersion?: number; requests?: RequestMarker[]; fitPadding?: FitPadding; onPick?: (point: MapPoint) => void; onOriginMove?: (point: MapPoint) => void; onDestinationMove?: (point: MapPoint) => void; onOriginClick?: () => void; onDestinationClick?: () => void; onRequestClick?: (id: string) => void; showFocusControl?: boolean; className?: string };
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
const markerSvg = (kind: "rider" | "riderWithPassenger" | "passenger" | "destination" | "start" | "pickup" | "request", heading?: number, riderConnected = false) => {
  const color = kind === "rider" || kind === "riderWithPassenger" ? "#2563eb" : kind === "passenger" ? "#a855f7" : kind === "destination" ? "#f97316" : kind === "start" ? "#0f766e" : kind === "pickup" ? "#16a34a" : "#7c3aed";
  const isRider = kind === "rider" || kind === "riderWithPassenger";
  const isFlag = kind === "destination" || kind === "start" || kind === "pickup";
  const shape = isRider
    ? '<path d="M4 16.7h2.5l2.2-5.2h5.8l3 5.2H20"/><circle cx="6" cy="17.5" r="2.2"/><circle cx="18" cy="17.5" r="2.2"/><path d="m10.3 11.5-1.8-2.7h3.7l2.2 2.7m-1.6-2.7 2.7-2.5M11 14h4.5"/>'
    : kind === "passenger" ? '<circle cx="12" cy="8.3" r="3.2"/><path d="M5.2 20.1c.8-3.6 3.2-5.3 6.8-5.3s6 1.7 6.8 5.3"/><path d="M8 3.6c1.2-.8 2.5-1.2 4-1.2s2.8.4 4 1.2"/>'
    : isFlag ? '<path d="M6.4 21V3.2M7.4 4h10.3l-2.5 3.7 2.5 3.7H7.4"/>'
    : '<path d="M12 21.2s7.1-5.5 7.1-12.1a7.1 7.1 0 1 0-14.2 0c0 6.6 7.1 12.1 7.1 12.1Z"/><circle cx="12" cy="9" r="2.2"/>';
  const direction = "";
  const liveState = riderConnected && isRider ? '<span class="motoya-live-state" aria-hidden="true"></span>' : "";
  const classes = `motoya-map-icon motoya-marker--${kind}${isRider ? " motoya-rider-marker" : ""}${kind === "passenger" ? " motoya-passenger-marker" : ""}${kind === "destination" ? " motoya-destination-marker" : ""}${kind === "start" ? " motoya-start-marker" : ""}${kind === "pickup" ? " motoya-pickup-marker" : ""}${kind === "riderWithPassenger" ? " motoya-rider-passenger" : ""}${riderConnected && isRider ? " motoya-rider-live" : ""}`;
  return `<span class="${classes}" style="background:${color}">${direction}<span class="motoya-marker-glow"></span><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${shape}</svg>${liveState}${kind === "riderWithPassenger" ? '<span class="motoya-passenger-badge"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><circle cx="12" cy="8" r="3"/><path d="M5.5 20c.7-3.5 3-5 6.5-5s5.8 1.5 6.5 5"/></svg></span>' : ""}${isFlag ? `<span class="motoya-flag-caption">${kind === "start" ? "Salida" : kind === "pickup" ? "Recogida" : "Destino"}</span>` : ""}</span>`;
};

export function MapView({ origin, destination, rider, riderConnected = false, riderWithPassenger = false, routeFrom, routeTo, secondaryRouteFrom, secondaryRouteTo, traveledPath = [], startFlag, pickupFlag, focus, recenterVersion = 0, requests = [], fitPadding, onPick, onOriginMove, onDestinationMove, onOriginClick, onDestinationClick, onRequestClick, showFocusControl = false, className }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const runtime = useRef<Runtime | null>(null);
  const markers = useRef<Array<{ remove: () => void }>>([]);
  const fittedRoute = useRef("");
  const lastFocus = useRef("");
  const [route, setRoute] = useState<{ key: string; points: MapPoint[] }>({ key: "", points: [] });
  const [secondaryRoute, setSecondaryRoute] = useState<{ key: string; points: MapPoint[] }>({ key: "", points: [] });
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState(false);
  const [routeUnavailable, setRouteUnavailable] = useState(false);
  const [theme, setTheme] = useState<MapTheme>("positron");
  const [focusLost, setFocusLost] = useState(false);
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const props = useRef({ origin, destination, rider, riderConnected, riderWithPassenger, routeFrom, routeTo, secondaryRouteFrom, secondaryRouteTo, traveledPath, startFlag, pickupFlag, focus, requests, onPick, onOriginMove, onDestinationMove, onOriginClick, onDestinationClick, onRequestClick });
  props.current = { origin, destination, rider, riderConnected, riderWithPassenger, routeFrom, routeTo, secondaryRouteFrom, secondaryRouteTo, traveledPath, startFlag, pickupFlag, focus, requests, onPick, onOriginMove, onDestinationMove, onOriginClick, onDestinationClick, onRequestClick };
  const routeStart = riderWithPassenger ? origin : traveledPath[0] || routeFrom || origin;
  const routeEnd = routeTo || destination;
  const pickupLeg = routeStart && routeEnd && origin && destination && routeEnd.lat === origin.lat && routeEnd.lng === origin.lng;
  const nextRouteFrom = secondaryRouteFrom || (pickupLeg ? origin : undefined);
  const nextRouteTo = secondaryRouteTo || (pickupLeg ? destination : undefined);
  const mainRouteKey = routeKey(routeStart, routeEnd);
  const secondaryRouteKey = routeKey(nextRouteFrom, nextRouteTo);
  const renderedRoute = route.key === mainRouteKey ? route.points : [];
  const renderedSecondaryRoute = secondaryRoute.key === secondaryRouteKey ? secondaryRoute.points : [];

  useEffect(() => {
    const from = routeStart; const to = routeEnd;
    const key = routeKey(from, to);
    if (!key || !from || !to) { setRoute({ key: "", points: [] }); setRouteUnavailable(false); return; }
    let live = true; const controller = new AbortController();
    fetch(`https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=false`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Route unavailable")))
      .then((data: { routes?: Array<{ geometry?: { coordinates?: [number, number][] } }> }) => { const points = data.routes?.[0]?.geometry?.coordinates?.map(([lng, lat]) => ({ lat, lng })) || []; if (live) { setRoute({ key, points }); setRouteUnavailable(points.length < 2); } })
      .catch(() => { if (live) { setRoute({ key, points: [] }); setRouteUnavailable(true); } });
    return () => { live = false; controller.abort(); };
  }, [routeStart?.lat, routeStart?.lng, routeEnd?.lat, routeEnd?.lng]);

  useEffect(() => {
    const key = routeKey(nextRouteFrom, nextRouteTo);
    if (!key || !nextRouteFrom || !nextRouteTo) { setSecondaryRoute({ key: "", points: [] }); return; }
    let live = true; const controller = new AbortController();
    fetch(`https://router.project-osrm.org/route/v1/driving/${nextRouteFrom.lng},${nextRouteFrom.lat};${nextRouteTo.lng},${nextRouteTo.lat}?overview=full&geometries=geojson&steps=false`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Route unavailable")))
      .then((data: { routes?: Array<{ geometry?: { coordinates?: [number, number][] } }> }) => { const points = data.routes?.[0]?.geometry?.coordinates?.map(([lng, lat]) => ({ lat, lng })) || []; if (live) setSecondaryRoute({ key, points }); })
      .catch(() => { if (live) setSecondaryRoute({ key, points: [] }); });
    return () => { live = false; controller.abort(); };
  }, [nextRouteFrom?.lat, nextRouteFrom?.lng, nextRouteTo?.lat, nextRouteTo?.lng]);

  const render = () => {
    const instance = map.current; const lib = runtime.current;
    if (!instance || !lib || !instance.isStyleLoaded()) return;
    markers.current.forEach((marker) => marker.remove()); markers.current = [];
    const current = props.current;
    const renderedTrail = current.traveledPath.filter((point, index, trail) => index === 0 || distanceMeters(trail[index - 1], point) >= 2).slice(-120);
    const plannedFrom = current.riderWithPassenger ? current.origin : current.traveledPath[0] || current.routeFrom || current.origin;
    const plannedTo = current.routeTo || current.destination;
    const routeGoesToDestination = Boolean(plannedTo && current.destination && plannedTo.lat === current.destination.lat && plannedTo.lng === current.destination.lng);
    const routeGoesToPickup = Boolean(plannedTo && current.origin && plannedTo.lat === current.origin.lat && plannedTo.lng === current.origin.lng);
    const confirmedRider = renderedTrail.at(-1) || current.rider;
    const riderNearPickup = distanceMeters(confirmedRider, current.origin) <= 80;
    const riderWithPassenger = current.riderWithPassenger || routeGoesToDestination || Boolean(current.onDestinationClick) || (riderNearPickup && !current.onOriginClick);
    const routeData = { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: renderedRoute.map((point) => [point.lng, point.lat]) } };
    const source = instance.getSource("motoya-route") as GeoJSONSource | undefined;
    if (source) source.setData(routeData);
    else {
      instance.addSource("motoya-route", { type: "geojson", data: routeData });
      instance.addLayer({ id: "motoya-route-glow", type: "line", source: "motoya-route", paint: { "line-color": "#c084fc", "line-width": 15, "line-opacity": .2, "line-blur": 5 } });
      instance.addLayer({ id: "motoya-route-casing", type: "line", source: "motoya-route", paint: { "line-color": "#6b21a8", "line-width": 9, "line-opacity": .72 } });
      instance.addLayer({ id: "motoya-route-line", type: "line", source: "motoya-route", paint: { "line-color": "#e9d5ff", "line-width": 4.5, "line-opacity": .98, "line-dasharray": [1.6, 1.15] } });
    }
    const isPickupLeg = plannedFrom && plannedTo && current.origin && current.destination && plannedTo.lat === current.origin.lat && plannedTo.lng === current.origin.lng;
    const secondaryFrom = current.secondaryRouteFrom || (isPickupLeg ? current.origin : undefined); const secondaryTo = current.secondaryRouteTo || (isPickupLeg ? current.destination : undefined);
    const secondaryData = { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: renderedSecondaryRoute.map((point) => [point.lng, point.lat]) } };
    const secondarySource = instance.getSource("motoya-secondary-route") as GeoJSONSource | undefined;
    if (secondarySource) secondarySource.setData(secondaryData);
    else {
      instance.addSource("motoya-secondary-route", { type: "geojson", data: secondaryData });
      instance.addLayer({ id: "motoya-secondary-route-glow", type: "line", source: "motoya-secondary-route", paint: { "line-color": "#fb923c", "line-width": 12, "line-opacity": .16, "line-blur": 4 } });
      instance.addLayer({ id: "motoya-secondary-route-line", type: "line", source: "motoya-secondary-route", paint: { "line-color": "#fdba74", "line-width": 3.5, "line-opacity": .9, "line-dasharray": [1.25, 1.2] } });
    }
    const traveledData = { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: renderedTrail.map((point) => [point.lng, point.lat]) } };
    const traveledSource = instance.getSource("motoya-traveled-route") as GeoJSONSource | undefined;
    if (traveledSource) traveledSource.setData(traveledData);
    else {
      instance.addSource("motoya-traveled-route", { type: "geojson", data: traveledData });
      instance.addLayer({ id: "motoya-traveled-route-shadow", type: "line", source: "motoya-traveled-route", paint: { "line-color": "#047857", "line-width": 14, "line-opacity": .28, "line-blur": 4 } });
      instance.addLayer({ id: "motoya-traveled-route-casing", type: "line", source: "motoya-traveled-route", paint: { "line-color": "#047857", "line-width": 9, "line-opacity": .9 } });
      instance.addLayer({ id: "motoya-traveled-route-line", type: "line", source: "motoya-traveled-route", paint: { "line-color": "#4ade80", "line-width": 5, "line-opacity": 1 } });
      instance.addLayer({ id: "motoya-traveled-route-highlight", type: "line", source: "motoya-traveled-route", paint: { "line-color": "#dcfce7", "line-width": 1.5, "line-opacity": .82 } });
    }
    const addMarker = (point: MapPoint | undefined, kind: "rider" | "riderWithPassenger" | "passenger" | "destination" | "start" | "pickup" | "request", draggable: boolean, tooltip: string, moved?: (point: MapPoint) => void, clicked?: () => void, emphasized = false) => {
      if (!point) return;
      const element = document.createElement("button"); element.type = "button"; element.className = `motoya-map-marker${clicked ? " motoya-action-marker" : ""}${emphasized ? " motoya-target-marker" : ""}${kind === "request" ? " motoya-request-marker" : ""}`; element.style.zIndex = emphasized || kind === "request" ? "7" : kind === "rider" || kind === "riderWithPassenger" ? "5" : "3"; element.setAttribute("aria-label", tooltip); element.innerHTML = markerSvg(kind, point.heading, current.riderConnected);
      if (clicked) element.addEventListener("click", clicked);
      const marker = new lib.Marker({ element, draggable, anchor: "center" }).setLngLat([point.lng, point.lat]).addTo(instance);
      if (moved) marker.on("dragend", () => { const next = marker.getLngLat(); moved({ lat: next.lat, lng: next.lng }); });
      markers.current.push(marker);
    };
    if (!riderWithPassenger) addMarker(current.origin, "passenger", Boolean(current.onOriginMove), current.onOriginClick ? "Confirmar llegada al pasajero" : "Pasajero · punto de recogida", current.onOriginMove, current.onOriginClick, routeGoesToPickup);
    addMarker(current.startFlag || renderedTrail[0], "start", false, "Salida del rider");
    if (current.pickupFlag || riderWithPassenger) addMarker(current.pickupFlag || current.origin, "pickup", false, "Pasajero recogido");
    addMarker(current.destination, "destination", Boolean(current.onDestinationMove), current.onDestinationClick ? "Iniciar viaje hacia el destino" : "Destino", current.onDestinationMove, current.onDestinationClick, routeGoesToDestination);
    addMarker(confirmedRider, riderWithPassenger ? "riderWithPassenger" : "rider", false, riderWithPassenger ? "Rider con pasajero" : "Rider · motocicleta");
    current.requests.forEach((request) => addMarker(request, "request", false, request.title, undefined, () => props.current.onRequestClick?.(request.id)));
    const visibleRoute = [...renderedRoute, ...renderedSecondaryRoute, ...renderedTrail];
    const key = `${plannedTo?.lat.toFixed(5) || ""},${plannedTo?.lng.toFixed(5) || ""}:${secondaryTo?.lat.toFixed(5) || ""},${secondaryTo?.lng.toFixed(5) || ""}`;
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
    if (map.current && focus && (renderedRoute.length < 2 || recenterVersion > 0) && key !== lastFocus.current) { map.current.flyTo({ center: [focus.lng, focus.lat], zoom: 15, essential: true }); lastFocus.current = key; }
  }, [origin, destination, rider, riderWithPassenger, routeFrom, routeTo, secondaryRouteFrom, secondaryRouteTo, traveledPath, startFlag, pickupFlag, focus, recenterVersion, requests, route, secondaryRoute, onOriginMove, onDestinationMove, onOriginClick, onDestinationClick, onRequestClick]);
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
