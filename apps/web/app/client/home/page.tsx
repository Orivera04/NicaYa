"use client";

import Link from "next/link";
import { AdvertisementCarousel } from "@/components/AdvertisementCarousel";
import { Guard } from "@/components/Guard";
import { MobileAppShell } from "@/components/MobileAppShell";

export default function ClientHomePage() {
  return <Guard roles={["CLIENT"]}><MobileAppShell role="CLIENT">
    <section className="mt-4">
      <div className="mb-2 flex items-end justify-between">
        <div><p className="text-xs font-black tracking-[.14em] text-orange-500">NOVEDADES</p><h1 className="mt-1 text-xl font-black tracking-tight text-slate-900">Lo nuevo para ti</h1></div>
        <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[.65rem] font-black tracking-wide text-orange-700">MOTOYA</span>
      </div>
      <AdvertisementCarousel />
    </section>
    <section className="mt-4 rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-orange-950 p-5 text-white shadow-[0_18px_38px_rgba(15,23,42,.2)]"><p className="text-xs font-bold tracking-[.16em] text-orange-300">MOTOYA</p><h2 className="mt-2 text-3xl font-black">¿A dónde te llevamos?</h2><p className="mt-2 text-sm text-slate-300">Elige tu destino, recibe una tarifa y solicita tu moto en pocos pasos.</p><Link className="login-cta mt-5" href="/client"><span>Buscar un viaje</span><span aria-hidden="true">→</span></Link></section>
    <section className="mt-4 grid grid-cols-2 gap-3"><Link className="card border border-orange-100" href="/client/places"><span className="grid h-10 w-10 place-items-center rounded-xl bg-orange-500/10 text-lg text-orange-600">⌖</span><b className="mt-3 block">Mis lugares</b><p className="muted mt-1">Casa, trabajo y favoritos</p></Link><Link className="card border border-slate-200" href="/client/history"><span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-lg text-white">◷</span><b className="mt-3 block">Mis viajes</b><p className="muted mt-1">Consulta tu historial</p></Link></section>
  </MobileAppShell></Guard>;
}
