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
  ADMIN: [{ label: "Resumen", href: "/admin", icon: "IN" }, { label: "Aprobar", href: "/admin/approvals", icon: "OK" }, { label: "Riders", href: "/admin/riders", icon: "RI" }, { label: "Pagos", href: "/admin/payments", icon: "PA" }, { label: "Planes", href: "/admin/plans", icon: "PL" }, { label: "Viajes", href: "/admin/trips", icon: "VI" }, { label: "Anuncios", href: "/admin/ads", icon: "AD" }],
};
const titles: Record<Role, string> = { CLIENT: "Pasajero", RIDER: "Rider", ADMIN: "Administracion" };

export function MobileAppShell({ role, children }: { role: Role; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const links = items[role];
  const active = (href: string) => pathname === href;
  const signOut = () => { logout(); window.location.assign("/login"); };

  return <main className="mx-auto min-h-dvh max-w-md bg-slate-100 pb-24">
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-slate-950/95 px-4 py-3 text-white shadow-lg backdrop-blur">
      <button className="border border-white/15 bg-white/5 px-3 py-2 text-sm" aria-label="Abrir menu" onClick={() => setOpen(true)}>Menu</button>
      <div className="text-center"><b className="text-xl tracking-tight">Moto<span className="text-orange-400">Ya</span></b><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{titles[role]}</p></div>
      <span className="grid h-10 w-10 place-items-center rounded-full border border-orange-400/30 bg-orange-500/15 text-[10px] font-bold text-orange-300">{role.slice(0, 2)}</span>
    </header>
    {open ? <div className="fixed inset-0 z-[100] bg-slate-950/70" onClick={() => setOpen(false)}>
      <aside className="h-full w-80 overflow-y-auto bg-slate-950 p-5 text-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="rounded-2xl border border-orange-400/15 bg-gradient-to-br from-orange-500/20 to-slate-900 p-4"><b className="text-2xl">Moto<span className="text-orange-400">Ya</span></b><p className="mt-1 text-sm text-slate-300">{titles[role]} · Viaja rapido, seguro y cerca.</p></div>
        <nav className="mt-5 space-y-2">{links.map((item) => <Link key={item.label} className={`flex items-center gap-3 rounded-xl border p-3 font-semibold ${active(item.href) ? "border-orange-400/50 bg-orange-500 text-white" : "border-white/10 bg-white/5 text-slate-200"}`} href={item.href} aria-current={active(item.href) ? "page" : undefined} onClick={() => setOpen(false)}><span className={`grid h-8 w-8 place-items-center rounded-lg text-[10px] ${active(item.href) ? "bg-white/20" : "bg-white/10 text-orange-300"}`}>{item.icon}</span>{item.label}</Link>)}
          {role === "CLIENT" ? <Link className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 font-semibold text-slate-200" href="/rider" onClick={() => setOpen(false)}>Quiero ser rider</Link> : null}
          <button className="mt-4 w-full border border-red-400/20 bg-red-500/10 text-left text-red-300" onClick={signOut}>Cerrar sesion</button>
        </nav>
      </aside>
    </div> : null}
    <div className="px-4">{children}</div>
    <nav className="fixed bottom-0 left-1/2 z-40 flex w-full max-w-md -translate-x-1/2 justify-around border-t border-white/10 bg-slate-950 px-1 py-2 text-white shadow-[0_-8px_24px_rgba(15,23,42,.28)]">{links.slice(0, 5).map((item) => <Link key={item.label} href={item.href} aria-current={active(item.href) ? "page" : undefined} className={`flex min-w-12 flex-col items-center gap-1 rounded-xl px-1 py-1 text-[10px] font-semibold ${active(item.href) ? "bg-orange-500/15 text-orange-300" : "text-slate-400"}`}><span className={`grid h-7 w-7 place-items-center rounded-lg text-[9px] ${active(item.href) ? "bg-orange-500 text-white" : "bg-white/10"}`}>{item.icon}</span>{item.label}</Link>)}</nav>
  </main>;
}
