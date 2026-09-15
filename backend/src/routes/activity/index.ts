import { Router } from "express";
import { prisma } from "../../db/index.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireWorkspaceMember } from "../../middleware/workspace.js";
import { validate } from "../../middleware/validate.js";
import { activityQuerySchema } from "../../lib/activityLogSchemas.js";

const router = Router();

// All activity routes require authentication
router.use(requireAuth);

// ─── GET /workspaces/:workspaceId/activity — paginated activity feed ────────

router.get(
  "/workspaces/:workspaceId/activity",
  requireWorkspaceMember,
  validate(activityQuerySchema, "query"),
  async (req, res, next) => {
    try {
      const { page, limit, action, entityType, userId } = req.query as unknown as {
        page: number;
        limit: number;
        action?: string;
        entityType?: string;
        userId?: string;
      };

      const where: Record<string, unknown> = {
        workspaceId: req.workspaceId!,
      };

      if (action) where.action = action;
      if (entityType) where.entityType = entityType;
      if (userId) where.userId = userId;

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
