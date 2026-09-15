import { z } from "zod";

const usernameRegex = /^[a-zA-Z0-9_-]+$/;

export const updateProfileSchema = z
  .object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name must be at most 100 characters")
      .trim()
      .optional(),
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(30, "Username must be at most 30 characters")
      .regex(usernameRegex, "Username can only contain letters, numbers, underscores, and hyphens")
      .toLowerCase()
      .trim()
      .optional(),
    bio: z
      .string()
      .max(500, "Bio must be at most 500 characters")
      .trim()
      .nullable()
      .optional(),
    avatarUrl: z
      .string()
      .url("Avatar URL must be a valid URL")
      .max(500, "Avatar URL must be at most 500 characters")
      .trim()
      .nullable()
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

// Fields the frontend is NEVER allowed to set
const FORBIDDEN_FIELDS = [
  "id",
  "role",
  "passwordHash",
  "createdAt",
  "updatedAt",
  "lastActiveAt",
  "email",
] as const;

export const forbiddenFieldsSchema = z
  .object(
    Object.fromEntries(FORBIDDEN_FIELDS.map((f) => [f, z.unknown().optional()])) as Record<
      string,
      z.ZodOptional<z.ZodUnknown>
    >,
  )
  .passthrough();

export function hasForbiddenFields(body: Record<string, unknown>): string[] {
  return FORBIDDEN_FIELDS.filter((field) => field in body && body[field] !== undefined);
}

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
