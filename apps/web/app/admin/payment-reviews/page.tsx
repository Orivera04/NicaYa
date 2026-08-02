"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Guard } from "@/components/Guard";
import { MobileAppShell } from "@/components/MobileAppShell";
import { api } from "@/lib/api";

type Payment = { id: string; status: string; amount: string; currency: string; externalReference: string; customerReference?: string | null; proofReference?: string | null; metadata?: { bankName?: string } | null; order: { planNameSnapshot: string; rider: { user: { name: string; email: string } } }; method: { name: string } };

export default function PaymentReviewsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [message, setMessage] = useState("");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const load = () => api<Payment[]>("/subscriptions/admin/payments").then((all) => setPayments(all.filter((item) => item.status === "PENDING_REVIEW"))).catch((error) => setMessage(error.message));
  useEffect(() => { load(); }, []);
  const review = async (id: string, approved: boolean, rejectionReason?: string) => {
    try { await api(`/subscriptions/admin/payments/${id}/review`, { method: "POST", body: JSON.stringify({ approved, reason: rejectionReason }) }); setMessage(approved ? "Pago aprobado y suscripción activada." : "Pago rechazado."); await load(); }
    catch (error) { setMessage((error as Error).message); }
  };
  const reject = async () => { if (!rejecting || !reason.trim()) { setMessage("Indica el motivo del rechazo."); return; } await review(rejecting, false, reason.trim()); setRejecting(null); setReason(""); };
  return <Guard roles={["ADMIN"]}><MobileAppShell role="ADMIN"><section className="mt-4 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold tracking-wider text-orange-500">SUSCRIPCIONES</p><h1 className="text-2xl font-black">Pagos por validar</h1><p className="muted">Comprueba el depósito antes de activar el plan.</p></div><Link className="text-sm font-bold text-orange-600" href="/admin/approvals">Expedientes</Link></section><section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{payments.map((payment) => <article className="card" key={payment.id}><b className="block">{payment.order.rider.user.name} · {payment.order.planNameSnapshot}</b><p className="muted">{payment.order.rider.user.email}</p><div className="mt-3 flex items-center justify-between gap-3"><span className="font-bold">{payment.method.name}</span><span className="shrink-0 font-black tabular-nums">{payment.currency} {payment.amount}</span></div><p className="muted mt-2">Referencia MotoYa: {payment.externalReference}</p><p className="muted">Banco de origen: {payment.metadata?.bankName || "No indicado"}</p>{payment.customerReference ? <p className="muted">Referencia del banco: {payment.customerReference}</p> : null}{payment.proofReference?.startsWith("data:image") ? <img className="mt-3 max-h-72 w-full rounded-xl object-contain" src={payment.proofReference} alt="Comprobante de pago" /> : <p className="mt-3 text-sm text-red-600">No hay comprobante válido.</p>}<div className="mt-3 flex gap-2"><button className="primary flex-1" onClick={() => review(payment.id, true)}>Aprobar pago</button><button className="secondary flex-1" onClick={() => { setRejecting(payment.id); setReason(""); }}>Rechazar</button></div></article>)}{!payments.length ? <p className="card sm:col-span-2 xl:col-span-3">No hay comprobantes pendientes.</p> : null}</section>{message ? <p className="mt-3 text-sm" role="status">{message}</p> : null}{rejecting ? <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="payment-reason-title"><section className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl"><p className="text-xs font-bold tracking-wider text-orange-500">RECHAZAR PAGO</p><h2 id="payment-reason-title" className="mt-1 text-xl font-black">Motivo del rechazo</h2><textarea autoFocus maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Indica qué debe corregir el rider" /><div className="mt-4 flex gap-2"><button className="primary flex-1" onClick={reject}>Confirmar rechazo</button><button className="secondary" onClick={() => setRejecting(null)}>Cancelar</button></div></section></div> : null}</MobileAppShell></Guard>;
}
