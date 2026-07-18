"use client";

import Link from "next/link";
import { Guard } from "@/components/Guard";
import { MobileAppShell } from "@/components/MobileAppShell";

const options = [
  { href: "/admin/payments", tag: "COBROS", title: "Pagos y depósitos", description: "Cuentas receptoras y comprobantes pendientes.", icon: "M3 7h18v10H3zM3 10h18M7 16h3" },
  { href: "/admin/plans", tag: "SUSCRIPCIONES", title: "Planes", description: "Precios, vigencia y disponibilidad de cada plan.", icon: "M12 3 3 9l9 12 9-12-9-6ZM3 9h18" },
  { href: "/admin/fares", tag: "VIAJES", title: "Tarifas de viaje", description: "Monto base, tarifa por kilómetro y mínimo.", icon: "M4 6h16M4 12h10M4 18h16" },
  { href: "/admin/ads", tag: "COMUNICACIÓN", title: "Anuncios", description: "Contenido y orden del carrusel de clientes.", icon: "M3 11v2a2 2 0 0 0 2 2h1l3 4v-6M6 15h1l10-5v8L7 13" },
];

export default function AdminConfigurationPage() {
  return <Guard roles={["ADMIN"]}><MobileAppShell role="ADMIN">
    <section className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-slate-950 p-5 text-white">
      <div>
        <p className="text-xs font-bold tracking-[.16em] text-orange-300">CONFIGURACIONES</p>
        <h1 className="mt-2 text-3xl font-black">Control de plataforma</h1>
        <p className="mt-2 max-w-md text-sm text-slate-300">Cada módulo modifica únicamente datos operativos reales.</p>
      </div>
      <div className="flex h-16 min-w-16 flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3">
        <b className="text-2xl">{options.length}</b>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Módulos</span>
      </div>
    </section>

    <section className="mt-4 grid gap-3 sm:grid-cols-2">
      {options.map((option) => (
        <Link key={option.href} href={option.href} className="card flex items-center gap-4 border border-slate-100 transition hover:ring-2 hover:ring-orange-200">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-orange-500/10 text-orange-600"><svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={option.icon} /></svg></span>
          <span className="min-w-0 flex-1"><small className="font-bold tracking-wider text-orange-500">{option.tag}</small><b className="mt-1 block">{option.title}</b><span className="muted mt-1 block">{option.description}</span></span>
          <span className="text-xl text-orange-500">›</span>
        </Link>
      ))}
    </section>
  </MobileAppShell></Guard>;
}
