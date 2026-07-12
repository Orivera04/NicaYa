"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { MapPoint } from "@/components/MapView";

export type GeocodedPlace = MapPoint & { address: string };

export function LocationSearch({ onSelect }: { onSelect: (place: GeocodedPlace) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodedPlace[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const searchPlaces = async (value: string) => {
    if (value.trim().length < 3) { setResults([]); setMessage(value ? "Escribe al menos 3 caracteres." : ""); return; }
    setLoading(true);
    try {
      const matches = await api<GeocodedPlace[]>(`/geocoding/search?q=${encodeURIComponent(value.trim())}`);
      setResults(matches);
      setMessage(matches.length === 0 ? "No encontramos esa dirección. Prueba con barrio, ciudad o referencia." : matches.length > 1 ? "Encontramos varios resultados. Confirma el lugar correcto." : "Confirma este resultado.");
    } catch {
      setMessage("No se pudo buscar la dirección en este momento. Puedes elegirla en el mapa.");
    } finally { setLoading(false); }
  };
  const search = async (event: FormEvent) => { event.preventDefault(); await searchPlaces(query); };
  useEffect(() => { const timer = window.setTimeout(() => { searchPlaces(query); }, 450); return () => window.clearTimeout(timer); }, [query]);

  const choose = (place: GeocodedPlace) => { onSelect(place); setQuery(place.address); setResults([]); setMessage("Ubicación seleccionada."); };
  return <section className="card mt-3"><b>Buscar dirección</b><form className="mt-2 flex gap-2" onSubmit={search}><input aria-label="Buscar dirección" placeholder="Barrio, calle o lugar" value={query} onChange={(event) => setQuery(event.target.value)} /><button className="primary shrink-0" disabled={loading} type="submit">Buscar</button></form>{message && <p className="muted mt-2" role="status">{message}</p>}{results.length > 0 && <div className="mt-2 space-y-2">{results.map((place) => <button key={`${place.lat}-${place.lng}`} onClick={() => choose(place)} className="w-full border text-left"><b>Usar esta ubicación</b><span className="muted mt-1 block text-sm">{place.address}</span></button>)}</div>}</section>;
}
