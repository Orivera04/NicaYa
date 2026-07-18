"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Guard } from "@/components/Guard";
import { MobileAppShell } from "@/components/MobileAppShell";
import { api } from "@/lib/api";

type Plan = { id: string; name: string; description: string; price: string; currency: string; durationDays: number };
type Method = { code: "MOTO_EXPRESS" | "BANK_TRANSFER"; name: string; instructions: string; configuration?: Record<string, string> | null };
type Created = { order: { planNameSnapshot: string }; payment: { id: string; externalReference: string; amount: string; currency: string }; method: Method };
const banks = ["BAC Credomatic", "Banpro", "Banco Lafise Bancentro", "Banco Ficohsa", "Banco Avanz", "Banco ProCredit", "Banco de Finanzas", "Otro banco"];

async function compact(file: File) { const url = URL.createObjectURL(file); try { const image = await new Promise<HTMLImageElement>((resolve, reject) => { const element = new Image(); element.onload = () => resolve(element); element.onerror = reject; element.src = url; }); const render = (size: number, quality: number) => { const scale = Math.min(1, size / Math.max(image.width, image.height)); const canvas = document.createElement("canvas"); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale); const context = canvas.getContext("2d"); if (!context) throw new Error("No se pudo preparar el comprobante."); context.drawImage(image, 0, 0, canvas.width, canvas.height); return canvas.toDataURL("image/jpeg", quality); }; let result = render(1200, .75); if (result.length > 480000) result = render(900, .62); if (result.length > 500000) throw new Error("El comprobante es muy pesado."); return result; } finally { URL.revokeObjectURL(url); } }

function Checkout() {
  const search = useSearchParams(); const planId = search.get("planId") || ""; const [plan, setPlan] = useState<Plan | null>(null); const [methods, setMethods] = useState<Method[]>([]); const [method, setMethod] = useState<Method | null>(null); const [created, setCreated] = useState<Created | null>(null); const [bank, setBank] = useState(""); const [transferRef, setTransferRef] = useState(""); const [proof, setProof] = useState(""); const [proofName, setProofName] = useState(""); const [processing, setProcessing] = useState(false); const [message, setMessage] = useState("");
  useEffect(() => { Promise.all([api<Plan[]>("/subscriptions/plans"), api<Method[]>("/subscriptions/methods")]).then(([plans, nextMethods]) => { setPlan(plans.find((item) => item.id === planId) || null); setMethods(nextMethods); setMethod(nextMethods[0] || null); }).catch((error) => setMessage(error.message)); }, [planId]);
  const create = async () => { if (!plan || !method) return; try { setCreated(await api<Created>("/subscriptions/orders", { method: "POST", body: JSON.stringify({ planId: plan.id, methodCode: method.code }) })); } catch (error) { setMessage((error as Error).message); } };
  const pick = async (file?: File) => { if (!file) return; setProcessing(true); try { setProof(await compact(file)); setProofName(file.name); } catch (error) { setMessage((error as Error).message); } finally { setProcessing(false); } };
  const send = async () => { if (!created || !method || !bank || !proof || (method.code === "BANK_TRANSFER" && !transferRef)) return; try { if (method.code === "MOTO_EXPRESS") await api(`/subscriptions/payments/${created.payment.id}/mark-paid`, { method: "POST", body: JSON.stringify({ bankName: bank, proofReference: proof }) }); else await api(`/subscriptions/payments/${created.payment.id}/transfer`, { method: "POST", body: JSON.stringify({ bankName: bank, transferReference: transferRef, proofReference: proof }) }); setMessage("Pago enviado a revision administrativa."); setCreated(null); } catch (error) { setMessage((error as Error).message); } };
  const account = created?.method.configuration || method?.configuration || {};
  const canSubmit = Boolean(bank && proof && !processing && !(created?.method.code === "BANK_TRANSFER" && !transferRef));

  return <section className={`pt-3 lg:pb-10 ${plan && created ? "pb-40" : "pb-24"}`}>
    <Link className="text-sm font-bold text-orange-600" href="/rider/subscription">← Cambiar plan</Link>
    <h1 className="mt-3 text-2xl font-black lg:text-3xl">Completa tu pago</h1>

    {!plan ? <p className="card mt-3">Plan no disponible. Regresa y selecciona otro.</p> : <div className="mt-4 lg:grid lg:grid-cols-[1.05fr_1.4fr] lg:items-start lg:gap-6">
      <section className="card">
        <p className="section-heading">Plan seleccionado</p>
        <div className="mt-2 flex items-start justify-between gap-3"><b className="min-w-0 truncate">{plan.name}</b><b className="shrink-0 tabular-nums">{plan.currency} {plan.price}</b></div>
        <p className="muted mt-1">{plan.durationDays} dias de suscripcion.</p>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <span className="text-sm font-bold text-slate-500">Total a pagar</span>
          <b className="text-xl tabular-nums">{plan.currency} {plan.price}</b>
        </div>
      </section>

      <div className="mt-4 lg:mt-0">
        {!created ? <section className="card">
          <p className="section-heading">Paso 2 de 2</p>
          <h2 className="mt-1 font-bold">Metodo de pago</h2>
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
            {methods.map((item) => <button key={item.code} type="button" aria-pressed={method?.code === item.code} className={method?.code === item.code ? "bg-orange-500 text-white" : "bg-transparent text-slate-600 hover:bg-slate-200"} onClick={() => setMethod(item)}>{item.code === "MOTO_EXPRESS" ? "Deposito" : "Transferencia"}</button>)}
          </div>
          <p className="muted mt-3">{method?.instructions}</p>
          <button className="primary mt-4 w-full" disabled={!method} onClick={create}>Generar referencia</button>
        </section> : <section className="card">
          <p className="section-heading">{created.method.code === "MOTO_EXPRESS" ? "Deposito" : "Transferencia"}</p>
          <dl className="mt-3 space-y-2 rounded-2xl bg-slate-950 p-4 text-sm text-white">
            <div className="flex items-center justify-between gap-3"><dt className="shrink-0 whitespace-nowrap text-slate-300">Titular</dt><dd className="min-w-0 truncate text-right font-bold">{account.holderName || "Pendiente de configurar"}</dd></div>
            <div className="flex items-center justify-between gap-3"><dt className="shrink-0 whitespace-nowrap text-slate-300">Banco receptor</dt><dd className="min-w-0 truncate text-right font-bold">{account.bank || "Pendiente de configurar"}</dd></div>
            <div className="flex items-center justify-between gap-3"><dt className="shrink-0 whitespace-nowrap text-slate-300">Cuenta</dt><dd className="min-w-0 truncate text-right font-bold">{account.account || "Pendiente de configurar"}</dd></div>
            <div className="border-t border-white/10 pt-3"><dt className="text-xs text-slate-300">Referencia automatica</dt><dd className="mt-1 break-all text-xl font-black tracking-widest text-orange-300">{created.payment.externalReference}</dd></div>
            <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3"><dt className="text-slate-300">Monto exacto</dt><dd className="text-lg font-black tabular-nums">{created.payment.currency} {created.payment.amount}</dd></div>
          </dl>

          <label className="mt-4 block text-sm font-semibold">Banco de origen
            <select className="mt-1" value={bank} onChange={(event) => setBank(event.target.value)}><option value="">Selecciona tu banco</option>{banks.map((name) => <option key={name}>{name}</option>)}</select>
          </label>
          {created.method.code === "BANK_TRANSFER" ? <label className="mt-3 block text-sm font-semibold">Numero de transferencia
            <input className="mt-1" value={transferRef} onChange={(event) => setTransferRef(event.target.value)} />
          </label> : null}

          <label className="mt-3 flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm font-semibold text-slate-600 transition hover:border-orange-400 hover:bg-orange-50/50">
            <span>{proofName || "Adjunta foto o archivo del comprobante"}</span>
            <input className="sr-only" type="file" accept="image/*" onChange={(event) => pick(event.target.files?.[0])} />
          </label>
          {proof ? <img className="mt-3 h-36 w-full rounded-xl object-cover" src={proof} alt="Comprobante" /> : null}

          <div className="mt-4 hidden items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 lg:flex">
            <span className="text-sm font-bold text-slate-500">Total a pagar</span>
            <b className="text-lg tabular-nums">{created.payment.currency} {created.payment.amount}</b>
          </div>
          <button className="primary mt-3 hidden w-full lg:block" disabled={!canSubmit} onClick={send}>{processing ? "Preparando comprobante..." : "Enviar pago a revision"}</button>
        </section>}
      </div>
    </div>}

    {message ? <p className="mt-3 text-sm" role="status">{message}</p> : null}

    {plan && created ? <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-2xl sm:-translate-x-1/2 sm:rounded-t-2xl sm:border-x lg:hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Total a pagar</p><b className="text-lg tabular-nums">{created.payment.currency} {created.payment.amount}</b></div>
        <button className="primary shrink-0" disabled={!canSubmit} onClick={send}>{processing ? "Preparando..." : "Enviar pago"}</button>
      </div>
    </div> : null}
  </section>;
}

export default function CheckoutPage() { return <Guard roles={["RIDER"]}><MobileAppShell role="RIDER"><Suspense fallback={<p className="card mt-4">Cargando pago...</p>}><Checkout /></Suspense></MobileAppShell></Guard>; }
