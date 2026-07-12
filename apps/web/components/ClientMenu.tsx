"use client";

import { useState } from "react";
import Link from "next/link";
import { logout } from "@/lib/api";

export function ClientMenu() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const signOut = () => { logout(); window.location.assign("/login"); };
  return <>
    <button className="border px-3 py-2" aria-label="Abrir menú" aria-expanded={open} onClick={() => setOpen(true)}>☰</button>
    {open && <div className="fixed inset-0 z-[1000] bg-slate-950/40" onClick={close}>
      <aside className="h-full w-80 overflow-y-auto bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between"><div><b className="text-xl text-orange-500">MotoYa</b><p className="muted">Panel del pasajero</p></div><button className="border px-3 py-2" aria-label="Cerrar menú" onClick={close}>×</button></div>
        <nav className="mt-6 space-y-5">
          <section><p className="mb-2 text-xs font-bold uppercase text-slate-400">Viajes</p><div className="space-y-2"><Link className="block rounded-xl border p-3 font-semibold" href="/client" onClick={close}>Solicitar una moto</Link><a className="block rounded-xl border p-3 font-semibold" href="#viaje" onClick={close}>Tu viaje actual</a><a className="block rounded-xl border p-3 font-semibold" href="#recientes" onClick={close}>Destinos recientes</a></div></section>
          <section><p className="mb-2 text-xs font-bold uppercase text-slate-400">Ubicaciones</p><div className="space-y-2"><a className="block rounded-xl border p-3 font-semibold" href="#buscar" onClick={close}>Buscar una dirección</a><a className="block rounded-xl border p-3 font-semibold" href="#lugares" onClick={close}>Lugares guardados</a></div></section>
          <section><p className="mb-2 text-xs font-bold uppercase text-slate-400">Cuenta</p><div className="space-y-2"><Link className="block rounded-xl border p-3 font-semibold" href="/rider" onClick={close}>Quiero ser rider</Link><button className="w-full border text-left text-red-600" onClick={signOut}>Cerrar sesión</button></div></section>
        </nav>
      </aside>
    </div>}
  </>;
}
