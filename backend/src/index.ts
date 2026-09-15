import express from "express";
import { createServer } from "node:http";
import cookieParser from "cookie-parser";
import { config } from "./config/index.js";
import { connectDatabase, disconnectDatabase } from "./db/index.js";
import { corsMiddleware } from "./middleware/cors.js";
import { securityMiddleware } from "./middleware/security.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { requestLogger, requestId } from "./middleware/logger.js";
import routes from "./routes/index.js";
import { createWebSocketServer } from "./ws/server.js";

const app = express();

if (config.TRUST_PROXY > 0) {
  app.set("trust proxy", config.TRUST_PROXY);
}

app.use(requestId);
app.use(securityMiddleware);
app.use(corsMiddleware);
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

app.use(config.API_PREFIX, routes);

app.use(notFoundHandler);
app.use(errorHandler);

async function start(): Promise<void> {
  await connectDatabase();

  const server = createServer(app);
  createWebSocketServer(server);

  server.listen(config.PORT, () => {
    console.log(`[backend] SyncSpace API running on http://localhost:${config.PORT}${config.API_PREFIX}`);
    console.log(`[backend] WebSocket server running on ws://localhost:${config.PORT}/ws`);
    console.log(`[backend] Environment: ${config.NODE_ENV}`);
    if (config.TRUST_PROXY > 0) {
      console.log(`[backend] Trust proxy: ${config.TRUST_PROXY}`);
    }
  });
}

start().catch((err) => {
  console.error("[backend] Failed to start server:", err);
  process.exit(1);
});

process.on("SIGTERM", async () => {
  console.log("[backend] SIGTERM received, shutting down gracefully...");
  await disconnectDatabase();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("[backend] SIGINT received, shutting down gracefully...");
  await disconnectDatabase();
  process.exit(0);
});

export default app;
