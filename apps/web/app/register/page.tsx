"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthHeroIllustration } from "@/components/AuthHero";
import { api, setSession, Session } from "@/lib/api";

const inputIcons: Record<string, string> = {
  name: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4 0-8 2-8 6h16c0-4-4-6-8-6Z",
  phone: "M6 3h4l1 5-3 2c1 3 3 5 6 6l2-3 5 1v4c0 1-1 2-2 2C10 20 4 14 4 5c0-1 1-2 2-2Z",
  email: "M4 6h16v12H4z|m4 7 8 6 8-6",
  password: "M5 11h14v9H5z|M8 11V8a4 4 0 0 1 8 0v3",
};

function FieldIcon({ name }: { name: string }) {
  const spec = inputIcons[name] || inputIcons.name;
  const paths = spec.split("|");
  return <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {paths.map((path) => <path d={path} key={path} />)}
    </svg>
  </span>;
}

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<"CLIENT" | "RIDER">("CLIENT");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (form: FormData) => {
    setLoading(true);
    try {
      const session = await api<Session>(`/auth/register/${role.toLowerCase()}`, { method: "POST", body: JSON.stringify(Object.fromEntries(form.entries())) });
      setSession(session);
      router.push(role === "RIDER" ? "/rider/account" : "/client/home");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="mt-4 max-w-lg text-5xl font-black leading-[1.05] tracking-tight">Unete a<br /><span className="text-orange-500">MotoYa hoy.</span></h1>
          <p className="mt-5 max-w-md text-slate-300">Crea tu cuenta como pasajero o como rider y comienza a moverte por la ciudad.</p>
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
          <div className="flex items-center justify-between lg:justify-end">
            <Link className="text-sm font-bold text-orange-400 lg:hidden" href="/">&larr; MotoYa</Link>
            <Link className="text-sm text-slate-300" href="/login">Ya tengo cuenta</Link>
          </div>

          <div className="relative mt-4 overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500/25 via-slate-900 to-slate-950 p-5 lg:hidden">
            <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full border border-orange-400/25" />
            <AuthHeroIllustration className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full opacity-80" />
            <p className="relative text-[10px] font-bold tracking-[.2em] text-orange-300">MOTOYA</p>
            <h2 className="relative mt-2 text-2xl font-black leading-tight">Unete a<br /><span className="text-orange-400">MotoYa hoy.</span></h2>
          </div>

          <h1 className="mt-8 text-3xl font-bold lg:mt-6">Crea tu cuenta</h1>
          <p className="mt-2 text-sm text-slate-300">Solo pedimos lo necesario para comenzar.</p>

          <div className="mt-6 grid grid-cols-2 rounded-2xl bg-white/10 p-1">
            <button type="button" className={role === "CLIENT" ? "bg-orange-500 text-white" : "text-slate-300"} onClick={() => setRole("CLIENT")}>Pasajero</button>
            <button type="button" className={role === "RIDER" ? "bg-orange-500 text-white" : "text-slate-300"} onClick={() => setRole("RIDER")}>Rider</button>
          </div>

          <section className="mt-4 rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4 text-sm text-orange-100">
            <b>{role === "CLIENT" ? "Cuenta activa" : "Registro inicial de rider"}</b>
            <p className="mt-1">{role === "CLIENT" ? "Puedes solicitar viajes desde hoy. La verificacion es opcional por ahora." : "Completaras vehiculo y documentos dentro de la aplicacion."}</p>
          </section>

          <form action={submit} className="mt-5 space-y-3">
            <div className="relative"><FieldIcon name="name" /><input className="border-white/15 bg-white/10 pl-10 text-white placeholder:text-slate-400" name="name" placeholder="Nombre completo" required /></div>
            <div className="relative"><FieldIcon name="phone" /><input className="border-white/15 bg-white/10 pl-10 text-white placeholder:text-slate-400" name="phone" placeholder="Telefono" required /></div>
            <div className="relative"><FieldIcon name="email" /><input className="border-white/15 bg-white/10 pl-10 text-white placeholder:text-slate-400" name="email" type="email" placeholder="Correo" required /></div>
            <div className="relative"><FieldIcon name="password" /><input className="border-white/15 bg-white/10 pl-10 text-white placeholder:text-slate-400" name="password" type="password" minLength={8} placeholder="Contrasena (minimo 8 caracteres)" required /></div>
            {error ? <p className="rounded-xl bg-red-500/15 p-3 text-sm text-red-200">{error}</p> : null}
            <button className="primary w-full" disabled={loading}>{loading ? "Creando cuenta..." : `Continuar como ${role === "RIDER" ? "rider" : "pasajero"}`}</button>
          </form>
          <p className="mt-5 text-center text-sm text-slate-400">¿Ya tienes cuenta? <Link className="font-bold text-orange-400" href="/login">Inicia sesion</Link></p>
        </div>
      </div>
    </main>
  );
}
