import { prisma } from "../db.js";
const defaults: Record<string,string>={launchPhase:"1",baseFare:"50",pricePerKm:"15",minimumFare:"50",currency:"NIO",monthlySubscriptionPrice:"200",freePlanCommissionPercent:"0",premiumPlanCommissionPercent:"5",standardPlanCommissionPercent:"15",riderMatchRadiusKm:"8"};
export async function getSettings(){ const rows=await prisma.systemSetting.findMany(); return {...defaults,...Object.fromEntries(rows.map(r=>[r.key,r.value]))}; }
export async function updateSettings(values:Record<string,string>){ await Promise.all(Object.entries(values).map(([key,value])=>prisma.systemSetting.upsert({where:{key},update:{value},create:{key,value}}))); return getSettings(); }
