import { z } from "zod";
import { Prisma, TripStatus } from "@prisma/client";
import type { Server } from "socket.io";
import { ratingSchema, tripCreateSchema } from "@motoya/shared";
import { prisma } from "../db.js";
import { fail } from "../lib/error.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { safeRouter } from "../middleware/safe-router.js";
import { acceptTrip,acceptOffer,boardPassenger,cancelTrip,changeStatus,completeTripByClient,createTrip,estimate,makeOffer,recordTripLocation,rejectOffer } from "../services/trip.service.js";
export const tripsRouter=safeRouter(); tripsRouter.use(authenticate);
tripsRouter.post("/estimate",authorize("CLIENT"),async(req,res)=>{const d=tripCreateSchema.parse(req.body);res.json(await estimate(d.origin,d.destination));});
tripsRouter.post("/",authorize("CLIENT"),asyncHandler(async(req,res)=>{const d=tripCreateSchema.parse(req.body);const trip=await createTrip(req.user!.id,d.origin,d.destination,d.serviceCode,d.proposedPrice);req.app.get("io")?.to("riders").emit("trip:requested",trip);res.status(201).json(trip);}));
const trackedLocationLimit=720;
const tripRelations={client:{select:{id:true,name:true,phone:true}},rider:{select:{id:true,name:true,phone:true,riderProfile:{select:{vehicleModel:true,vehiclePlate:true,workZoneLat:true,workZoneLng:true,workZoneUpdatedAt:true}}}},rating:true,locations:{orderBy:[{createdAt:"desc"},{id:"desc"}],take:trackedLocationLimit}} satisfies Prisma.TripInclude;
type TripWithRelations=Prisma.TripGetPayload<{include:typeof tripRelations}>;
const withLocationHistory=async(trips:TripWithRelations[])=>{
  const tripIds=trips.map((trip)=>trip.id);
  const firstLocations=tripIds.length?await prisma.tripLocation.findMany({where:{tripId:{in:tripIds}},orderBy:[{createdAt:"asc"},{id:"asc"}],distinct:["tripId"]}):[];
  const starts=new Map(firstLocations.map((location)=>[location.tripId,location]));
  return trips.map((trip)=>({
    ...trip,
    locations:[...trip.locations].reverse(),
    // Se conserva el punto de salida independientemente del límite del
    // historial reciente, para que la bandera no se mueva al reingresar.
    startLocation:starts.get(trip.id)??trip.locations.at(-1)??null,
  }));
};
tripsRouter.get("/",asyncHandler(async(req,res)=>{const where=req.user!.role==="CLIENT"?{clientId:req.user!.id}:req.user!.role==="RIDER"?{riderId:req.user!.id}:{};const trips=await prisma.trip.findMany({where,include:tripRelations,orderBy:{createdAt:"desc"}});res.json(await withLocationHistory(trips));}));
tripsRouter.get("/:id",asyncHandler(async(req,res)=>{const t=await prisma.trip.findUnique({where:{id:req.params.id},include:{...tripRelations,histories:true}});if(!t)return fail(404,"TRIP_NOT_FOUND","Viaje no encontrado.");if(req.user!.role!=="ADMIN"&&t.clientId!==req.user!.id&&t.riderId!==req.user!.id)return fail(403,"FORBIDDEN","No puedes ver este viaje.");res.json((await withLocationHistory([t]))[0]);}));
tripsRouter.post("/:id/accept",authorize("RIDER"),async(req,res)=>{const t=await acceptTrip(req.params.id,req.user!.id);req.app.get("io")?.to(`user:${t.clientId}`).emit("trip:accepted",t);req.app.get("io")?.to("admins").emit("trip:status-updated",t);res.json(t);});
tripsRouter.post("/:id/offers",authorize("RIDER"),async(req,res)=>{const amount=z.number().positive().max(2000).parse(req.body.amount);const offer=await makeOffer(req.params.id,req.user!.id,amount);req.app.get("io")?.to(`user:${(await prisma.trip.findUniqueOrThrow({where:{id:req.params.id}})).clientId}`).emit("trip:offer",offer);res.status(201).json(offer);});
tripsRouter.get("/:id/offers",authorize("CLIENT"),async(req,res)=>{const trip=await prisma.trip.findUnique({where:{id:req.params.id}});if(!trip||trip.clientId!==req.user!.id)fail(404,"TRIP_NOT_FOUND","Viaje no encontrado.");res.json(await prisma.tripOffer.findMany({where:{tripId:req.params.id,status:"PENDING",expiresAt:{gt:new Date()}},include:{rider:{select:{id:true,name:true}},},orderBy:{createdAt:"desc"}}));});
tripsRouter.post("/:id/offers/:offerId/accept",authorize("CLIENT"),async(req,res)=>{const trip=await acceptOffer(req.params.id,req.params.offerId,req.user!.id);req.app.get("io")?.to(`user:${trip.riderId}`).emit("trip:accepted",trip);res.json(trip);});
tripsRouter.post("/:id/offers/:offerId/reject",authorize("CLIENT"),async(req,res)=>{res.json(await rejectOffer(req.params.id,req.params.offerId,req.user!.id));});
const tripLocationSchema=z.object({lat:z.number().finite().min(-90).max(90),lng:z.number().finite().min(-180).max(180),accuracy:z.number().finite().min(0).max(5000).optional(),heading:z.number().finite().min(0).max(360).optional()});
const emitTrackingUpdate=(io:Server|undefined,update:{tripId:string;clientId:string;riderId:string})=>{
  // The same persisted event reaches both participants. A reconnect always
  // recovers its ordered source of truth through GET /trips/:id.
  io?.to(`user:${update.clientId}`).emit("trip:tracking-updated",update);
  if(update.riderId) io?.to(`user:${update.riderId}`).emit("trip:tracking-updated",update);
  // Keep the old client event during the web rollout; new views use the
  // explicit tracking event above.
  io?.to(`user:${update.clientId}`).emit("trip:location-updated",update);
};
tripsRouter.patch("/:id/status",authorize("RIDER"),async(req,res)=>{const tripId=z.string().min(1).parse(req.params.id);const data=z.object({status:z.nativeEnum(TripStatus),location:tripLocationSchema.optional()}).parse(req.body);const transition=data.status==="RIDER_ARRIVED"?await boardPassenger(tripId,req.user!.id,data.location):{trip:await changeStatus(tripId,req.user!.id,req.user!.role,data.status),trackingLocation:null};const t=transition.trip;const io=req.app.get("io");if(transition.trackingLocation)emitTrackingUpdate(io,transition.trackingLocation);io?.to(`user:${t.clientId}`).emit("trip:status-updated",t);if(t.riderId)io?.to(`user:${t.riderId}`).emit("trip:status-updated",t);io?.to("admins").emit("trip:status-updated",t);res.json(t);});
tripsRouter.patch("/:id/location",authorize("RIDER"),async(req,res)=>{const location=tripLocationSchema.parse(req.body);const update=await recordTripLocation(req.params.id,req.user!.id,location);emitTrackingUpdate(req.app.get("io"),update);res.json(update);});
tripsRouter.post("/:id/complete",authorize("CLIENT"),async(req,res)=>{const t=await completeTripByClient(req.params.id,req.user!.id);const io=req.app.get("io");io?.to(`user:${t.clientId}`).emit("trip:status-updated",t);if(t.riderId)io?.to(`user:${t.riderId}`).emit("trip:status-updated",t);io?.to("admins").emit("trip:status-updated",t);res.json(t);});
tripsRouter.post("/:id/cancel",async(req,res)=>{const reason=z.string().trim().min(2).max(160).optional().parse(req.body?.reason);const result=await cancelTrip(req.params.id,req.user!.id,req.user!.role,reason);const {trip,reopened,previousRiderId}=result;const io=req.app.get("io");if(reopened){io?.to(`user:${trip.clientId}`).emit("trip:status-updated",trip);if(previousRiderId)io?.to(`user:${previousRiderId}`).emit("trip:cancelled",trip);io?.to("riders").emit("trip:requested",trip);}else{io?.to(`user:${trip.clientId}`).emit("trip:cancelled",trip);if(previousRiderId)io?.to(`user:${previousRiderId}`).emit("trip:cancelled",trip);}res.json(trip);});
tripsRouter.post("/:id/rating",authorize("CLIENT"),async(req,res)=>{const d=ratingSchema.parse(req.body);const trip=await prisma.trip.findUnique({where:{id:req.params.id}});if(!trip||trip.clientId!==req.user!.id||trip.status!=="COMPLETED"||!trip.riderId)fail(409,"RATING_NOT_ALLOWED","Solo puedes calificar viajes finalizados propios.");res.status(201).json(await prisma.rating.create({data:{tripId:trip.id,authorId:req.user!.id,riderId:trip.riderId,...d}}));});
