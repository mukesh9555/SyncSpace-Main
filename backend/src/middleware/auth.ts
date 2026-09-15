import type { Request, Response, NextFunction } from "express";
import { verifyAuthToken, type AuthJWTPayload } from "../lib/token.js";
import { AUTH_COOKIE_NAME } from "../lib/token.js";
import { prisma } from "../db/index.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
      userName?: string;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token =
    req.cookies?.[AUTH_COOKIE_NAME] ??
    req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    res.status(401).json({
      success: false,
      error: "Authentication required. Please log in.",
    });
    return;
  }

  const payload: AuthJWTPayload | null = await verifyAuthToken(token);

  if (!payload) {
    res.status(401).json({
      success: false,
      error: "Invalid or expired token. Please log in again.",
    });
    return;
  }

  req.userId = payload.sub;
  req.userEmail = payload.email;
  req.userName = payload.name;

  // Fire-and-forget: update lastActiveAt without blocking the response.
  // Errors here are non-critical — logged but not propagated.
  prisma.user
    .update({
      where: { id: payload.sub },
      data: { lastActiveAt: new Date() },
      select: { id: true },
    })
    .catch((err) => {
      console.error("[auth] Failed to update lastActiveAt:", err);
    });

  next();
}
