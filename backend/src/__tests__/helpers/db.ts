import { describe } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/syncspace_lite_test?schema=public";

let _prisma: PrismaClient | null = null;

export async function getTestPrisma(): Promise<PrismaClient | null> {
  if (_prisma) return _prisma;
  try {
    const adapter = new PrismaPg({ connectionString: TEST_DB_URL });
    _prisma = new PrismaClient({ adapter });
    await _prisma.$connect();
    return _prisma;
  } catch {
    return null;
  }
}

export async function closeTestPrisma(): Promise<void> {
  if (_prisma) {
    await _prisma.$disconnect();
    _prisma = null;
  }
}

export async function cleanupTestData(prisma: PrismaClient): Promise<void> {
  await prisma.activityLog.deleteMany();
  await prisma.presence.deleteMany();
  await prisma.invite.deleteMany();
  await prisma.note.deleteMany();
  await prisma.codeFile.deleteMany();
  await prisma.whiteboard.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();
}

export function describeWithDb(name: string, fn: () => void): void {
  describe.skipIf(!process.env.TEST_DATABASE_URL)(name, fn);
}
