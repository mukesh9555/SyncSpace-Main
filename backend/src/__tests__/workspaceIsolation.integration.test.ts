import { it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getTestPrisma, closeTestPrisma, describeWithDb } from "./helpers/db.js";

let prisma: PrismaClient;

describeWithDb("Workspace Isolation (Security)", () => {
  let userA: string;
  let userB: string;
  let wsA: string;
  let wsB: string;

  beforeAll(async () => {
    const p = await getTestPrisma();
    if (!p) throw new Error("No test DB");
    prisma = p;

    await prisma.activityLog.deleteMany();
    await prisma.note.deleteMany();
    await prisma.codeFile.deleteMany();
    await prisma.whiteboard.deleteMany();
    await prisma.invite.deleteMany();
    await prisma.workspaceMember.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.user.deleteMany();

    const a = await prisma.user.create({
      data: { email: "iso-a@test.com", name: "User A", passwordHash: "hash" },
    });
    const b = await prisma.user.create({
      data: { email: "iso-b@test.com", name: "User B", passwordHash: "hash" },
    });
    userA = a.id;
    userB = b.id;

    const ws1 = await prisma.workspace.create({
      data: { name: "WS A", slug: "ws-iso-a" },
    });
    const ws2 = await prisma.workspace.create({
      data: { name: "WS B", slug: "ws-iso-b" },
    });
    wsA = ws1.id;
    wsB = ws2.id;

    await prisma.workspaceMember.createMany({
      data: [
        { userId: userA, workspaceId: wsA, role: "owner" },
        { userId: userB, workspaceId: wsB, role: "owner" },
      ],
    });

    await prisma.note.create({
      data: { title: "Note A", authorId: userA, workspaceId: wsA },
    });
    await prisma.note.create({
      data: { title: "Note B", authorId: userB, workspaceId: wsB },
    });
  });

  afterAll(async () => {
    await closeTestPrisma();
  });

  it("user A is member of wsA only", async () => {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: userA },
    });
    expect(memberships).toHaveLength(1);
    expect(memberships[0].workspaceId).toBe(wsA);
  });

  it("user B is member of wsB only", async () => {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: userB },
    });
    expect(memberships).toHaveLength(1);
    expect(memberships[0].workspaceId).toBe(wsB);
  });

  it("notes are isolated per workspace", async () => {
    const notesA = await prisma.note.findMany({ where: { workspaceId: wsA } });
    const notesB = await prisma.note.findMany({ where: { workspaceId: wsB } });

    expect(notesA).toHaveLength(1);
    expect(notesA[0].title).toBe("Note A");
    expect(notesB).toHaveLength(1);
    expect(notesB[0].title).toBe("Note B");
  });

  it("cannot query notes across workspaces", async () => {
    const allNotes = await prisma.note.findMany({
      where: { workspaceId: { in: [wsA, wsB] } },
    });
    expect(allNotes).toHaveLength(2);
  });

  it("cross-workspace membership check returns null", async () => {
    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: userA, workspaceId: wsB } },
    });
    expect(membership).toBeNull();
  });

  it("cross-workspace membership check returns null (reverse)", async () => {
    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: userB, workspaceId: wsA } },
    });
    expect(membership).toBeNull();
  });

  it("user A cannot see user B notes via direct query", async () => {
    const notes = await prisma.note.findMany({
      where: {
        workspaceId: wsA,
        authorId: userB,
      },
    });
    expect(notes).toHaveLength(0);
  });

  it("workspace slug is unique", async () => {
    await expect(
      prisma.workspace.create({
        data: { name: "Dup", slug: "ws-iso-a" },
      }),
    ).rejects.toThrow();
  });

  it("cannot add user A to wsB without explicit create", async () => {
    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: userA, workspaceId: wsB } },
    });
    expect(membership).toBeNull();
  });
});
