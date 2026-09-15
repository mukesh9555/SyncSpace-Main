import { Router } from "express";
import { prisma } from "../../db/index.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { requireWorkspaceMember } from "../../middleware/workspace.js";
import {
  createWhiteboardSchema,
  updateWhiteboardSchema,
  hasWhiteboardForbiddenFields,
} from "../../lib/whiteboardSchemas.js";
import { logActivity, ActivityAction } from "../../lib/activityLog.js";

const router = Router();

router.use(requireAuth);

// ─── POST /workspaces/:workspaceId/whiteboards — create whiteboard ──────────

router.post(
  "/workspaces/:workspaceId/whiteboards",
  requireWorkspaceMember,
  validate(createWhiteboardSchema),
  async (req, res, next) => {
    try {
      const forbidden = hasWhiteboardForbiddenFields(
        req.body as Record<string, unknown>,
      );
      if (forbidden.length > 0) {
        res.status(403).json({
          success: false,
          error: `Forbidden fields cannot be set: ${forbidden.join(", ")}`,
        });
        return;
      }

      const { name, content } = req.body;

      const whiteboard = await prisma.whiteboard.create({
        data: {
          name,
          content,
          authorId: req.userId!,
          workspaceId: req.workspaceId!,
        },
        include: {
          author: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      res.status(201).json({ success: true, whiteboard });

      logActivity({
        action: ActivityAction.WHITEBOARD_CREATED,
        entityType: "whiteboard",
        entityId: whiteboard.id,
        userId: req.userId!,
        workspaceId: req.workspaceId!,
        metadata: { name },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /workspaces/:workspaceId/whiteboards — list whiteboards ────────────

router.get(
  "/workspaces/:workspaceId/whiteboards",
  requireWorkspaceMember,
  async (req, res, next) => {
    try {
      const whiteboards = await prisma.whiteboard.findMany({
        where: { workspaceId: req.workspaceId! },
        select: {
          id: true,
          name: true,
          authorId: true,
          createdAt: true,
          updatedAt: true,
          author: {
            select: { id: true, name: true },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      res.json({ success: true, whiteboards });
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /workspaces/:workspaceId/whiteboards/:whiteboardId — single ────────

router.get(
  "/workspaces/:workspaceId/whiteboards/:whiteboardId",
  requireWorkspaceMember,
  async (req, res, next) => {
    try {
      const { whiteboardId } = req.params as { whiteboardId: string };

      const whiteboard = await prisma.whiteboard.findFirst({
        where: { id: whiteboardId, workspaceId: req.workspaceId! },
        include: {
          author: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      if (!whiteboard) {
        res.status(404).json({
          success: false,
          error: "Whiteboard not found.",
        });
        return;
      }

      res.json({ success: true, whiteboard });
    } catch (error) {
      next(error);
    }
  },
);

// ─── PATCH /workspaces/:workspaceId/whiteboards/:whiteboardId — update ──────

router.patch(
  "/workspaces/:workspaceId/whiteboards/:whiteboardId",
  requireWorkspaceMember,
  validate(updateWhiteboardSchema),
  async (req, res, next) => {
    try {
      const forbidden = hasWhiteboardForbiddenFields(
        req.body as Record<string, unknown>,
      );
      if (forbidden.length > 0) {
        res.status(403).json({
          success: false,
          error: `Forbidden fields cannot be set: ${forbidden.join(", ")}`,
        });
        return;
      }

      const { whiteboardId } = req.params as { whiteboardId: string };

      const existing = await prisma.whiteboard.findFirst({
        where: { id: whiteboardId, workspaceId: req.workspaceId! },
        select: { id: true, authorId: true },
      });

      if (!existing) {
        res.status(404).json({
          success: false,
          error: "Whiteboard not found.",
        });
        return;
      }

      const isAuthor = existing.authorId === req.userId;
      const isAdminOrOwner = ["admin", "owner"].includes(
        req.membershipRole!,
      );
      if (!isAuthor && !isAdminOrOwner) {
        res.status(403).json({
          success: false,
          error: "Only the whiteboard author or an admin can edit this whiteboard.",
        });
        return;
      }

      const { name, content } = req.body;

      const whiteboard = await prisma.whiteboard.update({
        where: { id: whiteboardId },
        data: { name, content },
        include: {
          author: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      logActivity({
        action: ActivityAction.WHITEBOARD_UPDATED,
        entityType: "whiteboard",
        entityId: whiteboardId,
        userId: req.userId!,
        workspaceId: req.workspaceId!,
        metadata: { name },
      });

      res.json({ success: true, whiteboard });
    } catch (error) {
      next(error);
    }
  },
);

// ─── DELETE /workspaces/:workspaceId/whiteboards/:whiteboardId — delete ─────

router.delete(
  "/workspaces/:workspaceId/whiteboards/:whiteboardId",
  requireWorkspaceMember,
  async (req, res, next) => {
    try {
      const { whiteboardId } = req.params as { whiteboardId: string };

      const existing = await prisma.whiteboard.findFirst({
        where: { id: whiteboardId, workspaceId: req.workspaceId! },
        select: { id: true, authorId: true },
      });

      if (!existing) {
        res.status(404).json({
          success: false,
          error: "Whiteboard not found.",
        });
        return;
      }

      const isAuthor = existing.authorId === req.userId;
      const isAdminOrOwner = ["admin", "owner"].includes(
        req.membershipRole!,
      );
      if (!isAuthor && !isAdminOrOwner) {
        res.status(403).json({
          success: false,
          error: "Only the whiteboard author or an admin can delete this whiteboard.",
        });
        return;
      }

      await prisma.whiteboard.delete({ where: { id: whiteboardId } });

      logActivity({
        action: ActivityAction.WHITEBOARD_DELETED,
        entityType: "whiteboard",
        entityId: whiteboardId,
        userId: req.userId!,
        workspaceId: req.workspaceId!,
      });

      res.json({ success: true, message: "Whiteboard deleted." });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
