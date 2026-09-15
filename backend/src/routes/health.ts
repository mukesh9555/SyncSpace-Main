import { Router } from "express";
import { config } from "../config/index.js";
import { prisma } from "../db/index.js";

const router = Router();

router.get("/health", async (_req, res) => {
  let dbStatus = "disconnected";

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = "connected";
  } catch {
    dbStatus = "unavailable";
  }

  const statusCode = dbStatus === "connected" ? 200 : 503;

  res.status(statusCode).json({
    success: dbStatus === "connected",
    status: dbStatus === "connected" ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.NODE_ENV,
    database: dbStatus,
  });
});

export default router;
