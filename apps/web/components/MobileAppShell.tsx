"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { logout } from "@/lib/api";

type Role = "CLIENT" | "RIDER" | "ADMIN";
type Item = { label: string; href: string; icon: string };
const items: Record<Role, Item[]> = {
  CLIENT: [{ label: "Inicio", href: "/client/home", icon: "⌂" }, { label: "Viaje", href: "/client", icon: "⌕" }, { label: "Lugares", href: "/client/places", icon: "⌖" }, { label: "Historial", href: "/client/history", icon: "◷" }, { label: "Cuenta", href: "/client/account", icon: "◉" }],
  RIDER: [{ label: "Inicio", href: "/rider", icon: "⌂" }, { label: "Trabajo", href: "/rider/work", icon: "⌖" }, { label: "Plan", href: "/rider/subscription", icon: "▣" }, { label: "Ganancias", href: "/rider/earnings", icon: "$" }, { label: "Historial", href: "/rider/history", icon: "◷" }],
  ADMIN: [{ label: "Resumen", href: "/admin", icon: "⌂" }, { label: "Riders", href: "/admin/riders", icon: "♞" }, { label: "Pagos", href: "/admin/payments", icon: "$" }, { label: "Planes", href: "/admin/plans", icon: "▣" }, { label: "Viajes", href: "/admin/trips", icon: "◷" }, { label: "Anuncios", href: "/admin/ads", icon: "▤" }],
};
const titles: Record<Role, string> = { CLIENT: "Pasajero", RIDER: "Rider", ADMIN: "Administracion" };

export function MobileAppShell({ role, children }: { role: Role; children: ReactNode }) {
  const [open, setOpen] = useState(false); const links = items[role];
  const signOut = () => { logout(); window.location.assign("/login"); };
  return <main className="mx-auto min-h-dvh max-w-md bg-slate-50 pb-24"><header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur"><button className="border px-3 py-2" aria-label="Abrir menu" onClick={() => setOpen(true)}>☰</button><div className="text-center"><b className="text-xl tracking-tight text-slate-950">Moto<span className="text-orange-500">Ya</span></b><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{titles[role]}</p></div><span className="grid h-10 w-10 place-items-center rounded-full bg-orange-100 text-lg text-orange-600">{role === "CLIENT" ? "●" : role === "RIDER" ? "♞" : "⚙"}</span></header>
    {open ? <div className="fixed inset-0 z-[100] bg-slate-950/50" onClick={() => setOpen(false)}><aside className="h-full w-80 overflow-y-auto bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="rounded-2xl bg-slate-950 p-4 text-white"><b className="text-2xl">Moto<span className="text-orange-500">Ya</span></b><p className="mt-1 text-sm text-slate-300">{titles[role]} · Viaja rapido, seguro y cerca.</p></div><nav className="mt-5 space-y-2">{links.map((item) => <Link key={item.label} className="flex items-center gap-3 rounded-xl border p-3 font-semibold" href={item.href} onClick={() => setOpen(false)}><span className="text-orange-500">{item.icon}</span>{item.label}</Link>)}{role === "CLIENT" ? <Link className="flex items-center gap-3 rounded-xl border p-3 font-semibold" href="/rider" onClick={() => setOpen(false)}><span className="text-orange-500">♞</span>Quiero ser rider</Link> : null}<button className="mt-4 w-full text-left text-red-600" onClick={signOut}>Cerrar sesion</button></nav></aside></div> : null}
    <div className="px-4">{children}</div><nav className="fixed bottom-0 left-1/2 z-40 flex w-full max-w-md -translate-x-1/2 justify-around border-t border-slate-200 bg-white px-1 py-2 shadow-[0_-8px_24px_rgba(15,23,42,.08)]">{links.slice(0, 5).map((item) => <Link key={item.label} href={item.href} className="flex min-w-12 flex-col items-center gap-0.5 rounded-xl px-1 py-1 text-[10px] font-medium text-slate-500"><span className="text-xl text-orange-500">{item.icon}</span>{item.label}</Link>)}</nav>
  </main>;
}
