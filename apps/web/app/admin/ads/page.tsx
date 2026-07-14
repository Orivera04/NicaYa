"use client";
import Link from"next/link";import{Guard}from"@/components/Guard";import{MobileAppShell}from"@/components/MobileAppShell";
export default function AdminAdsPage(){return <Guard roles={["ADMIN"]}><MobileAppShell role="ADMIN"><h1 className="mt-4 text-2xl font-bold">Anuncios</h1><section className="card mt-3"><p>La administracion completa del carrusel esta disponible en el panel de operacion.</p><Link className="primary mt-3 block text-center" href="/admin#publicidad">Abrir editor de anuncios</Link></section></MobileAppShell></Guard>}
