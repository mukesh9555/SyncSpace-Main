import { z } from "zod";

// Max canvas data ~5MB of base64 PNG dataURLs stored as JSON array
const MAX_CONTENT_SIZE = 5 * 1024 * 1024;

export const createWhiteboardSchema = z.object({
  name: z
    .string()
    .max(100, "Name must be at most 100 characters")
    .trim()
    .default("Untitled"),
  content: z
    .string()
    .max(MAX_CONTENT_SIZE, "Canvas content exceeds maximum size")
    .default("{}"),
});

export const updateWhiteboardSchema = z
  .object({
    name: z
      .string()
      .max(100, "Name must be at most 100 characters")
      .trim()
      .optional(),
    content: z
      .string()
      .max(MAX_CONTENT_SIZE, "Canvas content exceeds maximum size")
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

export const WHITEBOARD_FORBIDDEN_FIELDS = [
  "id",
  "authorId",
  "workspaceId",
  "createdAt",
  "updatedAt",
  "snapshotUrl",
] as const;

export function hasWhiteboardForbiddenFields(
  body: Record<string, unknown>,
): string[] {
  return WHITEBOARD_FORBIDDEN_FIELDS.filter(
    (field) => field in body && body[field] !== undefined,
  );
}

export type CreateWhiteboardInput = z.infer<typeof createWhiteboardSchema>;
export type UpdateWhiteboardInput = z.infer<typeof updateWhiteboardSchema>;
