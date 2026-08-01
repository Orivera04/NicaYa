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
    // Router's methods have overloads with different tuples. At runtime each
    // accepts the same list of path/middleware arguments, so we intentionally
    // erase the overload only at this boundary and keep the rest of the API
    // typed normally.
    const original = router[method].bind(router) as unknown as (...args: never[]) => Router;
    (router as unknown as Record<string, (...args: unknown[]) => unknown>)[method] = (...args: unknown[]) => {
      const wrapped = args.map((arg) => typeof arg === "function" ? asyncHandler(arg as never) : arg);
      return original(...(wrapped as never[]));
    };
  }
  return router;
}
