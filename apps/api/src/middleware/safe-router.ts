import { Router } from "express";
import { asyncHandler } from "./async-handler.js";

/**
 * Express 4 does not forward rejected promises from route callbacks. Every
 * router created here wraps its callbacks so business errors reach errorHandler
 * instead of becoming unhandled rejections that terminate the API process.
 */
export function safeRouter() {
  const router = Router();
  for (const method of ["use", "get", "post", "put", "patch", "delete", "all"] as const) {
    const original = router[method].bind(router);
    (router as unknown as Record<string, (...args: unknown[]) => unknown>)[method] = (...args: unknown[]) => original(...args.map((arg) => typeof arg === "function" ? asyncHandler(arg as never) : arg));
  }
  return router;
}
