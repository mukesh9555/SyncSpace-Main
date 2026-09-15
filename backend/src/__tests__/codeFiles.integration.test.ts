import { it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getTestPrisma, closeTestPrisma, describeWithDb } from "./helpers/db.js";

let prisma: PrismaClient;

describeWithDb("Code Files Integration", () => {
  let userId: string;
  let workspaceId: string;

  beforeAll(async () => {
    const p = await getTestPrisma();
    if (!p) throw new Error("No test DB");
    prisma = p;

    const user = await prisma.user.create({
      data: { email: "code@test.com", name: "Code User", passwordHash: "hash" },
    });
    userId = user.id;

    const ws = await prisma.workspace.create({
      data: { name: "Code WS", slug: "code-ws" },
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
    await prisma.codeFile.deleteMany();
  });

  it("creates a code file", async () => {
    const file = await prisma.codeFile.create({
      data: {
        name: "main.ts",
        path: "/src/main.ts",
        content: 'console.log("hello")',
        language: "typescript",
        authorId: userId,
        workspaceId,
      },
    });

    expect(file.id).toBeDefined();
    expect(file.name).toBe("main.ts");
    expect(file.language).toBe("typescript");
  });

  it("enforces unique path per workspace", async () => {
    await prisma.codeFile.create({
      data: {
        name: "index.ts",
        path: "/src/index.ts",
        authorId: userId,
        workspaceId,
      },
    });

    await expect(
      prisma.codeFile.create({
        data: {
          name: "index2.ts",
          path: "/src/index.ts",
          authorId: userId,
          workspaceId,
        },
      }),
    ).rejects.toThrow();
  });

  it("allows same path in different workspaces", async () => {
    const ws2 = await prisma.workspace.create({
      data: { name: "WS2", slug: "code-ws-2" },
    });

    await prisma.codeFile.create({
      data: {
        name: "app.ts",
        path: "/src/app.ts",
        authorId: userId,
        workspaceId,
      },
    });

    const file2 = await prisma.codeFile.create({
      data: {
        name: "app.ts",
        path: "/src/app.ts",
        authorId: userId,
        workspaceId: ws2.id,
      },
    });

    expect(file2.id).toBeDefined();
  });

  it("updates file content", async () => {
    const file = await prisma.codeFile.create({
      data: {
        name: "edit.ts",
        path: "/src/edit.ts",
        content: "old content",
        authorId: userId,
        workspaceId,
      },
    });

    const updated = await prisma.codeFile.update({
      where: { id: file.id },
      data: { content: "new content" },
    });

    expect(updated.content).toBe("new content");
  });

  it("defaults language to plaintext", async () => {
    const file = await prisma.codeFile.create({
      data: {
        name: "readme",
        path: "/readme",
        authorId: userId,
        workspaceId,
      },
    });

    expect(file.language).toBe("plaintext");
  });

  it("lists files by workspace", async () => {
    await prisma.codeFile.createMany({
      data: [
        { name: "a.ts", path: "/a.ts", authorId: userId, workspaceId },
        { name: "b.ts", path: "/b.ts", authorId: userId, workspaceId },
      ],
    });

    const files = await prisma.codeFile.findMany({ where: { workspaceId } });
    expect(files).toHaveLength(2);
  });
});
