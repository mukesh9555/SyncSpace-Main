import { Router } from "express";
import crypto from "node:crypto";
import { prisma } from "../../db/index.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { requireRole } from "../../middleware/workspace.js";
import {
  inviteMemberSchema,
  acceptInviteSchema,
} from "../../lib/workspaceSchemas.js";
import { logActivity, ActivityAction } from "../../lib/activityLog.js";

const router = Router();

// All invite routes require authentication
router.use(requireAuth);

// ─── POST /workspaces/:workspaceId/invites — create invite (admin+) ────────

router.post(
  "/workspaces/:workspaceId/invites",
  requireRole("admin", "owner"),
  validate(inviteMemberSchema),
  async (req, res, next) => {
    try {
      const { email, role } = req.body;

      // Check if user is already a member
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        const existingMember = await prisma.workspaceMember.findUnique({
          where: {
            userId_workspaceId: {
              userId: existingUser.id,
              workspaceId: req.workspaceId!,
            },
          },
        });
        if (existingMember) {
          res.status(409).json({
            success: false,
            error: "This user is already a member of the workspace.",
          });
          return;
        }
      }

      // Check for existing pending invite
      const existingInvite = await prisma.invite.findFirst({
        where: {
          email,
          workspaceId: req.workspaceId!,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
      if (existingInvite) {
        res.status(409).json({
          success: false,
          error: "A pending invite already exists for this email.",
        });
        return;
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

      const invite = await prisma.invite.create({
        data: {
          email,
          role,
          token,
          workspaceId: req.workspaceId!,
          invitedById: req.userId!,
          expiresAt,
        },
        include: {
          workspace: { select: { name: true, slug: true } },
        },
      });

      res.status(201).json({ success: true, invite });

      logActivity({
        action: ActivityAction.MEMBER_INVITED,
        entityType: "invite",
        entityId: invite.id,
        userId: req.userId!,
        workspaceId: req.workspaceId!,
        metadata: { email, role },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /workspaces/:workspaceId/invites — list pending invites ────────────

router.get(
  "/workspaces/:workspaceId/invites",
  requireRole("admin", "owner"),
  async (req, res, next) => {
    try {
      const invites = await prisma.invite.findMany({
        where: {
          workspaceId: req.workspaceId!,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: {
          invitedBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      res.json({ success: true, invites });
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /invites/accept — accept invite by token ─────────────────────────

router.post(
  "/invites/accept",
  validate(acceptInviteSchema),
  async (req, res, next) => {
    try {
      const { token } = req.body;

      const invite = await prisma.invite.findUnique({
        where: { token },
        include: {
          workspace: { select: { id: true, name: true, slug: true } },
        },
      });

      if (!invite) {
        res.status(404).json({
          success: false,
          error: "Invalid invite token.",
        });
        return;
      }

      if (invite.acceptedAt) {
        res.status(410).json({
          success: false,
          error: "This invite has already been accepted.",
        });
        return;
      }

      if (invite.expiresAt < new Date()) {
        res.status(410).json({
          success: false,
          error: "This invite has expired.",
        });
        return;
      }

      // Security: invite email must match the authenticated user's email
      if (invite.email !== req.userEmail) {
        res.status(403).json({
          success: false,
          error: "This invite was sent to a different email address.",
        });
        return;
      }

      // Check if already a member
      const existingMember = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: req.userId!,
            workspaceId: invite.workspaceId,
          },
        },
      });
      if (existingMember) {
        res.status(409).json({
          success: false,
          error: "You are already a member of this workspace.",
        });
        return;
      }

      // Create membership + mark invite accepted in a transaction
      const [membership] = await prisma.$transaction([
        prisma.workspaceMember.create({
          data: {
            userId: req.userId!,
            workspaceId: invite.workspaceId,
            role: invite.role,
          },
          select: { id: true, role: true },
        }),
        prisma.invite.update({
          where: { id: invite.id },
          data: { acceptedAt: new Date() },
        }),
      ]);

      logActivity({
        action: ActivityAction.MEMBER_JOINED,
        entityType: "member",
        entityId: membership.id,
        userId: req.userId!,
        workspaceId: invite.workspaceId,
        metadata: { role: invite.role },
      });

      res.json({
        success: true,
        message: `You have joined "${invite.workspace.name}".`,
        workspace: invite.workspace,
        membership,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ─── DELETE /workspaces/:workspaceId/invites/:inviteId — revoke invite ──────

router.delete(
  "/workspaces/:workspaceId/invites/:inviteId",
  requireRole("admin", "owner"),
  async (req, res, next) => {
    try {
      const { inviteId } = req.params as { inviteId: string };

      const invite = await prisma.invite.findUnique({
        where: { id: inviteId },
        select: { id: true, workspaceId: true, email: true, role: true },
      });

      if (!invite || invite.workspaceId !== req.workspaceId!) {
        res.status(404).json({
          success: false,
          error: "Invite not found.",
        });
        return;
      }

      await prisma.invite.delete({ where: { id: inviteId } });

      logActivity({
        action: ActivityAction.INVITE_REVOKED,
        entityType: "invite",
        entityId: inviteId,
        userId: req.userId!,
        workspaceId: req.workspaceId!,
        metadata: { email: invite.email, role: invite.role },
      });

      res.json({ success: true, message: "Invite revoked." });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
