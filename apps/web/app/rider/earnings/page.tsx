"use client";
import { useEffect,useState } from "react";
import { Guard } from "@/components/Guard";
import { MobileAppShell } from "@/components/MobileAppShell";
import { api } from "@/lib/api";
type Trip={id:string;status:string;estimatedPrice:string;finalPrice?:string|null};
export default function RiderEarningsPage(){const [trips,setTrips]=useState<Trip[]>([]);useEffect(()=>{api<Trip[]>("/trips").then(setTrips).catch(()=>undefined)},[]);const completed=trips.filter(t=>t.status==="COMPLETED");const total=completed.reduce((n,t)=>n+Number(t.finalPrice||t.estimatedPrice),0);return <Guard roles={["RIDER"]}><MobileAppShell role="RIDER"><h1 className="mt-4 text-2xl font-bold">Ganancias</h1><section className="card mt-3"><p className="muted">Ganancias simuladas</p><b className="text-3xl">NIO {total.toFixed(2)}</b><p className="mt-2">{completed.length} viajes completados</p></section></MobileAppShell></Guard>}
