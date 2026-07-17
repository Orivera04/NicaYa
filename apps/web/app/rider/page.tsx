"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Guard } from "@/components/Guard";
import { MapPoint, MapView } from "@/components/MapView";
import { MobileAppShell } from "@/components/MobileAppShell";
import { api, getSession } from "@/lib/api";

type Profile = { available: boolean };
type RequestTrip = { id: string; originAddress: string; originLat: number; originLng: number; destinationAddress: string; destinationLat: number; destinationLng: number; estimatedPrice: string; proposedPrice?: string | null; currency: string; distanceKm: number; estimatedDurationMin: number; riderDistanceKm?: number };
type ActiveTrip = RequestTrip & { status: "ACCEPTED" | "RIDER_ON_THE_WAY" | "RIDER_ARRIVED" | "IN_PROGRESS"; client?: { name: string } };
type Readiness = { ready: boolean; blockers: Array<{ code: string; message: string; action: string }>; workZone: { department: string } | null; subscription: { plan?: string; daysRemaining: number } | null };

const defaultPosition = { lat: 12.1364, lng: -86.2514 };
const stages: Record<ActiveTrip["status"], { title: string; detail: string; action?: string; next?: string }> = {
  ACCEPTED: { title: "Viaje aceptado", detail: "Dirígete al punto de recogida del pasajero.", action: "Voy en camino", next: "RIDER_ON_THE_WAY" },
  RIDER_ON_THE_WAY: { title: "En camino", detail: "Confirma cuando llegues al origen.", action: "He llegado", next: "RIDER_ARRIVED" },
  RIDER_ARRIVED: { title: "Llegaste al origen", detail: "Inicia el viaje solo cuando el pasajero esté contigo.", action: "Iniciar viaje", next: "IN_PROGRESS" },
  IN_PROGRESS: { title: "Viaje en curso", detail: "El pasajero confirmará la llegada desde su aplicación." },
};

const money = (trip: Pick<RequestTrip, "currency" | "estimatedPrice" | "proposedPrice">) => `${trip.currency} ${trip.proposedPrice || trip.estimatedPrice}`;

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
  const centeredFromGps = useRef(false);

  const load = useCallback(async () => {
    try {
      const [nextProfile, nextReadiness, trips] = await Promise.all([api<Profile>("/riders/me"), api<Readiness>("/riders/me/readiness"), api<ActiveTrip[]>("/trips")]);
      setProfile(nextProfile); setReadiness(nextReadiness);
      const current = trips.find((trip) => ["ACCEPTED", "RIDER_ON_THE_WAY", "RIDER_ARRIVED", "IN_PROGRESS"].includes(trip.status));
      setActiveTrip(current || null);
      if (nextReadiness.ready && nextProfile.available && !current) setRequests(await api<RequestTrip[]>("/riders/available-trips"));
      else setRequests([]);
    } catch (error) { setMessage((error as Error).message); }
  }, []);
  const refreshLocation = useCallback(() => {
    if (!navigator.geolocation) return setMessage("Activa GPS para recibir solicitudes cercanas.");
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const next = { lat: coords.latitude, lng: coords.longitude }; setPosition(next); if (!centeredFromGps.current) { setFocus(next); centeredFromGps.current = true; }
      if (profile?.available) try { await api("/riders/me/location", { method: "PATCH", body: JSON.stringify(next) }); } catch { /* Retried on the next scheduled update. */ }
    }, () => setMessage("No pudimos actualizar tu GPS. Revisa los permisos."), { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  }, [profile?.available]);
  useEffect(() => { void load(); refreshLocation(); }, [load, refreshLocation]);
  useEffect(() => { const timer = window.setInterval(() => { void load(); if (profile?.available) refreshLocation(); }, 15000); return () => clearInterval(timer); }, [load, profile?.available, refreshLocation]);
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
  const moveTrip = async () => {
    if (!activeTrip || !stages[activeTrip.status].next) return; setBusy(true);
    try { await api(`/trips/${activeTrip.id}/status`, { method: "PATCH", body: JSON.stringify({ status: stages[activeTrip.status].next }) }); await load(); }
    catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  };
  const ready = readiness?.ready ?? false;
  const zone = readiness?.workZone?.department || "Zona sin configurar";

  return <Guard roles={["RIDER"]}><MobileAppShell role="RIDER"><div className="dispatch-flow">
    <section className="dispatch-map"><MapView className="dispatch-map-canvas" rider={position} origin={activeTrip ? { lat: activeTrip.originLat, lng: activeTrip.originLng } : undefined} destination={activeTrip ? { lat: activeTrip.destinationLat, lng: activeTrip.destinationLng } : undefined} routeFrom={activeTrip ? position : undefined} routeTo={activeTrip ? activeTrip.status === "IN_PROGRESS" ? { lat: activeTrip.destinationLat, lng: activeTrip.destinationLng } : { lat: activeTrip.originLat, lng: activeTrip.originLng } : undefined} focus={focus} recenterVersion={recenterVersion} requests={!activeTrip ? requests.map((trip) => ({ id: trip.id, lat: trip.originLat, lng: trip.originLng, title: trip.originAddress })) : []} onRequestClick={(id) => { setSelectedId(id); setShowRequests(true); }} /><button className="map-recenter dispatch-recenter" aria-label="Centrar mi ubicación" onClick={() => { setFocus(position); setRecenterVersion((value) => value + 1); }}>◎</button><div className="dispatch-zone"><span>{zone}</span><b>{activeTrip ? "Viaje activo" : profile?.available ? "Conectado" : "Desconectado"}</b></div>{profile?.available && !activeTrip ? <button className="dispatch-available" onClick={() => setShowRequests(true)}>◉ Disponibles <b>{requests.length}</b></button> : null}</section>
    {!ready && readiness ? <section className="rider-blockers"><p>NO ESTÁS LISTO PARA TRABAJAR</p><h1>Completa tu activación</h1>{readiness.blockers.map((blocker) => <article key={blocker.code}><b>{blocker.action}</b><span>{blocker.message}</span></article>)}</section> : activeTrip ? <section className="active-trip-sheet"><div className="sheet-handle" /><p>VIAJE EN CURSO</p><h1>{stages[activeTrip.status].title}</h1><span>{stages[activeTrip.status].detail}</span><div className="active-trip-route"><b>{activeTrip.client?.name || "Pasajero"}</b><span>{activeTrip.originAddress}</span><i>↓</i><span>{activeTrip.destinationAddress}</span><strong>{money(activeTrip)}</strong></div>{stages[activeTrip.status].action ? <button className="trip-main-action" disabled={busy} onClick={moveTrip}>{busy ? "Actualizando…" : stages[activeTrip.status].action}<span>→</span></button> : <p className="waiting-copy">Espera a que el pasajero confirme la llegada.</p>}</section> : <section className="rider-connect-sheet"><div className="sheet-handle" /><p>{profile?.available ? "RECIBIENDO VIAJES" : "MODO DE TRABAJO"}</p><h1>{profile?.available ? "Estás conectado" : "Estás desconectado"}</h1><span>{profile?.available ? "Las solicitudes dentro de tu zona aparecerán aquí y en el botón Disponibles." : "Conéctate cuando estés listo para recibir solicitudes cercanas."}</span>{readiness?.subscription && readiness.subscription.daysRemaining <= 7 ? <small>Tu plan {readiness.subscription.plan} vence en {readiness.subscription.daysRemaining} días.</small> : null}<button className="trip-main-action" disabled={busy || (!profile?.available && !ready)} onClick={connect}>{busy ? "Actualizando…" : profile?.available ? "Desconectarme" : "Conectarme"}<span>→</span></button></section>}
    {showRequests && <div className="flow-modal dispatch-modal" onClick={() => setShowRequests(false)}><section onClick={(event) => event.stopPropagation()}><div className="sheet-handle" /><p>SOLICITUDES DISPONIBLES</p>{selected ? <><h2>Viaje cercano</h2><div className="request-detail"><span>Recogida · {selected.riderDistanceKm?.toFixed(1) || "—"} km</span><b>{selected.originAddress}</b><i>↓</i><span>Destino</span><b>{selected.destinationAddress}</b><strong>{money(selected)}</strong><small>{selected.distanceKm.toFixed(1)} km · {selected.estimatedDurationMin} min</small></div><button className="trip-main-action" disabled={busy} onClick={accept}>{busy ? "Procesando…" : "Aceptar tarifa"}<span>→</span></button><div className="counter-offer"><label>O envía una contraoferta</label><div><input type="number" value={counterOffer} onChange={(event) => setCounterOffer(event.target.value)} placeholder="Monto en córdobas" /><button disabled={busy || !counterOffer} onClick={negotiate}>Enviar</button></div></div><button className="cancel-link" onClick={() => setSelectedId(null)}>Volver a solicitudes</button></> : <><h2>Solicitudes cercanas</h2><div className="request-list">{requests.length ? requests.map((trip) => <button key={trip.id} onClick={() => { setSelectedId(trip.id); setFocus({ lat: trip.originLat, lng: trip.originLng }); }}><span>{trip.riderDistanceKm?.toFixed(1) || "—"} km</span><b>{trip.originAddress}</b><small>→ {trip.destinationAddress}</small><strong>{money(trip)}</strong></button>) : <p className="waiting-copy">No hay solicitudes en tu radio de trabajo.</p>}</div></>}</section></div>}
    {message && <p className="flow-message" role="status">{message}</p>}
  </div></MobileAppShell></Guard>;
}
