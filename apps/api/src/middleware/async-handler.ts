import type { NextFunction, Request, RequestHandler, Response } from "express";

/** Sends rejected async route promises to the centralized error middleware. */
export const asyncHandler = (handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
