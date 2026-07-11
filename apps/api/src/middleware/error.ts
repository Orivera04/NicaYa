import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/error.js";
export function errorHandler(err:unknown,req:Request,res:Response,_next:NextFunction){ if(err instanceof ZodError) return res.status(400).json({error:{code:"VALIDATION_ERROR",message:"Datos inválidos.",details:err.flatten()}}); const e=err instanceof AppError?err:new AppError(500,"INTERNAL_ERROR","Ocurrió un error interno."); console.error(JSON.stringify({requestId:req.requestId,code:e.code,message:err instanceof Error?err.message:String(err)})); return res.status(e.status).json({error:{code:e.code,message:e.message,details:e.details}}); }
