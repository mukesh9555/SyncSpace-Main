import { Router } from "express";
import { prisma } from "../../db/index.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { requireWorkspaceMember } from "../../middleware/workspace.js";
import {
  createCodeFileSchema,
  updateCodeFileSchema,
  hasCodeFileForbiddenFields,
} from "../../lib/codeFileSchemas.js";
import { logActivity, ActivityAction } from "../../lib/activityLog.js";

const router = Router();

router.use(requireAuth);

// ─── POST /workspaces/:workspaceId/codefiles — create file ──────────────────

router.post(
  "/workspaces/:workspaceId/codefiles",
  requireWorkspaceMember,
  validate(createCodeFileSchema),
  async (req, res, next) => {
    try {
      const forbidden = hasCodeFileForbiddenFields(
        req.body as Record<string, unknown>,
      );
      if (forbidden.length > 0) {
        res.status(403).json({
          success: false,
          error: `Forbidden fields cannot be set: ${forbidden.join(", ")}`,
        });
        return;
      }

      const { name, path, content, language } = req.body;

      const existing = await prisma.codeFile.findFirst({
        where: { workspaceId: req.workspaceId!, path },
      });
      if (existing) {
        res.status(409).json({
          success: false,
          error: "A file with this path already exists in the workspace.",
        });
        return;
      }

      const file = await prisma.codeFile.create({
        data: {
          name,
          path,
          content,
          language,
          authorId: req.userId!,
          workspaceId: req.workspaceId!,
        },
        include: {
          author: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      res.status(201).json({ success: true, file });

      logActivity({
        action: ActivityAction.CODEFILE_CREATED,
        entityType: "codefile",
        entityId: file.id,
        userId: req.userId!,
        workspaceId: req.workspaceId!,
        metadata: { name, path, language },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /workspaces/:workspaceId/codefiles — list files ────────────────────

router.get(
  "/workspaces/:workspaceId/codefiles",
  requireWorkspaceMember,
  async (req, res, next) => {
    try {
      const files = await prisma.codeFile.findMany({
        where: { workspaceId: req.workspaceId! },
        select: {
          id: true,
          name: true,
          path: true,
          language: true,
          authorId: true,
          createdAt: true,
          updatedAt: true,
          author: {
            select: { id: true, name: true },
          },
        },
        orderBy: { path: "asc" },
      });

      res.json({ success: true, files });
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /workspaces/:workspaceId/codefiles/:fileId — single file ───────────

router.get(
  "/workspaces/:workspaceId/codefiles/:fileId",
  requireWorkspaceMember,
  async (req, res, next) => {
    try {
      const { fileId } = req.params as { fileId: string };

      const file = await prisma.codeFile.findFirst({
        where: { id: fileId, workspaceId: req.workspaceId! },
        include: {
          author: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      if (!file) {
        res.status(404).json({ success: false, error: "File not found." });
        return;
      }

      res.json({ success: true, file });
    } catch (error) {
      next(error);
    }
  },
);

// ─── PATCH /workspaces/:workspaceId/codefiles/:fileId — update file ─────────

router.patch(
  "/workspaces/:workspaceId/codefiles/:fileId",
  requireWorkspaceMember,
  validate(updateCodeFileSchema),
  async (req, res, next) => {
    try {
      const forbidden = hasCodeFileForbiddenFields(
        req.body as Record<string, unknown>,
      );
      if (forbidden.length > 0) {
        res.status(403).json({
          success: false,
          error: `Forbidden fields cannot be set: ${forbidden.join(", ")}`,
        });
        return;
      }

      const { fileId } = req.params as { fileId: string };

      const existing = await prisma.codeFile.findFirst({
        where: { id: fileId, workspaceId: req.workspaceId! },
        select: { id: true, authorId: true, path: true },
      });

      if (!existing) {
        res.status(404).json({ success: false, error: "File not found." });
        return;
      }

      const isAuthor = existing.authorId === req.userId;
      const isAdminOrOwner = ["admin", "owner"].includes(
        req.membershipRole!,
      );
      if (!isAuthor && !isAdminOrOwner) {
        res.status(403).json({
          success: false,
          error: "Only the file author or an admin can edit this file.",
        });
        return;
      }

      // Check path uniqueness if path is being changed
      const { path: newPath } = req.body;
      if (newPath && newPath !== existing.path) {
        const duplicate = await prisma.codeFile.findFirst({
          where: {
            workspaceId: req.workspaceId!,
            path: newPath,
            id: { not: fileId },
          },
        });
        if (duplicate) {
          res.status(409).json({
            success: false,
            error: "A file with this path already exists in the workspace.",
          });
          return;
        }
      }

      const { name, path, content, language } = req.body;

      const file = await prisma.codeFile.update({
        where: { id: fileId },
        data: { name, path, content, language },
        include: {
          author: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      logActivity({
        action: ActivityAction.CODEFILE_UPDATED,
        entityType: "codefile",
        entityId: fileId,
        userId: req.userId!,
        workspaceId: req.workspaceId!,
        metadata: { name, path, language },
      });

      res.json({ success: true, file });
    } catch (error) {
      next(error);
    }
  },
);

// ─── DELETE /workspaces/:workspaceId/codefiles/:fileId — delete file ────────

router.delete(
  "/workspaces/:workspaceId/codefiles/:fileId",
  requireWorkspaceMember,
  async (req, res, next) => {
    try {
      const { fileId } = req.params as { fileId: string };

      const existing = await prisma.codeFile.findFirst({
        where: { id: fileId, workspaceId: req.workspaceId! },
        select: { id: true, authorId: true },
      });

      if (!existing) {
        res.status(404).json({ success: false, error: "File not found." });
        return;
      }

      const isAuthor = existing.authorId === req.userId;
      const isAdminOrOwner = ["admin", "owner"].includes(
        req.membershipRole!,
      );
      if (!isAuthor && !isAdminOrOwner) {
        res.status(403).json({
          success: false,
          error: "Only the file author or an admin can delete this file.",
        });
        return;
      }

      await prisma.codeFile.delete({ where: { id: fileId } });

      logActivity({
        action: ActivityAction.CODEFILE_DELETED,
        entityType: "codefile",
        entityId: fileId,
        userId: req.userId!,
        workspaceId: req.workspaceId!,
      });

      res.json({ success: true, message: "File deleted." });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
