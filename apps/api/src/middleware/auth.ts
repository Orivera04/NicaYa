import type { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import { readAccess } from "../lib/auth.js";
import { AppError } from "../lib/error.js";
export function authenticate(req:Request,_res:Response,next:NextFunction){ try { const token=req.headers.authorization?.replace(/^Bearer\s+/i,""); if(!token) throw new AppError(401,"UNAUTHENTICATED","Debes iniciar sesión."); req.user=readAccess(token); next(); } catch { next(new AppError(401,"UNAUTHENTICATED","Tu sesión no es válida o expiró.")); } }
export const authorize=(...roles:Role[]) => (req:Request,_res:Response,next:NextFunction)=> roles.includes(req.user!.role) ? next() : next(new AppError(403,"FORBIDDEN","No tienes permiso para esta acción."));
