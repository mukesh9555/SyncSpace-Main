import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "../config/index.js";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: config.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  console.log("[db] Connected to PostgreSQL");
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  console.log("[db] Disconnected from PostgreSQL");
}
