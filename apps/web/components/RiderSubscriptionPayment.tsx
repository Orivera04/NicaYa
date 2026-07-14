"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Subscription = { status: string; expiresAt?: string | null; pricePaid?: string | null; currency: string } | null;
type Payment = { reference: string; amount: string; currency: string; expiresAt: string; status: string };

export function RiderSubscriptionPayment() {
  const [subscription, setSubscription] = useState<Subscription>(null);
  const [step, setStep] = useState<"summary" | "amount" | "reference">("summary");
  const [amount, setAmount] = useState("");
  const [payment, setPayment] = useState<Payment | null>(null);
  const [message, setMessage] = useState("");
  const load = () => api<Subscription>("/riders/me/subscription").then(setSubscription).catch(() => undefined);
  useEffect(() => { load(); }, []);
  const createPayment = async () => { try { const value = amount ? Number(amount) : undefined; const result = await api<Payment>("/riders/me/subscription/payments", { method: "POST", body: JSON.stringify({ amount: value }) }); setPayment(result); setStep("reference"); } catch (error) { setMessage((error as Error).message); } };
  return <section id="suscripcion" className="mt-3 scroll-mt-4 rounded-2xl bg-slate-950 p-4 text-white"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-orange-400">Suscripción MotoYa</p><b className="mt-1 block text-xl">{subscription?.status === "ACTIVE" ? "Plan activo" : "Plan pendiente"}</b><p className="mt-1 text-sm text-slate-300">{subscription?.expiresAt ? `Vence: ${new Date(subscription.expiresAt).toLocaleDateString("es-NI")}` : "Activa tu plan para recibir viajes."}</p></div><span className="rounded-full bg-orange-500/20 px-3 py-1 text-sm text-orange-300">Punto Xpress</span></div>
    {step === "summary" && <button className="primary mt-4 w-full" onClick={() => setStep("amount")}>Recargar suscripción</button>}
    {step === "amount" && <div className="mt-4 rounded-xl bg-white p-3 text-slate-900"><b>Recargar con Punto Xpress</b><p className="muted mt-1">Ingresa el monto a pagar. Se generará una referencia válida durante 1 hora.</p><label className="mt-3 block text-sm">Valor a recargar (NIO)<input type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Ej. 200" /></label><div className="mt-3 flex gap-2"><button className="border flex-1" onClick={() => setStep("summary")}>Volver</button><button className="primary flex-1" onClick={createPayment}>Continuar</button></div></div>}
    {step === "reference" && payment && <div className="mt-4 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 p-4 text-center"><p className="font-semibold">Dirígete al Punto Xpress más cercano</p><p className="mt-3 text-sm">Número de referencia</p><b className="text-4xl tracking-widest">{payment.reference}</b><p className="mt-4 text-sm">Valor a pagar</p><b className="text-2xl">{payment.currency} {payment.amount}</b><p className="mt-4 text-xs text-white/90">El pago puede tardar hasta una hora en reflejarse. Guarda esta referencia.</p><button className="mt-4 w-full bg-white text-orange-600" onClick={() => { setStep("summary"); setPayment(null); load(); }}>Entendido</button></div>}
    {message && <p className="mt-3 text-sm text-orange-200" role="status">{message}</p>}
  </section>;
}
