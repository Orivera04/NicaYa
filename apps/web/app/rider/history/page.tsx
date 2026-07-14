"use client";
import { useEffect,useState } from "react";
import { Guard } from "@/components/Guard";
import { MobileAppShell } from "@/components/MobileAppShell";
import { api } from "@/lib/api";
type Trip={id:string;status:string;originAddress:string;destinationAddress:string;currency:string;estimatedPrice:string;finalPrice?:string|null};
export default function RiderHistoryPage(){const [trips,setTrips]=useState<Trip[]>([]);useEffect(()=>{api<Trip[]>("/trips").then(setTrips).catch(()=>undefined)},[]);return <Guard roles={["RIDER"]}><MobileAppShell role="RIDER"><h1 className="mt-4 text-2xl font-bold">Mis viajes</h1>{trips.map(t=><article className="card mt-3" key={t.id}><div className="flex justify-between"><b>{t.status}</b><b>{t.currency} {t.finalPrice||t.estimatedPrice}</b></div><p>{t.originAddress} → {t.destinationAddress}</p></article>)}{!trips.length?<p className="card mt-3">Aun no tienes viajes.</p>:null}</MobileAppShell></Guard>}
