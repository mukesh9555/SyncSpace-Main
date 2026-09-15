import { Router } from "express";
import { prisma } from "../../db/index.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  requireWorkspaceMember,
  requireRole,
} from "../../middleware/workspace.js";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  hasWorkspaceForbiddenFields,
} from "../../lib/workspaceSchemas.js";
import { logActivity, ActivityAction } from "../../lib/activityLog.js";

const router = Router();

// All workspace routes require authentication
router.use(requireAuth);

// ─── POST /workspaces — create workspace + owner membership ─────────────────

router.post(
  "/workspaces",
  validate(createWorkspaceSchema),
  async (req, res, next) => {
    try {
      const forbidden = hasWorkspaceForbiddenFields(
        req.body as Record<string, unknown>,
      );
      if (forbidden.length > 0) {
        res.status(403).json({
          success: false,
          error: `Forbidden fields cannot be set: ${forbidden.join(", ")}`,
        });
        return;
      }

      const { name, slug, description } = req.body;

      const existing = await prisma.workspace.findUnique({
        where: { slug },
      });
      if (existing) {
        res.status(409).json({
          success: false,
          error: "A workspace with this slug already exists.",
        });
        return;
      }

      const workspace = await prisma.workspace.create({
        data: {
          name,
          slug,
          description,
          members: {
            create: {
              userId: req.userId!,
              role: "owner",
            },
          },
        },
        include: {
          members: {
            select: { id: true, role: true, userId: true },
          },
        },
      });

      res.status(201).json({ success: true, workspace });

      logActivity({
        action: ActivityAction.WORKSPACE_CREATED,
        entityType: "workspace",
        entityId: workspace.id,
        userId: req.userId!,
        workspaceId: workspace.id,
        metadata: { name, slug },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /workspaces — list workspaces the user belongs to ──────────────────

router.get("/workspaces", async (req, res, next) => {
  try {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: req.userId! },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const workspaces = memberships.map((m) => ({
      ...m.workspace,
      role: m.role,
    }));

    res.json({ success: true, workspaces });
  } catch (error) {
    next(error);
  }
});

// ─── GET /workspaces/:workspaceId — single workspace ────────────────────────

router.get(
  "/workspaces/:workspaceId",
  requireWorkspaceMember,
  async (req, res, next) => {
    try {
      const workspace = await prisma.workspace.findUnique({
        where: { id: req.workspaceId! },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  username: true,
                  avatarUrl: true,
                },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!workspace) {
        res.status(404).json({
          success: false,
          error: "Workspace not found.",
        });
        return;
      }

      res.json({ success: true, workspace });
    } catch (error) {
      next(error);
    }
  },
);

// ─── PATCH /workspaces/:workspaceId — update (admin+) ───────────────────────

router.patch(
  "/workspaces/:workspaceId",
  requireRole("admin", "owner"),
  validate(updateWorkspaceSchema),
  async (req, res, next) => {
    try {
      const forbidden = hasWorkspaceForbiddenFields(
        req.body as Record<string, unknown>,
      );
      if (forbidden.length > 0) {
        res.status(403).json({
          success: false,
          error: `Forbidden fields cannot be set: ${forbidden.join(", ")}`,
        });
        return;
      }

      const { name, description } = req.body;

      const workspace = await prisma.workspace.update({
        where: { id: req.workspaceId! },
        data: { name, description },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      res.json({ success: true, workspace });

      logActivity({
        action: ActivityAction.WORKSPACE_UPDATED,
        entityType: "workspace",
        entityId: workspace.id,
        userId: req.userId!,
        workspaceId: workspace.id,
        metadata: { name, description },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ─── DELETE /workspaces/:workspaceId — delete (owner only) ──────────────────

router.delete(
  "/workspaces/:workspaceId",
  requireRole("owner"),
  async (req, res, next) => {
    try {
      const workspace = await prisma.workspace.findUnique({
        where: { id: req.workspaceId! },
        select: { id: true, name: true, slug: true },
      });

      await logActivity({
        action: ActivityAction.WORKSPACE_DELETED,
        entityType: "workspace",
        entityId: req.workspaceId!,
        userId: req.userId!,
        workspaceId: req.workspaceId!,
        metadata: workspace
          ? { name: workspace.name, slug: workspace.slug }
          : undefined,
      });

      await prisma.workspace.delete({
        where: { id: req.workspaceId! },
      });

      res.json({ success: true, message: "Workspace deleted." });
    } catch (error) {
      next(error);
    }
  },
);

// ─── DELETE /workspaces/:workspaceId/members/:memberId — remove member ──────

router.delete(
  "/workspaces/:workspaceId/members/:memberId",
  requireRole("admin", "owner"),
  async (req, res, next) => {
    try {
      const { memberId } = req.params as { memberId: string };

      const target = await prisma.workspaceMember.findUnique({
        where: { id: memberId },
        select: { id: true, role: true, userId: true, workspaceId: true },
      });

      if (!target || target.workspaceId !== req.workspaceId!) {
        res.status(404).json({
          success: false,
          error: "Member not found in this workspace.",
        });
        return;
      }

      // Owner cannot be removed
      if (target.role === "owner") {
        res.status(403).json({
          success: false,
          error: "The workspace owner cannot be removed.",
        });
        return;
      }

      // Non-owner admins cannot remove other admins
      if (
        target.role === "admin" &&
        req.membershipRole !== "owner"
      ) {
        res.status(403).json({
          success: false,
          error: "Only the owner can remove admin members.",
        });
        return;
      }

      await prisma.workspaceMember.delete({
        where: { id: memberId },
      });

      logActivity({
        action: ActivityAction.MEMBER_REMOVED,
        entityType: "member",
        entityId: memberId,
        userId: req.userId!,
        workspaceId: req.workspaceId!,
        metadata: { removedUserId: target.userId, role: target.role },
      });

      res.json({ success: true, message: "Member removed." });
    } catch (error) {
      next(error);
    }
  },
);

// ─── PATCH /workspaces/:workspaceId/members/:memberId/role — change role ────

router.patch(
  "/workspaces/:workspaceId/members/:memberId/role",
  requireRole("owner"),
  async (req, res, next) => {
    try {
      const { memberId } = req.params as { memberId: string };
      const { role } = req.body as { role?: string };

      if (!role || !["admin", "member"].includes(role)) {
        res.status(400).json({
          success: false,
          error: "Role must be 'admin' or 'member'.",
        });
        return;
      }

      const target = await prisma.workspaceMember.findUnique({
        where: { id: memberId },
        select: { id: true, role: true, workspaceId: true },
      });

      if (!target || target.workspaceId !== req.workspaceId!) {
        res.status(404).json({
          success: false,
          error: "Member not found in this workspace.",
        });
        return;
      }

      if (target.role === "owner") {
        res.status(403).json({
          success: false,
          error: "Cannot change the owner's role.",
        });
        return;
      }

      const updated = await prisma.workspaceMember.update({
        where: { id: memberId },
        data: { role },
        select: { id: true, role: true, userId: true },
      });

      logActivity({
        action: ActivityAction.MEMBER_ROLE_CHANGED,
        entityType: "member",
        entityId: memberId,
        userId: req.userId!,
        workspaceId: req.workspaceId!,
        metadata: { targetUserId: updated.userId, oldRole: target.role, newRole: role },
      });

      res.json({ success: true, member: updated });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
