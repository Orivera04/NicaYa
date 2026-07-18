"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/api";

type Role = "CLIENT" | "RIDER" | "ADMIN";
type Item = { label: string; href: string; icon: string };
const items: Record<Role, Item[]> = {
  CLIENT: [{ label: "Inicio", href: "/client/home", icon: "IN" }, { label: "Viaje", href: "/client", icon: "GO" }, { label: "Lugares", href: "/client/places", icon: "LU" }, { label: "Historial", href: "/client/history", icon: "HI" }, { label: "Cuenta", href: "/client/account", icon: "CU" }],
  RIDER: [{ label: "Trabajo", href: "/rider", icon: "MO" }, { label: "Ganancias", href: "/rider/earnings", icon: "GA" }, { label: "Historial", href: "/rider/history", icon: "HI" }, { label: "Cuenta", href: "/rider/account", icon: "CU" }],
  ADMIN: [{ label: "Resumen", href: "/admin", icon: "IN" }, { label: "Aprobar", href: "/admin/approvals", icon: "OK" }, { label: "Riders", href: "/admin/riders", icon: "RI" }, { label: "Viajes", href: "/admin/trips", icon: "VI" }, { label: "Config", href: "/admin/configuration", icon: "CF" }],
};
const titles: Record<Role, string> = { CLIENT: "Pasajero", RIDER: "Rider", ADMIN: "Administracion" };

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, string> = { IN: "M3 10.5 12 3l9 7.5v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z", GO: "M5 17h14l-2-5H7zM8 12l2-5h4l2 5M7 20h.01M17 20h.01", MO: "M5 16h14l-2-5H8l-3 5zm4-5 1-3h4l2 3M7 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM11 7h3", LU: "M12 21s7-5.4 7-12a7 7 0 1 0-14 0c0 6.6 7 12 7 12zm0-9a3 3 0 1 1 0-6 3 3 0 0 1 0 6z", HI: "M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z", CU: "M20 21a8 8 0 0 0-16 0M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", OK: "m5 12 4 4L19 6", RI: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m13 10v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8", PA: "M3 7h18v10H3zM3 10h18M7 16h3", PL: "M4 5h16v14H4zM7 9h10M7 13h6", VI: "M4 5h16v14H4zM8 9h8M8 13h5", AD: "M4 19V5l14 7zM18 12h2a2 2 0 0 1 0 4h-2", CF: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.95 1.95-.06-.06A1.7 1.7 0 0 0 15.9 18.5l-.1.04v2.76h-2.76l-.04-.1a1.7 1.7 0 0 0-1.88-.34l-.06.06-1.95-1.95.06-.06A1.7 1.7 0 0 0 8.5 17l-.04-.1H5.7v-2.76l.1-.04a1.7 1.7 0 0 0 .34-1.88l-.06-.06 1.95-1.95.06.06A1.7 1.7 0 0 0 10 9.5l.1-.04V6.7h2.76l.04.1a1.7 1.7 0 0 0 1.88.34l.06-.06 1.95 1.95-.06.06A1.7 1.7 0 0 0 15.5 11l.04.1h2.76z" };
  return <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name] || paths.IN} /></svg>;
}

export function MobileAppShell({ role, children }: { role: Role; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const links = items[role];
  const active = (href: string) => pathname === href;
  const signOut = () => { logout(); window.location.assign("/login"); };

  const sidebarLinks = <nav className="mt-6 space-y-1">{links.map((item) => <Link key={item.label} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active(item.href) ? "bg-orange-500 text-white shadow-[0_8px_18px_rgba(249,115,22,.28)]" : "text-slate-300 hover:bg-white/5 hover:text-white"}`} href={item.href} aria-current={active(item.href) ? "page" : undefined} onClick={() => setOpen(false)}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${active(item.href) ? "bg-white/20" : "bg-white/10 text-orange-300"}`}><NavIcon name={item.icon} /></span>{item.label}</Link>)}
    {role === "CLIENT" ? <Link className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/5 hover:text-white" href="/rider" onClick={() => setOpen(false)}>Quiero ser rider</Link> : null}
  </nav>;

  return <div className="min-h-dvh bg-slate-100 lg:flex">
    <aside className="hidden shrink-0 border-r border-white/10 bg-slate-950 text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-64 lg:flex-col lg:px-4 lg:py-6">
      <div className="rounded-2xl border border-orange-400/15 bg-gradient-to-br from-orange-500/20 to-slate-900 px-4 py-4"><b className="text-xl">Moto<span className="text-orange-400">Ya</span></b><p className="mt-1 text-xs text-slate-300">{titles[role]}</p></div>
      {sidebarLinks}
      <button className="secondary mt-auto w-full border-white/15 bg-white/5 text-left text-red-300 hover:border-red-400/30 hover:bg-red-500/10" onClick={signOut}>Cerrar sesion</button>
    </aside>

    <main className="min-h-dvh flex-1 pb-24 lg:pb-0">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-slate-950/95 px-4 py-3 text-white shadow-lg backdrop-blur lg:hidden">
        <button className="border border-white/15 bg-white/5 px-3 py-2 text-sm" aria-label="Abrir menu" onClick={() => setOpen(true)}>Menu</button>
        <div className="text-center"><b className="text-xl tracking-tight">Moto<span className="text-orange-400">Ya</span></b><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{titles[role]}</p></div>
        <span className="grid h-10 w-10 place-items-center rounded-full border border-orange-400/30 bg-orange-500/15 text-[10px] font-bold text-orange-300">{role.slice(0, 2)}</span>
      </header>
      <header className="sticky top-0 z-30 hidden items-center justify-between border-b border-slate-200 bg-white/90 px-10 py-4 backdrop-blur lg:flex">
        <p className="text-sm font-bold text-slate-500">{titles[role]}</p>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-orange-500/10 text-xs font-bold text-orange-600">{role.slice(0, 2)}</span>
      </header>

      {open ? <div className="fixed inset-0 z-[100] bg-slate-950/70 lg:hidden" onClick={() => setOpen(false)}>
        <aside className="h-full w-80 overflow-y-auto bg-slate-950 p-5 text-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
          <div className="rounded-2xl border border-orange-400/15 bg-gradient-to-br from-orange-500/20 to-slate-900 p-4"><b className="text-2xl">Moto<span className="text-orange-400">Ya</span></b><p className="mt-1 text-sm text-slate-300">{titles[role]} · Viaja rapido, seguro y cerca.</p></div>
          <nav className="mt-5 space-y-2">{links.map((item) => <Link key={item.label} className={`flex items-center gap-3 rounded-xl border p-3 font-semibold ${active(item.href) ? "border-orange-400/50 bg-orange-500 text-white" : "border-white/10 bg-white/5 text-slate-200"}`} href={item.href} aria-current={active(item.href) ? "page" : undefined} onClick={() => setOpen(false)}><span className={`grid h-8 w-8 place-items-center rounded-lg ${active(item.href) ? "bg-white/20" : "bg-white/10 text-orange-300"}`}><NavIcon name={item.icon} /></span>{item.label}</Link>)}
            {role === "CLIENT" ? <Link className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 font-semibold text-slate-200" href="/rider" onClick={() => setOpen(false)}>Quiero ser rider</Link> : null}
            <button className="mt-4 w-full border border-red-400/20 bg-red-500/10 text-left text-red-300" onClick={signOut}>Cerrar sesion</button>
          </nav>
        </aside>
      </div> : null}

      <div className="px-4 sm:mx-auto sm:max-w-2xl lg:max-w-5xl lg:px-10 lg:py-2">{children}</div>

      <nav className="fixed bottom-0 left-1/2 z-40 flex w-full max-w-md -translate-x-1/2 justify-around border-t border-white/10 bg-slate-950 px-1 pt-2 text-white shadow-[0_-8px_24px_rgba(15,23,42,.28)] [padding-bottom:calc(.5rem+env(safe-area-inset-bottom))] sm:max-w-2xl lg:hidden">{links.slice(0, 5).map((item) => <Link key={item.label} href={item.href} aria-current={active(item.href) ? "page" : undefined} className={`flex min-w-12 flex-col items-center gap-1 rounded-xl px-1 py-1 text-[10px] font-semibold ${active(item.href) ? "bg-orange-500/15 text-orange-300" : "text-slate-400"}`}><span className={`grid h-7 w-7 place-items-center rounded-lg ${active(item.href) ? "bg-orange-500 text-white" : "bg-white/10"}`}><NavIcon name={item.icon} /></span>{item.label}</Link>)}</nav>
    </main>
  </div>;
}
