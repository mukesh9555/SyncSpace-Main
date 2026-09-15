import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  logActivity,
  sanitizeMetadata,
  ActivityAction,
} from "../lib/activityLog.js";

// Mock prisma to avoid real DB calls
vi.mock("../db/index.js", () => ({
  prisma: {
    activityLog: {
      create: vi.fn().mockResolvedValue({ id: "log-id-1" }),
    },
  },
}));

// Import after mock is set up
const { prisma } = await import("../db/index.js");

describe("Activity log constants", () => {
  it("defines all expected actions", () => {
    expect(ActivityAction.WORKSPACE_CREATED).toBe("workspace.created");
    expect(ActivityAction.WORKSPACE_UPDATED).toBe("workspace.updated");
    expect(ActivityAction.WORKSPACE_DELETED).toBe("workspace.deleted");
    expect(ActivityAction.MEMBER_INVITED).toBe("member.invited");
    expect(ActivityAction.MEMBER_JOINED).toBe("member.joined");
    expect(ActivityAction.MEMBER_REMOVED).toBe("member.removed");
    expect(ActivityAction.MEMBER_ROLE_CHANGED).toBe("member.role_changed");
    expect(ActivityAction.INVITE_REVOKED).toBe("invite.revoked");
    expect(ActivityAction.NOTE_CREATED).toBe("note.created");
    expect(ActivityAction.NOTE_UPDATED).toBe("note.updated");
    expect(ActivityAction.NOTE_DELETED).toBe("note.deleted");
    expect(ActivityAction.CODEFILE_CREATED).toBe("codefile.created");
    expect(ActivityAction.CODEFILE_UPDATED).toBe("codefile.updated");
    expect(ActivityAction.CODEFILE_DELETED).toBe("codefile.deleted");
    expect(ActivityAction.WHITEBOARD_CREATED).toBe("whiteboard.created");
    expect(ActivityAction.WHITEBOARD_UPDATED).toBe("whiteboard.updated");
    expect(ActivityAction.WHITEBOARD_DELETED).toBe("whiteboard.deleted");
  });

  it("has 17 total actions", () => {
    expect(Object.keys(ActivityAction)).toHaveLength(17);
  });
});

describe("sanitizeMetadata", () => {
  it("passes through safe fields unchanged", () => {
    const input = { title: "Hello", name: "Test", count: 42 };
    expect(sanitizeMetadata(input)).toEqual(input);
  });

  it("removes sensitive fields", () => {
    const input = {
      title: "Hello",
      password: "secret123",
      token: "abc",
      secret: "xyz",
      authorization: "Bearer xxx",
      apiKey: "key123",
      accessToken: "at123",
      refreshToken: "rt123",
      cookie: "ss_token=xxx",
      jwt: "xxx.yyy.zzz",
    };
    const result = sanitizeMetadata(input);
    expect(result).toEqual({ title: "Hello" });
    expect(result).not.toHaveProperty("password");
    expect(result).not.toHaveProperty("token");
    expect(result).not.toHaveProperty("secret");
    expect(result).not.toHaveProperty("authorization");
    expect(result).not.toHaveProperty("apiKey");
    expect(result).not.toHaveProperty("accessToken");
    expect(result).not.toHaveProperty("refreshToken");
    expect(result).not.toHaveProperty("cookie");
    expect(result).not.toHaveProperty("jwt");
  });

  it("truncates long string values", () => {
    const longString = "a".repeat(600);
    const result = sanitizeMetadata({ content: longString });
    expect(result.content).toHaveLength(501); // 500 + "…"
    expect((result.content as string).endsWith("…")).toBe(true);
  });

  it("does not truncate strings under 500 chars", () => {
    const normalString = "a".repeat(500);
    const result = sanitizeMetadata({ content: normalString });
    expect(result.content).toBe(normalString);
  });

  it("handles empty object", () => {
    expect(sanitizeMetadata({})).toEqual({});
  });

  it("preserves non-string sensitive-looking but safe fields", () => {
    const input = { count: 0, enabled: true, tags: ["a", "b"] };
    expect(sanitizeMetadata(input)).toEqual(input);
  });
});

describe("logActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.activityLog.create as any).mockResolvedValue({ id: "log-id-1" });
  });

  it("creates activity log with correct data", async () => {
    logActivity({
      action: ActivityAction.NOTE_CREATED,
      entityType: "note",
      entityId: "note-123",
      userId: "user-1",
      workspaceId: "ws-1",
      metadata: { title: "My Note" },
    });

    // Allow fire-and-forget to complete
    await new Promise((r) => setTimeout(r, 10));

    expect(prisma.activityLog.create).toHaveBeenCalledWith({
      data: {
        action: "note.created",
        entityType: "note",
        entityId: "note-123",
        userId: "user-1",
        workspaceId: "ws-1",
        metadata: { title: "My Note" },
      },
      select: { id: true },
    });
  });

  it("omits metadata when not provided", async () => {
    logActivity({
      action: ActivityAction.WORKSPACE_DELETED,
      entityType: "workspace",
      entityId: "ws-1",
      userId: "user-1",
      workspaceId: "ws-1",
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(prisma.activityLog.create).toHaveBeenCalledWith({
      data: {
        action: "workspace.deleted",
        entityType: "workspace",
        entityId: "ws-1",
        userId: "user-1",
        workspaceId: "ws-1",
      },
      select: { id: true },
    });
  });

  it("sanitizes metadata before writing", async () => {
    logActivity({
      action: ActivityAction.MEMBER_INVITED,
      entityType: "invite",
      entityId: "inv-1",
      userId: "user-1",
      workspaceId: "ws-1",
      metadata: { email: "test@example.com", token: "secret-token" },
    });

    await new Promise((r) => setTimeout(r, 10));

    const call = (prisma.activityLog.create as any).mock.calls[0][0];
    expect(call.data.metadata).toEqual({ email: "test@example.com" });
    expect(call.data.metadata).not.toHaveProperty("token");
  });

  it("does not throw on DB failure (fire-and-forget)", async () => {
    (prisma.activityLog.create as any).mockRejectedValue(new Error("DB down"));

    // Should not throw
    expect(() => {
      logActivity({
        action: ActivityAction.NOTE_CREATED,
        entityType: "note",
        userId: "user-1",
        workspaceId: "ws-1",
      });
    }).not.toThrow();

    await new Promise((r) => setTimeout(r, 10));
  });

  it("handles entityId being undefined", async () => {
    logActivity({
      action: ActivityAction.WORKSPACE_CREATED,
      entityType: "workspace",
      userId: "user-1",
      workspaceId: "ws-new",
    });

    await new Promise((r) => setTimeout(r, 10));

    const call = (prisma.activityLog.create as any).mock.calls[0][0];
    expect(call.data.entityId).toBeNull();
  });

  it("accepts optional workspaceId (orphaned log after workspace delete)", async () => {
    logActivity({
      action: ActivityAction.WORKSPACE_DELETED,
      entityType: "workspace",
      entityId: "ws-deleted",
      userId: "user-1",
    });

    await new Promise((r) => setTimeout(r, 10));

    const call = (prisma.activityLog.create as any).mock.calls[0][0];
    expect(call.data.workspaceId).toBeUndefined();
  });

  it("logs invite.revoked with email and role in metadata", async () => {
    logActivity({
      action: ActivityAction.INVITE_REVOKED,
      entityType: "invite",
      entityId: "inv-1",
      userId: "user-1",
      workspaceId: "ws-1",
      metadata: { email: "test@example.com", role: "member" },
    });

    await new Promise((r) => setTimeout(r, 10));

    const call = (prisma.activityLog.create as any).mock.calls[0][0];
    expect(call.data.action).toBe("invite.revoked");
    expect(call.data.metadata).toEqual({ email: "test@example.com", role: "member" });
  });
});

describe("Activity action naming convention", () => {
  it("all actions follow entity.verb pattern", () => {
    for (const action of Object.values(ActivityAction)) {
      expect(action).toMatch(/^[a-z]+\.[a-z_]+$/);
    }
  });

  it("entity types match action prefixes", () => {
    const entityMap: Record<string, string> = {
      "workspace.created": "workspace",
      "workspace.updated": "workspace",
      "workspace.deleted": "workspace",
      "member.invited": "member",
      "member.joined": "member",
      "member.removed": "member",
      "member.role_changed": "member",
      "invite.revoked": "invite",
      "note.created": "note",
      "note.updated": "note",
      "note.deleted": "note",
      "codefile.created": "codefile",
      "codefile.updated": "codefile",
      "codefile.deleted": "codefile",
      "whiteboard.created": "whiteboard",
      "whiteboard.updated": "whiteboard",
      "whiteboard.deleted": "whiteboard",
    };

    for (const [action, expectedType] of Object.entries(entityMap)) {
      const [entityType] = action.split(".");
      expect(entityType).toBe(expectedType);
    }
  });
});
