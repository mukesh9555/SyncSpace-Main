import { Router } from "express";
import { prisma } from "../../db/index.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { requireWorkspaceMember } from "../../middleware/workspace.js";
import {
  createNoteSchema,
  updateNoteSchema,
  hasNoteForbiddenFields,
} from "../../lib/noteSchemas.js";
import { logActivity, ActivityAction } from "../../lib/activityLog.js";

const router = Router();

// All note routes require authentication
router.use(requireAuth);

// ─── POST /workspaces/:workspaceId/notes — create note ──────────────────────

router.post(
  "/workspaces/:workspaceId/notes",
  requireWorkspaceMember,
  validate(createNoteSchema),
  async (req, res, next) => {
    try {
      const forbidden = hasNoteForbiddenFields(req.body as Record<string, unknown>);
      if (forbidden.length > 0) {
        res.status(403).json({
          success: false,
          error: `Forbidden fields cannot be set: ${forbidden.join(", ")}`,
        });
        return;
      }

      const { title, content, isPinned } = req.body;

      const note = await prisma.note.create({
        data: {
          title,
          content,
          isPinned,
          authorId: req.userId!,
          workspaceId: req.workspaceId!,
        },
        include: {
          author: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      res.status(201).json({ success: true, note });

      logActivity({
        action: ActivityAction.NOTE_CREATED,
        entityType: "note",
        entityId: note.id,
        userId: req.userId!,
        workspaceId: req.workspaceId!,
        metadata: { title },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /workspaces/:workspaceId/notes — list notes ────────────────────────

router.get(
  "/workspaces/:workspaceId/notes",
  requireWorkspaceMember,
  async (req, res, next) => {
    try {
      const notes = await prisma.note.findMany({
        where: { workspaceId: req.workspaceId! },
        include: {
          author: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
      });

      res.json({ success: true, notes });
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /workspaces/:workspaceId/notes/:noteId — single note ───────────────

router.get(
  "/workspaces/:workspaceId/notes/:noteId",
  requireWorkspaceMember,
  async (req, res, next) => {
    try {
      const { noteId } = req.params as { noteId: string };

      const note = await prisma.note.findFirst({
        where: {
          id: noteId,
          workspaceId: req.workspaceId!,
        },
        include: {
          author: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      if (!note) {
        res.status(404).json({ success: false, error: "Note not found." });
        return;
      }

      res.json({ success: true, note });
    } catch (error) {
      next(error);
    }
  },
);

// ─── PATCH /workspaces/:workspaceId/notes/:noteId — update note ─────────────

router.patch(
  "/workspaces/:workspaceId/notes/:noteId",
  requireWorkspaceMember,
  validate(updateNoteSchema),
  async (req, res, next) => {
    try {
      const forbidden = hasNoteForbiddenFields(req.body as Record<string, unknown>);
      if (forbidden.length > 0) {
        res.status(403).json({
          success: false,
          error: `Forbidden fields cannot be set: ${forbidden.join(", ")}`,
        });
        return;
      }

      const { noteId } = req.params as { noteId: string };

      const existing = await prisma.note.findFirst({
        where: { id: noteId, workspaceId: req.workspaceId! },
        select: { id: true, authorId: true },
      });

      if (!existing) {
        res.status(404).json({ success: false, error: "Note not found." });
        return;
      }

      // Only the author or admin+ can update
      const isAuthor = existing.authorId === req.userId;
      const isAdminOrOwner = ["admin", "owner"].includes(req.membershipRole!);
      if (!isAuthor && !isAdminOrOwner) {
        res.status(403).json({
          success: false,
          error: "Only the note author or an admin can edit this note.",
        });
        return;
      }

      const { title, content, isPinned } = req.body;

      const note = await prisma.note.update({
        where: { id: noteId },
        data: { title, content, isPinned },
        include: {
          author: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      logActivity({
        action: ActivityAction.NOTE_UPDATED,
        entityType: "note",
        entityId: noteId,
        userId: req.userId!,
        workspaceId: req.workspaceId!,
        metadata: { title },
      });

      res.json({ success: true, note });
    } catch (error) {
      next(error);
    }
  },
);

// ─── DELETE /workspaces/:workspaceId/notes/:noteId — delete note ────────────

router.delete(
  "/workspaces/:workspaceId/notes/:noteId",
  requireWorkspaceMember,
  async (req, res, next) => {
    try {
      const { noteId } = req.params as { noteId: string };

      const existing = await prisma.note.findFirst({
        where: { id: noteId, workspaceId: req.workspaceId! },
        select: { id: true, authorId: true },
      });

      if (!existing) {
        res.status(404).json({ success: false, error: "Note not found." });
        return;
      }

      // Only the author or admin+ can delete
      const isAuthor = existing.authorId === req.userId;
      const isAdminOrOwner = ["admin", "owner"].includes(req.membershipRole!);
      if (!isAuthor && !isAdminOrOwner) {
        res.status(403).json({
          success: false,
          error: "Only the note author or an admin can delete this note.",
        });
        return;
      }

      await prisma.note.delete({ where: { id: noteId } });

      logActivity({
        action: ActivityAction.NOTE_DELETED,
        entityType: "note",
        entityId: noteId,
        userId: req.userId!,
        workspaceId: req.workspaceId!,
      });

      res.json({ success: true, message: "Note deleted." });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
