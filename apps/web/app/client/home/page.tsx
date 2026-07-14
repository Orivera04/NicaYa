"use client";
import Link from "next/link";
import { Guard } from "@/components/Guard";
import { MobileAppShell } from "@/components/MobileAppShell";
import { AdvertisementCarousel } from "@/components/AdvertisementCarousel";
export default function ClientHomePage() { return <Guard roles={["CLIENT"]}><MobileAppShell role="CLIENT"><section className="mt-4"><p className="text-sm font-bold text-orange-500">MOTOYA</p><h1 className="text-2xl font-bold">¿A donde te llevamos?</h1><p className="muted mt-1">Pide una moto, revisa tus lugares o consulta tus viajes.</p></section><AdvertisementCarousel /><Link className="primary mt-4 block w-full text-center" href="/client">Buscar un viaje</Link><section className="card mt-3"><b>Accesos rapidos</b><div className="mt-3 grid grid-cols-2 gap-2"><Link className="border text-center" href="/client/places">Mis lugares</Link><Link className="border text-center" href="/client/history">Mis viajes</Link></div></section></MobileAppShell></Guard>; }
