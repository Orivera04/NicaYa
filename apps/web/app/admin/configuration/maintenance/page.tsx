"use client";

import Link from "next/link";
import { useState } from "react";
import { Guard } from "@/components/Guard";
import { MobileAppShell } from "@/components/MobileAppShell";
import { api } from "@/lib/api";

type CleanupResult = {
  retained: { role: string; email: string }[];
  removedUsers: number;
  trips: number;
  pendingPayments: number;
  pendingOrders: number;
  savedPlaces: number;
};

const confirmationText = "BORRAR DATOS DE PRUEBA";

export default function DemoCleanupPage() {
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CleanupResult | null>(null);
  const [error, setError] = useState("");

  async function handleCleanup() {
    setLoading(true);
    setError("");
    try {
      const response = await api<CleanupResult>("/admin/maintenance/cleanup-demo-data", {
        method: "POST",
        body: JSON.stringify({ confirmation }),
      });
      setResult(response);
      setConfirmation("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo completar la limpieza.");
    } finally {
      setLoading(false);
    }
  }

  return <Guard roles={["ADMIN"]}><MobileAppShell role="ADMIN">
    <main className="mx-auto max-w-xl space-y-4 py-4">
      <Link href="/admin/configuration" className="inline-flex text-sm font-bold text-orange-600">&larr; Volver a configuracion</Link>
      <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl shadow-slate-950/15">
        <p className="text-xs font-bold tracking-[.16em] text-orange-300">MANTENIMIENTO</p>
        <h1 className="mt-2 text-3xl font-black">Depurar datos de prueba</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">Elimina viajes, sesiones, pagos y cuentas temporales. Conserva exactamente el administrador, Rider4 y Helda Rueda, junto con la configuracion, documentos aprobados y la suscripcion activa.</p>
      </section>

      <section className="card space-y-4 border border-orange-200">
        <div><h2 className="font-bold">Confirmacion requerida</h2><p className="muted mt-1">Escribe <b>{confirmationText}</b> para habilitar la accion.</p></div>
        <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={confirmationText} className="input font-semibold" autoComplete="off" />
        {error ? <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p> : null}
        <button type="button" disabled={confirmation !== confirmationText || loading} onClick={handleCleanup} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Limpiando datos..." : "Eliminar datos de prueba"}</button>
      </section>

      {result ? <section className="card border border-emerald-200 bg-emerald-50"><h2 className="font-bold text-emerald-900">Limpieza completada</h2><p className="mt-2 text-sm text-emerald-800">Se eliminaron {result.removedUsers} cuentas, {result.trips} viajes, {result.pendingPayments} pagos pendientes y {result.pendingOrders} ordenes pendientes.</p><p className="mt-2 text-xs text-emerald-700">Conservadas: {result.retained.map((user) => `${user.role}: ${user.email}`).join(" | ")}</p></section> : null}
    </main>
  </MobileAppShell></Guard>;
}