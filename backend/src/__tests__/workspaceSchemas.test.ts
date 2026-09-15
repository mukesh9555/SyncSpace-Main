import { describe, it, expect } from "vitest";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  inviteMemberSchema,
  hasWorkspaceForbiddenFields,
} from "../lib/workspaceSchemas.js";

describe("createWorkspaceSchema", () => {
  it("accepts valid workspace data", () => {
    const result = createWorkspaceSchema.safeParse({
      name: "My Workspace",
      slug: "my-workspace",
    });
    expect(result.success).toBe(true);
  });

  it("accepts with description", () => {
    const result = createWorkspaceSchema.safeParse({
      name: "My Workspace",
      slug: "my-workspace",
      description: "A test workspace",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createWorkspaceSchema.safeParse({
      name: "",
      slug: "my-workspace",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name too short", () => {
    const result = createWorkspaceSchema.safeParse({
      name: "A",
      slug: "my-workspace",
    });
    expect(result.success).toBe(false);
  });

  it("rejects slug with uppercase", () => {
    const result = createWorkspaceSchema.safeParse({
      name: "My Workspace",
      slug: "My-Workspace",
    });
    expect(result.success).toBe(false);
  });

  it("rejects slug with special characters", () => {
    const result = createWorkspaceSchema.safeParse({
      name: "My Workspace",
      slug: "my workspace!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects slug starting with hyphen", () => {
    const result = createWorkspaceSchema.safeParse({
      name: "My Workspace",
      slug: "-my-workspace",
    });
    expect(result.success).toBe(false);
  });

  it("accepts slug with numbers", () => {
    const result = createWorkspaceSchema.safeParse({
      name: "My Workspace",
      slug: "workspace-123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects description too long", () => {
    const result = createWorkspaceSchema.safeParse({
      name: "My Workspace",
      slug: "my-workspace",
      description: "A".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

describe("updateWorkspaceSchema", () => {
  it("accepts valid name update", () => {
    const result = updateWorkspaceSchema.safeParse({ name: "New Name" });
    expect(result.success).toBe(true);
  });

  it("accepts valid description update", () => {
    const result = updateWorkspaceSchema.safeParse({
      description: "New description",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null description", () => {
    const result = updateWorkspaceSchema.safeParse({ description: null });
    expect(result.success).toBe(true);
  });

  it("accepts both fields", () => {
    const result = updateWorkspaceSchema.safeParse({
      name: "New Name",
      description: "New desc",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty body", () => {
    const result = updateWorkspaceSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects name too short", () => {
    const result = updateWorkspaceSchema.safeParse({ name: "X" });
    expect(result.success).toBe(false);
  });
});

describe("inviteMemberSchema", () => {
  it("accepts valid invite", () => {
    const result = inviteMemberSchema.safeParse({
      email: "user@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("accepts with role", () => {
    const result = inviteMemberSchema.safeParse({
      email: "user@example.com",
      role: "admin",
    });
    expect(result.success).toBe(true);
  });

  it("defaults role to member", () => {
    const result = inviteMemberSchema.safeParse({
      email: "user@example.com",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("member");
    }
  });

  it("rejects invalid email", () => {
    const result = inviteMemberSchema.safeParse({
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid role", () => {
    const result = inviteMemberSchema.safeParse({
      email: "user@example.com",
      role: "owner",
    });
    expect(result.success).toBe(false);
  });

  it("rejects owner role", () => {
    const result = inviteMemberSchema.safeParse({
      email: "user@example.com",
      role: "owner",
    });
    expect(result.success).toBe(false);
  });
});

describe("hasWorkspaceForbiddenFields", () => {
  it("detects id field", () => {
    expect(hasWorkspaceForbiddenFields({ id: "some-uuid" })).toContain("id");
  });

  it("detects createdAt field", () => {
    expect(hasWorkspaceForbiddenFields({ createdAt: new Date() })).toContain(
      "createdAt",
    );
  });

  it("detects updatedAt field", () => {
    expect(hasWorkspaceForbiddenFields({ updatedAt: new Date() })).toContain(
      "updatedAt",
    );
  });

  it("returns empty for allowed fields", () => {
    expect(
      hasWorkspaceForbiddenFields({
        name: "Test",
        description: "Desc",
      }),
    ).toEqual([]);
  });

  it("returns empty for empty object", () => {
    expect(hasWorkspaceForbiddenFields({})).toEqual([]);
  });

  it("detects multiple forbidden fields", () => {
    const result = hasWorkspaceForbiddenFields({
      id: "x",
      createdAt: "2020",
      updatedAt: "2021",
    });
    expect(result).toContain("id");
    expect(result).toContain("createdAt");
    expect(result).toContain("updatedAt");
  });
});
