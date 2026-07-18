"use client";
import { useEffect,useState } from "react";
import { Guard } from "@/components/Guard";
import { MobileAppShell } from "@/components/MobileAppShell";
import { api } from "@/lib/api";
type Trip={id:string;status:string;originAddress:string;destinationAddress:string;currency:string;estimatedPrice:string;finalPrice?:string|null};
export default function RiderHistoryPage(){const [trips,setTrips]=useState<Trip[]>([]);useEffect(()=>{api<Trip[]>("/trips").then(setTrips).catch(()=>undefined)},[]);return <Guard roles={["RIDER"]}><MobileAppShell role="RIDER"><h1 className="mt-4 text-2xl font-bold">Mis viajes</h1><section className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{trips.map(t=><article className="card" key={t.id}><div className="flex items-start justify-between gap-3"><b className="min-w-0 truncate">{t.status}</b><b className="shrink-0 tabular-nums">{t.currency} {t.finalPrice||t.estimatedPrice}</b></div><p className="mt-1 break-words">{t.originAddress} → {t.destinationAddress}</p></article>)}{!trips.length?<p className="card">Aun no tienes viajes.</p>:null}</section></MobileAppShell></Guard>}
