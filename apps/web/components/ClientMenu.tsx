"use client";

import { useState } from "react";
import Link from "next/link";

export function ClientMenu() {
  const [open, setOpen] = useState(false);
  return <>
    <button className="border px-3 py-2" aria-label="Abrir menú" aria-expanded={open} onClick={() => setOpen(true)}>☰</button>
    {open && <div className="fixed inset-0 z-[1000] bg-slate-950/40" onClick={() => setOpen(false)}>
      <aside className="h-full w-72 bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between"><b className="text-xl text-orange-500">MotoYa</b><button className="border px-3 py-2" onClick={() => setOpen(false)}>×</button></div>
        <p className="muted mt-2">Opciones del pasajero</p>
        <nav className="mt-5 space-y-2">
          <Link className="block rounded-xl border p-3 font-semibold" href="/client" onClick={() => setOpen(false)}>Inicio y solicitar moto</Link>
          <a className="block rounded-xl border p-3 font-semibold" href="#lugares" onClick={() => setOpen(false)}>Lugares guardados</a>
          <a className="block rounded-xl border p-3 font-semibold" href="#recientes" onClick={() => setOpen(false)}>Destinos recientes</a>
          <Link className="block rounded-xl border p-3 font-semibold" href="/rider" onClick={() => setOpen(false)}>Quiero ser rider</Link>
          <Link className="block rounded-xl border p-3 font-semibold" href="/login" onClick={() => setOpen(false)}>Cambiar de cuenta</Link>
        </nav>
      </aside>
    </div>}
  </>;
}
