import { z } from "zod";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters")
    .trim(),
  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters")
    .max(100, "Slug must be at most 100 characters")
    .regex(slugRegex, "Slug must be lowercase alphanumeric with hyphens")
    .toLowerCase()
    .trim(),
  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .trim()
    .optional(),
});

export const updateWorkspaceSchema = z
  .object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name must be at most 100 characters")
      .trim()
      .optional(),
    description: z
      .string()
      .max(500, "Description must be at most 500 characters")
      .trim()
      .nullable()
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

export const inviteMemberSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .toLowerCase()
    .trim(),
  role: z.enum(["admin", "member"]).default("member"),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1, "Invite token is required"),
});

// Fields the frontend is NEVER allowed to set on workspace
export const WORKSPACE_FORBIDDEN_FIELDS = [
  "id",
  "createdAt",
  "updatedAt",
] as const;

export function hasWorkspaceForbiddenFields(body: Record<string, unknown>): string[] {
  return WORKSPACE_FORBIDDEN_FIELDS.filter(
    (field) => field in body && body[field] !== undefined,
  );
}

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
