import { Router } from "express";
import { prisma } from "../../db/index.js";
import { registerSchema, loginSchema } from "../../lib/authSchemas.js";
import { hashPassword, comparePassword } from "../../lib/password.js";
import {
  signAuthToken,
  setAuthCookie,
  clearAuthCookie,
} from "../../lib/token.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { authLimiter, strictAuthLimiter } from "../../middleware/rateLimit.js";

const USER_SELECT = {
  id: true,
  email: true,
  username: true,
  name: true,
  bio: true,
  avatarUrl: true,
  createdAt: true,
} as const;

const router = Router();

// ─── Register ───────────────────────────────────────────────────────────────

router.post(
  "/auth/register",
  strictAuthLimiter,
  validate(registerSchema),
  async (req, res, next) => {
    try {
      const { name, email, password } = req.body;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        res.status(409).json({
          success: false,
          error: "An account with this email already exists.",
        });
        return;
      }

      const passwordHash = await hashPassword(password);
      const user = await prisma.user.create({
        data: { name, email, passwordHash },
        select: USER_SELECT,
      });

      const token = await signAuthToken({
        sub: user.id,
        email: user.email,
        name: user.name,
      });

      setAuthCookie(res, token);

      res.status(201).json({
        success: true,
        message: "Account created successfully.",
        user,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ─── Login ──────────────────────────────────────────────────────────────────

router.post(
  "/auth/login",
  authLimiter,
  validate(loginSchema),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        res.status(401).json({
          success: false,
          error: "Invalid email or password.",
        });
        return;
      }

      const valid = await comparePassword(password, user.passwordHash);
      if (!valid) {
        res.status(401).json({
          success: false,
          error: "Invalid email or password.",
        });
        return;
      }

      const token = await signAuthToken({
        sub: user.id,
        email: user.email,
        name: user.name,
      });

      setAuthCookie(res, token);

      res.json({
        success: true,
        message: "Logged in successfully.",
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.name,
          bio: user.bio,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ─── Logout ─────────────────────────────────────────────────────────────────

router.post("/auth/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ success: true, message: "Logged out successfully." });
});

// ─── Me (current user) ─────────────────────────────────────────────────────

router.get("/auth/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: USER_SELECT,
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: "User not found.",
      });
      return;
    }

    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
});

export default router;
