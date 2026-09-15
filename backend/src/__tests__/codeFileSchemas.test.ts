import { describe, it, expect } from "vitest";
import {
  createCodeFileSchema,
  updateCodeFileSchema,
  hasCodeFileForbiddenFields,
  CODEFILE_FORBIDDEN_FIELDS,
  SUPPORTED_LANGUAGE_LIST,
} from "../lib/codeFileSchemas.js";

describe("createCodeFileSchema", () => {
  it("rejects empty body (name and path required)", () => {
    const result = createCodeFileSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const result = createCodeFileSchema.safeParse({ path: "/index.js" });
    expect(result.success).toBe(false);
  });

  it("rejects missing path", () => {
    const result = createCodeFileSchema.safeParse({ name: "index.js" });
    expect(result.success).toBe(false);
  });

  it("accepts valid file data", () => {
    const result = createCodeFileSchema.safeParse({
      name: "index.js",
      path: "/src/index.js",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.content).toBe("");
      expect(result.data.language).toBe("plaintext");
    }
  });

  it("accepts with content and language", () => {
    const result = createCodeFileSchema.safeParse({
      name: "app.py",
      path: "/app.py",
      content: "print('hello')",
      language: "python",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all supported languages", () => {
    for (const lang of SUPPORTED_LANGUAGE_LIST) {
      const result = createCodeFileSchema.safeParse({
        name: "test.txt",
        path: "/test.txt",
        language: lang,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects unsupported language", () => {
    const result = createCodeFileSchema.safeParse({
      name: "test.txt",
      path: "/test.txt",
      language: "brainfuck",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name over 255 characters", () => {
    const result = createCodeFileSchema.safeParse({
      name: "x".repeat(256),
      path: "/test",
    });
    expect(result.success).toBe(false);
  });

  it("rejects path over 500 characters", () => {
    const result = createCodeFileSchema.safeParse({
      name: "test.js",
      path: "/" + "x".repeat(500),
    });
    expect(result.success).toBe(false);
  });

  it("rejects content over 500,000 characters", () => {
    const result = createCodeFileSchema.safeParse({
      name: "test.js",
      path: "/test.js",
      content: "x".repeat(500001),
    });
    expect(result.success).toBe(false);
  });

  it("trims name and path", () => {
    const result = createCodeFileSchema.safeParse({
      name: "  index.js  ",
      path: "  /src/index.js  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("index.js");
      expect(result.data.path).toBe("/src/index.js");
    }
  });

  it("defaults language to plaintext", () => {
    const result = createCodeFileSchema.safeParse({
      name: "file",
      path: "/file",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.language).toBe("plaintext");
  });
});

describe("updateCodeFileSchema", () => {
  it("accepts name only", () => {
    const result = updateCodeFileSchema.safeParse({ name: "renamed.js" });
    expect(result.success).toBe(true);
  });

  it("accepts path only", () => {
    const result = updateCodeFileSchema.safeParse({ path: "/new/path.js" });
    expect(result.success).toBe(true);
  });

  it("accepts content only", () => {
    const result = updateCodeFileSchema.safeParse({ content: "new code" });
    expect(result.success).toBe(true);
  });

  it("accepts language only", () => {
    const result = updateCodeFileSchema.safeParse({ language: "python" });
    expect(result.success).toBe(true);
  });

  it("accepts all fields", () => {
    const result = updateCodeFileSchema.safeParse({
      name: "app.py",
      path: "/src/app.py",
      content: "print('hello')",
      language: "python",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty object", () => {
    const result = updateCodeFileSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects name over 255 characters", () => {
    const result = updateCodeFileSchema.safeParse({ name: "x".repeat(256) });
    expect(result.success).toBe(false);
  });

  it("rejects path over 500 characters", () => {
    const result = updateCodeFileSchema.safeParse({ path: "/" + "x".repeat(500) });
    expect(result.success).toBe(false);
  });

  it("rejects content over 500,000 characters", () => {
    const result = updateCodeFileSchema.safeParse({
      content: "x".repeat(500001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects unsupported language", () => {
    const result = updateCodeFileSchema.safeParse({ language: "brainfuck" });
    expect(result.success).toBe(false);
  });
});

describe("hasCodeFileForbiddenFields", () => {
  it("returns empty array when no forbidden fields present", () => {
    expect(hasCodeFileForbiddenFields({ name: "test" })).toEqual([]);
  });

  it("detects id field", () => {
    expect(hasCodeFileForbiddenFields({ id: "x" })).toContain("id");
  });

  it("detects authorId field", () => {
    expect(hasCodeFileForbiddenFields({ authorId: "x" })).toContain("authorId");
  });

  it("detects workspaceId field", () => {
    expect(hasCodeFileForbiddenFields({ workspaceId: "x" })).toContain("workspaceId");
  });

  it("detects createdAt field", () => {
    expect(hasCodeFileForbiddenFields({ createdAt: new Date() })).toContain("createdAt");
  });

  it("detects updatedAt field", () => {
    expect(hasCodeFileForbiddenFields({ updatedAt: new Date() })).toContain("updatedAt");
  });

  it("detects multiple forbidden fields", () => {
    const result = hasCodeFileForbiddenFields({
      id: "x", authorId: "y", workspaceId: "z",
    });
    expect(result).toHaveLength(3);
  });

  it("ignores undefined values", () => {
    expect(hasCodeFileForbiddenFields({ id: undefined })).toEqual([]);
  });

  it("returns all forbidden fields from CODEFILE_FORBIDDEN_FIELDS", () => {
    expect(CODEFILE_FORBIDDEN_FIELDS).toContain("id");
    expect(CODEFILE_FORBIDDEN_FIELDS).toContain("authorId");
    expect(CODEFILE_FORBIDDEN_FIELDS).toContain("workspaceId");
    expect(CODEFILE_FORBIDDEN_FIELDS).toContain("createdAt");
    expect(CODEFILE_FORBIDDEN_FIELDS).toContain("updatedAt");
  });
});
