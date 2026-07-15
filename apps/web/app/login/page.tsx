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
  // Password managers may populate the form. A session is created only after
  // the person explicitly activates the submit control (or presses Enter).
  const submitIntent = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!submitIntent.current) {
      setError("Confirma el inicio de sesion con el boton Entrar.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const form = new FormData(event.currentTarget);
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
      submitIntent.current = false;
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
        onKeyDown={(event) => { if (event.key === "Enter") submitIntent.current = true; }}
        onSubmit={submit}
      >
        <label className="block text-sm font-semibold">Correo
          <input className="mt-1 border-white/15 bg-white/10 text-white placeholder:text-slate-400" name="email" type="email" autoComplete="email" placeholder="nombre@correo.com" required />
        </label>
        <label className="block text-sm font-semibold">Contrasena
          <div className="relative mt-1">
            <input className="border-white/15 bg-white/10 pr-12 text-white placeholder:text-slate-400" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Tu contrasena" required />
            <button aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"} className="absolute right-1 top-1 grid h-10 w-10 place-items-center p-0 text-slate-300" type="button" onClick={() => setShowPassword((value) => !value)}>
              {showPassword ? "Ocultar" : "Ver"}
            </button>
          </div>
        </label>
        {error ? <p className="rounded-xl bg-red-500/15 p-3 text-sm text-red-200" role="alert">{error}</p> : null}
        <button className="login-cta w-full" disabled={loading} onPointerDown={() => { submitIntent.current = true; }} type="submit">
          <span>{loading ? "Ingresando..." : "Entrar a MotoYa"}</span><span aria-hidden="true">&rarr;</span>
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-300">Primera vez en MotoYa? <Link className="font-bold text-orange-400" href="/register">Crea tu cuenta</Link></p>
    </main>
  );
}
