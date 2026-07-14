"use client";
import { Guard } from "@/components/Guard";
import { MobileAppShell } from "@/components/MobileAppShell";
import { getSession } from "@/lib/api";
export default function ClientAccountPage(){const user=getSession()?.user;return <Guard roles={["CLIENT"]}><MobileAppShell role="CLIENT"><h1 className="mt-4 text-2xl font-bold">Mi cuenta</h1><section className="card mt-3"><b>{user?.name}</b><p className="muted">{user?.email}</p><p className="mt-3">Rol: Pasajero</p></section></MobileAppShell></Guard>}
