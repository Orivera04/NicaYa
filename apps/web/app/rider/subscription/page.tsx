"use client";
import { Guard } from "@/components/Guard";
import { MobileAppShell } from "@/components/MobileAppShell";
import { RiderSubscriptionPayment } from "@/components/RiderSubscriptionPayment";
export default function RiderSubscriptionPage(){return <Guard roles={["RIDER"]}><MobileAppShell role="RIDER"><h1 className="mt-4 text-2xl font-bold">Mi suscripcion</h1><p className="muted">Elige, paga y consulta el estado de tu plan.</p><RiderSubscriptionPayment /></MobileAppShell></Guard>}
