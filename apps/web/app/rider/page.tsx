"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Guard } from "@/components/Guard";
import { MapPoint, MapView } from "@/components/MapView";
import { MobileAppShell } from "@/components/MobileAppShell";
import { api, getSession, type ApiError } from "@/lib/api";

type Profile = { available: boolean };
type RequestTrip = { id: string; originAddress: string; originLat: number; originLng: number; destinationAddress: string; destinationLat: number; destinationLng: number; estimatedPrice: string; proposedPrice?: string | null; currency: string; distanceKm: number; estimatedDurationMin: number; riderDistanceKm?: number };
type TripLocation = { lat: number; lng: number; accuracy?: number | null; heading?: number | null; createdAt: string };
type RecordedTripLocation = { tripId: string; lat: number; lng: number; accuracy?: number | null; heading?: number | null; recordedAt: string };
type ActiveTrip = RequestTrip & { status: "ACCEPTED" | "RIDER_ON_THE_WAY" | "RIDER_ARRIVED" | "IN_PROGRESS"; client?: { name: string }; riderLat?: number | null; riderLng?: number | null; riderAccuracy?: number | null; riderHeading?: number | null; riderLocationUpdatedAt?: string | null; locations?: TripLocation[]; startLocation?: TripLocation | null };
type Readiness = { ready: boolean; blockers: Array<{ code: string; message: string; action: string }>; workZone: { department: string } | null; subscription: { plan?: string; daysRemaining: number } | null; dailyQuota: { limit: number; completed: number; remaining: number; resetsAt: string } | null };

const defaultPosition = { lat: 12.1364, lng: -86.2514 };
const LOCATION_PUBLISH_INTERVAL_MS = 3_000;
const LOCATION_HEARTBEAT_MS = 10_000;
const renderedTripHistoryLimit = 720;
const PICKUP_RADIUS_METERS = 5;
const distanceToMeters = (left: MapPoint, right: { lat: number; lng: number }) => {
  const latitude = (left.lat + right.lat) / 2 * Math.PI / 180;
  const latitudeDistance = (right.lat - left.lat) * 111_320;
  const longitudeDistance = (right.lng - left.lng) * 111_320 * Math.cos(latitude);
  return Math.hypot(latitudeDistance, longitudeDistance);
};
const locationPayload = (point: MapPoint) => ({
  lat: point.lat,
  lng: point.lng,
  ...(Number.isFinite(point.accuracy) && (point.accuracy ?? 0) >= 0 && (point.accuracy ?? 0) <= 5_000 ? { accuracy: point.accuracy } : {}),
  ...(Number.isFinite(point.heading) && (point.heading ?? 0) >= 0 && (point.heading ?? 0) <= 360 ? { heading: point.heading } : {}),
});
const stages: Record<ActiveTrip["status"], { title: string; detail: string; action?: string; next?: string }> = {
  ACCEPTED: { title: "Ve a recoger al pasajero", detail: "Inicia la ruta hacia el marcador morado de recogida.", action: "Iniciar ruta al pasajero", next: "RIDER_ON_THE_WAY" },
  RIDER_ON_THE_WAY: { title: "Vas a recoger al pasajero", detail: "Al estar a menos de 5 m se habilitará el botón para llevar al pasajero.", action: "Recoger pasajero", next: "RIDER_ARRIVED" },
  RIDER_ARRIVED: { title: "Pasajero a bordo", detail: "Toca el marcador naranja de destino para iniciar el recorrido.", action: "Iniciar viaje al destino", next: "IN_PROGRESS" },
  IN_PROGRESS: { title: "Llevas al pasajero a su destino", detail: "Sigue la ruta indicada. El pasajero confirmará la llegada desde su aplicación." },
};

const money = (trip: Pick<RequestTrip, "currency" | "estimatedPrice" | "proposedPrice">) => `${trip.currency} ${trip.proposedPrice || trip.estimatedPrice}`;

const appendConfirmedLocation = (trip: ActiveTrip, location: RecordedTripLocation): ActiveTrip => {
  const locations = trip.locations || [];
  const last = locations.at(-1);
  const isDuplicate = last && Math.abs(last.lat - location.lat) < 0.000001 && Math.abs(last.lng - location.lng) < 0.000001;
  const nextPoint = { lat: location.lat, lng: location.lng, accuracy: location.accuracy, heading: location.heading, createdAt: location.recordedAt };
  // La bandera de salida llega separada desde la API. Aquí conservamos el
  // historial GPS reciente continuo, sin unir artificialmente inicio y final.
  const nextLocations = isDuplicate
    ? locations
    : locations.length >= renderedTripHistoryLimit
      ? [...locations.slice(-(renderedTripHistoryLimit - 1)), nextPoint]
      : [...locations, nextPoint];

  return { ...trip, riderLat: location.lat, riderLng: location.lng, riderAccuracy: location.accuracy, riderHeading: location.heading, locations: nextLocations };
};

function RiderDailyQuota({ quota, plan }: { quota: Readiness["dailyQuota"]; plan?: string }) {
  if (!quota || quota.limit <= 0) return null;
  const remainingPercent = Math.max(0, Math.min(100, (quota.remaining / quota.limit) * 100));

  return <section className="rider-daily-quota" aria-label="Cupo diario del plan">
    <div className="rider-daily-quota__heading">
      <div>
        <p>CUPO DIARIO · {plan || "PLAN ACTIVO"}</p>
        <h2>{quota.remaining} viajes disponibles</h2>
      </div>
      <strong>{quota.remaining}/{quota.limit}</strong>
    </div>
    <span>{quota.completed} de {quota.limit} completados hoy</span>
    <div className="rider-daily-quota__progress" role="progressbar" aria-label="Viajes disponibles hoy" aria-valuemin={0} aria-valuemax={quota.limit} aria-valuenow={quota.remaining}>
      <i style={{ width: `${remainingPercent}%` }} />
    </div>
  </section>;
}
export default function RiderPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [requests, setRequests] = useState<RequestTrip[]>([]);
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
  const [position, setPosition] = useState<MapPoint>(defaultPosition);
  const [focus, setFocus] = useState<MapPoint>(defaultPosition);
  const [recenterVersion, setRecenterVersion] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showRequests, setShowRequests] = useState(false);
  const [counterOffer, setCounterOffer] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [tripInfoExpanded, setTripInfoExpanded] = useState(true);
  const [workPanelExpanded, setWorkPanelExpanded] = useState(true);
  const [showCancel, setShowCancel] = useState(false);
  const centeredFromGps = useRef(false);
  const lastLiveLocation = useRef<{ at: number; lat: number; lng: number } | null>(null);
  const lastLocationErrorAt = useRef(0);
  const locationPublishInFlight = useRef(false);
  const tripTransitionInFlight = useRef(false);

  const load = useCallback(async () => {
    try {
      const [nextProfile, nextReadiness, trips] = await Promise.all([api<Profile>("/riders/me"), api<Readiness>("/riders/me/readiness"), api<ActiveTrip[]>("/trips")]);
      setProfile(nextProfile); setReadiness(nextReadiness);
      const current = trips.find((trip) => ["ACCEPTED", "RIDER_ON_THE_WAY", "RIDER_ARRIVED", "IN_PROGRESS"].includes(trip.status));
      setActiveTrip((previous) => {
        if (!current || previous?.id !== current.id) return current || null;
        const previousLocations = previous.locations || [];
        const incomingLocations = current.locations || [];
        // Una respuesta de sondeo iniciada antes de un PATCH de GPS no debe borrar
        // la cola local confirmada ni devolver visualmente la moto hacia atrás.
        const incomingRecordedAt = current.riderLocationUpdatedAt || incomingLocations.at(-1)?.createdAt;
        const previousRecordedAt = previous.riderLocationUpdatedAt || previousLocations.at(-1)?.createdAt;
        const incomingIsNewer = !previousRecordedAt || !incomingRecordedAt || Date.parse(incomingRecordedAt) >= Date.parse(previousRecordedAt);
        return incomingIsNewer && incomingLocations.length >= previousLocations.length ? current : { ...current, locations: previousLocations, riderLat: previous.riderLat, riderLng: previous.riderLng, riderAccuracy: previous.riderAccuracy, riderHeading: previous.riderHeading, riderLocationUpdatedAt: previous.riderLocationUpdatedAt };
      });
      const latestLocation = current?.riderLat != null && current.riderLng != null
        ? { lat: current.riderLat, lng: current.riderLng, accuracy: current.riderAccuracy ?? undefined, heading: current.riderHeading ?? undefined }
        : current?.locations?.at(-1);
      const serverLocationAt = current?.riderLocationUpdatedAt || current?.locations?.at(-1)?.createdAt;
      const serverTimestamp = serverLocationAt ? Date.parse(serverLocationAt) : 0;
      const localTimestamp = lastLiveLocation.current?.at || 0;
      if (latestLocation && (Number.isNaN(serverTimestamp) || serverTimestamp >= localTimestamp)) {
        const restoredPosition = { lat: latestLocation.lat, lng: latestLocation.lng, accuracy: latestLocation.accuracy ?? undefined, heading: latestLocation.heading ?? undefined };
        setPosition(restoredPosition);
        if (!centeredFromGps.current) setFocus(restoredPosition);
      }
      if (nextReadiness.ready && nextProfile.available && !current) setRequests(await api<RequestTrip[]>("/riders/available-trips"));
      else setRequests([]);
    } catch (error) { setMessage((error as Error).message); }
  }, []);
  const publishLocation = useCallback(async (next: MapPoint & { accuracy?: number; heading?: number }) => {
    if (activeTrip) {
      // El GPS puede emitir varios puntos mientras la red sigue procesando el
      // anterior. Serializamos el envío para conservar el orden cronológico
      // del trayecto que verá el pasajero y evitar saltos por respuestas fuera
      // de orden.
      if (locationPublishInFlight.current) return;
      locationPublishInFlight.current = true;
      try {
        const recorded = await api<RecordedTripLocation>(`/trips/${activeTrip.id}/location`, { method: "PATCH", body: JSON.stringify(locationPayload(next)) });
        setActiveTrip((current) => current?.id === recorded.tripId ? appendConfirmedLocation(current, recorded) : current);
      } finally {
        locationPublishInFlight.current = false;
      }
    }
    else if (profile?.available) await api("/riders/me/location", { method: "PATCH", body: JSON.stringify(locationPayload(next)) });
  }, [activeTrip?.id, profile?.available]);
  const refreshLocation = useCallback(() => {
    if (!navigator.geolocation) return setMessage("Activa GPS para recibir solicitudes cercanas.");
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const next = { lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy, heading: Number.isFinite(coords.heading) ? coords.heading ?? undefined : position.heading }; setPosition(next); if (!centeredFromGps.current) { setFocus(next); centeredFromGps.current = true; }
      if (profile?.available || activeTrip) try { await publishLocation(next); } catch { /* Retried on the next scheduled update. */ }
    }, () => setMessage("No pudimos actualizar tu GPS. Revisa los permisos."), { enableHighAccuracy: Boolean(profile?.available || activeTrip), timeout: 10000, maximumAge: 5_000 });
  }, [activeTrip, profile?.available, publishLocation]);
  useEffect(() => { void load(); refreshLocation(); }, [load, refreshLocation]);
  useEffect(() => { lastLiveLocation.current = null; }, [activeTrip?.id]);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 4_500);
    return () => window.clearTimeout(timer);
  }, [message]);
  useEffect(() => { const timer = window.setInterval(() => { void load(); if (profile?.available || activeTrip) refreshLocation(); }, 15000); return () => clearInterval(timer); }, [load, profile?.available, activeTrip?.id, refreshLocation]);
  useEffect(() => {
    if ((!activeTrip && !profile?.available) || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(({ coords }) => {
      const next = { lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy, heading: Number.isFinite(coords.heading) ? coords.heading ?? undefined : undefined };
      setPosition(next);
      const previous = lastLiveLocation.current;
      const now = Date.now();
      const moved = !previous || Math.hypot(next.lat - previous.lat, next.lng - previous.lng) > .00008;
      const elapsed = previous ? now - previous.at : Number.POSITIVE_INFINITY;
      // Mantiene el seguimiento vivo sin convertir cada lectura de GPS en una
      // petición. Así se evita chocar con los límites de la API y la batería.
      if (!previous || (moved && elapsed >= LOCATION_PUBLISH_INTERVAL_MS) || elapsed >= LOCATION_HEARTBEAT_MS) {
        lastLiveLocation.current = { at: now, lat: next.lat, lng: next.lng };
        void publishLocation(next).catch((error: ApiError) => {
          if (error.code === "TRIP_NOT_ACTIVE" || error.code === "TRIP_NOT_FOUND") { void load(); return; }
          if (now - lastLocationErrorAt.current >= 30_000) {
            lastLocationErrorAt.current = now;
            setMessage(error.code === "VALIDATION_ERROR" ? "La señal GPS no tiene una precisión válida. Seguiremos intentando." : "No pudimos sincronizar tu ubicación. Seguiremos intentando.");
          }
        });
      }
    }, () => setMessage(activeTrip ? "No pudimos actualizar tu GPS durante el viaje." : "No pudimos actualizar tu GPS mientras recibes solicitudes."), { enableHighAccuracy: true, maximumAge: 3000, timeout: 12000 });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [activeTrip?.id, profile?.available, publishLocation]);
  useEffect(() => {
    const session = getSession(); if (!session) return;
    const socketUrl = (process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api").replace(/\/api$/, "");
    const socket = io(socketUrl, { auth: { token: session.accessToken }, transports: ["websocket", "polling"] });
    const update = () => void load(); ["trip:requested", "trip:accepted", "trip:status-updated", "trip:cancelled"].forEach((event) => socket.on(event, update));
    return () => { socket.disconnect(); };
  }, [load]);

  const selected = useMemo(() => requests.find((trip) => trip.id === selectedId) || null, [requests, selectedId]);
  const connect = async () => {
    if (!profile) return; setBusy(true); setMessage("");
    try { if (!profile.available) refreshLocation(); await api("/riders/me/availability", { method: "PATCH", body: JSON.stringify({ available: !profile.available }) }); await load(); }
    catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  };
  const accept = async () => {
    if (!selected) return; setBusy(true);
    try { await api(`/trips/${selected.id}/accept`, { method: "POST" }); setShowRequests(false); setSelectedId(null); await load(); }
    catch (error) { setMessage((error as Error).message); await load(); }
    finally { setBusy(false); }
  };
  const negotiate = async () => {
    if (!selected || !Number(counterOffer)) return setMessage("Ingresa un monto válido para tu contraoferta.");
    setBusy(true);
    try { await api(`/trips/${selected.id}/offers`, { method: "POST", body: JSON.stringify({ amount: Number(counterOffer) }) }); setCounterOffer(""); setShowRequests(false); setSelectedId(null); setMessage("Contraoferta enviada. Espera la respuesta del pasajero."); }
    catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  };
  const moveTrip = async (requestedStatus?: unknown) => {
    const nextStatus = typeof requestedStatus === "string" ? requestedStatus : activeTrip && stages[activeTrip.status].next;
    if (!activeTrip || !nextStatus || tripTransitionInFlight.current) return;

    tripTransitionInFlight.current = true;
    setBusy(true);

    try {
      // La vista puede recibir un punto GPS local antes de que la sincronización
      // periódica termine. Para la recogida, el servidor debe validar la misma
      // posición que el rider está viendo al tocar al pasajero.
      if (nextStatus === "RIDER_ARRIVED") {
        const meters = distanceToMeters(position, { lat: activeTrip.originLat, lng: activeTrip.originLng });
        if (meters > PICKUP_RADIUS_METERS) {
          setMessage(`Acércate al pasajero para confirmar la recogida. Estás a ${Math.ceil(meters)} m.`);
          return;
        }
      }
      const updated = await api<ActiveTrip>(`/trips/${activeTrip.id}/status`, {
        method: "PATCH",
        // Al recoger, el backend recibe y valida esta misma posición dentro de
        // la transacción. Así no existe una ventana entre "guardar GPS" y
        // "pasajero a bordo" que desincronice las dos pantallas.
        body: JSON.stringify({ status: nextStatus, ...(nextStatus === "RIDER_ARRIVED" ? { location: locationPayload(position) } : {}) }),
      });

      setActiveTrip((current) => current && current.id === updated.id
        ? { ...current, ...updated, locations: current.locations }
        : updated);
      setTripInfoExpanded(true);
      if (updated.status === "IN_PROGRESS") setMessage("Pasajero a bordo. Ya vas rumbo al destino.");
      await load();
    }
    catch (error) { setMessage((error as Error).message); }
    finally {
      tripTransitionInFlight.current = false;
      setBusy(false);
    }
  };
  const cancelActiveTrip = async () => {
    if (!activeTrip) return; setBusy(true);
    try { await api(`/trips/${activeTrip.id}/cancel`, { method: "POST", body: JSON.stringify({ reason: "Cancelado por rider" }) }); setShowCancel(false); setMessage("Viaje cancelado."); await load(); }
    catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  };
  const ready = readiness?.ready ?? false;
  const zone = readiness?.workZone?.department || "Zona sin configurar";
  const pickupDistance = activeTrip?.status === "RIDER_ON_THE_WAY"
    ? distanceToMeters(position, { lat: activeTrip.originLat, lng: activeTrip.originLng })
    : Number.POSITIVE_INFINITY;
  const canBoardPassenger = pickupDistance <= PICKUP_RADIUS_METERS;

  return <Guard roles={["RIDER"]}><MobileAppShell role="RIDER"><div className="dispatch-flow">
    {activeTrip && <section className={`rider-trip-overlay ${tripInfoExpanded ? "" : "is-collapsed"}`}><button className="tracking-collapse" aria-expanded={tripInfoExpanded} onClick={() => setTripInfoExpanded((expanded) => !expanded)}><span>{tripInfoExpanded ? "Ocultar información del viaje" : stages[activeTrip.status].title}</span><b>{tripInfoExpanded ? "⌄" : "⌃"}</b></button>{tripInfoExpanded && <><p>VIAJE ACTIVO · {activeTrip.status.replaceAll("_", " ")}</p><h1>{stages[activeTrip.status].title}</h1><span>{stages[activeTrip.status].detail}</span><div className="active-trip-route"><b>{activeTrip.client?.name || "Pasajero"}</b><span>{activeTrip.originAddress}</span><i>↓</i><span>{activeTrip.destinationAddress}</span><strong>{money(activeTrip)}</strong></div>{stages[activeTrip.status].action ? <button className="trip-main-action" disabled={busy} onClick={() => void moveTrip()}>{busy ? "Actualizando…" : stages[activeTrip.status].action}<span>→</span></button> : <p className="waiting-copy">El cliente confirmará la llegada al destino.</p>}{activeTrip.status !== "IN_PROGRESS" && <button className="cancel-link" disabled={busy} onClick={() => setShowCancel(true)}>Cancelar viaje</button>}</>}</section>}
    <section className={`dispatch-map${!activeTrip && readiness?.dailyQuota ? " has-rider-quota" : ""}`}><MapView className="dispatch-map-canvas" rider={position} riderConnected={Boolean(profile?.available)} riderWithPassenger={activeTrip?.status === "IN_PROGRESS"} passengerLoading={busy && activeTrip?.status === "RIDER_ON_THE_WAY"} traveledPath={(activeTrip?.locations || []).map((point) => ({ lat: point.lat, lng: point.lng, heading: point.heading ?? undefined, accuracy: point.accuracy ?? undefined }))} startFlag={activeTrip?.startLocation ? { lat: activeTrip.startLocation.lat, lng: activeTrip.startLocation.lng } : activeTrip?.locations?.[0] ? { lat: activeTrip.locations[0].lat, lng: activeTrip.locations[0].lng } : undefined} pickupFlag={activeTrip && ["RIDER_ARRIVED", "IN_PROGRESS"].includes(activeTrip.status) ? { lat: activeTrip.originLat, lng: activeTrip.originLng } : undefined} origin={activeTrip ? { lat: activeTrip.originLat, lng: activeTrip.originLng } : undefined} destination={activeTrip ? { lat: activeTrip.destinationLat, lng: activeTrip.destinationLng } : undefined} routeFrom={activeTrip ? position : undefined} routeTo={activeTrip ? activeTrip.status === "IN_PROGRESS" ? { lat: activeTrip.destinationLat, lng: activeTrip.destinationLng } : { lat: activeTrip.originLat, lng: activeTrip.originLng } : undefined} focus={focus} recenterVersion={recenterVersion} requests={!activeTrip ? requests.map((trip) => ({ id: trip.id, lat: trip.originLat, lng: trip.originLng, title: trip.originAddress })) : []} onOriginClick={activeTrip?.status === "ACCEPTED" ? () => void moveTrip("RIDER_ON_THE_WAY") : activeTrip?.status === "RIDER_ON_THE_WAY" ? () => void moveTrip("RIDER_ARRIVED") : undefined} onDestinationClick={activeTrip?.status === "RIDER_ARRIVED" ? () => void moveTrip("IN_PROGRESS") : undefined} onRequestClick={(id) => { setSelectedId(id); setShowRequests(true); }} />{activeTrip?.status === "RIDER_ON_THE_WAY" && canBoardPassenger ? <button className="dispatch-pickup-action" disabled={busy} onClick={() => void moveTrip("RIDER_ARRIVED")}>{busy ? "Recogiendo pasajero…" : "Recoger pasajero"}<span>→</span></button> : null}<button className="map-recenter dispatch-recenter" aria-label="Centrar mi ubicación" onClick={() => { setFocus(position); setRecenterVersion((value) => value + 1); }}>◎</button><div className="dispatch-zone"><span>{zone}</span><b>{activeTrip ? stages[activeTrip.status].title : profile?.available ? "Conectado" : "Desconectado"}</b></div>{profile?.available && !activeTrip ? <button className="dispatch-available" onClick={() => setShowRequests(true)}>◉ Disponibles <b>{requests.length}</b></button> : null}</section>
    {!ready && readiness ? <section className="rider-blockers"><p>NO ESTÁS LISTO PARA TRABAJAR</p><h1>Completa tu activación</h1>{readiness.blockers.map((blocker) => <article key={blocker.code}><b>{blocker.action}</b><span>{blocker.message}</span></article>)}</section> : activeTrip ? <section className="active-trip-sheet"><div className="sheet-handle" /><p>VIAJE EN CURSO</p><h1>{stages[activeTrip.status].title}</h1><span>{stages[activeTrip.status].detail}</span><div className="active-trip-route"><b>{activeTrip.client?.name || "Pasajero"}</b><span>{activeTrip.originAddress}</span><i>↓</i><span>{activeTrip.destinationAddress}</span><strong>{money(activeTrip)}</strong></div>{stages[activeTrip.status].action ? <button className="trip-main-action" disabled={busy} onClick={moveTrip}>{busy ? "Actualizando…" : stages[activeTrip.status].action}<span>→</span></button> : <p className="waiting-copy">Espera a que el pasajero confirme la llegada.</p>}</section> : <section className="rider-connect-sheet"><div className="sheet-handle" /><p>{profile?.available ? "RECIBIENDO VIAJES" : "MODO DE TRABAJO"}</p><h1>{profile?.available ? "Estás conectado" : "Estás desconectado"}</h1><span>{profile?.available ? "Las solicitudes dentro de tu zona aparecerán aquí y en el botón Disponibles." : "Conéctate cuando estés listo para recibir solicitudes cercanas."}</span><RiderDailyQuota quota={readiness?.dailyQuota ?? null} plan={readiness?.subscription?.plan} />{readiness?.subscription && readiness.subscription.daysRemaining <= 7 ? <small>Tu plan {readiness.subscription.plan} vence en {readiness.subscription.daysRemaining} días.</small> : null}<button className="trip-main-action" disabled={busy || (!profile?.available && !ready)} onClick={connect}>{busy ? "Actualizando…" : profile?.available ? "Desconectarme" : "Conectarme"}<span>→</span></button></section>}
    {showRequests && <div className="flow-modal dispatch-modal" onClick={() => setShowRequests(false)}><section onClick={(event) => event.stopPropagation()}><div className="sheet-handle" /><p>SOLICITUDES DISPONIBLES</p>{selected ? <><h2>Viaje cercano</h2><div className="request-detail"><span>Recogida · {selected.riderDistanceKm?.toFixed(1) || "—"} km</span><b>{selected.originAddress}</b><i>↓</i><span>Destino</span><b>{selected.destinationAddress}</b><strong>{money(selected)}</strong><small>{selected.distanceKm.toFixed(1)} km · {selected.estimatedDurationMin} min</small></div><button className="trip-main-action" disabled={busy} onClick={accept}>{busy ? "Procesando…" : "Aceptar tarifa"}<span>→</span></button><div className="counter-offer"><label>O envía una contraoferta</label><div><input type="number" value={counterOffer} onChange={(event) => setCounterOffer(event.target.value)} placeholder="Monto en córdobas" /><button disabled={busy || !counterOffer} onClick={negotiate}>Enviar</button></div></div><button className="cancel-link" onClick={() => setSelectedId(null)}>Volver a solicitudes</button></> : <><h2>Solicitudes cercanas</h2><div className="request-list">{requests.length ? requests.map((trip) => <button key={trip.id} onClick={() => { setSelectedId(trip.id); setFocus({ lat: trip.originLat, lng: trip.originLng }); }}><span>{trip.riderDistanceKm?.toFixed(1) || "—"} km</span><b>{trip.originAddress}</b><small>→ {trip.destinationAddress}</small><strong>{money(trip)}</strong></button>) : <p className="waiting-copy">No hay solicitudes en tu radio de trabajo.</p>}</div></>}</section></div>}
    {showCancel && <div className="flow-modal" onClick={() => setShowCancel(false)}><section onClick={(event) => event.stopPropagation()}><div className="sheet-handle" /><p>CANCELAR VIAJE</p><h2>¿Deseas cancelar este viaje?</h2><span>El pasajero será notificado y la solicitud dejará de estar activa.</span><button className="trip-main-action" disabled={busy} onClick={cancelActiveTrip}>{busy ? "Cancelando…" : "Confirmar cancelación"}<span>→</span></button><button className="cancel-link rider-modal-dismiss" onClick={() => setShowCancel(false)}>Volver al viaje</button></section></div>}
    {!activeTrip && ready && <section className={`rider-work-sheet ${workPanelExpanded ? "" : "is-collapsed"}`}><button className="tracking-collapse" aria-expanded={workPanelExpanded} onClick={() => setWorkPanelExpanded((expanded) => !expanded)}><span>{workPanelExpanded ? "Ocultar detalles de trabajo" : profile?.available ? "Estás conectado" : "Estás desconectado"}</span><b>{workPanelExpanded ? "⌄" : "⌃"}</b></button>{workPanelExpanded && <><p>{profile?.available ? "RECIBIENDO VIAJES" : "MODO DE TRABAJO"}</p><h1>{profile?.available ? "Estás conectado" : "Estás desconectado"}</h1><span>{profile?.available ? "Las solicitudes de tu zona aparecerán aquí y en Disponibles." : "Conéctate cuando estés listo para recibir solicitudes cercanas."}</span><RiderDailyQuota quota={readiness?.dailyQuota ?? null} plan={readiness?.subscription?.plan} />{readiness?.subscription && readiness.subscription.daysRemaining <= 7 ? <small>Tu plan {readiness.subscription.plan} vence en {readiness.subscription.daysRemaining} días.</small> : null}</>}<button className="trip-main-action" disabled={busy || (!profile?.available && !ready)} onClick={connect}>{busy ? "Actualizando…" : profile?.available ? "Desconectarme" : "Conectarme"}<span>→</span></button></section>}
    {activeTrip?.status === "IN_PROGRESS" && <button className="rider-in-progress-cancel" disabled={busy} onClick={() => setShowCancel(true)}>Cancelar por incidencia</button>}
    {message && <p className="flow-message" role="status">{message}</p>}
  </div></MobileAppShell></Guard>;
}
