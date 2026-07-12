"use client";

import { useEffect, useState } from "react";
import { Guard } from "@/components/Guard";
import { MapPoint, MapView } from "@/components/MapView";
import { api } from "@/lib/api";
import { AdvertisementCarousel } from "@/components/AdvertisementCarousel";
import { ClientMenu } from "@/components/ClientMenu";
import { LocationSearch } from "@/components/LocationSearch";

type Place = MapPoint & { address: string; reference?: string | null };
type SavedPlace = Place & { id: string; label: string };
type Quote = { distanceKm: number; estimatedPrice: number; currency: string };

const managua: Place = { lat: 12.1364, lng: -86.2514, address: "Managua, Nicaragua" };
const recentStorageKey = "motoya-recent-places";

function coordinatesToPlace(point: MapPoint): Place {
  return { ...point, address: `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` };
}

export default function ClientPage() {
  const [origin, setOrigin] = useState<Place>({ ...managua, address: "Selecciona tu origen" });
  const [destination, setDestination] = useState<Place | null>(null);
  const [selection, setSelection] = useState<"origin" | "destination">("origin");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [message, setMessage] = useState("");
  const [favorites, setFavorites] = useState<SavedPlace[]>([]);
  const [recents, setRecents] = useState<Place[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [placeLabel, setPlaceLabel] = useState("");
  const [reference, setReference] = useState("");
  const [locationNotice, setLocationNotice] = useState("");

  const loadFavorites = () => api<SavedPlace[]>("/places").then(setFavorites).catch(() => undefined);

  useEffect(() => {
    loadFavorites();
    try {
      const saved = window.localStorage.getItem(recentStorageKey);
      if (saved) setRecents(JSON.parse(saved) as Place[]);
    } catch {
      // Los lugares recientes son una comodidad local; el viaje sigue funcionando sin ellos.
    }
    locate();
  }, []);

  const remember = (place: Place) => {
    setRecents((current) => {
      const next = [place, ...current.filter((item) => item.address !== place.address)].slice(0, 3);
      window.localStorage.setItem(recentStorageKey, JSON.stringify(next));
      return next;
    });
  };

  const selectPlace = (place: Place, target = selection) => {
    setQuote(null);
    if (target === "origin") {
      setOrigin(place);
      setSelection("destination");
      setMessage("Ahora toca el destino en el mapa.");
      return;
    }
    setDestination(place);
    remember(place);
    setMessage("Destino seleccionado. Calcula la estimación.");
  };

  const interpretedPoint = async (point: MapPoint) => {
    try { return await api<Place>(`/geocoding/reverse?lat=${point.lat}&lng=${point.lng}`); }
    catch { return coordinatesToPlace(point); }
  };
  const pick = async (point: MapPoint) => {
    try { selectPlace(await api<Place>(`/geocoding/reverse?lat=${point.lat}&lng=${point.lng}`)); }
    catch { selectPlace(coordinatesToPlace(point)); setMessage("Ubicación elegida. No fue posible convertirla en dirección legible."); }
  };

  const locate = () => {
    if (!navigator.geolocation) {
      setMessage("Tu navegador no permite detectar la ubicación. Selecciona el origen en el mapa.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        let currentLocation: Place = { ...point, address: "Mi ubicación actual" };
        try { currentLocation = await api<Place>(`/geocoding/reverse?lat=${point.lat}&lng=${point.lng}`); } catch { /* La ubicación sigue siendo utilizable por coordenadas. */ }
        setOrigin(currentLocation);
        setQuote(null);
        setSelection("destination");
        setLocationNotice(position.coords.accuracy > 100 ? `La señal GPS tiene una precisión aproximada de ${Math.round(position.coords.accuracy)} m. Revisa o arrastra el pin si es necesario.` : `Ubicación detectada (precisión aproximada de ${Math.round(position.coords.accuracy)} m).`);
        setMessage("Ubicación detectada. Ahora selecciona destino.");
      },
      (error) => { const detail = error.code === error.PERMISSION_DENIED ? "No diste permiso de ubicación. Busca o toca el mapa para elegir el origen." : error.code === error.POSITION_UNAVAILABLE ? "No hay señal GPS disponible. Busca o toca el mapa para elegir el origen." : "La ubicación tardó demasiado. Inténtalo de nuevo o selecciona el origen manualmente."; setLocationNotice(detail); setMessage(detail); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const estimate = async () => {
    if (!destination) return;
    try {
      setQuote(await api<Quote>("/trips/estimate", { method: "POST", body: JSON.stringify({ origin, destination }) }));
      setMessage("");
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const requestRide = async () => {
    if (!destination || !quote) return;
    try {
      const trip = await api<{ id: string }>("/trips", { method: "POST", body: JSON.stringify({ origin, destination }) });
      setMessage(`Viaje solicitado. Código ${trip.id}. Esperando un rider disponible.`);
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const saveFavorite = async (label: string) => {
    const place = selection === "destination" && destination ? destination : origin;
    if (!label.trim()) { setMessage("Escribe un nombre para guardar este lugar."); return; }
    setIsSaving(true);
    try {
      await api(`/places/${encodeURIComponent(label.trim())}`, { method: "PUT", body: JSON.stringify({ ...place, reference: reference.trim() || null }) });
      await loadFavorites();
      setPlaceLabel(""); setReference(""); setMessage(`${label.trim()} guardado.`);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const swapPlaces = () => {
    if (!destination) return;
    setOrigin(destination);
    setDestination(origin);
    setQuote(null);
    setSelection("destination");
    setMessage("Origen y destino intercambiados. Calcula una nueva estimación.");
  };

  const clearDestination = () => {
    setDestination(null);
    setQuote(null);
    setSelection("destination");
    setMessage("Selecciona un nuevo destino en el mapa.");
  };

  return (
    <Guard roles={["CLIENT"]}>
      <main className="mx-auto max-w-md p-4">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2"><ClientMenu /><b className="text-xl text-orange-500">MotoYa</b></div>
          <span className="muted">Pasajero</span>
        </header>

        <AdvertisementCarousel />

        <section id="viaje" className="card mt-3 scroll-mt-4">
          <div className="flex items-center justify-between gap-3">
            <b>Tu viaje</b>
            {destination && <button onClick={swapPlaces} className="border py-2 text-sm">⇅ Intercambiar</button>}
          </div>
          <button onClick={() => setSelection("origin")} className={`mt-3 w-full text-left ${selection === "origin" ? "ring-2 ring-orange-400" : "border"}`}>
            <span className="muted block text-xs">Origen</span>{origin.address}
          </button>
          <button onClick={() => setSelection("destination")} className={`mt-2 w-full text-left ${selection === "destination" ? "ring-2 ring-orange-400" : "border"}`}>
            <span className="muted block text-xs">Destino</span>{destination?.address || "Toca el mapa para seleccionarlo"}
          </button>
          {destination && <button onClick={clearDestination} className="mt-2 w-full text-sm text-red-600">Limpiar destino</button>}
        </section>

        <div id="buscar" className="scroll-mt-4"><LocationSearch onSelect={(place) => selectPlace(place)} /></div>

        <p className="mt-3 text-sm font-medium">{selection === "origin" ? "Toca el mapa o arrastra el pin verde para corregir el origen." : "Toca el mapa o arrastra el pin naranja para elegir destino."}</p>
        {locationNotice && <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="status">{locationNotice}</p>}
        <section className="mt-3"><MapView origin={origin} destination={destination || undefined} focus={origin} onPick={pick} onOriginMove={async (point) => selectPlace(await interpretedPoint(point), "origin")} onDestinationMove={async (point) => selectPlace(await interpretedPoint(point), "destination")} /></section>
        <button onClick={locate} className="mt-3 w-full border">Usar mi ubicación actual</button>

        <section className="mt-3 space-y-3">
          <section id="lugares" className="card scroll-mt-4"><b>Guardar ubicación</b><p className="muted mt-1">Guarda Casa, Trabajo u otro lugar con el nombre que prefieras.</p><div className="mt-3 flex gap-2"><button className="border flex-1" onClick={() => setPlaceLabel("Casa")}>Casa</button><button className="border flex-1" onClick={() => setPlaceLabel("Trabajo")}>Trabajo</button></div><div className="mt-2 grid gap-2"><input maxLength={40} value={placeLabel} onChange={(event) => setPlaceLabel(event.target.value)} placeholder="Nombre del lugar" /><input maxLength={120} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Referencia opcional (ej. portón azul)" /><button className="primary" disabled={isSaving} onClick={() => saveFavorite(placeLabel)}>Guardar ubicación</button></div></section>
          {favorites.length > 0 && <div className="card"><b>Lugares guardados</b>{favorites.map((place) => <div className="mt-2 rounded-xl border p-2" key={place.id}><b>{place.label}</b><span className="muted mt-1 block text-sm">{place.address}{place.reference ? ` · ${place.reference}` : ""}</span><div className="mt-2 flex gap-2"><button onClick={() => selectPlace(place, "origin")} className="border flex-1 py-2 text-sm">Usar origen</button><button onClick={() => selectPlace(place, "destination")} className="border flex-1 py-2 text-sm">Usar destino</button><button className="py-2 text-sm text-red-600" aria-label={`Eliminar ${place.label}`} onClick={async () => { await api(`/places/${encodeURIComponent(place.label)}`, { method: "DELETE" }); loadFavorites(); }}>Eliminar</button></div></div>)}</div>}
          {recents.length > 0 && <div id="recientes" className="card scroll-mt-4"><b>Destinos recientes</b>{recents.map((place) => <button key={place.address} onClick={() => selectPlace(place, "destination")} className="mt-2 w-full border text-left">{place.address}</button>)}</div>}
          {destination && <button onClick={estimate} className="w-full border">Calcular estimación</button>}
          {quote && <div className="card"><b>{quote.distanceKm} km · {quote.currency} {quote.estimatedPrice}</b><p className="muted">Precio estimado antes de solicitar.</p></div>}
          <button onClick={requestRide} className="primary w-full" disabled={!quote}>Solicitar moto</button>
          {message && <p className="text-sm" role="status">{message}</p>}
        </section>
      </main>
    </Guard>
  );
}
