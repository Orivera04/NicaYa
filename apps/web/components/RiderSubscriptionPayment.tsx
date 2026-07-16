"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Plan = { id: string; name: string; description: string; price: string; currency: string; durationDays: number; benefits: string[] };
type Subscription = { status: string; expiresAt?: string; plan?: { name: string; benefits: string[] } | null } | null;

export function RiderSubscriptionPayment() {
  const [plans, setPlans] = useState<Plan[]>([]); const [subscription, setSubscription] = useState<Subscription>(null); const [renewing, setRenewing] = useState(false); const [message, setMessage] = useState("");
  useEffect(() => { Promise.all([api<Plan[]>("/subscriptions/plans"), api<Subscription>("/riders/me/subscription")]).then(([nextPlans, nextSubscription]) => { setPlans(nextPlans); setSubscription(nextSubscription); }).catch((error) => setMessage(error.message)); }, []);
  const days = subscription?.expiresAt ? Math.max(0, Math.ceil((new Date(subscription.expiresAt).getTime() - Date.now()) / 864e5)) : 0; const showPlans = !subscription || subscription.status !== "ACTIVE" || renewing;
  return <section className="mt-3"><div className="rounded-3xl bg-slate-950 p-5 text-white"><p className="text-xs font-bold uppercase tracking-wider text-orange-400">Suscripcion MotoYa</p><h2 className="mt-1 text-xl font-bold">{subscription?.status === "ACTIVE" ? subscription.plan?.name || "Plan activo" : "Elige tu plan mensual"}</h2><p className="mt-2 text-sm text-slate-300">{subscription?.status === "ACTIVE" ? `${days} dias restantes. Vence ${new Date(subscription.expiresAt!).toLocaleDateString("es-NI")}.` : "Elige un plan para continuar al pago."}</p></div>
    {subscription?.status === "ACTIVE" && !renewing ? <button className="primary mt-3 w-full" onClick={() => setRenewing(true)}>Renovar o cambiar plan</button> : null}
    {showPlans ? <section className="card mt-3"><p className="text-xs font-bold uppercase tracking-wider text-orange-500">Paso 1 de 2</p><h3 className="mt-1 font-bold">Selecciona un plan</h3><div className="mt-3 space-y-2">{plans.map((plan) => <Link key={plan.id} className="block rounded-2xl border p-4 transition hover:border-orange-500 hover:ring-2 hover:ring-orange-100" href={`/rider/subscription/checkout?planId=${encodeURIComponent(plan.id)}`}><div className="flex justify-between gap-3"><b>{plan.name}</b><b>{plan.currency} {plan.price}</b></div><p className="muted mt-1">{plan.description} · {plan.durationDays} dias</p><span className="mt-3 inline-block text-sm font-bold text-orange-600">Continuar al pago →</span></Link>)}</div></section> : null}{message ? <p className="mt-3 text-sm" role="status">{message}</p> : null}
  </section>;
}
