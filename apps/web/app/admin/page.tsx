"use client";

import { FormEvent, useEffect, useState } from "react";
import { Guard } from "@/components/Guard";
import { api } from "@/lib/api";

type Rider = { id: string; name: string; email: string; riderProfile: { approval: string; subscriptions: { status: string; expiresAt: string }[] } };
type Dashboard = { clients: number; riders: number; pendingRiders: number; activeSubscriptions: number; requestedTrips: number; completedTrips: number; cancelledTrips: number; subscriptionRevenue: number };
type Advertisement = { id: string; title: string; description?: string | null; imageUrl?: string | null; actionLabel?: string | null; actionUrl?: string | null; backgroundColor: string; textColor: string; displayOrder: number; active: boolean };
type AdDraft = Omit<Advertisement, "id">;

const blankAd: AdDraft = { title: "", description: "", imageUrl: "", actionLabel: "", actionUrl: "", backgroundColor: "#f97316", textColor: "#ffffff", displayOrder: 0, active: true };
const clean = (value?: string | null) => value?.trim() || null;

export default function AdminPage() {
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [draft, setDraft] = useState<AdDraft>(blankAd);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = () => Promise.all([
    api<Dashboard>("/admin/dashboard"), api<Rider[]>("/admin/riders"), api<Record<string, string>>("/admin/settings"), api<Advertisement[]>("/advertisements/manage"),
  ]).then(([dashboard, riderList, savedSettings, advertisements]) => { setDash(dashboard); setRiders(riderList); setSettings(savedSettings); setAds(advertisements); }).catch((error) => setMessage(error.message));
  useEffect(() => { load(); }, []);

  const approve = async (id: string) => { await api(`/admin/riders/${id}/status`, { method: "PATCH", body: JSON.stringify({ approval: "APPROVED" }) }); load(); };
  const activateSubscription = async (id: string) => { await api(`/admin/riders/${id}/subscriptions`, { method: "POST", body: JSON.stringify({ expiresAt: new Date(Date.now() + 30 * 864e5).toISOString() }) }); load(); };
  const saveSettings = async () => { try { await api("/admin/settings", { method: "PATCH", body: JSON.stringify(settings) }); setMessage("Configuración guardada."); } catch (error) { setMessage((error as Error).message); } };
  const saveAd = async (event: FormEvent) => {
    event.preventDefault();
    const payload = { ...draft, description: clean(draft.description), imageUrl: clean(draft.imageUrl), actionLabel: clean(draft.actionLabel), actionUrl: clean(draft.actionUrl) };
    try {
      await api(editingId ? `/advertisements/${editingId}` : "/advertisements", { method: editingId ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setDraft(blankAd); setEditingId(null); setMessage("Publicidad guardada."); load();
    } catch (error) { setMessage((error as Error).message); }
  };
  const editAd = (advertisement: Advertisement) => { const { id, ...data } = advertisement; setEditingId(id); setDraft({ ...blankAd, ...data }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const deleteAd = async (id: string) => { if (!window.confirm("¿Eliminar este anuncio?")) return; await api(`/advertisements/${id}`, { method: "DELETE" }); load(); };
  const toggleAd = async (advertisement: Advertisement) => { await api(`/advertisements/${advertisement.id}`, { method: "PATCH", body: JSON.stringify({ active: !advertisement.active }) }); load(); };

  return <Guard roles={["ADMIN"]}><main className="mx-auto max-w-5xl p-4">
    <header><p className="text-sm font-bold text-orange-500">MOTOYA ADMIN</p><h1 className="text-3xl font-bold">Operación</h1></header>
    <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">{dash && Object.entries(dash).map(([key, value]) => <div className="card" key={key}><p className="muted">{key}</p><b className="text-xl">{value}</b></div>)}</section>

    <section className="card mt-5"><h2 className="font-bold">Publicidad del carrusel</h2><p className="muted mt-1">Los anuncios activos se muestran automáticamente a los pasajeros cada 5 segundos.</p>
      <form className="mt-3 grid gap-2 md:grid-cols-2" onSubmit={saveAd}>
        <label className="text-sm">Título<input required maxLength={80} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
        <label className="text-sm">Texto del anuncio<input maxLength={180} value={draft.description || ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
        <label className="text-sm">URL de imagen (opcional)<input type="url" value={draft.imageUrl || ""} onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value })} /></label>
        <label className="text-sm">Texto del botón (opcional)<input maxLength={30} value={draft.actionLabel || ""} onChange={(event) => setDraft({ ...draft, actionLabel: event.target.value })} /></label>
        <label className="text-sm">Enlace del botón (opcional)<input type="url" value={draft.actionUrl || ""} onChange={(event) => setDraft({ ...draft, actionUrl: event.target.value })} /></label>
        <label className="text-sm">Orden<input type="number" min="0" value={draft.displayOrder} onChange={(event) => setDraft({ ...draft, displayOrder: Number(event.target.value) })} /></label>
        <label className="text-sm">Color de fondo<input type="color" value={draft.backgroundColor} onChange={(event) => setDraft({ ...draft, backgroundColor: event.target.value })} /></label>
        <label className="text-sm">Color de texto<input type="color" value={draft.textColor} onChange={(event) => setDraft({ ...draft, textColor: event.target.value })} /></label>
        <label className="flex items-center gap-2 text-sm"><input className="w-auto" type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} /> Mostrar anuncio</label>
        <div className="flex items-end gap-2"><button className="primary" type="submit">{editingId ? "Actualizar anuncio" : "Crear anuncio"}</button>{editingId && <button className="border" type="button" onClick={() => { setEditingId(null); setDraft(blankAd); }}>Cancelar</button>}</div>
      </form>
      <div className="mt-4 space-y-2">{ads.length === 0 ? <p className="muted">Todavía no hay anuncios. Crea el primero arriba.</p> : ads.map((advertisement) => <article key={advertisement.id} className="flex flex-col gap-2 rounded-xl border p-3 md:flex-row md:items-center md:justify-between"><div><b>{advertisement.title}</b><p className="muted">Orden {advertisement.displayOrder} · {advertisement.active ? "Activo" : "Oculto"}</p></div><div className="flex gap-2"><button className="border" onClick={() => toggleAd(advertisement)}>{advertisement.active ? "Ocultar" : "Activar"}</button><button className="border" onClick={() => editAd(advertisement)}>Editar</button><button className="text-red-600" onClick={() => deleteAd(advertisement.id)}>Eliminar</button></div></article>)}</div>
    </section>

    <section className="card mt-5"><h2 className="font-bold">Tarifas configurables</h2><div className="mt-3 grid gap-2 md:grid-cols-3">{Object.entries(settings).map(([key, value]) => <label key={key} className="text-sm">{key}<input value={value} onChange={(event) => setSettings({ ...settings, [key]: event.target.value })} /></label>)}</div><button onClick={saveSettings} className="primary mt-3">Guardar cambios</button></section>
    <section className="mt-5"><h2 className="font-bold">Riders</h2><div className="mt-2 space-y-2">{riders.map((rider) => <article className="card flex flex-col gap-2 md:flex-row md:items-center md:justify-between" key={rider.id}><div><b>{rider.name}</b><p className="muted">{rider.email} · {rider.riderProfile.approval} · {rider.riderProfile.subscriptions[0]?.status || "Sin suscripción"}</p></div><div className="flex gap-2"><button className="border" onClick={() => approve(rider.id)}>Aprobar</button><button className="primary" onClick={() => activateSubscription(rider.id)}>Activar 30 días</button></div></article>)}</div></section>
    {message && <p className="mt-3 text-sm" role="status">{message}</p>}
  </main></Guard>;
}
