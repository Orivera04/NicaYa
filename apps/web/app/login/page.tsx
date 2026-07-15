"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, setSession, Session } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      setSession(session);
      router.push(session.user.role === "ADMIN" ? "/admin" : session.user.role === "RIDER" ? "/rider" : "/client/home");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-slate-950 p-5 text-white">
      <Link className="mt-3 inline-block text-sm font-bold text-slate-300" href="/">&larr; MotoYa</Link>
      <section className="mt-10">
        <p className="text-sm font-bold tracking-wide text-orange-400">BIENVENIDO DE NUEVO</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Ingresa a tu cuenta</h1>
        <p className="mt-2 text-sm text-slate-300">Usa tus datos para continuar de forma segura.</p>
      </section>

      <form
        className="mt-7 space-y-4 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_20px_55px_rgba(0,0,0,.28)]"
        ref={formRef}
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="block text-sm font-semibold">Correo
          <input className="mt-1 border-white/15 bg-white/10 text-white placeholder:text-slate-400" name="email" type="email" autoComplete="email" placeholder="nombre@correo.com" required />
        </label>
        <label className="block text-sm font-semibold">Contrasena
          <div className="relative mt-1">
            <input className="border-white/15 bg-white/10 pr-12 text-white placeholder:text-slate-400" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Tu contrasena" required />
            <button aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"} className="absolute right-1 top-1 grid h-10 w-10 place-items-center rounded-lg p-0 text-slate-300 hover:bg-white/10 hover:text-white" type="button" onClick={() => setShowPassword((value) => !value)}>
              {showPassword ? <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.8 10.8 0 0 1 12 4c5.8 0 9.5 8 9.5 8a18.5 18.5 0 0 1-2.6 3.6M6.3 6.3C3.9 8 2.5 12 2.5 12S6.2 20 12 20c1.2 0 2.3-.3 3.3-.7" /></svg> : <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2.5 12S6.2 4 12 4s9.5 8 9.5 8-3.7 8-9.5 8-9.5-8-9.5-8Z" /><circle cx="12" cy="12" r="3" /></svg>}
            </button>
          </div>
        </label>
        {error ? <p className="rounded-xl bg-red-500/15 p-3 text-sm text-red-200" role="alert">{error}</p> : null}
        <button className="login-cta w-full" disabled={loading} onClick={() => submit()} type="button">
          <span>{loading ? "Ingresando..." : "Entrar a MotoYa"}</span><span aria-hidden="true">&rarr;</span>
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-300">Primera vez en MotoYa? <Link className="font-bold text-orange-400" href="/register">Crea tu cuenta</Link></p>
    </main>
  );
}
