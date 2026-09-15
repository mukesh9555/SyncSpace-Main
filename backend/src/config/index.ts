import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const baseEnvSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  FRONTEND_URL: z.string().url().optional(),
  API_PREFIX: z.string().default("/api/v1"),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  TRUST_PROXY: z.coerce.number().default(0),
});

const parsed = baseEnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

if (env.NODE_ENV === "production") {
  const prodWarnings: string[] = [];

  if (!env.FRONTEND_URL) {
    prodWarnings.push("FRONTEND_URL is not set — CORS will use CORS_ORIGIN only");
  }

  if (env.CORS_ORIGIN === "http://localhost:5173") {
    prodWarnings.push("CORS_ORIGIN is still localhost — update for production");
  }

  if (env.TRUST_PROXY === 0) {
    prodWarnings.push("TRUST_PROXY is 0 — set to 1 if behind a reverse proxy");
  }

  if (env.JWT_SECRET.includes("change") || env.JWT_SECRET.includes("dev")) {
    prodWarnings.push("JWT_SECRET appears to be a development value");
  }

  if (prodWarnings.length > 0) {
    console.warn("[config] Production warnings:");
    for (const w of prodWarnings) {
      console.warn(`  - ${w}`);
    }
  }
}

export const config = env;
