"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/api";

type Role = "CLIENT" | "RIDER" | "ADMIN";
type Item = { label: string; href: string; icon: string };
const items: Record<Role, Item[]> = {
  CLIENT: [{ label: "Inicio", href: "/client/home", icon: "IN" }, { label: "Viaje", href: "/client", icon: "GO" }, { label: "Lugares", href: "/client/places", icon: "LU" }, { label: "Historial", href: "/client/history", icon: "HI" }, { label: "Cuenta", href: "/client/account", icon: "CU" }],
  RIDER: [{ label: "Trabajo", href: "/rider", icon: "GO" }, { label: "Plan", href: "/rider/subscription", icon: "PL" }, { label: "Ganancias", href: "/rider/earnings", icon: "GA" }, { label: "Historial", href: "/rider/history", icon: "HI" }, { label: "Cuenta", href: "/rider/account", icon: "CU" }],
  ADMIN: [{ label: "Resumen", href: "/admin", icon: "IN" }, { label: "Riders", href: "/admin/riders", icon: "RI" }, { label: "Pagos", href: "/admin/payments", icon: "PA" }, { label: "Planes", href: "/admin/plans", icon: "PL" }, { label: "Viajes", href: "/admin/trips", icon: "VI" }, { label: "Anuncios", href: "/admin/ads", icon: "AD" }],
};
const titles: Record<Role, string> = { CLIENT: "Pasajero", RIDER: "Rider", ADMIN: "Administracion" };

export function MobileAppShell({ role, children }: { role: Role; children: ReactNode }) {
  const [open, setOpen] = useState(false); const pathname = usePathname(); const links = items[role];
  const signOut = () => { logout(); window.location.assign("/login"); };
  const active = (href: string) => pathname === href;
  return <main className="mx-auto min-h-dvh max-w-md bg-slate-50 pb-24"><header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur"><button className="border px-3 py-2" aria-label="Abrir menu" onClick={() => setOpen(true)}>Menu</button><div className="text-center"><b className="text-xl tracking-tight text-slate-950">Moto<span className="text-orange-500">Ya</span></b><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{titles[role]}</p></div><span className="grid h-10 w-10 place-items-center rounded-full bg-orange-100 text-xs font-bold text-orange-600">{role}</span></header>
    {open ? <div className="fixed inset-0 z-[100] bg-slate-950/50" onClick={() => setOpen(false)}><aside className="h-full w-80 overflow-y-auto bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="rounded-2xl bg-slate-950 p-4 text-white"><b className="text-2xl">Moto<span className="text-orange-500">Ya</span></b><p className="mt-1 text-sm text-slate-300">{titles[role]} · Viaja rapido, seguro y cerca.</p></div><nav className="mt-5 space-y-2">{links.map((item) => <Link key={item.label} className={`flex items-center gap-3 rounded-xl border p-3 font-semibold ${active(item.href) ? "border-orange-500 bg-orange-50 text-orange-700" : ""}`} href={item.href} aria-current={active(item.href) ? "page" : undefined} onClick={() => setOpen(false)}><span className="grid h-8 w-8 place-items-center rounded-lg bg-orange-100 text-[10px] text-orange-700">{item.icon}</span>{item.label}</Link>)}{role === "CLIENT" ? <Link className="flex items-center gap-3 rounded-xl border p-3 font-semibold" href="/rider" onClick={() => setOpen(false)}>Quiero ser rider</Link> : null}<button className="mt-4 w-full text-left text-red-600" onClick={signOut}>Cerrar sesion</button></nav></aside></div> : null}
    <div className="px-4">{children}</div><nav className="fixed bottom-0 left-1/2 z-40 flex w-full max-w-md -translate-x-1/2 justify-around border-t border-slate-200 bg-white px-1 py-2 shadow-[0_-8px_24px_rgba(15,23,42,.08)]">{links.slice(0, 5).map((item) => <Link key={item.label} href={item.href} aria-current={active(item.href) ? "page" : undefined} className={`flex min-w-12 flex-col items-center gap-1 rounded-xl px-1 py-1 text-[10px] font-semibold ${active(item.href) ? "bg-orange-50 text-orange-600" : "text-slate-500"}`}><span className={`grid h-7 w-7 place-items-center rounded-lg text-[9px] ${active(item.href) ? "bg-orange-500 text-white" : "bg-slate-100"}`}>{item.icon}</span>{item.label}</Link>)}</nav>
  </main>;
}
