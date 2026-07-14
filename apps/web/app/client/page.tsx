"use client";

import { useEffect, useState } from "react";
import { Guard } from "@/components/Guard";
import { MapPoint, MapView } from "@/components/MapView";
import { api } from "@/lib/api";
import { AdvertisementCarousel } from "@/components/AdvertisementCarousel";
import { MobileAppShell } from "@/components/MobileAppShell";
import { LocationSearch } from "@/components/LocationSearch";

type Place = MapPoint & { address: string; reference?: string | null };
type SavedPlace = Place & { id: string; label: string };
type Quote = { distanceKm: number; estimatedDurationMin: number; minimumFare: number; maximumFare: number; estimatedPrice: number; currency: string };
type Offer = { id: string; amount: string; currency: string; rider: { name: string } };
type HistoryTrip = { id: string; status: string; originAddress: string; destinationAddress: string; currency: string; estimatedPrice: string; finalPrice?: string | null };
const managua: Place = { lat: 12.1364, lng: -86.2514, address: "Managua, Nicaragua" };
const recentStorageKey = "motoya-recent-places";

export default function ClientPage() {
  const [origin, setOrigin] = useState<Place>({ ...managua, address: "Selecciona tu origen" });
  const [destination, setDestination] = useState<Place | null>(null);
  const [selection, setSelection] = useState<"origin" | "destination">("origin");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [favorites, setFavorites] = useState<SavedPlace[]>([]);
  const [recents, setRecents] = useState<Place[]>([]);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [panelExpanded, setPanelExpanded] = useState(true);
  const [label, setLabel] = useState(""); const [reference, setReference] = useState("");
  const [proposedPrice, setProposedPrice] = useState("");
  const [requestState, setRequestState] = useState<"idle" | "confirm" | "sending" | "searching" | "accepted" | "cancelled">("idle");
  const [tripId, setTripId] = useState<string | null>(null); const [offers, setOffers] = useState<Offer[]>([]);
  const [history, setHistory] = useState<HistoryTrip[]>([]);
  const loadFavorites = () => api<SavedPlace[]>("/places").then(setFavorites).catch(() => undefined);

  useEffect(() => { loadFavorites(); api<HistoryTrip[]>("/trips").then(setHistory).catch(() => undefined); try { const data = localStorage.getItem(recentStorageKey); if (data) setRecents(JSON.parse(data)); } catch {} locate(); }, []);
  useEffect(() => { if (!tripId || requestState !== "searching") return; const refresh = () => api<Offer[]>(`/trips/${tripId}/offers`).then(setOffers).catch(() => undefined); refresh(); const timer = window.setInterval(refresh, 5000); return () => clearInterval(timer); }, [tripId, requestState]);
  const remember = (place: Place) => setRecents((current) => { const next = [place, ...current.filter((item) => item.address !== place.address)].slice(0, 3); localStorage.setItem(recentStorageKey, JSON.stringify(next)); return next; });
  const selectPlace = (place: Place, target = selection) => { setQuote(null); setProposedPrice(""); if (target === "origin") { setOrigin(place); setSelection("destination"); setMessage("Origen actualizado. Selecciona el destino."); } else { setDestination(place); remember(place); setMessage("Destino seleccionado. Calcula la tarifa."); } };
  const reverse = async (point: MapPoint): Promise<Place> => { try { return await api<Place>(`/geocoding/reverse?lat=${point.lat}&lng=${point.lng}`); } catch { return { ...point, address: `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` }; } };
  const pick = async (point: MapPoint) => selectPlace(await reverse(point));
  const locate = () => { if (!navigator.geolocation) { setNotice("Tu navegador no permite GPS. Busca o toca el mapa para definir el origen."); return; } navigator.geolocation.getCurrentPosition(async (position) => { const place = await reverse({ lat: position.coords.latitude, lng: position.coords.longitude }); setOrigin(place); setSelection("destination"); setQuote(null); setNotice(position.coords.accuracy > 100 ? `Señal GPS aproximada (${Math.round(position.coords.accuracy)} m). Revisa o arrastra el pin verde.` : `Ubicación detectada (${Math.round(position.coords.accuracy)} m de precisión).`); }, (error) => setNotice(error.code === error.PERMISSION_DENIED ? "No diste permiso de ubicación. Usa búsqueda o mapa." : error.code === error.POSITION_UNAVAILABLE ? "No hay señal GPS disponible. Usa búsqueda o mapa." : "No se pudo obtener ubicación a tiempo. Inténtalo nuevamente."), { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }); };
  const estimate = async () => { if (!destination) return; try { setQuote(await api<Quote>("/trips/estimate", { method: "POST", body: JSON.stringify({ origin, destination, serviceCode: "MOTO" }) })); setMessage(""); } catch (error) { setMessage((error as Error).message); } };
  const publishRequest = async () => { if (!destination || !quote) return; const proposed = proposedPrice ? Number(proposedPrice) : undefined; if (proposed !== undefined && (!Number.isFinite(proposed) || proposed < quote.minimumFare || proposed > quote.maximumFare)) { setMessage(`La propuesta debe estar entre ${quote.minimumFare} y ${quote.maximumFare} ${quote.currency}.`); return; } setRequestState("sending"); try { const trip = await api<{ id: string }>("/trips", { method: "POST", body: JSON.stringify({ origin, destination, serviceCode: "MOTO", proposedPrice: proposed }) }); setTripId(trip.id); setRequestState("searching"); setMessage("Buscando riders disponibles cerca de tu origen."); } catch (error) { setRequestState("idle"); setMessage((error as Error).message); } };
  const acceptOffer = async (offerId: string) => { if (!tripId) return; try { await api(`/trips/${tripId}/offers/${offerId}/accept`, { method: "POST" }); setRequestState("accepted"); setMessage("Oferta aceptada. El rider irá hacia tu origen."); } catch (error) { setMessage((error as Error).message); } };
  const cancel = async () => { if (!tripId) return; try { await api(`/trips/${tripId}/cancel`, { method: "POST" }); setRequestState("cancelled"); setMessage("Solicitud cancelada."); } catch (error) { setMessage((error as Error).message); } };
  const save = async () => { const place = selection === "destination" && destination ? destination : origin; if (!label.trim()) { setMessage("Escribe un nombre para guardar la ubicación."); return; } try { await api(`/places/${encodeURIComponent(label.trim())}`, { method: "PUT", body: JSON.stringify({ ...place, reference: reference.trim() || null }) }); setLabel(""); setReference(""); loadFavorites(); } catch (error) { setMessage((error as Error).message); } };

  return <Guard roles={["CLIENT"]}><MobileAppShell role="CLIENT">
    <section id="inicio" className="scroll-mt-4"><AdvertisementCarousel /></section>
    <section id="viaje" className="card mt-3 scroll-mt-4"><div className="flex items-center justify-between"><b>Tu viaje</b><div className="flex gap-2"><button className="border py-2 text-sm" onClick={() => setPanelExpanded(!panelExpanded)}>{panelExpanded ? "Contraer" : "Expandir"}</button>{destination && <button className="border py-2 text-sm" onClick={() => { setOrigin(destination); setDestination(origin); setQuote(null); }}>⇅</button>}</div></div>{panelExpanded && <><button className={`mt-3 w-full text-left ${selection === "origin" ? "ring-2 ring-orange-400" : "border"}`} onClick={() => setSelection("origin")}><span className="muted block text-xs">Origen</span>{origin.address}</button><button className={`mt-2 w-full text-left ${selection === "destination" ? "ring-2 ring-orange-400" : "border"}`} onClick={() => setSelection("destination")}><span className="muted block text-xs">Destino</span>{destination?.address || "Toca el mapa para seleccionarlo"}</button></>}</section>
    <div id="buscar" className="scroll-mt-4"><LocationSearch onSelect={(place) => selectPlace(place)} /></div>
    {notice && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{notice}</p>}
    <p className="mt-3 text-sm font-medium">{selection === "origin" ? "Toca el mapa o arrastra el pin verde para corregir origen." : "Toca el mapa o arrastra el pin naranja para elegir destino."}</p>
    <section className="relative mt-3"><MapView origin={origin} destination={destination || undefined} focus={origin} onPick={pick} onOriginMove={async (point) => selectPlace(await reverse(point), "origin")} onDestinationMove={async (point) => selectPlace(await reverse(point), "destination")} />{destination && <div className="absolute bottom-3 left-3 right-3 rounded-xl bg-white/95 p-3 shadow-lg"><b>Moto · 1 pasajero</b><p className="muted">Ruta preparada para solicitar.</p></div>}</section><button className="mt-3 w-full border" onClick={locate}>Usar mi ubicación actual</button>
    <section className="mt-3 space-y-3"><nav className="flex gap-2 overflow-x-auto text-sm"><a className="border" href="#viaje">Viaje</a><a className="border" href="#servicio">Servicio</a><a className="border" href="#lugares">Lugares</a><a className="border" href="#historial">Historial</a></nav><section id="servicio" className="card"><b>Servicio disponible: Moto</b><p className="muted mt-1">Traslado individual en motocicleta. Capacidad: 1 pasajero. Usa casco y sigue las reglas de seguridad.</p></section>
      <section id="lugares" className="card"><b>Guardar ubicación</b><div className="mt-2 flex gap-2"><button className="border flex-1" onClick={() => setLabel("Casa")}>Casa</button><button className="border flex-1" onClick={() => setLabel("Trabajo")}>Trabajo</button></div><input className="mt-2" value={label} maxLength={40} onChange={(event) => setLabel(event.target.value)} placeholder="Nombre del lugar" /><input className="mt-2" value={reference} maxLength={120} onChange={(event) => setReference(event.target.value)} placeholder="Referencia opcional" /><button className="primary mt-2 w-full" onClick={save}>Guardar ubicación</button></section>
      {favorites.length > 0 && <section className="card"><b>Favoritos</b>{favorites.map((place) => <div className="mt-2 rounded-xl border p-2" key={place.id}><b>{place.label}</b><p className="muted">{place.address}</p><div className="mt-2 flex gap-2"><button className="border flex-1 py-2 text-sm" onClick={() => selectPlace(place, "origin")}>Origen</button><button className="border flex-1 py-2 text-sm" onClick={() => selectPlace(place, "destination")}>Destino</button><button className="py-2 text-sm text-red-600" onClick={async () => { await api(`/places/${encodeURIComponent(place.label)}`, { method: "DELETE" }); loadFavorites(); }}>Eliminar</button></div></div>)}</section>}
      {recents.length > 0 && <section id="recientes" className="card"><b>Destinos recientes</b>{recents.map((place) => <button key={place.address} className="mt-2 w-full border text-left" onClick={() => selectPlace(place, "destination")}>{place.address}</button>)}</section>}
      <section id="historial" className="card scroll-mt-4"><b>Mis viajes</b>{history.slice(0, 5).map((item) => <article className="mt-2 rounded-xl border p-2" key={item.id}><div className="flex justify-between"><span>{item.status}</span><b>{item.currency} {item.finalPrice || item.estimatedPrice}</b></div><p className="muted">{item.originAddress} → {item.destinationAddress}</p></article>)}{history.length === 0 && <p className="muted mt-2">Aún no tienes viajes.</p>}</section>
      {destination && <button className="w-full border" onClick={estimate}>Calcular estimación</button>}
      {quote && <section id="tarifa" className="card"><b>{quote.distanceKm} km · {quote.estimatedDurationMin} min</b><p className="mt-1 text-lg font-bold">{quote.currency} {quote.estimatedPrice}</p><p className="muted">Precio estimado Moto. Puede variar si cambia la ruta. Tarifa mínima: {quote.currency} {quote.minimumFare}.</p><label className="muted mt-2 block">Proponer otro monto<input type="number" min={quote.minimumFare} max={quote.maximumFare} value={proposedPrice} onChange={(event) => setProposedPrice(event.target.value)} placeholder={`Entre ${quote.minimumFare} y ${quote.maximumFare}`} /></label></section>}
      {requestState === "idle" && <button className="primary w-full" disabled={!quote} onClick={() => setRequestState("confirm")}>Continuar</button>}
      {requestState === "confirm" && <section className="card"><b>Confirmar solicitud</b><p className="muted">Moto · {destination?.address} · {quote?.currency} {proposedPrice || quote?.estimatedPrice}</p><div className="mt-3 flex gap-2"><button className="border flex-1" onClick={() => setRequestState("idle")}>Volver</button><button className="primary flex-1" onClick={publishRequest}>Publicar</button></div></section>}
      {requestState === "sending" && <p className="card">Enviando solicitud…</p>}{requestState === "searching" && <section className="card"><b>Buscando riders</b><p className="muted">La solicitud vence en 5 minutos.</p>{offers.map((offer) => <div className="mt-2 rounded-xl border p-3" key={offer.id}><b>{offer.rider.name}: {offer.currency} {offer.amount}</b><button className="primary mt-2 w-full" onClick={() => acceptOffer(offer.id)}>Aceptar oferta</button></div>)}<button className="mt-3 w-full text-red-600" onClick={cancel}>Cancelar solicitud</button></section>}{requestState === "accepted" && <p className="card text-green-700">Rider asignado. Espera su llegada.</p>}{requestState === "cancelled" && <button className="primary w-full" onClick={() => { setTripId(null); setRequestState("idle"); }}>Solicitar otra moto</button>}
      {message && <p className="text-sm" role="status">{message}</p>}
    </section>
  </MobileAppShell></Guard>;
}
