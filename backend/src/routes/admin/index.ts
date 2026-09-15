import { Router } from "express";
import { prisma } from "../../db/index.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { requireRole } from "../../middleware/workspace.js";
import {
  adminMembersQuerySchema,
  changeMemberRoleSchema,
  adminActivityQuerySchema,
} from "../../lib/adminSchemas.js";
import { logActivity, ActivityAction } from "../../lib/activityLog.js";

const router = Router();

// All admin routes require authentication
router.use(requireAuth);

// ─── GET /workspaces/:workspaceId/admin/stats — dashboard statistics ──────

router.get(
  "/workspaces/:workspaceId/admin/stats",
  requireRole("admin", "owner"),
  async (req, res, next) => {
    try {
      const workspaceId = req.workspaceId!;

      const [memberCount, notesCount, codeFilesCount, whiteboardsCount, activityCount] =
        await Promise.all([
          prisma.workspaceMember.count({ where: { workspaceId } }),
          prisma.note.count({ where: { workspaceId } }),
          prisma.codeFile.count({ where: { workspaceId } }),
          prisma.whiteboard.count({ where: { workspaceId } }),
          prisma.activityLog.count({ where: { workspaceId } }),
        ]);

      res.json({
        success: true,
        stats: {
          members: memberCount,
          notes: notesCount,
          codeFiles: codeFilesCount,
          whiteboards: whiteboardsCount,
          activity: activityCount,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /workspaces/:workspaceId/admin/members — paginated member list ───

router.get(
  "/workspaces/:workspaceId/admin/members",
  requireRole("admin", "owner"),
  validate(adminMembersQuerySchema, "query"),
  async (req, res, next) => {
    try {
      const { page, limit, search, role } = req.query as unknown as {
        page: number;
        limit: number;
        search?: string;
        role?: string;
      };

      const workspaceId = req.workspaceId!;
      const where: Record<string, unknown> = { workspaceId };

      if (role) where.role = role;

      if (search) {
        where.user = {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        };
      }

      const skip = (page - 1) * limit;

      const [members, total] = await Promise.all([
        prisma.workspaceMember.findMany({
          where,
          select: {
            id: true,
            role: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                lastActiveAt: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
          skip,
          take: limit,
        }),
        prisma.workspaceMember.count({ where }),
      ]);

      res.json({
        success: true,
        members,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ─── PATCH /workspaces/:workspaceId/admin/members/:memberId/role ──────────
// Owner only — cannot promote to owner, cannot change own role

router.patch(
  "/workspaces/:workspaceId/admin/members/:memberId/role",
  requireRole("owner"),
  validate(changeMemberRoleSchema),
  async (req, res, next) => {
    try {
      const { memberId } = req.params as { memberId: string };
      const { role } = req.body as { role: string };
      const workspaceId = req.workspaceId!;

      // Server-side: never trust frontend — resolve target from DB
      const target = await prisma.workspaceMember.findUnique({
        where: { id: memberId },
        select: { id: true, role: true, userId: true, workspaceId: true },
      });

      if (!target || target.workspaceId !== workspaceId) {
        res.status(404).json({
          success: false,
          error: "Member not found in this workspace.",
        });
        return;
      }

      // Cannot change own role
      if (target.userId === req.userId) {
        res.status(403).json({
          success: false,
          error: "You cannot change your own role.",
        });
        return;
      }

      // Cannot change the owner's role
      if (target.role === "owner") {
        res.status(403).json({
          success: false,
          error: "Cannot change the owner's role.",
        });
        return;
      }

      // Target role must differ from current
      if (target.role === role) {
        res.status(400).json({
          success: false,
          error: `Member already has the "${role}" role.`,
        });
        return;
      }

      const updated = await prisma.workspaceMember.update({
        where: { id: memberId },
        data: { role },
        select: { id: true, role: true, userId: true },
      });

      res.json({ success: true, member: updated });

      logActivity({
        action: ActivityAction.MEMBER_ROLE_CHANGED,
        entityType: "member",
        entityId: memberId,
        userId: req.userId!,
        workspaceId,
        metadata: { targetUserId: updated.userId, oldRole: target.role, newRole: role },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ─── DELETE /workspaces/:workspaceId/admin/members/:memberId — remove ─────
// Admin+ — admins cannot remove other admins or owner

router.delete(
  "/workspaces/:workspaceId/admin/members/:memberId",
  requireRole("admin", "owner"),
  async (req, res, next) => {
    try {
      const { memberId } = req.params as { memberId: string };
      const workspaceId = req.workspaceId!;

      // Server-side: never trust frontend — resolve target from DB
      const target = await prisma.workspaceMember.findUnique({
        where: { id: memberId },
        select: { id: true, role: true, userId: true, workspaceId: true },
      });

      if (!target || target.workspaceId !== workspaceId) {
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
      if (target.role === "admin" && req.membershipRole !== "owner") {
        res.status(403).json({
          success: false,
          error: "Only the owner can remove admin members.",
        });
        return;
      }

      await prisma.workspaceMember.delete({ where: { id: memberId } });

      res.json({ success: true, message: "Member removed." });

      logActivity({
        action: ActivityAction.MEMBER_REMOVED,
        entityType: "member",
        entityId: memberId,
        userId: req.userId!,
        workspaceId,
        metadata: { removedUserId: target.userId, role: target.role },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /workspaces/:workspaceId/admin/activity — paginated activity feed ─

router.get(
  "/workspaces/:workspaceId/admin/activity",
  requireRole("admin", "owner"),
  validate(adminActivityQuerySchema, "query"),
  async (req, res, next) => {
    try {
      const { page, limit, action, entityType } = req.query as unknown as {
        page: number;
        limit: number;
        action?: string;
        entityType?: string;
      };

      const workspaceId = req.workspaceId!;
      const where: Record<string, unknown> = { workspaceId };

      if (action) where.action = action;
      if (entityType) where.entityType = entityType;

      const skip = (page - 1) * limit;

      const [logs, total] = await Promise.all([
        prisma.activityLog.findMany({
          where,
          select: {
            id: true,
            action: true,
            entityType: true,
            entityId: true,
            metadata: true,
            createdAt: true,
            user: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.activityLog.count({ where }),
      ]);

      res.json({
        success: true,
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
