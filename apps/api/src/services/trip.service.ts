import { prisma } from "../db.js";
import { fail } from "../lib/error.js";
import { haversineKm } from "../lib/geo.js";
import { nicaraguaDayWindow } from "../lib/business-day.js";
import { getSettings } from "./settings.service.js";
import { assertRiderCanOperate } from "./subscription.service.js";
import { Prisma, TripStatus } from "@prisma/client";

type TrackingLocationInput={lat:number;lng:number;accuracy?:number;heading?:number};
export type TripTrackingUpdate={tripId:string;clientId:string;riderId:string;locationId:string;lat:number;lng:number;accuracy:number|null;heading:number|null;recordedAt:string};

const toTrackingUpdate=(trip:{id:string;clientId:string;riderId:string|null},location:{id:string;lat:number;lng:number;accuracy:number|null;heading:number|null;createdAt:Date}):TripTrackingUpdate=>({
  tripId:trip.id,
  clientId:trip.clientId,
  riderId:trip.riderId||"",
  locationId:location.id,
  lat:location.lat,
  lng:location.lng,
  accuracy:location.accuracy,
  heading:location.heading,
  recordedAt:location.createdAt.toISOString(),
});

/**
 * Persists exactly the point that will be broadcast to both trip participants.
 * Socket.io is deliberately only a notification channel; reconnecting clients
 * recover the same ordered history from PostgreSQL through GET /trips/:id.
 */
export async function recordTripLocation(tripId:string,riderId:string,location:TrackingLocationInput):Promise<TripTrackingUpdate>{
  return prisma.$transaction(async tx=>{
    const trip=await tx.trip.findUnique({where:{id:tripId},select:{id:true,clientId:true,riderId:true,status:true}});
    if(!trip) return fail(404,"TRIP_NOT_FOUND","Viaje no encontrado.");
    const activeTrip=trip;
    if(activeTrip.riderId!==riderId) return fail(403,"FORBIDDEN","No puedes actualizar la ubicación de este viaje.");
    if(!["ACCEPTED","RIDER_ON_THE_WAY","RIDER_ARRIVED","IN_PROGRESS"].includes(activeTrip.status)) return fail(409,"TRIP_NOT_ACTIVE","El viaje ya no acepta ubicaciones.");

    const recordedAt=new Date();
    await tx.trip.update({where:{id:activeTrip.id},data:{riderLat:location.lat,riderLng:location.lng,riderAccuracy:location.accuracy??null,riderHeading:location.heading??null,riderLocationUpdatedAt:recordedAt}});
    const persisted=await tx.tripLocation.create({data:{tripId:activeTrip.id,...location,createdAt:recordedAt}});
    return toTrackingUpdate(activeTrip,persisted);
  });
}
const operatingCenter={lat:12.1364,lng:-86.2514};
const operatingRadiusKm=75;
function validateRoute(origin:{lat:number;lng:number},destination:{lat:number;lng:number}){const distance=haversineKm(origin,destination);if(distance<0.05)fail(422,"ORIGIN_EQUALS_DESTINATION","El origen y el destino deben ser diferentes.");if(haversineKm(operatingCenter,origin)>operatingRadiusKm||haversineKm(operatingCenter,destination)>operatingRadiusKm)fail(422,"OUTSIDE_OPERATING_AREA","Esta ubicación está fuera del área operativa actual de MotoYa.");return distance;}
const active=["REQUESTED","ACCEPTED","RIDER_ON_THE_WAY","RIDER_ARRIVED","IN_PROGRESS"] as TripStatus[];
const transitions:Partial<Record<TripStatus,TripStatus[]>>={REQUESTED:["ACCEPTED"],ACCEPTED:["RIDER_ON_THE_WAY","CANCELLED_BY_RIDER"],RIDER_ON_THE_WAY:["RIDER_ARRIVED","CANCELLED_BY_RIDER"],RIDER_ARRIVED:["IN_PROGRESS","CANCELLED_BY_RIDER"]};
const pickupRadiusMeters=5;
const retrySerializableTransaction=async<T>(operation:()=>Promise<T>):Promise<T>=>{
  for(let attempt=0;attempt<3;attempt+=1){
    try { return await operation(); }
    catch(error){
      const retryable=error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2034";
      // PostgreSQL can reject a serializable transaction when a GPS update
      // commits at the same instant as boarding. Retrying keeps the operation
      // atomic; if contention persists, return a recoverable domain response
      // instead of leaking an "internal error" to the rider.
      if(retryable&&attempt===2) return fail(409,"TRIP_SYNC_IN_PROGRESS","Estamos sincronizando tu ubicación. Intenta recoger al pasajero de nuevo.");
      if(!retryable) throw error;
      await new Promise((resolve)=>setTimeout(resolve,35*(attempt+1)));
    }
  }
  throw new Error("Unreachable transaction retry state.");
};
export async function boardPassenger(tripId:string,riderId:string,location?:TrackingLocationInput){
  return retrySerializableTransaction(()=>prisma.$transaction(async tx=>{
    // One authoritative transaction keeps rider and client synchronized even
    // if the marker is tapped twice or the network retries the request.
    const trip=await tx.trip.findUnique({where:{id:tripId}});
    if(!trip) return fail(404,"TRIP_NOT_FOUND","Viaje no encontrado.");
    if(trip.riderId!==riderId) fail(403,"FORBIDDEN","No puedes recoger al pasajero de este viaje.");
    if(trip.status!=="RIDER_ON_THE_WAY") fail(409,"INVALID_TRIP_TRANSITION","El pasajero ya fue recogido o el viaje cambió.");
    const pickupLocation=location||((trip.riderLat===null||trip.riderLng===null)?null:{lat:trip.riderLat,lng:trip.riderLng,accuracy:trip.riderAccuracy??undefined,heading:trip.riderHeading??undefined});
    if(!pickupLocation) fail(409,"RIDER_LOCATION_REQUIRED","Actualiza tu ubicación antes de recoger al pasajero.");
    const meters=haversineKm(pickupLocation!,{lat:trip.originLat,lng:trip.originLng})*1000;
    if(meters>pickupRadiusMeters) fail(409,"TOO_FAR_FROM_PICKUP",`Acércate al pasajero. Debes estar a menos de ${pickupRadiusMeters} m; estás a ${Math.ceil(meters)} m.`);
    let trackingLocation:TripTrackingUpdate|null=null;
    if(location){
      const recordedAt=new Date();
      await tx.trip.update({where:{id:tripId},data:{riderLat:location.lat,riderLng:location.lng,riderAccuracy:location.accuracy??null,riderHeading:location.heading??null,riderLocationUpdatedAt:recordedAt}});
      const persisted=await tx.tripLocation.create({data:{tripId,...location,createdAt:recordedAt}});
      trackingLocation=toTrackingUpdate(trip,persisted);
    }
    const updated=await tx.trip.updateMany({where:{id:tripId,riderId,status:"RIDER_ON_THE_WAY"},data:{status:"IN_PROGRESS"}});
    if(!updated.count) fail(409,"TRIP_CHANGED","El viaje cambió. Actualiza la pantalla antes de continuar.");
    await tx.tripStatusHistory.createMany({data:[{tripId,status:"RIDER_ARRIVED",actorId:riderId},{tripId,status:"IN_PROGRESS",actorId:riderId}]});
    const updatedTrip=await tx.trip.findUniqueOrThrow({where:{id:tripId},include:{client:{select:{id:true,name:true,phone:true}},rider:{select:{id:true,name:true,phone:true,riderProfile:{select:{vehicleModel:true,vehiclePlate:true}}}},histories:true}});
    return {trip:updatedTrip,trackingLocation};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable}));
}
export async function estimate(origin:{lat:number;lng:number},destination:{lat:number;lng:number}){ const s=await getSettings(); const distanceKm=validateRoute(origin,destination); const amount=Math.max(Number(s.minimumFare),Number(s.baseFare)+distanceKm*Number(s.pricePerKm)); return {distanceKm,estimatedDurationMin:Math.max(3,Math.ceil(distanceKm*3)),minimumFare:Number(s.minimumFare),maximumFare:2000,estimatedPrice:Number(amount.toFixed(2)),currency:s.currency}; }
export async function createTrip(clientId:string, origin:{lat:number;lng:number;address:string}, destination:{lat:number;lng:number;address:string}, serviceCode="MOTO", proposedPrice?:number){ const quote=await estimate(origin,destination); if(proposedPrice!==undefined&&(proposedPrice<quote.minimumFare||proposedPrice>quote.maximumFare))fail(422,"INVALID_PROPOSED_PRICE",`La propuesta debe estar entre ${quote.minimumFare} y ${quote.maximumFare} ${quote.currency}.`); return prisma.$transaction(async tx=>{ const exists=await tx.trip.findFirst({where:{clientId,status:{in:active}}}); if(exists) fail(409,"CLIENT_HAS_ACTIVE_TRIP","Ya tienes un viaje activo."); const trip=await tx.trip.create({data:{clientId,originLat:origin.lat,originLng:origin.lng,originAddress:origin.address,destinationLat:destination.lat,destinationLng:destination.lng,destinationAddress:destination.address,distanceKm:quote.distanceKm,estimatedDurationMin:quote.estimatedDurationMin,estimatedPrice:new Prisma.Decimal(quote.estimatedPrice),proposedPrice:proposedPrice?new Prisma.Decimal(proposedPrice):null,serviceCode,expiresAt:new Date(Date.now()+5*60_000),currency:quote.currency}}); await tx.tripStatusHistory.create({data:{tripId:trip.id,status:"REQUESTED",actorId:clientId}}); return trip; },{isolationLevel:"Serializable"}); }
export async function makeOffer(tripId:string,riderId:string,amount:number){const trip=await prisma.trip.findUnique({where:{id:tripId}});if(!trip||trip.status!=="REQUESTED"||!trip.expiresAt||trip.expiresAt<new Date())fail(409,"TRIP_EXPIRED","La solicitud ya no está disponible.");const settings=await getSettings();const minimum=Number(settings.minimumFare);if(amount<minimum||amount>2000)fail(422,"INVALID_OFFER_AMOUNT",`La contraoferta debe estar entre ${minimum} y 2000 ${trip.currency}.`);await prisma.$transaction(async tx=>{await eligibleRider(tx,riderId);await tx.tripOffer.updateMany({where:{tripId,riderId,status:"PENDING"},data:{status:"EXPIRED"}});const offer=await tx.tripOffer.create({data:{tripId,riderId,amount:new Prisma.Decimal(amount),currency:trip.currency,expiresAt:new Date(Date.now()+2*60_000)}});await tx.auditLog.create({data:{actorId:riderId,action:"TRIP_COUNTER_OFFER_CREATED",entity:"TripOffer",entityId:offer.id,metadata:{tripId,amount,currency:trip.currency}}});});return prisma.tripOffer.findFirstOrThrow({where:{tripId,riderId,status:"PENDING"},orderBy:{createdAt:"desc"},include:{rider:{select:{id:true,name:true}}}});}
export async function acceptOffer(tripId:string,offerId:string,clientId:string){return prisma.$transaction(async tx=>{const offer=await tx.tripOffer.findUnique({where:{id:offerId},include:{trip:true}});if(!offer||offer.tripId!==tripId||offer.trip.clientId!==clientId||offer.status!=="PENDING"||offer.expiresAt<new Date())fail(409,"OFFER_NOT_AVAILABLE","La oferta ya está disponible.");const updated=await tx.trip.updateMany({where:{id:tripId,status:"REQUESTED",expiresAt:{gt:new Date()}},data:{status:"RIDER_ON_THE_WAY",riderId:offer.riderId,finalPrice:offer.amount}});if(!updated.count)fail(409,"TRIP_CHANGED","La solicitud ya cambió de estado.");await tx.tripOffer.updateMany({where:{tripId,status:"PENDING"},data:{status:"REJECTED"}});await tx.tripOffer.update({where:{id:offerId},data:{status:"ACCEPTED"}});await tx.tripStatusHistory.createMany({data:[{tripId,status:"ACCEPTED",actorId:clientId},{tripId,status:"RIDER_ON_THE_WAY",actorId:offer.riderId}]});return tx.trip.findUniqueOrThrow({where:{id:tripId},include:{rider:{select:{id:true,name:true,phone:true,riderProfile:{select:{vehicleModel:true,vehiclePlate:true}}}}}});},{isolationLevel:"Serializable"});}
export async function rejectOffer(tripId:string,offerId:string,clientId:string){ return prisma.$transaction(async tx=>{ const changed=await tx.tripOffer.updateMany({where:{id:offerId,tripId,status:"PENDING",expiresAt:{gt:new Date()},trip:{clientId,status:"REQUESTED"}},data:{status:"REJECTED"}}); if(!changed.count) fail(409,"OFFER_NOT_AVAILABLE","La oferta ya no está disponible."); await tx.auditLog.create({data:{actorId:clientId,action:"TRIP_OFFER_REJECTED",entity:"TripOffer",entityId:offerId,metadata:{tripId}}}); return { id: offerId, status: "REJECTED" }; },{isolationLevel:"Serializable"}); }
async function eligibleRider(tx:Prisma.TransactionClient,riderId:string){ const eligibility=await assertRiderCanOperate(riderId); const rider=await tx.riderProfile.findUnique({where:{userId:riderId}}); if(!rider?.available) fail(403,"RIDER_NOT_AVAILABLE","Activa tu disponibilidad para aceptar viajes."); const busy=await tx.trip.findFirst({where:{riderId,status:{in:active.filter(s=>s!=="REQUESTED")}}}); if(busy) fail(409,"RIDER_HAS_ACTIVE_TRIP","Ya tienes un viaje activo."); const limit=eligibility.subscriptions[0]?.plan?.dailyTripLimit; if(limit){const {start,end}=nicaraguaDayWindow();const completed=await tx.trip.count({where:{riderId,status:"COMPLETED",updatedAt:{gte:start,lt:end}}});if(completed>=limit)fail(409,"DAILY_PLAN_LIMIT_REACHED",`Alcanzaste el límite de ${limit} viajes completados para tu plan hoy.`);}}
export async function acceptTrip(tripId:string,riderId:string){ return prisma.$transaction(async tx=>{ await eligibleRider(tx,riderId); const trip=await tx.trip.findUnique({where:{id:tripId}});if(!trip||!trip.expiresAt||trip.expiresAt<new Date())fail(409,"TRIP_EXPIRED","La solicitud ya venció."); const updated=await tx.trip.updateMany({where:{id:tripId,status:"REQUESTED",riderId:null,expiresAt:{gt:new Date()}},data:{status:"RIDER_ON_THE_WAY",riderId,finalPrice:trip.proposedPrice||trip.estimatedPrice}}); if(updated.count!==1) fail(409,"TRIP_ALREADY_ACCEPTED","El viaje ya fue aceptado por otro rider."); await tx.tripOffer.updateMany({where:{tripId,status:"PENDING"},data:{status:"REJECTED"}}); await tx.tripStatusHistory.createMany({data:[{tripId,status:"ACCEPTED",actorId:riderId},{tripId,status:"RIDER_ON_THE_WAY",actorId:riderId}]}); return tx.trip.findUniqueOrThrow({where:{id:tripId},include:{client:{select:{id:true,name:true,phone:true}},rider:{select:{id:true,name:true,phone:true,riderProfile:{select:{vehicleModel:true,vehiclePlate:true}}}}}}); }); }
export async function changeStatus(tripId:string,actorId:string,role:string,next:TripStatus){ const trip=await prisma.trip.findUnique({where:{id:tripId}}); if(!trip) fail(404,"TRIP_NOT_FOUND","Viaje no encontrado."); if(role!=="RIDER"||trip.riderId!==actorId) fail(403,"FORBIDDEN","No puedes actualizar este viaje."); if(!transitions[trip.status]?.includes(next)) fail(409,"INVALID_TRIP_TRANSITION","La transición de estado no está permitida."); const boardingPassenger=trip.status==="RIDER_ON_THE_WAY"&&next==="RIDER_ARRIVED"; if(boardingPassenger){ if(trip.riderLat===null||trip.riderLng===null) fail(409,"RIDER_LOCATION_REQUIRED","Actualiza tu ubicación antes de confirmar la recogida."); const meters=haversineKm({lat:trip.riderLat,lng:trip.riderLng},{lat:trip.originLat,lng:trip.originLng})*1000; if(meters>2) fail(409,"TOO_FAR_FROM_PICKUP",`Debes estar a menos de 2 m del pasajero. Distancia actual: ${Math.ceil(meters)} m.`); } return prisma.$transaction(async tx=>{ const result=await tx.trip.updateMany({where:{id:tripId,status:trip.status,riderId:actorId},data:{status:boardingPassenger?"IN_PROGRESS":next}}); if(!result.count) fail(409,"TRIP_CHANGED","El viaje cambió, vuelve a intentarlo."); if(boardingPassenger) await tx.tripStatusHistory.createMany({data:[{tripId,status:"RIDER_ARRIVED",actorId},{tripId,status:"IN_PROGRESS",actorId}]}); else await tx.tripStatusHistory.create({data:{tripId,status:next,actorId}}); return tx.trip.findUniqueOrThrow({where:{id:tripId},include:{client:{select:{id:true,name:true,phone:true}},rider:{select:{id:true,name:true,phone:true,riderProfile:{select:{vehicleModel:true,vehiclePlate:true}}}},histories:true}}); }); }
export async function completeTripByClient(tripId:string,clientId:string){ return prisma.$transaction(async tx=>{ const result=await tx.trip.updateMany({where:{id:tripId,clientId,status:"IN_PROGRESS"},data:{status:"COMPLETED"}}); if(!result.count) fail(409,"TRIP_NOT_COMPLETABLE","Solo puedes finalizar un viaje propio que esté en curso."); const completedTrip=await tx.trip.findUniqueOrThrow({where:{id:tripId},select:{riderId:true}}); await tx.tripStatusHistory.create({data:{tripId,status:"COMPLETED",actorId:clientId}}); if(completedTrip.riderId){const subscription=await tx.riderSubscription.findFirst({where:{rider:{userId:completedTrip.riderId},status:"ACTIVE",startsAt:{lte:new Date()},expiresAt:{gt:new Date()}},include:{plan:true},orderBy:{expiresAt:"desc"}});const limit=subscription?.plan?.dailyTripLimit;if(limit){const {start,end}=nicaraguaDayWindow();const completedToday=await tx.trip.count({where:{riderId:completedTrip.riderId,status:"COMPLETED",updatedAt:{gte:start,lt:end}}});if(completedToday>=limit){await tx.riderProfile.update({where:{userId:completedTrip.riderId},data:{available:false}});await tx.auditLog.create({data:{actorId:completedTrip.riderId,action:"RIDER_DAILY_TRIP_LIMIT_REACHED",entity:"RiderProfile",entityId:completedTrip.riderId,metadata:{dailyTripLimit:limit,completedToday}}});}}} await tx.auditLog.create({data:{actorId:clientId,action:"TRIP_COMPLETED_BY_CLIENT",entity:"Trip",entityId:tripId}}); return tx.trip.findUniqueOrThrow({where:{id:tripId},include:{client:{select:{id:true,name:true,phone:true}},rider:{select:{id:true,name:true,phone:true,riderProfile:{select:{vehicleModel:true,vehiclePlate:true}}}}}}); },{isolationLevel:"Serializable"}); }
export async function cancelTrip(tripId:string,actorId:string,role:string,reason?:string){
  return retrySerializableTransaction(()=>prisma.$transaction(async tx=>{
    const trip=await tx.trip.findUnique({where:{id:tripId}});
    if(!trip) fail(404,"TRIP_NOT_FOUND","Viaje no encontrado.");
    const status=role==="ADMIN"?"CANCELLED_BY_ADMIN":role==="CLIENT"&&trip.clientId===actorId?"CANCELLED_BY_CLIENT":role==="RIDER"&&trip.riderId===actorId?"CANCELLED_BY_RIDER":null;
    if(!status) fail(403,"FORBIDDEN","No puedes cancelar este viaje.");
    if(!active.includes(trip.status)) fail(409,"TRIP_CANNOT_BE_CANCELLED","Este viaje ya fue finalizado o cancelado.");

    // Un rider puede soltar una solicitud únicamente antes de haber iniciado
    // realmente el desplazamiento. Conservamos la solicitud del cliente y la
    // devolvemos de forma atómica al grupo de riders disponibles.
    const now=new Date();
    const [firstLocation,lastLocation]=await Promise.all([
      tx.tripLocation.findFirst({where:{tripId},orderBy:{createdAt:"asc"}}),
      tx.tripLocation.findFirst({where:{tripId},orderBy:{createdAt:"desc"}}),
    ]);
    const traveledMeters=firstLocation&&lastLocation?haversineKm(firstLocation,lastLocation)*1000:0;
    const canReopen=role==="RIDER"&&trip.status==="RIDER_ON_THE_WAY"&&Boolean(trip.expiresAt&&trip.expiresAt>now)&&traveledMeters<=25;

    if(canReopen){
      const reopened=await tx.trip.updateMany({where:{id:tripId,status:"RIDER_ON_THE_WAY",riderId:actorId},data:{status:"REQUESTED",riderId:null,finalPrice:null,riderLat:null,riderLng:null,riderAccuracy:null,riderHeading:null,riderLocationUpdatedAt:null,expiresAt:new Date(now.getTime()+5*60_000)}});
      if(!reopened.count) fail(409,"TRIP_CHANGED","El viaje cambió. Actualiza la pantalla e inténtalo otra vez.");
      await tx.tripLocation.deleteMany({where:{tripId}});
      await tx.tripStatusHistory.create({data:{tripId,status:"REQUESTED",actorId}});
      await tx.auditLog.create({data:{actorId,action:"TRIP_REOPENED_BY_RIDER",entity:"Trip",entityId:tripId,metadata:{reason:reason||"UNSPECIFIED",previousStatus:trip.status,traveledMeters}}});
      const reopenedTrip=await tx.trip.findUniqueOrThrow({where:{id:tripId},include:{client:{select:{id:true,name:true,phone:true}},rider:{select:{id:true,name:true,phone:true,riderProfile:{select:{vehicleModel:true,vehiclePlate:true}}}}}});
      return {trip:reopenedTrip,reopened:true,previousRiderId:actorId};
    }

    const updated=await tx.trip.updateMany({where:{id:tripId,status:trip.status},data:{status}});
    if(!updated.count) fail(409,"TRIP_CHANGED","El estado del viaje cambió. Actualiza la pantalla e inténtalo otra vez.");
    await tx.tripStatusHistory.create({data:{tripId,status,actorId}});
    await tx.auditLog.create({data:{actorId,action:"TRIP_CANCELLED",entity:"Trip",entityId:tripId,metadata:{reason:reason||"UNSPECIFIED",previousStatus:trip.status,role}}});
    const cancelledTrip=await tx.trip.findUniqueOrThrow({where:{id:tripId},include:{client:{select:{id:true,name:true,phone:true}},rider:{select:{id:true,name:true,phone:true,riderProfile:{select:{vehicleModel:true,vehiclePlate:true}}}}}});
    return {trip:cancelledTrip,reopened:false,previousRiderId:trip.riderId};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable}));
}
