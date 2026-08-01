import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  API_PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().url(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]+$/).default("motoya_refresh"),
  COOKIE_DOMAIN: z.string().min(1).optional(),
  COOKIE_SECURE: z.enum(["true", "false"]).optional(),
  COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
  FILE_ENCRYPTION_KEY: z.string().min(32).optional(),
  // A compact image keeps the full 8-image rider dossier below the JSON body limit.
  MEDIA_MAX_IMAGE_BYTES: z.coerce.number().int().positive().max(1_000_000).default(350_000),
});

const parsed = schema.parse(process.env);

if (parsed.COOKIE_SAME_SITE === "none" && parsed.COOKIE_SECURE === "false") {
  throw new Error("COOKIE_SAME_SITE=none requires COOKIE_SECURE=true.");
}

export const env = {
  ...parsed,
  COOKIE_SECURE: parsed.COOKIE_SECURE ? parsed.COOKIE_SECURE === "true" : parsed.NODE_ENV === "production",
};
