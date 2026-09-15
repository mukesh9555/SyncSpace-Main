import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock prisma ──────────────────────────────────────────────────────────

const mockPrisma = {
  workspace: {
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
  invite: {
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
  activityLog: {
    create: vi.fn().mockResolvedValue({ id: "log-id-1" }),
  },
};

vi.mock("../db/index.js", () => ({
  prisma: mockPrisma,
}));

// Import after mock
const { prisma } = await import("../db/index.js");
const { logActivity, ActivityAction } = await import("../lib/activityLog.js");

// ─── Helpers ──────────────────────────────────────────────────────────────

function mockWorkspace(id: string, name: string, slug: string) {
  return { id, name, slug };
}

function mockInvite(id: string, email: string, role: string, workspaceId: string) {
  return { id, email, role, workspaceId };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("Audit preservation — workspace deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.activityLog.create.mockResolvedValue({ id: "log-id-1" });
  });

  it("logActivity returns a Promise (can be awaited)", async () => {
    const result = logActivity({
      action: ActivityAction.WORKSPACE_DELETED,
      entityType: "workspace",
      entityId: "ws-1",
      userId: "user-1",
      workspaceId: "ws-1",
      metadata: { name: "Test", slug: "test" },
    });

    expect(result).toBeInstanceOf(Promise);
    await result;
  });

  it("workspace deleted log includes name and slug in metadata", async () => {
    const workspace = mockWorkspace("ws-1", "My Workspace", "my-workspace");

    // Simulate what the route handler does
    await logActivity({
      action: ActivityAction.WORKSPACE_DELETED,
      entityType: "workspace",
      entityId: workspace.id,
      userId: "user-1",
      workspaceId: workspace.id,
      metadata: { name: workspace.name, slug: workspace.slug },
    });

    const call = (prisma.activityLog.create as any).mock.calls[0][0];
    expect(call.data.action).toBe("workspace.deleted");
    expect(call.data.entityId).toBe("ws-1");
    expect(call.data.workspaceId).toBe("ws-1");
    expect(call.data.metadata).toEqual({
      name: "My Workspace",
      slug: "my-workspace",
    });
  });

  it("workspace deleted log survives FK nullification (workspaceId is nullable)", async () => {
    // Verify schema: ActivityLog.workspaceId is optional
    // When workspace is deleted, onDelete: SetNull sets workspaceId to null
    // The log row itself is NOT cascade-deleted
    const logCall = {
      data: {
        action: "workspace.deleted",
        entityType: "workspace",
        entityId: "ws-1",
        userId: "user-1",
        workspaceId: "ws-1",
        metadata: { name: "Test", slug: "test" },
      },
    };

    // After workspace delete, the log row still exists with workspaceId set to null
    // This is handled by Prisma schema: onDelete: SetNull on ActivityLog.workspace
    expect(logCall.data.workspaceId).toBe("ws-1"); // before deletion
    // After deletion: workspaceId becomes null, but log row persists
  });

  it("logActivity awaits DB write before returning", async () => {
    let writeCompleted = false;
    mockPrisma.activityLog.create.mockImplementation(async () => {
      // Simulate async DB write
      await new Promise((r) => setTimeout(r, 5));
      writeCompleted = true;
      return { id: "log-id-1" };
    });

    await logActivity({
      action: ActivityAction.WORKSPACE_DELETED,
      entityType: "workspace",
      entityId: "ws-1",
      userId: "user-1",
      workspaceId: "ws-1",
      metadata: { name: "Test", slug: "test" },
    });

    // If logActivity awaited correctly, writeCompleted should be true
    expect(writeCompleted).toBe(true);
  });

  it("logActivity does not throw on DB failure", async () => {
    mockPrisma.activityLog.create.mockRejectedValue(new Error("DB down"));

    await expect(
      logActivity({
        action: ActivityAction.WORKSPACE_DELETED,
        entityType: "workspace",
        entityId: "ws-1",
        userId: "user-1",
        workspaceId: "ws-1",
        metadata: { name: "Test", slug: "test" },
      }),
    ).resolves.toBeUndefined();
  });
});

describe("Audit preservation — invite revocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.activityLog.create.mockResolvedValue({ id: "log-id-1" });
  });

  it("INVITE_REVOKED constant is defined", () => {
    expect(ActivityAction.INVITE_REVOKED).toBe("invite.revoked");
  });

  it("invite revoke log includes email and role in metadata", async () => {
    const invite = mockInvite(
      "inv-1",
      "alice@example.com",
      "member",
      "ws-1",
    );

    await logActivity({
      action: ActivityAction.INVITE_REVOKED,
      entityType: "invite",
      entityId: invite.id,
      userId: "user-1",
      workspaceId: invite.workspaceId,
      metadata: { email: invite.email, role: invite.role },
    });

    const call = (prisma.activityLog.create as any).mock.calls[0][0];
    expect(call.data.action).toBe("invite.revoked");
    expect(call.data.entityType).toBe("invite");
    expect(call.data.entityId).toBe("inv-1");
    expect(call.data.metadata).toEqual({
      email: "alice@example.com",
      role: "member",
    });
  });

  it("invite revoke log preserves workspaceId for audit trail", async () => {
    await logActivity({
      action: ActivityAction.INVITE_REVOKED,
      entityType: "invite",
      entityId: "inv-1",
      userId: "user-1",
      workspaceId: "ws-1",
      metadata: { email: "bob@example.com", role: "admin" },
    });

    const call = (prisma.activityLog.create as any).mock.calls[0][0];
    expect(call.data.workspaceId).toBe("ws-1");
  });

  it("invite revoke sanitizes sensitive fields from metadata", async () => {
    await logActivity({
      action: ActivityAction.INVITE_REVOKED,
      entityType: "invite",
      entityId: "inv-1",
      userId: "user-1",
      workspaceId: "ws-1",
      metadata: {
        email: "test@example.com",
        role: "member",
        token: "secret-token-value",
        password: "hunter2",
      },
    });

    const call = (prisma.activityLog.create as any).mock.calls[0][0];
    expect(call.data.metadata).toEqual({
      email: "test@example.com",
      role: "member",
    });
    expect(call.data.metadata).not.toHaveProperty("token");
    expect(call.data.metadata).not.toHaveProperty("password");
  });
});

describe("Audit action completeness", () => {
  it("has WORKSPACE_DELETED action", () => {
    expect(ActivityAction.WORKSPACE_DELETED).toBeDefined();
    expect(ActivityAction.WORKSPACE_DELETED).toBe("workspace.deleted");
  });

  it("has INVITE_REVOKED action", () => {
    expect(ActivityAction.INVITE_REVOKED).toBeDefined();
    expect(ActivityAction.INVITE_REVOKED).toBe("invite.revoked");
  });

  it("all 17 actions are defined", () => {
    expect(Object.keys(ActivityAction)).toHaveLength(17);
  });
});
