import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { authenticate, authorize } from "../middleware/auth.js";
export const placesRouter=Router(); placesRouter.use(authenticate,authorize("CLIENT"));
placesRouter.get("/",async(req,res)=>res.json(await prisma.savedPlace.findMany({where:{userId:req.user!.id},orderBy:{createdAt:"asc"}})));
placesRouter.put("/:label",async(req,res)=>{const data=z.object({address:z.string().min(3),lat:z.number(),lng:z.number()}).parse(req.body);res.json(await prisma.savedPlace.upsert({where:{userId_label:{userId:req.user!.id,label:req.params.label}},update:data,create:{userId:req.user!.id,label:req.params.label,...data}}));});
placesRouter.delete("/:label",async(req,res)=>{await prisma.savedPlace.delete({where:{userId_label:{userId:req.user!.id,label:req.params.label}}});res.status(204).end();});
