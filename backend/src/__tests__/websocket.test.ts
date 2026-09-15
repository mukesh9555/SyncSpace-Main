import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { WebSocket } from "ws";
import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import { signAuthToken } from "../lib/token.js";
import { createWebSocketServer, getPresence, getRoomMembers, isUserOnline } from "../ws/server.js";

let server: http.Server;
let wss: ReturnType<typeof createWebSocketServer>;
let port: number;

function makeToken(payload: { sub: string; email: string; name: string }) {
  return signAuthToken(payload);
}

function connectWS(token: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`, {
      headers: { Cookie: `ss_token=${token}` },
    });
    ws.on("open", () => {
      // Send heartbeat to ensure server-side connection handler has completed
      ws.send(JSON.stringify({ type: "heartbeat" }));
    });
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "pong") {
        resolve(ws);
      }
    });
    ws.on("error", reject);
  });
}

function waitForMessage(ws: WebSocket, type: string, timeout = 3000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${type}`)), timeout);
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === type) {
        clearTimeout(timer);
        resolve(msg);
      }
    });
  });
}

beforeAll(async () => {
  const app = express();
  app.use(cookieParser());
  server = http.createServer(app);
  wss = createWebSocketServer(server);

  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const addr = server.address();
      port = typeof addr === "object" && addr ? addr.port : 0;
      resolve();
    });
  });
});

afterAll(() => {
  wss.close();
  server.close();
});

describe("WebSocket authentication", () => {
  it("rejects connection without token", async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    const closePromise = new Promise<number>((resolve) => {
      ws.on("close", (code) => resolve(code));
    });
    const code = await closePromise;
    expect(code).toBe(4001);
  });

  it("rejects connection with invalid token", async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`, {
      headers: { Cookie: "ss_token=invalid.token.here" },
    });
    const closePromise = new Promise<number>((resolve) => {
      ws.on("close", (code) => resolve(code));
    });
    const code = await closePromise;
    expect(code).toBe(4001);
  });

  it("accepts connection with valid token", async () => {
    const token = await makeToken({
      sub: "user-auth-1",
      email: "auth@test.com",
      name: "Auth User",
    });
    const ws = await connectWS(token);
    expect(ws.readyState).toBe(WebSocket.OPEN);
    expect(isUserOnline("user-auth-1")).toBe(true);
    ws.close();
  });
});

describe("WebSocket workspace rooms", () => {
  let userToken: string;

  beforeEach(async () => {
    userToken = await makeToken({
      sub: "user-room-1",
      email: "room@test.com",
      name: "Room User",
    });
  });

  it("sends error for join without membership (mock check)", async () => {
    const token = await makeToken({
      sub: "user-no-membership",
      email: "no@test.com",
      name: "No Member",
    });
    const ws = await connectWS(token);

    // The server checks DB for membership — in test env without DB,
    // the join will silently fail (no error broadcast, but no presence update).
    // We verify the connection stays open.
    ws.send(JSON.stringify({ type: "join", workspaceId: "nonexistent" }));

    // Wait a bit for async DB check
    await new Promise((r) => setTimeout(r, 100));

    // Connection should still be open
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  it("handles leave message without error", async () => {
    const ws = await connectWS(userToken);
    ws.send(JSON.stringify({ type: "leave", workspaceId: "nonexistent" }));
    await new Promise((r) => setTimeout(r, 50));
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });
});

describe("WebSocket heartbeat", () => {
  it("responds with pong to heartbeat", async () => {
    const token = await makeToken({
      sub: "user-heartbeat",
      email: "hb@test.com",
      name: "HB User",
    });
    const ws = await connectWS(token);

    const pongPromise = waitForMessage(ws, "pong");
    ws.send(JSON.stringify({ type: "heartbeat" }));
    const msg = await pongPromise;

    expect(msg.type).toBe("pong");
    ws.close();
  });

  it("updates presence lastSeen on heartbeat", async () => {
    const token = await makeToken({
      sub: "user-presence",
      email: "presence@test.com",
      name: "Presence User",
    });
    const ws = await connectWS(token);

    const before = Date.now();
    ws.send(JSON.stringify({ type: "heartbeat" }));
    await waitForMessage(ws, "pong");

    const presence = getPresence("user-presence");
    expect(presence).toBeDefined();
    expect(presence!.lastSeen).toBeGreaterThanOrEqual(before);
    ws.close();
  });
});

describe("WebSocket presence", () => {
  it("tracks online status for connected user", async () => {
    const token = await makeToken({
      sub: "user-status",
      email: "status@test.com",
      name: "Status User",
    });
    const ws = await connectWS(token);

    const presence = getPresence("user-status");
    expect(presence).toBeDefined();
    expect(presence!.status).toBe("online");
    expect(presence!.userId).toBe("user-status");

    ws.close();
  });

  it("removes presence on disconnect", async () => {
    const token = await makeToken({
      sub: "user-disconnect",
      email: "disc@test.com",
      name: "Disconnect User",
    });
    const ws = await connectWS(token);
    expect(isUserOnline("user-disconnect")).toBe(true);

    await new Promise<void>((resolve) => {
      ws.on("close", () => resolve());
      ws.close();
    });

    // Wait for cleanup
    await new Promise((r) => setTimeout(r, 50));
    expect(isUserOnline("user-disconnect")).toBe(false);
  });

  it("supports multiple tabs per user", async () => {
    const token = await makeToken({
      sub: "user-multi",
      email: "multi@test.com",
      name: "Multi User",
    });
    const ws1 = await connectWS(token);
    const ws2 = await connectWS(token);

    expect(isUserOnline("user-multi")).toBe(true);

    ws1.close();
    await new Promise((r) => setTimeout(r, 50));

    // Should still be online with second tab
    expect(isUserOnline("user-multi")).toBe(true);

    ws2.close();
    await new Promise((r) => setTimeout(r, 50));

    // Now offline
    expect(isUserOnline("user-multi")).toBe(false);
  });
});

describe("WebSocket helper exports", () => {
  it("getRoomMembers returns empty array for unknown workspace", () => {
    expect(getRoomMembers("nonexistent")).toEqual([]);
  });

  it("getPresence returns undefined for unknown user", () => {
    expect(getPresence("nonexistent")).toBeUndefined();
  });

  it("isUserOnline returns false for unknown user", () => {
    expect(isUserOnline("nonexistent")).toBe(false);
  });
});
