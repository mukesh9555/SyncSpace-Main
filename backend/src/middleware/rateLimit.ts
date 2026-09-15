import rateLimit from "express-rate-limit";

// ─── General API limiter — applied to all routes ────────────────────────

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many requests. Please try again later.",
  },
  keyGenerator: (req) => {
    return req.ip ?? req.socket.remoteAddress ?? "unknown";
  },
});

// ─── Auth endpoint limiter — login/register ─────────────────────────────

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many attempts. Please try again in 15 minutes.",
  },
  keyGenerator: (req) => {
    return req.ip ?? req.socket.remoteAddress ?? "unknown";
  },
});

// ─── Strict auth limiter — registration only ────────────────────────────

export const strictAuthLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many registration attempts. Please try again in 1 hour.",
  },
  keyGenerator: (req) => {
    return req.ip ?? req.socket.remoteAddress ?? "unknown";
  },
});
