"use client";

import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { Guard } from "@/components/Guard";
import { LocationSearch } from "@/components/LocationSearch";
import { MapPoint, MapView } from "@/components/MapView";
import { MobileAppShell } from "@/components/MobileAppShell";
import { api, getSession } from "@/lib/api";

type Place = MapPoint & { address: string; reference?: string | null };
type SavedPlace = Place & { id: string; label: string };
type Quote = { distanceKm: number; estimatedDurationMin: number; minimumFare: number; maximumFare: number; estimatedPrice: number; currency: string };
type Offer = { id: string; amount: string; currency: string; rider: { name: string } };
type ActiveTrip = { id: string; status: string; originAddress: string; destinationAddress: string; originLat: number; originLng: number; destinationLat: number; destinationLng: number; riderLat?: number | null; riderLng?: number | null; riderLocationUpdatedAt?: string | null; currency: string; estimatedPrice: string; finalPrice?: string | null; rider?: { name: string; riderProfile?: { vehicleModel?: string | null; vehiclePlate?: string | null; workZoneLat?: number | null; workZoneLng?: number | null } | null } | null };
type LiveLocation = { tripId: string; lat: number; lng: number; accuracy?: number | null; heading?: number | null; recordedAt: string };

type Stage = "ROUTE" | "QUOTE" | "REVIEW" | "SEARCHING" | "TRACKING";
const initialPlace: Place = { lat: 12.1364, lng: -86.2514, address: "Tu ubicación actual" };
const cancellationReasons = ["Dirección errónea", "Problemas de seguridad", "El rider pidió cancelar", "Rider muy lejos", "Solo estoy probando la aplicación", "Otro"];

const statusCopy: Record<string, string> = {
  ACCEPTED: "Rider asignado. Está preparando el recorrido hacia tu origen.",
  RIDER_ON_THE_WAY: "Tu rider va en camino al punto de recogida.",
  RIDER_ARRIVED: "Tu rider llegó. Verifica la moto antes de iniciar.",
  IN_PROGRESS: "Viaje en curso. Confirma la llegada solo al llegar al destino.",
};

export default function ClientPage() {
  const [origin, setOrigin] = useState<Place>(initialPlace);
  const [destination, setDestination] = useState<Place | null>(null);
  const [editing, setEditing] = useState<"origin" | "destination">("destination");
  const [focus, setFocus] = useState<MapPoint>(initialPlace);
  const [stage, setStage] = useState<Stage>("ROUTE");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [proposedPrice, setProposedPrice] = useState("");
  const [favorites, setFavorites] = useState<SavedPlace[]>([]);
  const [tripId, setTripId] = useState<string | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
  const [liveRider, setLiveRider] = useState<LiveLocation | null>(null);
  const [tripInfoExpanded, setTripInfoExpanded] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState(cancellationReasons[0]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const selectPlace = (place: Place, target = editing) => {
    setFocus(place); setQuote(null); setProposedPrice(""); setShowSearch(false);
    if (target === "origin") { setOrigin(place); setEditing("destination"); setMessage("Origen actualizado. Ahora elige el destino."); }
    else { setDestination(place); setMessage("Destino seleccionado. Ya puedes consultar la tarifa."); }
  };
  const reverse = async (point: MapPoint): Promise<Place> => {
    try { return await api<Place>(`/geocoding/reverse?lat=${point.lat}&lng=${point.lng}`); }
    catch { return { ...point, address: `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` }; }
  };
  const locate = () => {
    if (!navigator.geolocation) return setMessage("Tu navegador no permite usar GPS. Busca una dirección o toca el mapa.");
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const place = await reverse({ lat: coords.latitude, lng: coords.longitude });
      setOrigin(place); setFocus(place); setQuote(null); setMessage(`Ubicación actualizada. Precisión aproximada: ${Math.round(coords.accuracy)} m.`);
    }, (error) => setMessage(error.code === error.PERMISSION_DENIED ? "No autorizaste ubicación. Puedes buscar o ajustar el punto en el mapa." : "No pudimos obtener tu ubicación. Inténtalo otra vez."), { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  };
  const load = async () => {
    try {
      const [places, trips] = await Promise.all([api<SavedPlace[]>("/places"), api<ActiveTrip[]>("/trips")]);
      setFavorites(places);
      const current = trips.find((trip) => ["REQUESTED", "ACCEPTED", "RIDER_ON_THE_WAY", "RIDER_ARRIVED", "IN_PROGRESS"].includes(trip.status));
      if (current) { setTripId(current.id); setActiveTrip(current); if (current.riderLat != null && current.riderLng != null) setLiveRider({ tripId: current.id, lat: current.riderLat, lng: current.riderLng, recordedAt: current.riderLocationUpdatedAt || new Date().toISOString() }); setTripInfoExpanded(true); setStage(current.status === "REQUESTED" ? "SEARCHING" : "TRACKING"); }
    } catch (error) { setMessage((error as Error).message); }
  };
  useEffect(() => { void load(); locate(); }, []);
  useEffect(() => {
    if (!tripId) return;
    const refresh = async () => {
      try {
        const trip = await api<ActiveTrip>(`/trips/${tripId}`);
        setActiveTrip(trip);
        if (trip.status === "REQUESTED") {
          setStage("SEARCHING");
          setOffers(await api<Offer[]>(`/trips/${tripId}/offers`));
        } else if (["ACCEPTED", "RIDER_ON_THE_WAY", "RIDER_ARRIVED", "IN_PROGRESS"].includes(trip.status)) setStage("TRACKING");
        else if (trip.status.startsWith("CANCELLED") || trip.status === "COMPLETED") reset();
      } catch { /* A short networking error should not erase an active trip from the screen. */ }
    };
    void refresh(); const timer = window.setInterval(() => void refresh(), 5000); return () => clearInterval(timer);
  }, [tripId]);
  useEffect(() => {
    if (!tripId) return;
    const session = getSession(); if (!session) return;
    const socketUrl = (process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api").replace(/\/api$/, "");
    const socket = io(socketUrl, { auth: { token: session.accessToken }, transports: ["websocket", "polling"] });
    const updateLocation = (location: LiveLocation) => { if (location.tripId === tripId) setLiveRider(location); };
    socket.on("trip:location-updated", updateLocation);
    return () => { socket.disconnect(); };
  }, [tripId]);

  const getQuote = async () => {
    if (!destination) return setMessage("Primero selecciona un destino.");
    setBusy(true); setMessage("");
    try { setQuote(await api<Quote>("/trips/estimate", { method: "POST", body: JSON.stringify({ origin, destination, serviceCode: "MOTO" }) })); setStage("QUOTE"); }
    catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  };
  const validAmount = useMemo(() => proposedPrice ? Number(proposedPrice) : undefined, [proposedPrice]);
  const publish = async () => {
    if (!destination || !quote) return;
    if (validAmount !== undefined && (!Number.isFinite(validAmount) || validAmount < quote.minimumFare || validAmount > quote.maximumFare)) return setMessage(`Tu propuesta debe estar entre ${quote.minimumFare} y ${quote.maximumFare} ${quote.currency}.`);
    setBusy(true); setMessage("");
    try {
      const trip = await api<{ id: string }>("/trips", { method: "POST", body: JSON.stringify({ origin, destination, serviceCode: "MOTO", proposedPrice: validAmount }) });
      setTripId(trip.id); setStage("SEARCHING"); setMessage("Solicitud enviada a riders cercanos.");
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  };
  const acceptOffer = async (offerId: string) => {
    if (!tripId) return; setBusy(true);
    try { await api(`/trips/${tripId}/offers/${offerId}/accept`, { method: "POST" }); setStage("TRACKING"); setMessage("Oferta aceptada. Tu rider irá hacia el origen."); }
    catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  };
  const rejectOffer = async (offerId: string) => {
    if (!tripId) return;
    try { await api(`/trips/${tripId}/offers/${offerId}/reject`, { method: "POST" }); setOffers((current) => current.filter((offer) => offer.id !== offerId)); }
    catch (error) { setMessage((error as Error).message); }
  };
  const cancel = async () => {
    if (!tripId) return; setBusy(true);
    try { await api(`/trips/${tripId}/cancel`, { method: "POST", body: JSON.stringify({ reason: cancelReason }) }); setShowCancel(false); setMessage("Solicitud cancelada."); reset(); }
    catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  };
  const complete = async () => {
    if (!tripId || activeTrip?.status !== "IN_PROGRESS") return;
    setBusy(true);
    try { await api(`/trips/${tripId}/complete`, { method: "POST" }); setMessage("Viaje finalizado. Puedes calificarlo desde Historial."); reset(); }
    catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  };
  const reset = () => { setTripId(null); setActiveTrip(null); setLiveRider(null); setTripInfoExpanded(true); setOffers([]); setDestination(null); setQuote(null); setProposedPrice(""); setStage("ROUTE"); setEditing("destination"); };
  const selectFavorite = (place: SavedPlace) => selectPlace(place, "destination");
  const price = quote ? (proposedPrice || quote.estimatedPrice) : null;
  const riderOnMap = liveRider ? { lat: liveRider.lat, lng: liveRider.lng } : activeTrip?.riderLat != null && activeTrip.riderLng != null ? { lat: activeTrip.riderLat, lng: activeTrip.riderLng } : activeTrip?.rider?.riderProfile?.workZoneLat != null && activeTrip.rider.riderProfile.workZoneLng != null ? { lat: activeTrip.rider.riderProfile.workZoneLat, lng: activeTrip.rider.riderProfile.workZoneLng } : undefined;

  return <Guard roles={["CLIENT"]}><MobileAppShell role="CLIENT"><div className="trip-flow pb-4">
    {stage === "ROUTE" && <><section className="trip-flow-hero"><p>MOTOYA · PASAJERO</p><h1>¿A dónde te llevamos?</h1><span>Elige tu destino, revisa la tarifa y solicita una moto.</span></section>
      <section className="route-editor"><div className="route-point"><i className="origin-dot" /><button onClick={() => setEditing("origin")}><small>Origen</small>{origin.address}</button><button aria-label="Usar ubicación actual" onClick={locate}>◎</button></div><div className="route-line" /><div className="route-point"><i className="destination-dot" /><button onClick={() => setEditing("destination")}><small>Destino</small>{destination?.address || "Buscar destino"}</button><button aria-label="Buscar destino" onClick={() => setShowSearch(true)}>＋</button></div></section>
      {showSearch && <LocationSearch onSelect={(place) => selectPlace(place)} />}
      <section className="relative mt-3"><MapView origin={origin} destination={destination || undefined} focus={focus} onPick={async (point) => selectPlace(await reverse(point))} onOriginMove={async (point) => selectPlace(await reverse(point), "origin")} onDestinationMove={async (point) => selectPlace(await reverse(point), "destination")} /><button className="map-recenter" aria-label="Centrar ubicación" onClick={locate}>◎</button></section>
      {favorites.length > 0 && <section className="quick-destinations"><p>Destinos guardados</p><div>{favorites.slice(0, 4).map((place) => <button key={place.id} onClick={() => selectFavorite(place)}><b>{place.label}</b><span>{place.address}</span></button>)}</div></section>}
      <button className="trip-main-action" disabled={!destination || busy} onClick={getQuote}>{busy ? "Calculando…" : "Ver tarifa de Moto"}<span>→</span></button></>}

    {stage === "QUOTE" && quote && <><section className="flow-page-title"><button onClick={() => setStage("ROUTE")}>←</button><div><p>VIAJE MOTO</p><h1>Elige cómo pagar</h1></div></section><section className="relative mt-3"><MapView origin={origin} destination={destination || undefined} focus={destination || origin} /><div className="route-summary"><span>{origin.address}</span><i>↓</i><b>{destination?.address}</b></div></section><section className="moto-service-card"><div><p>MOTO · 1 PASAJERO</p><h2>Viaje estimado</h2><span>{quote.distanceKm.toFixed(1)} km · {quote.estimatedDurationMin} min</span></div><strong>{quote.currency} {quote.estimatedPrice}</strong></section><section className="offer-choice"><div><b>Tarifa calculada</b><span>Usar {quote.currency} {quote.estimatedPrice}</span><button className={!proposedPrice ? "chosen" : ""} onClick={() => setProposedPrice("")}>Seleccionar</button></div><div><b>Proponer mi tarifa</b><span>Entre {quote.currency} {quote.minimumFare} y {quote.maximumFare}</span><input type="number" value={proposedPrice} min={quote.minimumFare} max={quote.maximumFare} onChange={(event) => setProposedPrice(event.target.value)} placeholder="Ingresa tu monto" /></div></section><button className="trip-main-action" onClick={() => setStage("REVIEW")}>Continuar con {quote.currency} {price}<span>→</span></button></>}

    {stage === "REVIEW" && quote && <><section className="flow-page-title"><button onClick={() => setStage("QUOTE")}>←</button><div><p>CONFIRMACIÓN</p><h1>Revisa tu viaje</h1></div></section><section className="confirmation-card"><div className="confirmation-route"><span>Origen</span><b>{origin.address}</b><i>↓</i><span>Destino</span><b>{destination?.address}</b></div><div className="confirmation-info"><span>Moto · 1 pasajero</span><span>{quote.distanceKm.toFixed(1)} km · {quote.estimatedDurationMin} min</span></div><div className="confirmation-price"><span>Tarifa propuesta</span><b>{quote.currency} {price}</b></div></section><p className="flow-notice">La tarifa puede variar si la ruta cambia. No se realizará ningún cobro en línea en este MVP.</p><button className="trip-main-action" disabled={busy} onClick={publish}>{busy ? "Publicando…" : "Confirmar y pedir moto"}<span>→</span></button></>}

    {stage === "SEARCHING" && <><section className="relative mt-3"><MapView origin={origin} destination={destination || undefined} focus={origin} /></section><section className="searching-sheet"><div className="sheet-handle" /><p>SOLICITUD ENVIADA</p><h1>Buscando riders cercanos</h1><span>Tu solicitud está activa. Recibirás una oferta o una aceptación en cuanto haya disponibilidad.</span><div className="searching-pulse"><i /><i /><i /></div>{offers.length > 0 ? <div className="offer-list">{offers.map((offer) => <article key={offer.id}><p>{offer.rider.name}</p><b>{offer.currency} {offer.amount}</b><div><button className="trip-main-action" disabled={busy} onClick={() => acceptOffer(offer.id)}>Aceptar</button><button onClick={() => rejectOffer(offer.id)}>Rechazar</button></div></article>)}</div> : <p className="waiting-copy">Aún no hay ofertas. Puedes esperar o cancelar la solicitud.</p>}<button className="cancel-link" onClick={() => setShowCancel(true)}>Cancelar viaje</button></section></>}

    {stage === "TRACKING" && activeTrip && <><section className={`relative mt-3 ${tripInfoExpanded ? "" : "tracking-map-expanded"}`}><MapView origin={{ lat: activeTrip.originLat, lng: activeTrip.originLng }} destination={{ lat: activeTrip.destinationLat, lng: activeTrip.destinationLng }} rider={riderOnMap} routeFrom={riderOnMap} routeTo={activeTrip.status === "IN_PROGRESS" ? { lat: activeTrip.destinationLat, lng: activeTrip.destinationLng } : { lat: activeTrip.originLat, lng: activeTrip.originLng }} focus={{ lat: activeTrip.originLat, lng: activeTrip.originLng }} /><span className="map-legend">♙ Pasajero&nbsp;&nbsp; 🏍 Rider&nbsp;&nbsp; ⚑ Destino</span></section><section className={`tracking-sheet ${tripInfoExpanded ? "" : "tracking-sheet-collapsed"}`}><button className="tracking-collapse" aria-expanded={tripInfoExpanded} onClick={() => setTripInfoExpanded((expanded) => !expanded)}><span>{tripInfoExpanded ? "Ocultar información del viaje" : "Ver información del viaje"}</span><b>{tripInfoExpanded ? "⌄" : "⌃"}</b></button>{tripInfoExpanded && <><p>VIAJE ACTUAL · {activeTrip.status.replaceAll("_", " ")}</p><h1>{activeTrip.status === "RIDER_ON_THE_WAY" ? "Tu rider va en camino" : activeTrip.status === "RIDER_ARRIVED" ? "Tu rider ya llegó" : activeTrip.status === "IN_PROGRESS" ? "Vas rumbo al destino" : activeTrip.rider?.name || "Rider asignado"}</h1><span>{activeTrip.rider?.name || "Rider asignado"} · {activeTrip.rider?.riderProfile?.vehicleModel || "Motocicleta confirmada"}{activeTrip.rider?.riderProfile?.vehiclePlate ? ` · ${activeTrip.rider.riderProfile.vehiclePlate}` : ""}</span><div className="trip-status"><b>{activeTrip.status.replaceAll("_", " ")}</b><span>{statusCopy[activeTrip.status] || "Actualizando el estado de tu viaje."}</span></div><div className="tracking-route"><span>{activeTrip.originAddress}</span><i>↓</i><span>{activeTrip.destinationAddress}</span></div>{liveRider && <small className="live-location-status">● Ubicación del rider actualizada en vivo</small>}{activeTrip.status === "IN_PROGRESS" ? <button className="trip-main-action" disabled={busy} onClick={complete}>{busy ? "Finalizando…" : "Confirmar llegada"}<span>→</span></button> : <button className="cancel-link" onClick={() => setShowCancel(true)}>Cancelar según las reglas operativas</button>}</>}</section></>}
    {message && <p className="flow-message" role="status">{message}</p>}
    {showCancel && <div className="flow-modal" onClick={() => setShowCancel(false)}><section onClick={(event) => event.stopPropagation()}><div className="sheet-handle" /><p>CANCELAR SOLICITUD</p><h2>¿Por qué quieres cancelar?</h2>{cancellationReasons.map((reason) => <label key={reason} className={cancelReason === reason ? "selected" : ""}><input type="radio" checked={cancelReason === reason} onChange={() => setCancelReason(reason)} />{reason}</label>)}<button className="trip-main-action" disabled={busy} onClick={cancel}>Cancelar viaje</button></section></div>}
  </div></MobileAppShell></Guard>;
}
