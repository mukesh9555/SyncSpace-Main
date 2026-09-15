import cors from "cors";
import { config } from "../config/index.js";

function getAllowedOrigins(): string[] {
  const origins = [config.CORS_ORIGIN];
  if (config.FRONTEND_URL && config.FRONTEND_URL !== config.CORS_ORIGIN) {
    origins.push(config.FRONTEND_URL);
  }
  return [...new Set(origins)];
}

export const corsMiddleware = cors({
  origin: getAllowedOrigins(),
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  maxAge: 86400,
});
