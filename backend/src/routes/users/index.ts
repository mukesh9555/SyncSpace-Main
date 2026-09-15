import { Router } from "express";
import { prisma } from "../../db/index.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  updateProfileSchema,
  hasForbiddenFields,
} from "../../lib/userSchemas.js";

const router = Router();

// All user routes require authentication
router.use(requireAuth);

// ─── GET /users/me ──────────────────────────────────────────────────────────

router.get("/users/me", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        bio: true,
        avatarUrl: true,
        lastActiveAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ success: false, error: "User not found." });
      return;
    }

    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
});

// ─── PATCH /users/me ────────────────────────────────────────────────────────

router.patch(
  "/users/me",
  validate(updateProfileSchema),
  async (req, res, next) => {
    try {
      // Security: reject any forbidden fields the frontend tried to smuggle
      const forbidden = hasForbiddenFields(req.body as Record<string, unknown>);
      if (forbidden.length > 0) {
        res.status(403).json({
          success: false,
          error: `Forbidden fields cannot be modified: ${forbidden.join(", ")}`,
        });
        return;
      }

      const { name, username, bio, avatarUrl } = req.body;

      // Username uniqueness check
      if (username !== undefined) {
        const existing = await prisma.user.findFirst({
          where: {
            username,
            id: { not: req.userId! },
          },
        });

        if (existing) {
          res.status(409).json({
            success: false,
            error: "This username is already taken.",
          });
          return;
        }
      }

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (username !== undefined) updateData.username = username;
      if (bio !== undefined) updateData.bio = bio;
      if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

      if (Object.keys(updateData).length === 0) {
        res.status(400).json({
          success: false,
          error: "No valid fields to update.",
        });
        return;
      }

      const user = await prisma.user.update({
        where: { id: req.userId! },
        data: updateData,
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          bio: true,
          avatarUrl: true,
          lastActiveAt: true,
          createdAt: true,
        },
      });

      res.json({ success: true, user });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
