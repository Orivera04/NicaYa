import { z } from "zod";

export const roles = ["CLIENT", "RIDER", "ADMIN"] as const;
export type Role = (typeof roles)[number];
export const tripStatuses = ["REQUESTED", "ACCEPTED", "RIDER_ON_THE_WAY", "RIDER_ARRIVED", "IN_PROGRESS", "COMPLETED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_RIDER", "CANCELLED_BY_ADMIN"] as const;
export type TripStatus = (typeof tripStatuses)[number];
export const registerSchema = z.object({ name: z.string().min(2).max(80), email: z.string().email(), password: z.string().min(8).max(128), phone: z.string().min(7).max(25).optional() });
export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
export const locationSchema = z.object({ lat: z.number().gte(-90).lte(90), lng: z.number().gte(-180).lte(180), address: z.string().min(3).max(255) });
export const tripCreateSchema = z.object({ origin: locationSchema, destination: locationSchema, serviceCode: z.literal("MOTO").default("MOTO"), proposedPrice: z.number().positive().max(2000).optional() });
export const ratingSchema = z.object({ score: z.number().int().min(1).max(5), comment: z.string().max(500).optional() });
export const availabilitySchema = z.object({ available: z.boolean() });
export const apiError = (code: string, message: string, details: unknown = null) => ({ error: { code, message, details } });
