import { z } from "zod";

const SUPPORTED_LANGUAGES = [
  "plaintext",
  "javascript",
  "typescript",
  "python",
  "java",
  "c",
  "cpp",
  "csharp",
  "go",
  "rust",
  "ruby",
  "php",
  "swift",
  "kotlin",
  "sql",
  "html",
  "css",
  "scss",
  "json",
  "yaml",
  "markdown",
  "bash",
  "shell",
] as const;

export const createCodeFileSchema = z.object({
  name: z
    .string()
    .min(1, "File name is required")
    .max(255, "File name must be at most 255 characters")
    .trim(),
  path: z
    .string()
    .min(1, "File path is required")
    .max(500, "Path must be at most 500 characters")
    .trim(),
  content: z
    .string()
    .max(500000, "Content must be at most 500,000 characters")
    .default(""),
  language: z
    .enum(SUPPORTED_LANGUAGES)
    .default("plaintext"),
});

export const updateCodeFileSchema = z
  .object({
    name: z
      .string()
      .min(1, "File name is required")
      .max(255, "File name must be at most 255 characters")
      .trim()
      .optional(),
    path: z
      .string()
      .min(1, "File path is required")
      .max(500, "Path must be at most 500 characters")
      .trim()
      .optional(),
    content: z
      .string()
      .max(500000, "Content must be at most 500,000 characters")
      .optional(),
    language: z.enum(SUPPORTED_LANGUAGES).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

export const CODEFILE_FORBIDDEN_FIELDS = [
  "id",
  "authorId",
  "workspaceId",
  "createdAt",
  "updatedAt",
] as const;

export function hasCodeFileForbiddenFields(
  body: Record<string, unknown>,
): string[] {
  return CODEFILE_FORBIDDEN_FIELDS.filter(
    (field) => field in body && body[field] !== undefined,
  );
}

export const SUPPORTED_LANGUAGE_LIST = SUPPORTED_LANGUAGES;

export type CreateCodeFileInput = z.infer<typeof createCodeFileSchema>;
export type UpdateCodeFileInput = z.infer<typeof updateCodeFileSchema>;
