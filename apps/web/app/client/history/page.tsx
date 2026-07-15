"use client";

import { useEffect, useState } from "react";
import { Guard } from "@/components/Guard";
import { MobileAppShell } from "@/components/MobileAppShell";
import { api } from "@/lib/api";

type Trip = { id: string; status: string; originAddress: string; originLat: number; originLng: number; destinationAddress: string; destinationLat: number; destinationLng: number; currency: string; estimatedPrice: string; finalPrice?: string | null };

export default function ClientHistoryPage() {
  const [trips, setTrips] = useState<Trip[]>([]); const [message, setMessage] = useState("");
  useEffect(() => { api<Trip[]>("/trips").then(setTrips).catch((error) => setMessage(error.message)); }, []);
  const saveDestination = async (trip: Trip) => {
    const label = window.prompt("Nombre para este destino, por ejemplo: Casa u Oficina");
    if (!label?.trim()) return;
    try {
      await api(`/places/${encodeURIComponent(label.trim())}`, { method: "PUT", body: JSON.stringify({ address: trip.destinationAddress, lat: trip.destinationLat, lng: trip.destinationLng }) });
      setMessage(`Destino guardado como ${label.trim()}.`);
    } catch (error) { setMessage((error as Error).message); }
  };
  return <Guard roles={["CLIENT"]}><MobileAppShell role="CLIENT"><h1 className="mt-4 text-2xl font-bold">Mis viajes</h1><p className="muted">Historial de solicitudes y viajes finalizados.</p>{trips.map((trip) => <article className="card mt-3" key={trip.id}><div className="flex justify-between"><b>{trip.status}</b><b>{trip.currency} {trip.finalPrice || trip.estimatedPrice}</b></div><p className="mt-2">{trip.originAddress} → {trip.destinationAddress}</p><button className="mt-3 w-full border text-sm" onClick={() => saveDestination(trip)}>Guardar destino</button></article>)}{!trips.length ? <p className="card mt-3">Aun no tienes viajes.</p> : null}{message ? <p className="mt-3 text-sm" role="status">{message}</p> : null}</MobileAppShell></Guard>;
}
