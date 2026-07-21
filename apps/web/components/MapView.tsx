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
const closestRoutePoint = (points: MapPoint[], point?: MapPoint) => {
  if (!point || !points.length) return undefined;
  let index = 0;
  let distance = Number.POSITIVE_INFINITY;
  points.forEach((candidate, candidateIndex) => {
    const nextDistance = distanceMeters(candidate, point);
    if (nextDistance < distance) {
      index = candidateIndex;
      distance = nextDistance;
    }
  });
  return { point: points[index], index, distance };
};
// La tolerancia absorbe el margen normal del GPS urbano, sin ocultar un desvío
// real. La precisión reportada por el dispositivo sólo puede ampliarla dentro
// de un límite seguro para evitar "saltar" de una calle a otra.
const routeSnapTolerance = (point?: MapPoint) => Math.max(55, Math.min(170, 42 + (point?.accuracy || 0)));
const renderedPathPointLimit = 720;
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
  const observedTrail = useRef<MapPoint[]>([]);
  const observedTripKey = useRef("");
  const rerouteRequest = useRef<{ key: string; at: number; from?: MapPoint }>({ key: "", at: 0 });
  const fittedRoute = useRef("");
  const lastFocus = useRef("");
  const [route, setRoute] = useState<{ key: string; points: MapPoint[] }>({ key: "", points: [] });
  const [secondaryRoute, setSecondaryRoute] = useState<{ key: string; points: MapPoint[] }>({ key: "", points: [] });
  const [reroute, setReroute] = useState<{ key: string; points: MapPoint[] }>({ key: "", points: [] });
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState(false);
  const [routeUnavailable, setRouteUnavailable] = useState(false);
  const [theme, setTheme] = useState<MapTheme>("positron");
  const [focusLost, setFocusLost] = useState(false);
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const props = useRef({ origin, destination, rider, riderConnected, riderWithPassenger, routeFrom, routeTo, secondaryRouteFrom, secondaryRouteTo, traveledPath, startFlag, pickupFlag, focus, requests, onPick, onOriginMove, onDestinationMove, onOriginClick, onDestinationClick, onRequestClick });
  props.current = { origin, destination, rider, riderConnected, riderWithPassenger, routeFrom, routeTo, secondaryRouteFrom, secondaryRouteTo, traveledPath, startFlag, pickupFlag, focus, requests, onPick, onOriginMove, onDestinationMove, onOriginClick, onDestinationClick, onRequestClick };
  // La guía siempre comienza en el punto real de salida del viaje. El trazo
  // azul se construye aparte, únicamente con puntos GPS confirmados.
  const routeStart = riderWithPassenger ? origin : startFlag || traveledPath[0] || routeFrom || origin;
  const routeEnd = routeTo || destination;
  // Las rutas secundarias son guías explícitas. Nunca se reutilizan para
  // fabricar el recorrido ya realizado: eso pintaba en azul calles que el
  // rider no necesariamente había transitado.
  const nextRouteFrom = secondaryRouteFrom;
  const nextRouteTo = secondaryRouteTo;
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

  // Si el GPS se sale de la geometría planeada no sustituimos la ruta original:
  // la conservamos como referencia y solicitamos una alternativa por calles
  // desde la posición real del rider hasta el siguiente hito. Se limita a una
  // consulta cada 12 s o 45 m para respetar al proveedor de rutas y la batería.
  useEffect(() => {
    const liveRider = rider;
    const target = routeEnd;
    const closest = closestRoutePoint(renderedRoute, liveRider);
    const key = mainRouteKey;

    if (!liveRider || !target || renderedRoute.length < 2 || !key) {
      setReroute((current) => current.key ? { key: "", points: [] } : current);
      return;
    }

    if (!closest || closest.distance <= routeSnapTolerance(liveRider)) {
      setReroute((current) => current.key ? { key: "", points: [] } : current);
      return;
    }

    const now = Date.now();
    const previous = rerouteRequest.current;
    const riderMovedEnough = !previous.from || distanceMeters(previous.from, liveRider) >= 45;
    if (previous.key === key && !riderMovedEnough && now - previous.at < 12_000) return;

    rerouteRequest.current = { key, at: now, from: { ...liveRider } };
    let active = true;
    const controller = new AbortController();
    fetch(`https://router.project-osrm.org/route/v1/driving/${liveRider.lng},${liveRider.lat};${target.lng},${target.lat}?overview=full&geometries=geojson&steps=false`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Reroute unavailable")))
      .then((data: { routes?: Array<{ geometry?: { coordinates?: [number, number][] } }> }) => {
        const points = data.routes?.[0]?.geometry?.coordinates?.map(([lng, lat]) => ({ lat, lng })) || [];
        if (active) setReroute({ key, points });
      })
      .catch(() => {
        // La ruta original y el trazo GPS siguen disponibles aunque el proveedor
        // externo no pueda recalcular temporalmente.
        if (active) setReroute((current) => current.key === key ? { key: "", points: [] } : current);
      });
    return () => { active = false; controller.abort(); };
  }, [rider?.lat, rider?.lng, rider?.accuracy, routeEnd?.lat, routeEnd?.lng, mainRouteKey, renderedRoute]);

  const render = () => {
    const instance = map.current; const lib = runtime.current;
    if (!instance || !lib || !instance.isStyleLoaded()) return;
    markers.current.forEach((marker) => marker.remove()); markers.current = [];
    const current = props.current;
    const tripKey = current.origin && current.destination
      ? `${current.origin.lat.toFixed(5)},${current.origin.lng.toFixed(5)}:${current.destination.lat.toFixed(5)},${current.destination.lng.toFixed(5)}`
      : "";

    if (tripKey !== observedTripKey.current) {
      observedTripKey.current = tripKey;
      observedTrail.current = [];
    }

    // La cola local recupera la respuesta fluida de la versión anterior: el rider
    // se ve avanzar apenas llega un punto GPS/Socket, incluso antes del siguiente
    // refresco del viaje. Sólo se utiliza como una cola corta sobre el historial
    // persistido y se descarta al cambiar de viaje.
    if (current.rider && current.routeFrom && current.routeTo) {
      const previous = observedTrail.current.at(-1);
      if (!previous || distanceMeters(previous, current.rider) >= 3) {
        observedTrail.current = [...observedTrail.current, current.rider].slice(-120);
      }
    }

    const persistedTrail = current.traveledPath
      .filter((point, index, trail) => index === 0 || distanceMeters(trail[index - 1], point) >= 2)
      .slice(-renderedPathPointLimit);
    const renderedTrail = (() => {
      if (!persistedTrail.length) return observedTrail.current;
      if (!observedTrail.current.length) return persistedTrail;

      const lastPersisted = persistedTrail.at(-1)!;
      const matchedObserved = observedTrail.current.findLastIndex((point) => distanceMeters(lastPersisted, point) < 12);
      // Tras volver a entrar no añadimos una línea artificial desde un histórico
      // viejo hasta el GPS actual. La cola se vuelve a poblar en el siguiente punto.
      const tail = matchedObserved >= 0
        ? observedTrail.current.slice(matchedObserved + 1)
        : distanceMeters(lastPersisted, observedTrail.current[0]) < 120
          ? observedTrail.current
          : [];

      return [...persistedTrail, ...tail].filter((point, index, trail) => index === 0 || distanceMeters(trail[index - 1], point) >= 3).slice(-renderedPathPointLimit);
    })();
    const plannedTo = current.routeTo || current.destination;
    const routeGoesToDestination = Boolean(plannedTo && current.destination && plannedTo.lat === current.destination.lat && plannedTo.lng === current.destination.lng);
    const routeGoesToPickup = Boolean(plannedTo && current.origin && plannedTo.lat === current.origin.lat && plannedTo.lng === current.origin.lng);
    // El marcador siempre usa el GPS más reciente. Si se sale de la ruta, el
    // avance real y el recálculo se dibujan aparte; así no falseamos el tramo
    // completado ni reemplazamos el recorrido original que ven ambos perfiles.
    const liveRider = current.rider || renderedTrail.at(-1);
    // El pasajero solo puede pasar a bordo por una transición confirmada por el
    // servidor (IN_PROGRESS). Nunca deducimos este estado por cercanía al
    // punto de recogida, por la ruta calculada ni por controles visibles: eso
    // hacía que la vista del cliente mostrara una recogida que el rider aún no
    // había confirmado.
    const riderWithPassenger = Boolean(current.riderWithPassenger);
    const reroutePoints = reroute.key === mainRouteKey ? reroute.points : [];
    const routeData = { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: renderedRoute.map((point) => [point.lng, point.lat]) } };
    const source = instance.getSource("motoya-route") as GeoJSONSource | undefined;
    if (source) source.setData(routeData);
    else {
      instance.addSource("motoya-route", { type: "geojson", data: routeData });
      instance.addLayer({ id: "motoya-route-glow", type: "line", source: "motoya-route", paint: { "line-color": "#c084fc", "line-width": 15, "line-opacity": .2, "line-blur": 5 } });
      instance.addLayer({ id: "motoya-route-casing", type: "line", source: "motoya-route", paint: { "line-color": "#6b21a8", "line-width": 9, "line-opacity": .72 } });
      instance.addLayer({ id: "motoya-route-line", type: "line", source: "motoya-route", paint: { "line-color": "#e9d5ff", "line-width": 4.5, "line-opacity": .98, "line-dasharray": [1.6, 1.15] } });
    }
    const secondaryTo = current.secondaryRouteTo;
    const secondaryData = { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: renderedSecondaryRoute.map((point) => [point.lng, point.lat]) } };
    const secondarySource = instance.getSource("motoya-secondary-route") as GeoJSONSource | undefined;
    if (secondarySource) secondarySource.setData(secondaryData);
    else {
      instance.addSource("motoya-secondary-route", { type: "geojson", data: secondaryData });
      instance.addLayer({ id: "motoya-secondary-route-glow", type: "line", source: "motoya-secondary-route", paint: { "line-color": "#fb923c", "line-width": 12, "line-opacity": .16, "line-blur": 4 } });
      instance.addLayer({ id: "motoya-secondary-route-line", type: "line", source: "motoya-secondary-route", paint: { "line-color": "#fdba74", "line-width": 3.5, "line-opacity": .9, "line-dasharray": [1.25, 1.2] } });
    }
    if (instance.getLayer("motoya-secondary-route-glow")) instance.setPaintProperty("motoya-secondary-route-glow", "line-color", "#fb923c");
    if (instance.getLayer("motoya-secondary-route-line")) {
      instance.setPaintProperty("motoya-secondary-route-line", "line-color", "#fdba74");
      instance.setPaintProperty("motoya-secondary-route-line", "line-dasharray", [1.25, 1.2]);
    }
    // El azul es la bitácora GPS real, no el "progreso" inferido sobre una ruta
    // sugerida. Así, si el rider toma otro camino, se dibuja exactamente ese
    // camino y ninguna calle de la guía se marca como completada.
    const traveledData = { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: renderedTrail.map((point) => [point.lng, point.lat]) } };
    const traveledSource = instance.getSource("motoya-traveled-route") as GeoJSONSource | undefined;
    if (traveledSource) traveledSource.setData(traveledData);
    else {
      instance.addSource("motoya-traveled-route", { type: "geojson", data: traveledData });
      instance.addLayer({ id: "motoya-traveled-route-shadow", type: "line", source: "motoya-traveled-route", paint: { "line-color": "#2563eb", "line-width": 16, "line-opacity": .26, "line-blur": 5 } });
      instance.addLayer({ id: "motoya-traveled-route-casing", type: "line", source: "motoya-traveled-route", paint: { "line-color": "#1d4ed8", "line-width": 10, "line-opacity": .95 } });
      instance.addLayer({ id: "motoya-traveled-route-line", type: "line", source: "motoya-traveled-route", paint: { "line-color": "#38bdf8", "line-width": 5, "line-opacity": 1 } });
      instance.addLayer({ id: "motoya-traveled-route-highlight", type: "line", source: "motoya-traveled-route", paint: { "line-color": "#eff6ff", "line-width": 1.4, "line-opacity": .86 } });
    }
    // La instancia de MapLibre puede sobrevivir a una actualizaciÃ³n del
    // frontend. Reaplicamos el diseÃ±o del avance para reemplazar cualquier
    // capa verde heredada por el mismo azul continuo del trayecto actual.
    if (instance.getLayer("motoya-traveled-route-shadow")) instance.setPaintProperty("motoya-traveled-route-shadow", "line-color", "#2563eb");
    if (instance.getLayer("motoya-traveled-route-casing")) instance.setPaintProperty("motoya-traveled-route-casing", "line-color", "#1d4ed8");
    if (instance.getLayer("motoya-traveled-route-line")) {
      instance.setPaintProperty("motoya-traveled-route-line", "line-color", "#38bdf8");
      instance.setPaintProperty("motoya-traveled-route-line", "line-dasharray", [1, .01]);
    }
    if (instance.getLayer("motoya-traveled-route-highlight")) instance.setPaintProperty("motoya-traveled-route-highlight", "line-color", "#eff6ff");
    // El desvío ya forma parte del azul real. Se vacía y se oculta la capa
    // naranja heredada para no duplicar ni confundir el recorrido.
    const offRouteData = { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: [] as [number, number][] } };
    const offRouteSource = instance.getSource("motoya-off-route-trail") as GeoJSONSource | undefined;
    if (offRouteSource) offRouteSource.setData(offRouteData);
    else {
      instance.addSource("motoya-off-route-trail", { type: "geojson", data: offRouteData });
      instance.addLayer({ id: "motoya-off-route-trail-glow", type: "line", source: "motoya-off-route-trail", paint: { "line-color": "#f97316", "line-width": 14, "line-opacity": .2, "line-blur": 5 } });
      instance.addLayer({ id: "motoya-off-route-trail-line", type: "line", source: "motoya-off-route-trail", paint: { "line-color": "#fb923c", "line-width": 4.5, "line-opacity": .98, "line-dasharray": [1.1, .72] } });
    }
    if (instance.getLayer("motoya-off-route-trail-glow")) instance.setLayoutProperty("motoya-off-route-trail-glow", "visibility", "none");
    if (instance.getLayer("motoya-off-route-trail-line")) instance.setLayoutProperty("motoya-off-route-trail-line", "visibility", "none");
    const rerouteData = { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: reroutePoints.map((point) => [point.lng, point.lat]) } };
    const rerouteSource = instance.getSource("motoya-reroute-route") as GeoJSONSource | undefined;
    if (rerouteSource) rerouteSource.setData(rerouteData);
    else {
      instance.addSource("motoya-reroute-route", { type: "geojson", data: rerouteData });
      instance.addLayer({ id: "motoya-reroute-route-glow", type: "line", source: "motoya-reroute-route", paint: { "line-color": "#06b6d4", "line-width": 15, "line-opacity": .18, "line-blur": 5 } });
      instance.addLayer({ id: "motoya-reroute-route-line", type: "line", source: "motoya-reroute-route", paint: { "line-color": "#22d3ee", "line-width": 4.5, "line-opacity": .95, "line-dasharray": [1.25, .82] } });
    }
    const addMarker = (point: MapPoint | undefined, kind: "rider" | "riderWithPassenger" | "passenger" | "destination" | "start" | "pickup" | "request", draggable: boolean, tooltip: string, moved?: (point: MapPoint) => void, clicked?: () => void, emphasized = false, offset?: [number, number]) => {
      if (!point) return;
      const element = document.createElement("button"); element.type = "button"; element.className = `motoya-map-marker${clicked ? " motoya-action-marker" : ""}${emphasized ? " motoya-target-marker" : ""}${kind === "request" ? " motoya-request-marker" : ""}`; element.style.zIndex = emphasized || kind === "request" ? "7" : kind === "rider" || kind === "riderWithPassenger" ? "5" : "3"; element.setAttribute("aria-label", tooltip); element.innerHTML = markerSvg(kind, point.heading, current.riderConnected);
      if (clicked) {
        // MapLibre escucha los gestos del contenedor. Detenemos el gesto sobre
        // el hito y atendemos pointerup además de click para que un toque en
        // Android no se convierta en un arrastre silencioso del mapa.
        let lastActivation = 0;
        const activate = (event: Event) => {
          const now = Date.now();
          if (now - lastActivation < 450) return;
          lastActivation = now;
          event.preventDefault();
          event.stopPropagation();
          clicked();
        };
        element.style.pointerEvents = "auto";
        element.addEventListener("pointerdown", (event) => event.stopPropagation());
        element.addEventListener("pointerup", activate);
        element.addEventListener("click", activate);
      }
      const marker = new lib.Marker({ element, draggable, anchor: "center", offset }).setLngLat([point.lng, point.lat]).addTo(instance);
      if (moved) marker.on("dragend", () => { const next = marker.getLngLat(); moved({ lat: next.lat, lng: next.lng }); });
      markers.current.push(marker);
    };
    // En el punto de recogida el GPS del rider puede quedar a 1–2 m del
    // pasajero. Desplazamos solo la representación visual del pasajero para
    // que se vean claramente dos personas distintas; su coordenada real y la
    // regla de recogida en el servidor no se alteran.
    const separatePassengerMarker = !riderWithPassenger && distanceMeters(liveRider, current.origin) <= 25;
    if (!riderWithPassenger) addMarker(current.origin, "passenger", Boolean(current.onOriginMove), current.onOriginClick ? "Confirmar llegada al pasajero" : "Pasajero · punto de recogida", current.onOriginMove, current.onOriginClick, routeGoesToPickup, separatePassengerMarker ? [26, -18] : undefined);
    addMarker(current.startFlag || renderedTrail[0], "start", false, "Salida del rider");
    if (current.pickupFlag || riderWithPassenger) addMarker(current.pickupFlag || current.origin, "pickup", false, "Pasajero recogido");
    addMarker(current.destination, "destination", Boolean(current.onDestinationMove), current.onDestinationClick ? "Iniciar viaje hacia el destino" : "Destino", current.onDestinationMove, current.onDestinationClick, routeGoesToDestination);
    addMarker(liveRider, riderWithPassenger ? "riderWithPassenger" : "rider", false, riderWithPassenger ? "Rider con pasajero" : "Rider · motocicleta");
    current.requests.forEach((request) => addMarker(request, "request", false, request.title, undefined, () => props.current.onRequestClick?.(request.id)));
    const visibleRoute = [...renderedRoute, ...renderedSecondaryRoute, ...reroutePoints, ...renderedTrail];
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
  }, [origin, destination, rider, riderWithPassenger, routeFrom, routeTo, secondaryRouteFrom, secondaryRouteTo, traveledPath, startFlag, pickupFlag, focus, recenterVersion, requests, route, secondaryRoute, reroute, onOriginMove, onDestinationMove, onOriginClick, onDestinationClick, onRequestClick]);
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
  const changeZoom = (amount: number) => {
    if (!map.current) return;
    map.current.easeTo({ zoom: Math.max(2, Math.min(20, map.current.getZoom() + amount)), duration: 180 });
  };
  const resetMapBearing = () => map.current?.easeTo({ bearing: 0, pitch: 0, duration: 220 });

  return <div data-theme={theme} className={`map-view relative isolate z-0 h-72 w-full overflow-hidden rounded-2xl bg-slate-200 ${className || ""}`}>
    <div ref={host} className="map-view__canvas" aria-label="Mapa interactivo" />
    <div className="map-action-controls" aria-label="Controles de mapa">
      <button type="button" className="map-theme-toggle" data-theme={theme} onClick={switchTheme} aria-label="Cambiar tema del mapa" title={theme === "positron" ? "Mapa con más color" : theme === "voyager" ? "Mapa oscuro" : "Mapa claro"}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Zm-8 9 8 4.5 8-4.5M4 16.5 12 21l8-4.5" /></svg></button>
      {(focusLost || showFocusControl) && <button type="button" className="map-focus-control" onClick={focusMap} aria-label="Centrar el foco del mapa" title="Centrar mapa"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></svg></button>}
    </div>
    <div className="map-navigation-controls" aria-label="Navegación del mapa">
      <button type="button" onClick={() => changeZoom(1)} aria-label="Acercar mapa" title="Acercar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></button>
      <button type="button" onClick={() => changeZoom(-1)} aria-label="Alejar mapa" title="Alejar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /></svg></button>
      <button type="button" className="map-bearing-control" onClick={resetMapBearing} aria-label="Restablecer orientación del mapa" title="Restablecer orientación"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 4.5 12-4.5 6-4.5-6L12 3Z" /><path d="m12 3 4.5 12L12 15V3Z" /></svg></button>
    </div>
    {loading && <div className="map-state map-state--loading" role="status"><i /><span>Cargando mapa…</span></div>}
    {routeUnavailable && !loading && <div className="map-state map-state--route" role="status">No pudimos trazar la ruta. Puedes ajustar los puntos o continuar con la estimación.</div>}
    {mapError && <div className="map-state map-state--error" role="alert"><b>No pudimos cargar el mapa.</b><span>Comprueba tu conexión e inténtalo nuevamente.</span><button type="button" onClick={retryMap}>Reintentar</button></div>}
  </div>;
}
