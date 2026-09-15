import { describe, it, expect } from "vitest";
import {
  createNoteSchema,
  updateNoteSchema,
  hasNoteForbiddenFields,
  NOTE_FORBIDDEN_FIELDS,
} from "../lib/noteSchemas.js";

describe("createNoteSchema", () => {
  it("accepts empty body (all defaults)", () => {
    const result = createNoteSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("");
      expect(result.data.content).toBe("");
      expect(result.data.isPinned).toBe(false);
    }
  });

  it("accepts valid note data", () => {
    const result = createNoteSchema.safeParse({
      title: "My Note",
      content: "Hello world",
      isPinned: true,
    });
    expect(result.success).toBe(true);
  });

  it("trims whitespace from title", () => {
    const result = createNoteSchema.safeParse({ title: "  padded  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBe("padded");
  });

  it("rejects title over 200 characters", () => {
    const result = createNoteSchema.safeParse({
      title: "x".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("rejects content over 100,000 characters", () => {
    const result = createNoteSchema.safeParse({
      content: "x".repeat(100001),
    });
    expect(result.success).toBe(false);
  });

  it("accepts exactly 200 character title", () => {
    const result = createNoteSchema.safeParse({
      title: "x".repeat(200),
    });
    expect(result.success).toBe(true);
  });

  it("accepts exactly 100,000 character content", () => {
    const result = createNoteSchema.safeParse({
      content: "x".repeat(100000),
    });
    expect(result.success).toBe(true);
  });
});

describe("updateNoteSchema", () => {
  it("accepts title only", () => {
    const result = updateNoteSchema.safeParse({ title: "Updated" });
    expect(result.success).toBe(true);
  });

  it("accepts content only", () => {
    const result = updateNoteSchema.safeParse({ content: "New content" });
    expect(result.success).toBe(true);
  });

  it("accepts isPinned only", () => {
    const result = updateNoteSchema.safeParse({ isPinned: true });
    expect(result.success).toBe(true);
  });

  it("accepts all fields", () => {
    const result = updateNoteSchema.safeParse({
      title: "Updated",
      content: "New content",
      isPinned: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty object", () => {
    const result = updateNoteSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects title over 200 characters", () => {
    const result = updateNoteSchema.safeParse({ title: "x".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("rejects content over 100,000 characters", () => {
    const result = updateNoteSchema.safeParse({
      content: "x".repeat(100001),
    });
    expect(result.success).toBe(false);
  });
});

describe("hasNoteForbiddenFields", () => {
  it("returns empty array when no forbidden fields present", () => {
    const result = hasNoteForbiddenFields({ title: "test" });
    expect(result).toEqual([]);
  });

  it("detects id field", () => {
    const result = hasNoteForbiddenFields({ id: "some-uuid" });
    expect(result).toContain("id");
  });

  it("detects authorId field", () => {
    const result = hasNoteForbiddenFields({ authorId: "some-uuid" });
    expect(result).toContain("authorId");
  });

  it("detects workspaceId field", () => {
    const result = hasNoteForbiddenFields({ workspaceId: "some-uuid" });
    expect(result).toContain("workspaceId");
  });

  it("detects createdAt field", () => {
    const result = hasNoteForbiddenFields({ createdAt: new Date() });
    expect(result).toContain("createdAt");
  });

  it("detects updatedAt field", () => {
    const result = hasNoteForbiddenFields({ updatedAt: new Date() });
    expect(result).toContain("updatedAt");
  });

  it("detects multiple forbidden fields at once", () => {
    const result = hasNoteForbiddenFields({
      id: "x",
      authorId: "y",
      workspaceId: "z",
    });
    expect(result).toHaveLength(3);
  });

  it("ignores undefined values for forbidden fields", () => {
    const result = hasNoteForbiddenFields({ id: undefined });
    expect(result).toEqual([]);
  });

  it("returns all forbidden fields from NOTE_FORBIDDEN_FIELDS", () => {
    expect(NOTE_FORBIDDEN_FIELDS).toContain("id");
    expect(NOTE_FORBIDDEN_FIELDS).toContain("authorId");
    expect(NOTE_FORBIDDEN_FIELDS).toContain("workspaceId");
    expect(NOTE_FORBIDDEN_FIELDS).toContain("createdAt");
    expect(NOTE_FORBIDDEN_FIELDS).toContain("updatedAt");
  });
});
