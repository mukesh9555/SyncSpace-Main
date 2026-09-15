import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import morgan from "morgan";
import { config } from "../config/index.js";

morgan.token("request-id", (req: Request) => req.requestId ?? "unknown");

export const requestLogger = morgan(
  config.NODE_ENV === "production"
    ? ':remote-addr - :request-id ":method :url :status :res[content-length] - :response-time ms'
    : ":method :url :status :res[content-length] - :response-time ms",
);

export function requestId(req: Request, _res: Response, next: NextFunction): void {
  req.requestId = crypto.randomUUID();
  next();
}
