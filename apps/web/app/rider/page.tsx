"use client";

import { useEffect, useState } from "react";
import { Guard } from "@/components/Guard";
import { MapPoint, MapView } from "@/components/MapView";
import { api } from "@/lib/api";
type Trip = { id: string; originAddress: string; originLat: number; originLng: number; destinationAddress: string; estimatedPrice: string; proposedPrice?: string | null; currency: string };
export default function RiderPage() {
  const [profile, setProfile] = useState<{ approval: string; available: boolean } | null>(null); const [trips, setTrips] = useState<Trip[]>([]); const [position, setPosition] = useState<MapPoint>({ lat: 12.1364, lng: -86.2514 }); const [selected, setSelected] = useState<string>(); const [amount, setAmount] = useState(""); const [message, setMessage] = useState("");
  const load = () => Promise.all([api<typeof profile>("/riders/me"), api<Trip[]>("/riders/available-trips")]).then(([p, t]) => { setProfile(p); setTrips(t); }).catch((error) => setMessage(error.message));
  useEffect(() => { load(); navigator.geolocation?.getCurrentPosition((point) => setPosition({ lat: point.coords.latitude, lng: point.coords.longitude })); }, []);
  const toggle = async () => { await api("/riders/me/availability", { method: "PATCH", body: JSON.stringify({ available: !profile?.available }) }); load(); };
  const accept = async (id: string) => { try { await api(`/trips/${id}/accept`, { method: "POST" }); setMessage("Viaje aceptado."); load(); } catch (error) { setMessage((error as Error).message); } };
  const counter = async (id: string) => { try { await api(`/trips/${id}/offers`, { method: "POST", body: JSON.stringify({ amount: Number(amount) }) }); setMessage("Contraoferta enviada al cliente por 2 minutos."); setAmount(""); } catch (error) { setMessage((error as Error).message); } };
  const trip = trips.find((item) => item.id === selected);
  return <Guard roles={["RIDER"]}><main className="mx-auto max-w-md p-4"><header className="flex justify-between"><h1 className="text-2xl font-bold">Rider</h1><span className="muted">{profile?.available ? "Disponible" : "No disponible"}</span></header><button onClick={toggle} className="primary mt-3 w-full">{profile?.available ? "Desactivarme" : "Activarme para viajes"}</button><p className="mt-3 text-sm">Tu ubicación es azul. Solicitudes cercanas son moradas.</p><section className="mt-2"><MapView rider={position} focus={position} requests={trips.map((item) => ({ id: item.id, lat: item.originLat, lng: item.originLng, title: item.originAddress, subtitle: item.destinationAddress }))} onRequestClick={setSelected} /></section>{trip ? <article className="card mt-3"><b>{trip.originAddress} → {trip.destinationAddress}</b><p className="muted">Estimado: {trip.currency} {trip.estimatedPrice}{trip.proposedPrice ? ` · Cliente propone ${trip.currency} ${trip.proposedPrice}` : ""}</p><button onClick={() => accept(trip.id)} className="primary mt-2 w-full">Aceptar tarifa</button><div className="mt-2 flex gap-2"><input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Contraoferta" /><button className="border" onClick={() => counter(trip.id)} disabled={!amount}>Enviar</button></div></article> : <p className="muted mt-3">Toca un marcador para ver una solicitud.</p>}{message && <p className="mt-3 text-sm">{message}</p>}</main></Guard>;
}
