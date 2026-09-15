import { z } from "zod";

// ─── GET /workspaces/:workspaceId/admin/members query ─────────────────────

export const adminMembersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(100).trim().optional(),
  role: z.enum(["owner", "admin", "member"]).optional(),
});

export type AdminMembersQueryInput = z.infer<typeof adminMembersQuerySchema>;

// ─── PATCH /workspaces/:workspaceId/admin/members/:memberId/role ──────────

export const changeMemberRoleSchema = z.object({
  role: z.enum(["admin", "member"]),
});

export type ChangeMemberRoleInput = z.infer<typeof changeMemberRoleSchema>;

// ─── GET /workspaces/:workspaceId/admin/activity query ────────────────────

export const adminActivityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  action: z.string().max(50).optional(),
  entityType: z.string().max(50).optional(),
});

export type AdminActivityQueryInput = z.infer<typeof adminActivityQuerySchema>;
