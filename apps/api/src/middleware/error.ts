import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/error.js";
import { logger } from "../lib/logger.js";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Datos inválidos.", details: err.flatten() } });
  }

  const error = err instanceof AppError ? err : new AppError(500, "INTERNAL_ERROR", "Ocurrió un error interno.");
  logger.error({ requestId: req.requestId, code: error.code, message: err instanceof Error ? err.message : String(err) }, "Request failed");
  return res.status(error.status).json({ error: { code: error.code, message: error.message, details: error.details } });
}
