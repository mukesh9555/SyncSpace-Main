import type { Request, Response, NextFunction } from "express";
import { prisma } from "../db/index.js";

const ROLE_HIERARCHY: Record<string, number> = {
  owner: 3,
  admin: 2,
  member: 1,
};

declare global {
  namespace Express {
    interface Request {
      workspaceId?: string;
      membershipId?: string;
      membershipRole?: string;
    }
  }
}

export async function requireWorkspaceMember(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await resolveWorkspaceContext(req, res);
  if (res.writableEnded) return;
  next();
}

export function requireRole(...allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await resolveWorkspaceContext(req, res);
    if (res.writableEnded) return;

    const userRole = req.membershipRole;
    if (!userRole) {
      res.status(403).json({
        success: false,
        error: "You are not a member of this workspace.",
      });
      return;
    }

    const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
    const hasAccess = allowedRoles.some(
      (role) => userLevel >= (ROLE_HIERARCHY[role] ?? 0),
    );

    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: `This action requires one of the following roles: ${allowedRoles.join(", ")}. Your role: ${userRole}.`,
      });
      return;
    }

    next();
  };
}

async function resolveWorkspaceContext(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({
      success: false,
      error: "Authentication required.",
    });
    return;
  }

  // workspaceId can come from params (:workspaceId) or body
  const workspaceId =
    (req.params as Record<string, string>).workspaceId ??
    (req.body as Record<string, unknown>)?.workspaceId as string | undefined;

  if (!workspaceId) {
    res.status(400).json({
      success: false,
      error: "Workspace ID is required.",
    });
    return;
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId: req.userId,
        workspaceId,
      },
    },
    select: {
      id: true,
      role: true,
    },
  });

  if (!membership) {
    res.status(403).json({
      success: false,
      error: "You are not a member of this workspace.",
    });
    return;
  }

  req.workspaceId = workspaceId;
  req.membershipId = membership.id;
  req.membershipRole = membership.role;
}
