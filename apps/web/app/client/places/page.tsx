"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Guard } from "@/components/Guard";
import { MobileAppShell } from "@/components/MobileAppShell";
import { api } from "@/lib/api";
type Place={id:string;label:string;address:string;reference?:string|null};
export default function ClientPlacesPage(){const [places,setPlaces]=useState<Place[]>([]);const [message,setMessage]=useState("");const load=()=>api<Place[]>("/places").then(setPlaces).catch(e=>setMessage(e.message));useEffect(()=>{load()},[]);return <Guard roles={["CLIENT"]}><MobileAppShell role="CLIENT"><h1 className="mt-4 text-2xl font-bold">Lugares guardados</h1><p className="muted">Casa, Trabajo y cualquier destino que hayas nombrado.</p><Link className="primary mt-3 block text-center" href="/client">Guardar desde el mapa</Link>{places.map(p=><article className="card mt-3" key={p.id}><b>{p.label}</b><p>{p.address}</p>{p.reference?<p className="muted">{p.reference}</p>:null}<button className="mt-2 text-red-600" onClick={async()=>{await api(`/places/${encodeURIComponent(p.label)}`,{method:"DELETE"});load()}}>Eliminar</button></article>)}{!places.length?<p className="card mt-3">No tienes lugares guardados.</p>:null}{message?<p className="mt-3 text-sm">{message}</p>:null}</MobileAppShell></Guard>}
