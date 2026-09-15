import { z } from "zod";

export const createNoteSchema = z.object({
  title: z
    .string()
    .max(200, "Title must be at most 200 characters")
    .trim()
    .default(""),
  content: z
    .string()
    .max(100000, "Content must be at most 100,000 characters")
    .default(""),
  isPinned: z.boolean().default(false),
});

export const updateNoteSchema = z
  .object({
    title: z
      .string()
      .max(200, "Title must be at most 200 characters")
      .trim()
      .optional(),
    content: z
      .string()
      .max(100000, "Content must be at most 100,000 characters")
      .optional(),
    isPinned: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

// Fields the frontend is NEVER allowed to set
export const NOTE_FORBIDDEN_FIELDS = [
  "id",
  "authorId",
  "workspaceId",
  "createdAt",
  "updatedAt",
] as const;

export function hasNoteForbiddenFields(body: Record<string, unknown>): string[] {
  return NOTE_FORBIDDEN_FIELDS.filter(
    (field) => field in body && body[field] !== undefined,
  );
}

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
