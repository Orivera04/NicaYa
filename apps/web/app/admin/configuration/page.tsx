"use client";

import Link from "next/link";
import { Guard } from "@/components/Guard";
import { MobileAppShell } from "@/components/MobileAppShell";

const options = [
  { href: "/admin/payments", tag: "COBROS", title: "Pagos y depósitos", description: "Cuentas receptoras y comprobantes pendientes.", icon: "₵" },
  { href: "/admin/plans", tag: "SUSCRIPCIONES", title: "Planes", description: "Precios, vigencia y disponibilidad de cada plan.", icon: "◈" },
  { href: "/admin/fares", tag: "VIAJES", title: "Tarifas de viaje", description: "Monto base, tarifa por kilómetro y mínimo.", icon: "⌁" },
  { href: "/admin/ads", tag: "COMUNICACIÓN", title: "Anuncios", description: "Contenido y orden del carrusel de clientes.", icon: "✦" },
];

export default function AdminConfigurationPage() { return <Guard roles={["ADMIN"]}><MobileAppShell role="ADMIN"><section className="mt-4 rounded-3xl bg-slate-950 p-5 text-white"><p className="text-xs font-bold tracking-[.16em] text-orange-300">CONFIGURACIONES</p><h1 className="mt-2 text-3xl font-black">Control de plataforma</h1><p className="mt-2 text-sm text-slate-300">Cada módulo modifica únicamente datos operativos reales.</p></section><section className="mt-4 space-y-3">{options.map((option) => <Link key={option.href} href={option.href} className="card flex items-center gap-4 border border-slate-100 transition hover:ring-2 hover:ring-orange-200"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-500/10 text-xl font-black text-orange-600">{option.icon}</span><span className="min-w-0 flex-1"><small className="font-bold tracking-wider text-orange-500">{option.tag}</small><b className="mt-1 block">{option.title}</b><span className="muted mt-1 block">{option.description}</span></span><span className="text-xl text-orange-500">›</span></Link>)}</section></MobileAppShell></Guard>; }
