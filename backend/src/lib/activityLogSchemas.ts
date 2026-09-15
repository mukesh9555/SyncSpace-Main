import { z } from "zod";

// ─── GET /workspaces/:workspaceId/activity query params ─────────────────────

export const activityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  action: z.string().max(50).optional(),
  entityType: z.string().max(50).optional(),
  userId: z.string().uuid().optional(),
});

export type ActivityQueryInput = z.infer<typeof activityQuerySchema>;
