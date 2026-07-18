"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Guard } from "@/components/Guard";
import { MobileAppShell } from "@/components/MobileAppShell";
import { api } from "@/lib/api";

type Place = { id: string; label: string; address: string; reference?: string | null };

function placeIconPath(label: string) {
  const normalized = label.toLowerCase();
  if (/(casa|hogar)/.test(normalized)) return "M3 10.5 12 3l9 7.5v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z";
  if (/(trabajo|oficina)/.test(normalized)) return "M4 7h16v12H4zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2";
  return "M12 21s7-5.4 7-12a7 7 0 1 0-14 0c0 6.6 7 12 7 12Zm0-9a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z";
}

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
      {places.map((place) => <article className="saved-place-card" key={place.id}>
        <span className="saved-place-card__icon"><svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={placeIconPath(place.label)} /></svg></span>
        <div className="saved-place-card__body"><p>DESTINO GUARDADO</p><h2>{place.label}</h2><span>{place.address}</span>{place.reference && <small>Referencia: {place.reference}</small>}</div>
        <button type="button" className="saved-place-card__delete" disabled={removing === place.id} aria-label={`Eliminar ${place.label}`} onClick={() => void remove(place)}>{removing === place.id ? "…" : "×"}</button>
      </article>)}
      {!places.length && <article className="saved-places-empty"><span><svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-5.4 7-12a7 7 0 1 0-14 0c0 6.6 7 12 7 12Zm0-9a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" /></svg></span><h2>Aún no tienes destinos</h2><p>Cuando ubiques tu origen y destino en el mapa, podrás guardar tus lugares con el nombre que prefieras.</p><Link href="/client">Buscar una dirección <i>→</i></Link></article>}
    </section>
    {message && <p className="flow-message" role="status">{message}</p>}
  </MobileAppShell></Guard>;
}
