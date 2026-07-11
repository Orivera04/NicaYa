import "dotenv/config";
import { z } from "zod";
const schema = z.object({ DATABASE_URL: z.string().url(), JWT_ACCESS_SECRET: z.string().min(32), JWT_REFRESH_SECRET: z.string().min(32), JWT_ACCESS_EXPIRES_IN: z.string().default("15m"), JWT_REFRESH_EXPIRES_IN: z.string().default("7d"), API_PORT: z.coerce.number().default(4000), CORS_ORIGIN: z.string().url(), NODE_ENV: z.enum(["development", "test", "production"]).default("development") });
export const env = schema.parse(process.env);
