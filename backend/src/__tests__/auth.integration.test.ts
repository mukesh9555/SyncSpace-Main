import { it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getTestPrisma, closeTestPrisma, cleanupTestData, describeWithDb } from "./helpers/db.js";
import { hashPassword, comparePassword } from "../lib/password.js";
import { signAuthToken, verifyAuthToken } from "../lib/token.js";

let prisma: PrismaClient;

describeWithDb("Auth Integration", () => {
  beforeAll(async () => {
    const p = await getTestPrisma();
    if (!p) throw new Error("No test DB");
    prisma = p;
  });

  afterAll(async () => {
    await closeTestPrisma();
  });

  beforeEach(async () => {
    await cleanupTestData(prisma);
  });

  it("creates user and hashes password", async () => {
    const hash = await hashPassword("testpass123");
    const user = await prisma.user.create({
      data: {
        email: "auth@test.com",
        name: "Auth Test",
        passwordHash: hash,
      },
    });

    expect(user.id).toBeDefined();
    expect(user.email).toBe("auth@test.com");
    expect(user.passwordHash).not.toBe("testpass123");
  });

  it("verifies password correctly", async () => {
    const hash = await hashPassword("mypassword");
    const user = await prisma.user.create({
      data: {
        email: "verify@test.com",
        name: "Verify Test",
        passwordHash: hash,
      },
    });

    const fetched = await prisma.user.findUnique({ where: { id: user.id } });
    expect(fetched).not.toBeNull();

    const valid = await comparePassword("mypassword", fetched!.passwordHash);
    expect(valid).toBe(true);

    const invalid = await comparePassword("wrongpassword", fetched!.passwordHash);
    expect(invalid).toBe(false);
  });

  it("creates and verifies JWT token", async () => {
    const user = await prisma.user.create({
      data: {
        email: "jwt@test.com",
        name: "JWT Test",
        passwordHash: await hashPassword("pass"),
      },
    });

    const token = await signAuthToken({
      sub: user.id,
      email: user.email,
      name: user.name,
    });

    expect(token).toBeDefined();
    expect(typeof token).toBe("string");

    const payload = await verifyAuthToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe(user.id);
    expect(payload!.email).toBe(user.email);
  });

  it("enforces unique email constraint", async () => {
    await prisma.user.create({
      data: {
        email: "unique@test.com",
        name: "First",
        passwordHash: await hashPassword("pass"),
      },
    });

    await expect(
      prisma.user.create({
        data: {
          email: "unique@test.com",
          name: "Second",
          passwordHash: await hashPassword("pass"),
        },
      }),
    ).rejects.toThrow();
  });
});
