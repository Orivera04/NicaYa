"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdvertisementCarousel } from "@/components/AdvertisementCarousel";
import { Guard } from "@/components/Guard";
import { MobileAppShell } from "@/components/MobileAppShell";
import { api, getSession } from "@/lib/api";

type Trip = { id: string; status: string; originAddress: string; destinationAddress: string; currency: string; estimatedPrice: string; finalPrice?: string | null; createdAt: string };

const tripStatusLabel: Record<string, string> = { COMPLETED: "Finalizado", REQUESTED: "Buscando rider", ACCEPTED: "Rider asignado", RIDER_ON_THE_WAY: "Rider en camino", RIDER_ARRIVED: "Rider en el punto", IN_PROGRESS: "En curso", CANCELLED_BY_CLIENT: "Cancelado", CANCELLED_BY_RIDER: "Cancelado" };

const quickLinks = [
  { href: "/client", label: "Nuevo viaje", icon: "M5 17h14l-2-5H7zM8 12l2-5h4l2 5" },
  { href: "/client/places", label: "Lugares", icon: "M12 21s7-5.4 7-12a7 7 0 1 0-14 0c0 6.6 7 12 7 12Zm0-9a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" },
  { href: "/client/history", label: "Historial", icon: "M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" },
  { href: "/client/account", label: "Cuenta", icon: "M20 21a8 8 0 0 0-16 0M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" },
];

function formatWhen(value: string) {
  const date = new Date(value);
  const sameDay = date.toDateString() === new Date().toDateString();
  const time = date.toLocaleTimeString("es-NI", { hour: "numeric", minute: "2-digit" });
  return sameDay ? `Hoy, ${time}` : `${date.toLocaleDateString("es-NI", { day: "numeric", month: "short" })}, ${time}`;
}

export default function ClientHomePage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const name = getSession()?.user.name?.split(" ")[0] || "";

  useEffect(() => { api<Trip[]>("/trips").then(setTrips).catch(() => undefined); }, []);

  return <Guard roles={["CLIENT"]}><MobileAppShell role="CLIENT">
    <section className="mt-4">
      <p className="text-xs font-black tracking-[.14em] text-orange-500">MOTOYA</p>
      <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">{name ? `¡Hola, ${name}!` : "¿A dónde vamos hoy?"}</h1>
      <p className="mt-1 text-sm text-slate-500">Elige tu destino y recibe una tarifa antes de confirmar.</p>
    </section>

    <Link className="mt-4 flex items-center justify-between gap-3 rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-orange-950 p-5 text-white shadow-[0_18px_38px_rgba(15,23,42,.2)]" href="/client">
      <span className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-orange-500/20 text-orange-300"><svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17h14l-2-5H7zM8 12l2-5h4l2 5" /></svg></span>
        <span><b className="block text-lg">Buscar un viaje</b><span className="text-sm text-slate-300">Rápido, seguro y cercano</span></span>
      </span>
      <span aria-hidden="true" className="text-xl text-orange-400">→</span>
    </Link>

    <section className="mt-5">
      <div className="mb-2 flex items-end justify-between">
        <div><p className="text-xs font-black tracking-[.14em] text-orange-500">NOVEDADES</p><h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">Lo nuevo para ti</h2></div>
        <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[.65rem] font-black tracking-wide text-orange-700">MOTOYA</span>
      </div>
      <AdvertisementCarousel />
    </section>

    <section className="mt-5">
      <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-400">Accesos rápidos</p>
      <div className="grid grid-cols-4 gap-2">
        {quickLinks.map((item) => (
          <Link className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-100 bg-white py-3 text-center shadow-sm" href={item.href} key={item.href}>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-orange-50 text-orange-600"><svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon} /></svg></span>
            <span className="text-[11px] font-bold text-slate-600">{item.label}</span>
          </Link>
        ))}
      </div>
    </section>

    <section className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-wider text-slate-400">Viajes recientes</p>
        {trips.length ? <Link className="text-xs font-bold text-orange-600" href="/client/history">Ver todos</Link> : null}
      </div>
      {trips.length ? <div className="space-y-2">
        {trips.slice(0, 3).map((trip) => (
          <Link className="card flex items-center gap-3" href="/client/history" key={trip.id}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500"><svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-5.4 7-12a7 7 0 1 0-14 0c0 6.6 7 12 7 12Zm0-9a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" /></svg></span>
            <span className="min-w-0 flex-1">
              <b className="block truncate text-sm">{trip.originAddress}</b>
              <span className="block truncate text-xs text-slate-500">{trip.destinationAddress}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-xs font-bold text-slate-500">{formatWhen(trip.createdAt)}</span>
              <span className="block text-[11px] text-slate-400">{tripStatusLabel[trip.status] || trip.status}</span>
            </span>
          </Link>
        ))}
      </div> : <p className="card text-sm text-slate-500">Aún no tienes viajes. Cuando solicites una moto, aparecerá aquí.</p>}
    </section>

  </MobileAppShell></Guard>;
}
