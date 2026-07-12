"use client";

import { useEffect, useState } from "react";
import { Guard } from "@/components/Guard";
import { MapPoint, MapView } from "@/components/MapView";
import { api } from "@/lib/api";
import { AdvertisementCarousel } from "@/components/AdvertisementCarousel";
import { ClientMenu } from "@/components/ClientMenu";

type Place = MapPoint & { address: string };
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

  const pick = (point: MapPoint) => selectPlace(coordinatesToPlace(point));

  const locate = () => {
    if (!navigator.geolocation) {
      setMessage("Tu navegador no permite detectar la ubicación. Selecciona el origen en el mapa.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOrigin({ lat: position.coords.latitude, lng: position.coords.longitude, address: "Mi ubicación actual" });
        setQuote(null);
        setSelection("destination");
        setMessage("Ubicación detectada. Ahora selecciona destino.");
      },
      () => setMessage("No fue posible obtener tu ubicación. Selecciona el origen tocando el mapa."),
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

  const saveFavorite = async (label: "Casa" | "Trabajo") => {
    const place = selection === "destination" && destination ? destination : origin;
    setIsSaving(true);
    try {
      await api(`/places/${label}`, { method: "PUT", body: JSON.stringify(place) });
      await loadFavorites();
      setMessage(`${label} guardado.`);
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
          <b className="text-xl text-orange-500">MotoYa</b>
          <div className="flex items-center gap-2"><span className="muted">Pasajero</span><ClientMenu /></div>
        </header>

        <AdvertisementCarousel />

        <section className="card mt-3">
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

        <p className="mt-3 text-sm font-medium">{selection === "origin" ? "Toca el mapa para elegir origen." : "Toca el mapa para elegir destino."}</p>
        <section className="mt-3"><MapView origin={origin} destination={destination || undefined} focus={origin} onPick={pick} /></section>
        <button onClick={locate} className="mt-3 w-full border">Usar mi ubicación actual</button>

        <section className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button className="border" disabled={isSaving} onClick={() => saveFavorite("Casa")}>Guardar Casa</button>
            <button className="border" disabled={isSaving} onClick={() => saveFavorite("Trabajo")}>Guardar Trabajo</button>
          </div>
          {favorites.length > 0 && <div id="lugares" className="card scroll-mt-4"><b>Lugares guardados</b>{favorites.map((place) => <button key={place.id} onClick={() => selectPlace(place)} className="mt-2 w-full border text-left"><b>{place.label}</b><span className="muted block text-sm">{place.address}</span></button>)}</div>}
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
