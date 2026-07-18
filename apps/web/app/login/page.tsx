"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthHeroIllustration } from "@/components/AuthHero";
import { api, setSession, Session } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!formRef.current) return;

    setLoading(true);
    setError("");
    try {
      const form = new FormData(formRef.current);
      const session = await api<Session>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      setSession(session, remember);
      router.push(session.user.role === "ADMIN" ? "/admin" : session.user.role === "RIDER" ? "/rider" : "/client/home");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const values = [
    { icon: "M13 2 3 14h7l-1 8 11-14h-7l1-8Z", title: "Rapido", detail: "Conecta con un rider cercano en minutos." },
    { icon: "M12 3 5 6v6c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6l-7-3Z", title: "Seguro", detail: "Rutas y riders verificados en cada viaje." },
    { icon: "M12 21s7-5.4 7-12a7 7 0 1 0-14 0c0 6.6 7 12 7 12Zm0-9a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z", title: "Cerca", detail: "Cobertura activa en tu ciudad." },
  ];

  return (
    <main className="min-h-dvh bg-slate-950 text-white lg:flex">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-orange-950 lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:p-12">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full border border-orange-400/20" />
          <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full border border-orange-400/10" />
          <AuthHeroIllustration className="absolute inset-x-0 bottom-0 h-[280px] w-full opacity-90" />
        </div>
        <Link className="relative text-xl font-black tracking-tight" href="/">Moto<span className="text-orange-400">Ya</span></Link>
        <div className="relative">
          <p className="text-xs font-bold tracking-[.2em] text-orange-400">PLATAFORMA DE MOVILIDAD</p>
          <h1 className="mt-4 max-w-lg text-5xl font-black leading-[1.05] tracking-tight">Muevete rapido.<br /><span className="text-orange-500">Llega seguro.</span></h1>
          <p className="mt-5 max-w-md text-slate-300">Pide una moto, síguela en el mapa en tiempo real y paga como prefieras.</p>
          <div className="mt-10 space-y-4">
            {values.map((value) => (
              <div className="flex items-start gap-3" key={value.title}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-500/15 text-orange-300"><svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={value.icon} /></svg></span>
                <div><b className="block text-sm">{value.title}</b><p className="mt-0.5 text-sm text-slate-400">{value.detail}</p></div>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-slate-500">MotoYa · Movilidad bajo demanda</p>
      </aside>

      <div className="flex flex-1 items-center justify-center p-5 lg:p-12">
        <div className="w-full max-w-md">
          <Link className="inline-block text-sm font-bold text-slate-300 lg:hidden" href="/">&larr; MotoYa</Link>

          <div className="relative mt-4 overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500/25 via-slate-900 to-slate-950 p-5 lg:hidden">
            <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full border border-orange-400/25" />
            <AuthHeroIllustration className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full opacity-80" />
            <p className="relative text-[10px] font-bold tracking-[.2em] text-orange-300">MOTOYA</p>
            <h2 className="relative mt-2 text-2xl font-black leading-tight">Muevete rapido.<br /><span className="text-orange-400">Llega seguro.</span></h2>
          </div>

          <section className="mt-8 lg:mt-0">
            <p className="text-sm font-bold tracking-wide text-orange-400">BIENVENIDO DE NUEVO</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Ingresa a tu cuenta</h1>
            <p className="mt-2 text-sm text-slate-300">Usa tus datos para continuar de forma segura.</p>
          </section>

          <form
            className="mt-7 space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_20px_55px_rgba(0,0,0,.28)]"
            ref={formRef}
            onSubmit={(event) => event.preventDefault()}
          >
            <label className="block text-sm font-semibold">Correo
              <div className="relative mt-1">
                <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16v12H4z" /><path d="m4 7 8 6 8-6" /></svg></span>
                <input className="border-white/15 bg-white/10 pl-10 text-white placeholder:text-slate-400" name="email" type="email" autoComplete="email" placeholder="nombre@correo.com" required />
              </div>
            </label>
            <label className="block text-sm font-semibold">Contrasena
              <div className="relative mt-1">
                <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg></span>
                <input className="border-white/15 bg-white/10 pl-10 pr-12 text-white placeholder:text-slate-400" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Tu contrasena" required />
                <button aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"} className="absolute right-1 top-1 grid h-10 w-10 place-items-center rounded-lg p-0 text-slate-300 hover:bg-white/10 hover:text-white" type="button" onClick={() => setShowPassword((value) => !value)}>
                  {showPassword ? <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.8 10.8 0 0 1 12 4c5.8 0 9.5 8 9.5 8a18.5 18.5 0 0 1-2.6 3.6M6.3 6.3C3.9 8 2.5 12 2.5 12S6.2 20 12 20c1.2 0 2.3-.3 3.3-.7" /></svg> : <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2.5 12S6.2 4 12 4s9.5 8 9.5 8-3.7 8-9.5 8-9.5-8-9.5-8Z" /><circle cx="12" cy="12" r="3" /></svg>}
                </button>
              </div>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input className="h-4 w-4 shrink-0 accent-orange-500" type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
              Recordarme en este dispositivo
            </label>
            {error ? <p className="rounded-xl bg-red-500/15 p-3 text-sm text-red-200" role="alert">{error}</p> : null}
            <button className="login-cta w-full" disabled={loading} onClick={() => submit()} type="button">
              <span>{loading ? "Ingresando..." : "Entrar a MotoYa"}</span><span aria-hidden="true">&rarr;</span>
            </button>
          </form>
          <p className="mt-5 text-center text-sm text-slate-300">Primera vez en MotoYa? <Link className="font-bold text-orange-400" href="/register">Crea tu cuenta</Link></p>
        </div>
      </div>
    </main>
  );
}
