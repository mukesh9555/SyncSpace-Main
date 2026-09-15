import { describe, it, expect } from "vitest";
import {
  updateProfileSchema,
  hasForbiddenFields,
} from "../lib/userSchemas.js";

describe("updateProfileSchema", () => {
  it("accepts a valid name update", () => {
    const result = updateProfileSchema.safeParse({ name: "Jane Doe" });
    expect(result.success).toBe(true);
  });

  it("accepts a valid username update", () => {
    const result = updateProfileSchema.safeParse({ username: "jane-doe" });
    expect(result.success).toBe(true);
  });

  it("accepts a valid bio update", () => {
    const result = updateProfileSchema.safeParse({ bio: "Hello world" });
    expect(result.success).toBe(true);
  });

  it("accepts null bio (clear bio)", () => {
    const result = updateProfileSchema.safeParse({ bio: null });
    expect(result.success).toBe(true);
  });

  it("accepts a valid avatarUrl update", () => {
    const result = updateProfileSchema.safeParse({
      avatarUrl: "https://example.com/avatar.png",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null avatarUrl (clear avatar)", () => {
    const result = updateProfileSchema.safeParse({ avatarUrl: null });
    expect(result.success).toBe(true);
  });

  it("accepts multiple fields at once", () => {
    const result = updateProfileSchema.safeParse({
      name: "Jane",
      username: "jane",
      bio: "Dev",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty body", () => {
    const result = updateProfileSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects name too short", () => {
    const result = updateProfileSchema.safeParse({ name: "J" });
    expect(result.success).toBe(false);
  });

  it("rejects name too long", () => {
    const result = updateProfileSchema.safeParse({ name: "A".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("rejects username too short", () => {
    const result = updateProfileSchema.safeParse({ username: "ab" });
    expect(result.success).toBe(false);
  });

  it("rejects username with special characters", () => {
    const result = updateProfileSchema.safeParse({ username: "jane doe!" });
    expect(result.success).toBe(false);
  });

  it("rejects username with spaces", () => {
    const result = updateProfileSchema.safeParse({ username: "jane doe" });
    expect(result.success).toBe(false);
  });

  it("accepts username with underscores and hyphens", () => {
    const result = updateProfileSchema.safeParse({
      username: "jane_doe-123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects bio too long", () => {
    const result = updateProfileSchema.safeParse({ bio: "A".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("rejects invalid avatarUrl", () => {
    const result = updateProfileSchema.safeParse({
      avatarUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("rejects avatarUrl too long", () => {
    const result = updateProfileSchema.safeParse({
      avatarUrl: "https://example.com/" + "a".repeat(500),
    });
    expect(result.success).toBe(false);
  });
});

describe("hasForbiddenFields", () => {
  it("detects id field", () => {
    expect(hasForbiddenFields({ id: "some-uuid" })).toContain("id");
  });

  it("detects role field", () => {
    expect(hasForbiddenFields({ role: "admin" })).toContain("role");
  });

  it("detects passwordHash field", () => {
    expect(hasForbiddenFields({ passwordHash: "hashed" })).toContain(
      "passwordHash",
    );
  });

  it("detects createdAt field", () => {
    expect(hasForbiddenFields({ createdAt: new Date() })).toContain(
      "createdAt",
    );
  });

  it("detects updatedAt field", () => {
    expect(hasForbiddenFields({ updatedAt: new Date() })).toContain(
      "updatedAt",
    );
  });

  it("detects lastActiveAt field", () => {
    expect(hasForbiddenFields({ lastActiveAt: new Date() })).toContain(
      "lastActiveAt",
    );
  });

  it("detects email field", () => {
    expect(hasForbiddenFields({ email: "hacked@evil.com" })).toContain(
      "email",
    );
  });

  it("detects multiple forbidden fields", () => {
    const result = hasForbiddenFields({
      id: "x",
      role: "admin",
      passwordHash: "y",
    });
    expect(result).toContain("id");
    expect(result).toContain("role");
    expect(result).toContain("passwordHash");
  });

  it("returns empty array for allowed fields", () => {
    expect(
      hasForbiddenFields({ name: "Jane", username: "jane", bio: "Hi" }),
    ).toEqual([]);
  });

  it("returns empty array for empty object", () => {
    expect(hasForbiddenFields({})).toEqual([]);
  });

  it("ignores undefined values", () => {
    expect(hasForbiddenFields({ id: undefined, role: undefined })).toEqual([]);
  });

  it("detects forbidden fields mixed with allowed fields", () => {
    const result = hasForbiddenFields({
      name: "Jane",
      id: "hacked",
      bio: "Hi",
      role: "admin",
    });
    expect(result).toContain("id");
    expect(result).toContain("role");
    expect(result).not.toContain("name");
    expect(result).not.toContain("bio");
  });
});
