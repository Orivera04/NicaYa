"use client";
import { useEffect, useState } from "react";
import { Guard } from "@/components/Guard";
import { MobileAppShell } from "@/components/MobileAppShell";
import { api } from "@/lib/api";
type Trip={id:string;status:string;originAddress:string;destinationAddress:string;currency:string;estimatedPrice:string;finalPrice?:string|null};
export default function ClientHistoryPage(){const [trips,setTrips]=useState<Trip[]>([]);const [message,setMessage]=useState("");useEffect(()=>{api<Trip[]>("/trips").then(setTrips).catch(e=>setMessage(e.message));},[]);return <Guard roles={["CLIENT"]}><MobileAppShell role="CLIENT"><h1 className="mt-4 text-2xl font-bold">Mis viajes</h1><p className="muted">Historial de solicitudes y viajes finalizados.</p>{trips.map(t=><article className="card mt-3" key={t.id}><div className="flex justify-between"><b>{t.status}</b><b>{t.currency} {t.finalPrice||t.estimatedPrice}</b></div><p className="mt-2">{t.originAddress} → {t.destinationAddress}</p></article>)}{!trips.length?<p className="card mt-3">Aun no tienes viajes.</p>:null}{message?<p className="mt-3 text-sm">{message}</p>:null}</MobileAppShell></Guard>}
