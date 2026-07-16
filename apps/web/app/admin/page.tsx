"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Guard } from "@/components/Guard";
import { MobileAppShell } from "@/components/MobileAppShell";
import { api } from "@/lib/api";

type Dashboard = { clients: number; ridersAwaitingReview: number; operationalRiders: number; activeTrips: number; completedToday: number; pendingPayments: number };

const cards: { key: keyof Dashboard; label: string; caption: string; href: string; tone: string }[] = [
  { key: "ridersAwaitingReview", label: "Por revisar", caption: "Expedientes de riders", href: "/admin/approvals", tone: "from-amber-500/20 to-orange-500/5" },
  { key: "pendingPayments", label: "Pagos pendientes", caption: "Comprobantes recibidos", href: "/admin/payment-reviews", tone: "from-violet-500/20 to-indigo-500/5" },
  { key: "operationalRiders", label: "Riders operativos", caption: "Disponibles y habilitados", href: "/admin/riders", tone: "from-emerald-500/20 to-teal-500/5" },
  { key: "activeTrips", label: "Viajes en curso", caption: "Seguimiento operativo", href: "/admin/trips", tone: "from-sky-500/20 to-blue-500/5" },
];

export default function AdminPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [message, setMessage] = useState("");
  const load = () => api<Dashboard>("/admin/dashboard").then(setDashboard).catch((error) => setMessage(error.message));
  useEffect(() => { load(); }, []);
  return <Guard roles={["ADMIN"]}><MobileAppShell role="ADMIN"><section className="mt-4 rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-orange-950 p-5 text-white shadow-xl"><p className="text-xs font-bold tracking-[.16em] text-orange-300">MOTOYA ADMIN</p><h1 className="mt-2 text-3xl font-black">Centro de operación</h1><p className="mt-2 text-sm text-slate-300">Solo indicadores verificables para decidir qué atender ahora.</p><div className="mt-5 flex items-end justify-between"><div><p className="text-4xl font-black">{dashboard?.clients ?? "—"}</p><p className="text-sm text-slate-300">clientes registrados</p></div><Link className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-bold" href="/admin/configuration">Configuraciones</Link></div></section>
    <section className="mt-5"><div className="flex items-center justify-between"><div><h2 className="text-lg font-black">Requiere atención</h2><p className="muted">Datos actuales de la plataforma.</p></div><button className="text-sm font-bold text-orange-600" onClick={load}>Actualizar</button></div><div className="mt-3 grid grid-cols-2 gap-3">{cards.map((card) => <Link key={card.key} href={card.href} className={`rounded-2xl bg-gradient-to-br ${card.tone} p-4 ring-1 ring-slate-200 transition active:scale-[.98]`}><p className="text-2xl font-black">{dashboard?.[card.key] ?? "—"}</p><p className="mt-2 text-sm font-bold">{card.label}</p><p className="mt-1 text-xs text-slate-500">{card.caption}</p></Link>)}</div></section>
    <section className="card mt-5"><div className="flex items-center justify-between"><div><h2 className="font-black">Actividad de hoy</h2><p className="muted">Viajes finalizados desde medianoche.</p></div><b className="text-3xl text-orange-500">{dashboard?.completedToday ?? "—"}</b></div><Link className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm font-bold" href="/admin/trips"><span>Ver todos los viajes</span><span className="text-orange-500">→</span></Link></section>
    <section className="mt-5 grid grid-cols-2 gap-3"><Link className="card border border-orange-100" href="/admin/ads"><p className="text-xs font-bold text-orange-500">COMUNICACIÓN</p><b className="mt-1 block">Anuncios</b><p className="muted mt-1">Carrusel y campañas</p></Link><Link className="card border border-slate-200" href="/admin/configuration"><p className="text-xs font-bold text-slate-500">SISTEMA</p><b className="mt-1 block">Configurar</b><p className="muted mt-1">Pagos, planes y tarifas</p></Link></section>{message ? <p className="mt-3 text-sm text-red-600" role="status">{message}</p> : null}</MobileAppShell></Guard>;
}
