import { it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getTestPrisma, closeTestPrisma, describeWithDb } from "./helpers/db.js";

let prisma: PrismaClient;

describeWithDb("Whiteboards Integration", () => {
  let userId: string;
  let workspaceId: string;

  beforeAll(async () => {
    const p = await getTestPrisma();
    if (!p) throw new Error("No test DB");
    prisma = p;

    const user = await prisma.user.create({
      data: { email: "wb@test.com", name: "WB User", passwordHash: "hash" },
    });
    userId = user.id;

    const ws = await prisma.workspace.create({
      data: { name: "WB WS", slug: "wb-ws" },
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
    await prisma.whiteboard.deleteMany();
  });

  it("creates a whiteboard", async () => {
    const wb = await prisma.whiteboard.create({
      data: {
        name: "My Board",
        authorId: userId,
        workspaceId,
      },
    });

    expect(wb.id).toBeDefined();
    expect(wb.name).toBe("My Board");
    expect(wb.content).toBe("{}");
  });

  it("creates whiteboard with default name", async () => {
    const wb = await prisma.whiteboard.create({
      data: {
        authorId: userId,
        workspaceId,
      },
    });

    expect(wb.name).toBe("Untitled");
  });

  it("updates whiteboard content", async () => {
    const wb = await prisma.whiteboard.create({
      data: { authorId: userId, workspaceId },
    });

    const content = JSON.stringify({ history: ["line1", "line2"], index: 1 });
    const updated = await prisma.whiteboard.update({
      where: { id: wb.id },
      data: { content },
    });

    expect(updated.content).toBe(content);
  });

  it("stores snapshot URL", async () => {
    const wb = await prisma.whiteboard.create({
      data: { authorId: userId, workspaceId },
    });

    const updated = await prisma.whiteboard.update({
      where: { id: wb.id },
      data: { snapshotUrl: "https://s3.amazonaws.com/snapshots/wb.png" },
    });

    expect(updated.snapshotUrl).toBe("https://s3.amazonaws.com/snapshots/wb.png");
  });

  it("lists whiteboards by workspace", async () => {
    await prisma.whiteboard.createMany({
      data: [
        { name: "Board 1", authorId: userId, workspaceId },
        { name: "Board 2", authorId: userId, workspaceId },
      ],
    });

    const boards = await prisma.whiteboard.findMany({ where: { workspaceId } });
    expect(boards).toHaveLength(2);
  });

  it("deletes a whiteboard", async () => {
    const wb = await prisma.whiteboard.create({
      data: { name: "Deletable", authorId: userId, workspaceId },
    });

    await prisma.whiteboard.delete({ where: { id: wb.id } });

    const found = await prisma.whiteboard.findUnique({ where: { id: wb.id } });
    expect(found).toBeNull();
  });
});
