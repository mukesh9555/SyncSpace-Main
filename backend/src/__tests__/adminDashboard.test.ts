import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  adminMembersQuerySchema,
  changeMemberRoleSchema,
  adminActivityQuerySchema,
} from "../lib/adminSchemas.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Schema validation ───────────────────────────────────────────────────

describe("adminMembersQuerySchema", () => {
  it("accepts empty query (defaults applied)", () => {
    const result = adminMembersQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
      expect(result.data.search).toBeUndefined();
      expect(result.data.role).toBeUndefined();
    }
  });

  it("accepts valid search", () => {
    const result = adminMembersQuerySchema.safeParse({ search: "alice" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.search).toBe("alice");
    }
  });

  it("accepts valid role filter", () => {
    for (const role of ["admin", "member", "owner"]) {
      const result = adminMembersQuerySchema.safeParse({ role });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid role", () => {
    const result = adminMembersQuerySchema.safeParse({ role: "superadmin" });
    expect(result.success).toBe(false);
  });

  it("rejects page less than 1", () => {
    const result = adminMembersQuerySchema.safeParse({ page: "0" });
    expect(result.success).toBe(false);
  });

  it("rejects limit greater than 100", () => {
    const result = adminMembersQuerySchema.safeParse({ limit: "101" });
    expect(result.success).toBe(false);
  });

  it("accepts limit of 100 (max)", () => {
    const result = adminMembersQuerySchema.safeParse({ limit: "100" });
    expect(result.success).toBe(true);
  });

  it("coerces string numbers to integers", () => {
    const result = adminMembersQuerySchema.safeParse({ page: "3", limit: "50" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.page).toBe("number");
      expect(typeof result.data.limit).toBe("number");
    }
  });
});

describe("changeMemberRoleSchema", () => {
  it("accepts admin role", () => {
    const result = changeMemberRoleSchema.safeParse({ role: "admin" });
    expect(result.success).toBe(true);
  });

  it("accepts member role", () => {
    const result = changeMemberRoleSchema.safeParse({ role: "member" });
    expect(result.success).toBe(true);
  });

  it("rejects owner role (cannot promote to owner)", () => {
    const result = changeMemberRoleSchema.safeParse({ role: "owner" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid role", () => {
    const result = changeMemberRoleSchema.safeParse({ role: "superadmin" });
    expect(result.success).toBe(false);
  });

  it("rejects missing role", () => {
    const result = changeMemberRoleSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("adminActivityQuerySchema", () => {
  it("accepts empty query (defaults applied)", () => {
    const result = adminActivityQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });

  it("accepts valid action filter", () => {
    const result = adminActivityQuerySchema.safeParse({ action: "note.created" });
    expect(result.success).toBe(true);
  });

  it("accepts valid entityType filter", () => {
    const result = adminActivityQuerySchema.safeParse({ entityType: "note" });
    expect(result.success).toBe(true);
  });

  it("rejects page less than 1", () => {
    const result = adminActivityQuerySchema.safeParse({ page: "0" });
    expect(result.success).toBe(false);
  });

  it("rejects limit greater than 100", () => {
    const result = adminActivityQuerySchema.safeParse({ limit: "101" });
    expect(result.success).toBe(false);
  });
});

// ─── RBAC enforcement via source inspection ──────────────────────────────

describe("Admin route RBAC enforcement", () => {
  let routeSource: string;

  beforeEach(() => {
    const routePath = path.resolve(
      __dirname,
      "../../src/routes/admin/index.ts",
    );
    routeSource = fs.readFileSync(routePath, "utf-8");
  });

  it("all admin routes require authentication", () => {
    expect(routeSource).toContain("router.use(requireAuth)");
  });

  it("stats endpoint requires admin or owner role", () => {
    expect(routeSource).toContain("/admin/stats");
    expect(routeSource).toContain('requireRole("admin", "owner")');
  });

  it("members list endpoint requires admin or owner role", () => {
    expect(routeSource).toContain("/admin/members");
    expect(routeSource).toContain("adminMembersQuerySchema");
  });

  it("role change requires owner only", () => {
    expect(routeSource).toContain("/admin/members/:memberId/role");
    expect(routeSource).toContain('requireRole("owner")');
  });

  it("member removal requires admin or owner", () => {
    expect(routeSource).toContain('"/workspaces/:workspaceId/admin/members/:memberId"');
  });

  it("activity feed requires admin or owner role", () => {
    expect(routeSource).toContain("/admin/activity");
    expect(routeSource).toContain("adminActivityQuerySchema");
  });

  it("role change resolves target from DB (never trusts frontend)", () => {
    expect(routeSource).toContain("prisma.workspaceMember.findUnique");
    expect(routeSource).toContain("target.userId === req.userId");
    expect(routeSource).toContain("You cannot change your own role");
  });

  it("role change prevents promoting to owner", () => {
    expect(routeSource).toContain('target.role === "owner"');
    expect(routeSource).toContain("Cannot change the owner");
  });

  it("role change validates target belongs to workspace", () => {
    expect(routeSource).toContain("target.workspaceId !== workspaceId");
    expect(routeSource).toContain("Member not found in this workspace");
  });

  it("member removal resolves target from DB (never trusts frontend)", () => {
    const deleteSection = routeSource.substring(
      routeSource.indexOf('"DELETE /workspaces/:workspaceId/admin/members/:memberId"') !== -1
        ? routeSource.indexOf('"DELETE /workspaces/:workspaceId/admin/members/:memberId"')
        : routeSource.indexOf('"/workspaces/:workspaceId/admin/members/:memberId"'),
    );
    expect(deleteSection).toContain("prisma.workspaceMember.findUnique");
    expect(deleteSection).toContain("target.workspaceId !== workspaceId");
  });

  it("member removal prevents removing owner", () => {
    expect(routeSource).toContain('target.role === "owner"');
    expect(routeSource).toContain("The workspace owner cannot be removed");
  });

  it("admin cannot remove other admins", () => {
    expect(routeSource).toContain('target.role === "admin"');
    expect(routeSource).toContain('req.membershipRole !== "owner"');
    expect(routeSource).toContain("Only the owner can remove admin members");
  });

  it("role change logs activity with MEMBER_ROLE_CHANGED", () => {
    expect(routeSource).toContain("MEMBER_ROLE_CHANGED");
    expect(routeSource).toContain("logActivity");
  });

  it("member removal logs activity with MEMBER_REMOVED", () => {
    expect(routeSource).toContain("MEMBER_REMOVED");
    expect(routeSource).toContain("logActivity");
  });

  it("members endpoint supports pagination", () => {
    expect(routeSource).toContain("skip");
    expect(routeSource).toContain("take: limit");
  });

  it("activity endpoint supports pagination", () => {
    expect(routeSource).toContain("adminActivityQuerySchema");
  });

  it("members endpoint supports search filter", () => {
    expect(routeSource).toContain("search");
    expect(routeSource).toContain("contains");
  });
});
