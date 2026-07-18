"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Guard } from "@/components/Guard";
import { MobileAppShell } from "@/components/MobileAppShell";
import { api } from "@/lib/api";

type Place = { id: string; label: string; address: string; reference?: string | null };

export default function ClientPlacesPage() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [message, setMessage] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const load = () => api<Place[]>("/places").then(setPlaces).catch((error) => setMessage(error.message));

  useEffect(() => { load(); }, []);

  const remove = async (place: Place) => {
    setRemoving(place.id);
    try {
      await api(`/places/${encodeURIComponent(place.label)}`, { method: "DELETE" });
      setPlaces((current) => current.filter((item) => item.id !== place.id));
      setMessage(`${place.label} fue eliminado.`);
    } catch (error) { setMessage((error as Error).message); }
    finally { setRemoving(null); }
  };

  return <Guard roles={["CLIENT"]}><MobileAppShell role="CLIENT">
    <section className="saved-places-hero mt-4"><div><p>DESTINOS</p><h1>Lugares guardados</h1><span>Ten tus direcciones frecuentes siempre a mano.</span></div><b>{places.length}<small>{places.length === 1 ? "lugar" : "lugares"}</small></b><Link href="/client">Agregar desde el mapa <i>→</i></Link></section>
    <section className="saved-places-list">
      {places.map((place, index) => <article className="saved-place-card" key={place.id}><span className="saved-place-card__icon">{index < 2 ? (index === 0 ? "⌂" : "★") : "⌖"}</span><div className="saved-place-card__body"><p>DESTINO GUARDADO</p><h2>{place.label}</h2><span>{place.address}</span>{place.reference && <small>Referencia: {place.reference}</small>}</div><button type="button" className="saved-place-card__delete" disabled={removing === place.id} aria-label={`Eliminar ${place.label}`} onClick={() => void remove(place)}>{removing === place.id ? "…" : "×"}</button></article>)}
      {!places.length && <article className="saved-places-empty"><span>⌖</span><h2>Aún no tienes destinos</h2><p>Cuando ubiques tu origen y destino en el mapa, podrás guardar tus lugares con el nombre que prefieras.</p><Link href="/client">Buscar una dirección <i>→</i></Link></article>}
    </section>
    {message && <p className="flow-message" role="status">{message}</p>}
  </MobileAppShell></Guard>;
}
