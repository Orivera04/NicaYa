import pino from "pino";

/** Structured logs keep operational diagnostics useful without exposing secrets. */
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "password",
      "passwordHash",
      "refreshToken",
      "accessToken",
      "proofReference",
      "frontImage",
      "backImage",
    ],
    censor: "[REDACTED]",
  },
});
