import { it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getTestPrisma, closeTestPrisma, describeWithDb } from "./helpers/db.js";

let prisma: PrismaClient;

describeWithDb("Notes Integration", () => {
  let userId: string;
  let workspaceId: string;

  beforeAll(async () => {
    const p = await getTestPrisma();
    if (!p) throw new Error("No test DB");
    prisma = p;

    const user = await prisma.user.create({
      data: { email: "notes@test.com", name: "Notes User", passwordHash: "hash" },
    });
    userId = user.id;

    const ws = await prisma.workspace.create({
      data: { name: "Notes WS", slug: "notes-ws" },
    });
    workspaceId = ws.id;

    await prisma.workspaceMember.create({
      data: { userId, workspaceId, role: "owner" },
    });
  });

  afterAll(async () => {
    await closeTestPrisma();
  });

  beforeEach(async () => {
    await prisma.note.deleteMany();
  });

  it("creates a note", async () => {
    const note = await prisma.note.create({
      data: {
        title: "Test Note",
        content: "Hello world",
        authorId: userId,
        workspaceId,
      },
    });

    expect(note.id).toBeDefined();
    expect(note.title).toBe("Test Note");
    expect(note.content).toBe("Hello world");
    expect(note.isPinned).toBe(false);
  });

  it("creates note with defaults", async () => {
    const note = await prisma.note.create({
      data: {
        title: "",
        authorId: userId,
        workspaceId,
      },
    });

    expect(note.title).toBe("");
    expect(note.content).toBe("");
    expect(note.isPinned).toBe(false);
  });

  it("updates note content", async () => {
    const note = await prisma.note.create({
      data: { title: "Original", authorId: userId, workspaceId },
    });

    const updated = await prisma.note.update({
      where: { id: note.id },
      data: { content: "Updated content" },
    });

    expect(updated.content).toBe("Updated content");
  });

  it("pins a note", async () => {
    const note = await prisma.note.create({
      data: { title: "Pinnable", authorId: userId, workspaceId },
    });

    const pinned = await prisma.note.update({
      where: { id: note.id },
      data: { isPinned: true },
    });

    expect(pinned.isPinned).toBe(true);
  });

  it("lists notes by workspace", async () => {
    await prisma.note.createMany({
      data: [
        { title: "Note 1", authorId: userId, workspaceId },
        { title: "Note 2", authorId: userId, workspaceId },
        { title: "Note 3", authorId: userId, workspaceId },
      ],
    });

    const notes = await prisma.note.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });

    expect(notes).toHaveLength(3);
  });

  it("sorted by updatedAt descending", async () => {
    const note1 = await prisma.note.create({
      data: { title: "Old", authorId: userId, workspaceId },
    });
    const note2 = await prisma.note.create({
      data: { title: "New", authorId: userId, workspaceId },
    });

    // Update note1 to make it newer
    await prisma.note.update({
      where: { id: note1.id },
      data: { title: "Updated Old" },
    });

    const sorted = await prisma.note.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
    });

    expect(sorted[0].id).toBe(note1.id);
    expect(sorted[1].id).toBe(note2.id);
  });

  it("deletes a note", async () => {
    const note = await prisma.note.create({
      data: { title: "Deletable", authorId: userId, workspaceId },
    });

    await prisma.note.delete({ where: { id: note.id } });

    const found = await prisma.note.findUnique({ where: { id: note.id } });
    expect(found).toBeNull();
  });

  it("cascades note deletion when workspace is deleted", async () => {
    const ws = await prisma.workspace.create({
      data: { name: "Del WS", slug: "del-ws-notes" },
    });
    await prisma.note.create({
      data: { title: "Orphan", authorId: userId, workspaceId: ws.id },
    });

    await prisma.workspace.delete({ where: { id: ws.id } });

    const notes = await prisma.note.findMany({ where: { workspaceId: ws.id } });
    expect(notes).toHaveLength(0);
  });
});
