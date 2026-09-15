import { prisma } from "../db/index.js";

// ─── Action constants ──────────────────────────────────────────────────────

export const ActivityAction = {
  // Workspace
  WORKSPACE_CREATED: "workspace.created",
  WORKSPACE_UPDATED: "workspace.updated",
  WORKSPACE_DELETED: "workspace.deleted",

  // Members
  MEMBER_INVITED: "member.invited",
  MEMBER_JOINED: "member.joined",
  MEMBER_REMOVED: "member.removed",
  MEMBER_ROLE_CHANGED: "member.role_changed",

  // Invites
  INVITE_REVOKED: "invite.revoked",

  // Notes
  NOTE_CREATED: "note.created",
  NOTE_UPDATED: "note.updated",
  NOTE_DELETED: "note.deleted",

  // Code files
  CODEFILE_CREATED: "codefile.created",
  CODEFILE_UPDATED: "codefile.updated",
  CODEFILE_DELETED: "codefile.deleted",

  // Whiteboards
  WHITEBOARD_CREATED: "whiteboard.created",
  WHITEBOARD_UPDATED: "whiteboard.updated",
  WHITEBOARD_DELETED: "whiteboard.deleted",
} as const;

export type ActivityActionValue =
  (typeof ActivityAction)[keyof typeof ActivityAction];

// ─── Sanitized metadata helpers ────────────────────────────────────────────

/** Fields that must never appear in activity metadata. */
const SENSITIVE_FIELDS = new Set([
  "password",
  "passwordHash",
  "token",
  "secret",
  "jwt",
  "authorization",
  "cookie",
  "apiKey",
  "accessToken",
  "refreshToken",
]);

/**
 * Return a shallow copy of `data` with sensitive keys removed and sensitive
 * string values redacted.  Only safe, human-readable context is preserved.
 */
export function sanitizeMetadata(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_FIELDS.has(key)) continue;
    if (typeof value === "string" && value.length > 500) {
      out[key] = value.slice(0, 500) + "…";
    } else {
      out[key] = value;
    }
  }
  return out;
}

// ─── Core write helper ─────────────────────────────────────────────────────

export interface LogActivityParams {
  action: ActivityActionValue;
  entityType: string;
  entityId?: string;
  userId: string;
  workspaceId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Write a single activity log entry.
 *
 * Returns a Promise that resolves when the log is persisted. Callers that
 * need durable writes (e.g. workspace deletion) MUST await this.  Errors
 * are logged but never propagated so a logging failure never blocks the
 * user-facing request.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  const metadata = params.metadata
    ? sanitizeMetadata(params.metadata)
    : undefined;

  try {
    await prisma.activityLog.create({
      data: {
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        userId: params.userId,
        workspaceId: params.workspaceId,
        ...(metadata ? { metadata: metadata as any } : {}),
      },
      select: { id: true },
    });
  } catch (err) {
    console.error("[activityLog] Failed to write activity log:", err);
  }
}
