import type { Request, Response, NextFunction } from "express";
import { config } from "../config/index.js";
import { AppError, ValidationError } from "../types/errors.js";

interface ErrorResponse {
  success: false;
  error: string;
  statusCode: number;
  requestId?: string;
  details?: Record<string, string[]>;
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ValidationError) {
    const response: ErrorResponse = {
      success: false,
      error: err.message,
      statusCode: err.statusCode,
      details: err.errors,
    };
    res.status(err.statusCode).json(response);
    return;
  }

  if (err instanceof AppError) {
    const response: ErrorResponse = {
      success: false,
      error: err.message,
      statusCode: err.statusCode,
    };
    res.status(err.statusCode).json(response);
    return;
  }

  console.error("Unhandled error:", err);

  const statusCode = 500;
  const response: ErrorResponse = {
    success: false,
    error: config.NODE_ENV === "production" ? "Internal server error" : err.message,
    statusCode,
  };

  res.status(statusCode).json(response);
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  const message = config.NODE_ENV === "production"
    ? "Route not found"
    : `Route ${req.method} ${req.originalUrl} not found`;
  next(new AppError(message, 404));
}
