import { prisma } from "../db.js";
const defaults: Record<string,string>={baseFare:"1.50",pricePerKm:"0.70",minimumFare:"2.00",currency:"USD",monthlySubscriptionPrice:"10.00"};
export async function getSettings(){ const rows=await prisma.systemSetting.findMany(); return {...defaults,...Object.fromEntries(rows.map(r=>[r.key,r.value]))}; }
export async function updateSettings(values:Record<string,string>){ await Promise.all(Object.entries(values).map(([key,value])=>prisma.systemSetting.upsert({where:{key},update:{value},create:{key,value}}))); return getSettings(); }
