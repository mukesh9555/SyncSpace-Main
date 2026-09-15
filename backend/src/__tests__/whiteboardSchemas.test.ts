import { describe, it, expect } from "vitest";
import {
  createWhiteboardSchema,
  updateWhiteboardSchema,
  hasWhiteboardForbiddenFields,
  WHITEBOARD_FORBIDDEN_FIELDS,
} from "../lib/whiteboardSchemas.js";

describe("createWhiteboardSchema", () => {
  it("accepts empty body (all defaults)", () => {
    const result = createWhiteboardSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Untitled");
      expect(result.data.content).toBe("{}");
    }
  });

  it("accepts valid whiteboard data", () => {
    const result = createWhiteboardSchema.safeParse({
      name: "My Board",
      content: '{"history":["data:image/png;..."],"index":0}',
    });
    expect(result.success).toBe(true);
  });

  it("accepts name only", () => {
    const result = createWhiteboardSchema.safeParse({ name: "Board" });
    expect(result.success).toBe(true);
  });

  it("trims whitespace from name", () => {
    const result = createWhiteboardSchema.safeParse({ name: "  padded  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("padded");
  });

  it("rejects name over 100 characters", () => {
    const result = createWhiteboardSchema.safeParse({ name: "x".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("accepts exactly 100 character name", () => {
    const result = createWhiteboardSchema.safeParse({ name: "x".repeat(100) });
    expect(result.success).toBe(true);
  });

  it("rejects content over 5MB", () => {
    const result = createWhiteboardSchema.safeParse({
      content: "x".repeat(5 * 1024 * 1024 + 1),
    });
    expect(result.success).toBe(false);
  });
});

describe("updateWhiteboardSchema", () => {
  it("accepts name only", () => {
    const result = updateWhiteboardSchema.safeParse({ name: "Updated" });
    expect(result.success).toBe(true);
  });

  it("accepts content only", () => {
    const result = updateWhiteboardSchema.safeParse({
      content: '{"history":[],"index":0}',
    });
    expect(result.success).toBe(true);
  });

  it("accepts both fields", () => {
    const result = updateWhiteboardSchema.safeParse({
      name: "Updated",
      content: '{"history":[],"index":0}',
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty object", () => {
    const result = updateWhiteboardSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects name over 100 characters", () => {
    const result = updateWhiteboardSchema.safeParse({ name: "x".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("rejects content over 5MB", () => {
    const result = updateWhiteboardSchema.safeParse({
      content: "x".repeat(5 * 1024 * 1024 + 1),
    });
    expect(result.success).toBe(false);
  });
});

describe("hasWhiteboardForbiddenFields", () => {
  it("returns empty array when no forbidden fields present", () => {
    expect(hasWhiteboardForbiddenFields({ name: "test" })).toEqual([]);
  });

  it("detects id field", () => {
    expect(hasWhiteboardForbiddenFields({ id: "x" })).toContain("id");
  });

  it("detects authorId field", () => {
    expect(hasWhiteboardForbiddenFields({ authorId: "x" })).toContain("authorId");
  });

  it("detects workspaceId field", () => {
    expect(hasWhiteboardForbiddenFields({ workspaceId: "x" })).toContain("workspaceId");
  });

  it("detects createdAt field", () => {
    expect(hasWhiteboardForbiddenFields({ createdAt: new Date() })).toContain("createdAt");
  });

  it("detects updatedAt field", () => {
    expect(hasWhiteboardForbiddenFields({ updatedAt: new Date() })).toContain("updatedAt");
  });

  it("detects snapshotUrl field", () => {
    expect(hasWhiteboardForbiddenFields({ snapshotUrl: "x" })).toContain("snapshotUrl");
  });

  it("detects multiple forbidden fields", () => {
    const result = hasWhiteboardForbiddenFields({
      id: "x", authorId: "y", workspaceId: "z",
    });
    expect(result).toHaveLength(3);
  });

  it("ignores undefined values", () => {
    expect(hasWhiteboardForbiddenFields({ id: undefined })).toEqual([]);
  });

  it("returns all forbidden fields from WHITEBOARD_FORBIDDEN_FIELDS", () => {
    expect(WHITEBOARD_FORBIDDEN_FIELDS).toContain("id");
    expect(WHITEBOARD_FORBIDDEN_FIELDS).toContain("authorId");
    expect(WHITEBOARD_FORBIDDEN_FIELDS).toContain("workspaceId");
    expect(WHITEBOARD_FORBIDDEN_FIELDS).toContain("createdAt");
    expect(WHITEBOARD_FORBIDDEN_FIELDS).toContain("updatedAt");
    expect(WHITEBOARD_FORBIDDEN_FIELDS).toContain("snapshotUrl");
  });
});
