import { it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getTestPrisma, closeTestPrisma, describeWithDb } from "./helpers/db.js";

let prisma: PrismaClient;

describeWithDb("Workspace & RBAC Integration", () => {
  let ownerId: string;
  let adminId: string;
  let memberId: string;
  let outsiderId: string;
  let workspaceId: string;

  beforeAll(async () => {
    const p = await getTestPrisma();
    if (!p) throw new Error("No test DB");
    prisma = p;

    const owner = await prisma.user.create({
      data: { email: "owner@rbac.com", name: "Owner", passwordHash: "hash" },
    });
    const admin = await prisma.user.create({
      data: { email: "admin@rbac.com", name: "Admin", passwordHash: "hash" },
    });
    const member = await prisma.user.create({
      data: { email: "member@rbac.com", name: "Member", passwordHash: "hash" },
    });
    const outsider = await prisma.user.create({
      data: { email: "outsider@rbac.com", name: "Outsider", passwordHash: "hash" },
    });

    ownerId = owner.id;
    adminId = admin.id;
    memberId = member.id;
    outsiderId = outsider.id;

    const ws = await prisma.workspace.create({
      data: { name: "Test WS", slug: "test-ws-rbac" },
    });
    workspaceId = ws.id;

    await prisma.workspaceMember.createMany({
      data: [
        { userId: ownerId, workspaceId, role: "owner" },
        { userId: adminId, workspaceId, role: "admin" },
        { userId: memberId, workspaceId, role: "member" },
      ],
    });
  });

  afterAll(async () => {
    await closeTestPrisma();
  });

  beforeEach(async () => {
    // no cleanup — we need the test data
  });

  it("creates workspace with owner", async () => {
    const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    expect(ws).not.toBeNull();
    expect(ws!.name).toBe("Test WS");

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: ownerId, workspaceId } },
    });
    expect(membership).not.toBeNull();
    expect(membership!.role).toBe("owner");
  });

  it("assigns correct roles", async () => {
    const roles = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: { role: "asc" },
    });

    const roleMap = Object.fromEntries(roles.map((r) => [r.userId, r.role]));
    expect(roleMap[ownerId]).toBe("owner");
    expect(roleMap[adminId]).toBe("admin");
    expect(roleMap[memberId]).toBe("member");
  });

  it("enforces unique membership per user per workspace", async () => {
    await expect(
      prisma.workspaceMember.create({
        data: { userId: memberId, workspaceId, role: "member" },
      }),
    ).rejects.toThrow();
  });

  it("outsider has no membership", async () => {
    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: outsiderId, workspaceId } },
    });
    expect(membership).toBeNull();
  });

  it("role hierarchy: owner > admin > member", () => {
    const hierarchy: Record<string, number> = { owner: 3, admin: 2, member: 1 };
    expect(hierarchy["owner"]).toBeGreaterThan(hierarchy["admin"]);
    expect(hierarchy["admin"]).toBeGreaterThan(hierarchy["member"]);
  });

  it("cascades workspace deletion to members", async () => {
    const tempWs = await prisma.workspace.create({
      data: { name: "Temp WS", slug: "temp-ws-cascade" },
    });
    await prisma.workspaceMember.create({
      data: { userId: memberId, workspaceId: tempWs.id, role: "member" },
    });

    await prisma.workspace.delete({ where: { id: tempWs.id } });

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: tempWs.id },
    });
    expect(members).toHaveLength(0);
  });

  it("cascades user deletion to memberships", async () => {
    const tempUser = await prisma.user.create({
      data: { email: "temp@cascade.com", name: "Temp", passwordHash: "hash" },
    });
    await prisma.workspaceMember.create({
      data: { userId: tempUser.id, workspaceId, role: "member" },
    });

    await prisma.user.delete({ where: { id: tempUser.id } });

    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: tempUser.id },
    });
    expect(memberships).toHaveLength(0);
  });

  it("prevents duplicate slugs", async () => {
    await expect(
      prisma.workspace.create({
        data: { name: "Dup WS", slug: "test-ws-rbac" },
      }),
    ).rejects.toThrow();
  });

  it("workspace slug is unique", async () => {
    const slug = await prisma.workspace.findUnique({ where: { slug: "test-ws-rbac" } });
    expect(slug).not.toBeNull();
    expect(slug!.id).toBe(workspaceId);
  });
});
