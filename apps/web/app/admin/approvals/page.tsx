"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Guard } from "@/components/Guard";
import { MobileAppShell } from "@/components/MobileAppShell";
import { api } from "@/lib/api";

type Rider = { id: string; name: string; email: string; riderProfile: { approval: string; onboardingStatus: string; workZoneDepartment?: string | null; documents: { status: string }[] } };

export default function ApprovalsPage() {
  const [riders, setRiders] = useState<Rider[]>([]); const [filter, setFilter] = useState("UNDER_REVIEW"); const [search, setSearch] = useState(""); const [message, setMessage] = useState("");
  useEffect(() => { const timeout = window.setTimeout(() => api<Rider[]>(`/admin/approvals?status=${encodeURIComponent(filter)}&q=${encodeURIComponent(search)}`).then(setRiders).catch((error) => setMessage(error.message)), 200); return () => window.clearTimeout(timeout); }, [filter, search]);
  return <Guard roles={["ADMIN"]}><MobileAppShell role="ADMIN"><section className="mt-4"><p className="text-sm font-bold text-orange-500">BACK-OFFICE</p><h1 className="text-2xl font-black">Centro de aprobaciones</h1><p className="muted">Selecciona una solicitud para revisar su expediente privado.</p></section>
    <input className="mt-3" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre o correo" aria-label="Buscar rider" /><select className="mt-2" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="ALL">Todos los estados</option><option value="UNDER_REVIEW">En revisión</option><option value="REQUIRES_CORRECTION">Corrección solicitada</option><option value="DOCUMENTS_PENDING">Pendientes</option><option value="SUBSCRIPTION_REQUIRED">Suscripción</option><option value="READY_TO_WORK">Operativos</option></select>
    <section className="mt-3 space-y-2">{riders.map((rider) => { const complete = rider.riderProfile.documents.filter((document) => document.status === "APPROVED").length; return <Link className="card block transition hover:ring-2 hover:ring-orange-400" href={`/admin/approvals/${rider.id}`} key={rider.id}><div className="flex items-start justify-between gap-2"><div><b>{rider.name}</b><p className="muted">{rider.email}</p></div><span className="rounded-full bg-orange-50 px-2 py-1 text-[10px] font-bold text-orange-700">{rider.riderProfile.onboardingStatus}</span></div><div className="mt-3 flex items-center justify-between"><span className="text-xs text-slate-500">{complete}/4 documentos aprobados · {rider.riderProfile.workZoneDepartment || "Zona pendiente"}</span><span className="text-sm font-bold text-orange-600">Ver expediente ›</span></div></Link>; })}{!riders.length ? <p className="card">No hay riders en este estado.</p> : null}</section>{message ? <p className="mt-3 text-sm" role="status">{message}</p> : null}
  </MobileAppShell></Guard>;
}
