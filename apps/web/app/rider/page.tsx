"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { Guard } from "@/components/Guard";
import { MapPoint, MapView } from "@/components/MapView";
import { api, getSession } from "@/lib/api";
import { MobileAppShell } from "@/components/MobileAppShell";

type Profile = { approval: string; available: boolean; vehicleModel?: string | null; vehiclePlate?: string | null };
type RequestTrip = { id: string; originAddress: string; originLat: number; originLng: number; destinationAddress: string; estimatedPrice: string; proposedPrice?: string | null; currency: string; distanceKm: number; estimatedDurationMin: number; riderDistanceKm?: number; expiresAt?: string | null };
type ActiveTrip = RequestTrip & { status: "ACCEPTED" | "RIDER_ON_THE_WAY" | "RIDER_ARRIVED" | "IN_PROGRESS"; client?: { name: string; phone?: string | null } };
type Readiness = { ready: boolean; blockers: Array<{ code: string; message: string; action: string }>; workZone: { department: string; lat: number; lng: number; updatedAt?: string | null } | null; activeTrip: { id: string; status: string } | null; subscription: { plan?: string; expiresAt: string; daysRemaining: number } | null };

const activeStatuses: Record<ActiveTrip["status"], { title: string; detail: string; next?: { label: string; status: string } }> = {
  ACCEPTED: { title: "Viaje aceptado", detail: "Dirígete al punto de origen.", next: { label: "Voy en camino", status: "RIDER_ON_THE_WAY" } },
  RIDER_ON_THE_WAY: { title: "En camino al pasajero", detail: "Confirma cuando llegues al origen.", next: { label: "He llegado", status: "RIDER_ARRIVED" } },
  RIDER_ARRIVED: { title: "Esperando al pasajero", detail: "Confirma el inicio solo cuando el pasajero esté contigo.", next: { label: "Iniciar viaje", status: "IN_PROGRESS" } },
  IN_PROGRESS: { title: "Viaje en curso", detail: "Al llegar, pide al pasajero que confirme la finalización desde su aplicación." },
};

const money = (trip: Pick<RequestTrip, "currency" | "estimatedPrice" | "proposedPrice">) => `${trip.currency} ${trip.proposedPrice || trip.estimatedPrice}`;

export default function RiderPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [requests, setRequests] = useState<RequestTrip[]>([]);
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
  const [position, setPosition] = useState<MapPoint>({ lat: 12.1364, lng: -86.2514 });
  const [mapFocus, setMapFocus] = useState<MapPoint>({ lat: 12.1364, lng: -86.2514 });
  const [selected, setSelected] = useState<string>();
  const [showRequests, setShowRequests] = useState(false);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [nextProfile, nextReadiness, trips] = await Promise.all([
        api<Profile>("/riders/me"),
        api<Readiness>("/riders/me/readiness"),
        api<ActiveTrip[]>("/trips"),
      ]);
      setProfile(nextProfile);
      setReadiness(nextReadiness);
      const current = trips.find((trip) => ["ACCEPTED", "RIDER_ON_THE_WAY", "RIDER_ARRIVED", "IN_PROGRESS"].includes(trip.status));
      setActiveTrip(current || null);
      if (nextReadiness.ready && nextProfile.available && !current) {
        setRequests(await api<RequestTrip[]>("/riders/available-trips"));
      } else setRequests([]);
    } catch (error) { setMessage((error as Error).message); }
  }, []);

  const publishLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (point) => {
      const current = { lat: point.coords.latitude, lng: point.coords.longitude };
      setPosition(current);
      setMapFocus(current);
      if (profile?.available) {
        try { await api("/riders/me/location", { method: "PATCH", body: JSON.stringify(current) }); }
        catch { /* A temporary GPS/network error must not disconnect the rider. */ }
      }
    }, () => setMessage("No pudimos actualizar tu GPS. Revisa los permisos de ubicación."), { enableHighAccuracy: false, maximumAge: 45_000, timeout: 10_000 });
  }, [profile?.available]);

  useEffect(() => { void load(); publishLocation(); }, [load, publishLocation]);
  useEffect(() => { const timer = window.setInterval(() => { void load(); if (profile?.available) publishLocation(); }, 15_000); return () => window.clearInterval(timer); }, [load, profile?.available, publishLocation]);
  useEffect(() => {
    const session = getSession();
    if (!session) return;
    const socketUrl = (process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api").replace(/\/api$/, "");
    const socket = io(socketUrl, { auth: { token: session.accessToken }, transports: ["websocket", "polling"] });
    const refresh = () => { void load(); };
    socket.on("trip:requested", refresh);
    socket.on("trip:accepted", refresh);
    socket.on("trip:status-updated", refresh);
    socket.on("trip:cancelled", refresh);
    return () => { socket.disconnect(); };
  }, [load]);

  const toggleAvailability = async () => {
    if (!profile) return;
    setBusy(true); setMessage("");
    try {
      if (!profile.available) publishLocation();
      await api("/riders/me/availability", { method: "PATCH", body: JSON.stringify({ available: !profile.available }) });
      setMessage(profile.available ? "Recepción de solicitudes pausada." : "Ya estás disponible para recibir solicitudes cercanas.");
      await load();
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  };
  const accept = async (id: string) => {
    setBusy(true); setMessage("");
    try { await api(`/trips/${id}/accept`, { method: "POST" }); setSelected(undefined); setMessage("Viaje aceptado. Ya puedes dirigirte al origen."); await load(); }
    catch (error) { setMessage((error as Error).message); await load(); }
    finally { setBusy(false); }
  };
  const counter = async (id: string) => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return setMessage("Ingresa un monto válido para la contraoferta.");
    setBusy(true); setMessage("");
    try { await api(`/trips/${id}/offers`, { method: "POST", body: JSON.stringify({ amount: value }) }); setAmount(""); setSelected(undefined); setMessage("Contraoferta enviada. Te avisaremos cuando el pasajero responda."); await load(); }
    catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  };
  const transition = async (status: string) => {
    if (!activeTrip) return;
    if (status === "IN_PROGRESS" && !window.confirm("¿El pasajero ya está contigo? Esta acción inicia el viaje.")) return;
    setBusy(true); setMessage("");
    try { await api(`/trips/${activeTrip.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }); setMessage(status === "COMPLETED" ? "Viaje finalizado y registrado." : "Estado del viaje actualizado."); await load(); }
    catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  };

  const selectedTrip = useMemo(() => requests.find((item) => item.id === selected), [requests, selected]);
  const isReady = readiness?.ready ?? false;
  const zone = readiness?.workZone?.department || "Zona pendiente";

  return <Guard roles={["RIDER"]}><MobileAppShell role="RIDER">
    <section className="mt-4 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-orange-950 p-5 text-white shadow-xl">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-orange-300">Centro de trabajo · {zone}</p><h1 className="mt-1 text-2xl font-bold">{activeTrip ? "Tienes un viaje activo" : profile?.available ? "Estás disponible" : "Estás desconectado"}</h1><p className="mt-1 text-sm text-slate-300">{activeTrip ? "Mantén este panel abierto para actualizar el viaje." : "Tu ubicación se actualiza cada minuto mientras estás disponible."}</p></div><span className={`mt-1 h-3 w-3 rounded-full ${profile?.available ? "bg-emerald-400 shadow-[0_0_18px_#34d399]" : "bg-slate-500"}`} /></div>
      {!activeTrip ? <div className="mt-5 grid grid-cols-1 gap-2"><button className={`${profile?.available ? "bg-white text-slate-950" : "bg-orange-500 text-white"}`} disabled={busy || (!profile?.available && !isReady)} onClick={toggleAvailability}>{busy ? "Actualizando…" : profile?.available ? "Desconectarme" : isReady ? "Conectarme para trabajar" : "Completa los requisitos para conectarte"}</button>{profile?.available ? <button className="border border-white/20 bg-white/10 text-white" onClick={() => setShowRequests(true)}>Disponibles · {requests.length}</button> : null}</div> : null}
    </section>

    {!isReady && readiness ? <section className="card mt-3 border border-amber-200 bg-amber-50"><p className="text-xs font-bold uppercase tracking-wider text-amber-700">Requisitos para trabajar</p><ul className="mt-2 space-y-2">{readiness.blockers.map((blocker) => <li key={blocker.code} className="rounded-xl bg-white p-3 text-sm"><b>{blocker.action}</b><p className="mt-1 text-slate-600">{blocker.message}</p></li>)}</ul><button className="mt-3 w-full border" onClick={() => window.location.assign("/rider/account")}>Ir a mi cuenta</button></section> : null}
    {readiness?.subscription && readiness.subscription.daysRemaining <= 7 ? <section className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><b>Tu plan {readiness.subscription.plan} vence en {readiness.subscription.daysRemaining} días.</b><button className="ml-2 font-bold text-orange-700 underline" onClick={() => window.location.assign("/rider/subscription")}>Renovar</button></section> : null}

    {activeTrip ? <section className="mt-4 overflow-hidden rounded-3xl bg-slate-950 p-5 text-white shadow-xl"><p className="text-xs font-bold uppercase tracking-widest text-orange-300">Viaje en curso</p><h2 className="mt-1 text-2xl font-bold">{activeStatuses[activeTrip.status].title}</h2><p className="mt-1 text-sm text-slate-300">{activeStatuses[activeTrip.status].detail}</p><div className="mt-4 rounded-2xl bg-white/10 p-4"><b>{activeTrip.client?.name || "Pasajero"}</b><p className="mt-2 text-sm text-slate-200">Origen: {activeTrip.originAddress}</p><p className="mt-1 text-sm text-slate-200">Destino: {activeTrip.destinationAddress}</p><p className="mt-3 font-bold text-orange-300">Monto confirmado: {money(activeTrip)}</p></div>{activeStatuses[activeTrip.status].next ? <button className="mt-4 w-full bg-orange-500 text-white" disabled={busy} onClick={() => transition(activeStatuses[activeTrip.status].next!.status)}>{busy ? "Actualizando…" : activeStatuses[activeTrip.status].next!.label}</button> : null}</section> : <>
      <section className="mt-4"><div className="mb-2 flex items-center justify-between"><div><h2 className="font-bold">Solicitudes cercanas</h2><p className="muted">Selecciona una tarjeta o un pin para responder.</p></div><span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">{requests.length} nuevas</span></div><div className="relative"><MapView rider={position} focus={mapFocus} requests={requests.map((item) => ({ id: item.id, lat: item.originLat, lng: item.originLng, title: item.originAddress, subtitle: item.destinationAddress }))} onRequestClick={(id) => { setSelected(id); setShowRequests(true); }} /><button className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full bg-white text-xl font-bold shadow-lg" aria-label="Centrar mi ubicación" onClick={() => setMapFocus(position)}>◎</button></div></section>
      <section className="mt-3 space-y-3">{requests.map((trip) => <button key={trip.id} className={`card w-full text-left transition ${selected === trip.id ? "border-2 border-orange-400" : ""}`} onClick={() => setSelected(trip.id)}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-orange-600">Solicitud cercana · {trip.riderDistanceKm?.toFixed(1) || "—"} km</p><b className="mt-1 block">{trip.originAddress}</b><p className="muted mt-1 line-clamp-1">→ {trip.destinationAddress}</p></div><strong className="whitespace-nowrap text-slate-950">{money(trip)}</strong></div><p className="muted mt-2">{trip.distanceKm.toFixed(1)} km · {trip.estimatedDurationMin} min</p></button>)}</section>
      {selectedTrip ? <article className="card mt-3 border-2 border-orange-300"><div className="flex justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-orange-600">Responder solicitud</p><b>{selectedTrip.originAddress} → {selectedTrip.destinationAddress}</b></div><button className="h-8 border px-2 py-1 text-sm" onClick={() => setSelected(undefined)}>Cerrar</button></div><p className="muted mt-2">Tarifa propuesta: <b className="text-slate-950">{money(selectedTrip)}</b></p><button className="primary mt-3 w-full" disabled={busy} onClick={() => accept(selectedTrip.id)}>{busy ? "Procesando…" : "Aceptar tarifa"}</button><div className="mt-3 rounded-xl bg-slate-50 p-3"><label className="text-sm font-bold">O enviar contraoferta</label><div className="mt-2 flex gap-2"><input aria-label="Monto de contraoferta" type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Monto en córdobas" /><button className="border whitespace-nowrap" disabled={busy || !amount} onClick={() => counter(selectedTrip.id)}>Enviar</button></div></div></article> : requests.length === 0 ? <section className="card mt-3 text-center"><b>{profile?.available ? "Esperando solicitudes" : "Activa tu disponibilidad"}</b><p className="muted mt-1">Las solicitudes que estén dentro de tu radio de trabajo aparecerán aquí.</p></section> : null}
      {showRequests && <div className="fixed inset-0 z-[100] bg-slate-950/60 p-4" onClick={() => setShowRequests(false)}><section className="mx-auto mt-20 max-w-md rounded-3xl bg-white p-5" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-orange-600">Disponibles</p><h2 className="text-xl font-bold">Solicitudes cercanas</h2></div><button className="border px-3 py-2" onClick={() => setShowRequests(false)}>×</button></div><div className="mt-4 max-h-[60vh] space-y-2 overflow-y-auto">{requests.length ? requests.map((trip) => <button key={trip.id} className="w-full rounded-2xl border p-3 text-left" onClick={() => { setSelected(trip.id); setMapFocus({ lat: trip.originLat, lng: trip.originLng }); setShowRequests(false); }}><b>{trip.originAddress}</b><p className="muted mt-1">→ {trip.destinationAddress}</p><div className="mt-2 flex justify-between text-sm font-bold"><span>{trip.riderDistanceKm?.toFixed(1) || "—"} km</span><span>{money(trip)}</span></div></button>) : <p className="muted py-8 text-center">Aún no hay solicitudes en tu radio de trabajo.</p>}</div></section></div>}
    </>}
    {message ? <p className="mt-3 rounded-xl bg-slate-900 p-3 text-sm text-white" role="status">{message}</p> : null}
  </MobileAppShell></Guard>;
}
