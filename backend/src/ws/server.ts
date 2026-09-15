import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import type { Server } from "node:http";
import { verifyAuthToken, AUTH_COOKIE_NAME } from "../lib/token.js";
import { prisma } from "../db/index.js";
import type { AuthJWTPayload } from "../lib/token.js";
import {
  setBroadcastFunction,
  setMembershipChecker,
  handleCollaborationMessage,
  type CollaborationClientMessage,
} from "./collaboration.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PresenceUser {
  userId: string;
  name: string;
  email: string;
  status: "online" | "away";
  lastSeen: number;
}

interface AuthenticatedSocket extends WebSocket {
  userId: string;
  userName: string;
  userEmail: string;
  workspaceIds: Set<string>;
  alive: boolean;
  lastDbWrite: number;
  msgCount: number;
  msgWindowStart: number;
}

// ─── Protocol messages ──────────────────────────────────────────────────────

type ClientMessage =
  | { type: "join"; workspaceId: string }
  | { type: "leave"; workspaceId: string }
  | { type: "heartbeat" };

type ServerMessage =
  | { type: "presence"; workspaceId: string; users: PresenceUser[] }
  | { type: "user_joined"; workspaceId: string; user: PresenceUser }
  | { type: "user_left"; workspaceId: string; userId: string }
  | { type: "error"; message: string }
  | { type: "pong" };

// ─── Presence state ─────────────────────────────────────────────────────────

const HEARTBEAT_INTERVAL = 30_000; // 30s
const AWAY_THRESHOLD = 2 * 60_000; // 2min
const DB_WRITE_INTERVAL = 5 * 60_000; // 5min
const WS_MAX_PAYLOAD = 1024 * 1024; // 1MB
const MSG_RATE_LIMIT = 100; // max messages per window
const MSG_RATE_WINDOW = 10_000; // 10s window

// userId -> PresenceUser (in-memory presence for all connected users)
const presenceMap = new Map<string, PresenceUser>();
// workspaceId -> Set<userId>
const roomMembers = new Map<string, Set<string>>();
// userId -> Set<AuthenticatedSocket> (multiple tabs)
const userSockets = new Map<string, Set<AuthenticatedSocket>>();

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const cookies: Record<string, string> = {};
  for (const pair of header.split(";")) {
    const [key, ...rest] = pair.split("=");
    if (key) cookies[key.trim()] = rest.join("=").trim();
  }
  return cookies;
}

function getWorkspaceUsers(workspaceId: string): PresenceUser[] {
  const memberIds = roomMembers.get(workspaceId);
  if (!memberIds) return [];
  const users: PresenceUser[] = [];
  for (const uid of memberIds) {
    const p = presenceMap.get(uid);
    if (p) users.push(p);
  }
  return users;
}

function broadcastToWorkspace(
  workspaceId: string,
  message: ServerMessage,
  excludeUserId?: string,
): void {
  const memberIds = roomMembers.get(workspaceId);
  if (!memberIds) return;
  const payload = JSON.stringify(message);
  for (const uid of memberIds) {
    if (uid === excludeUserId) continue;
    const sockets = userSockets.get(uid);
    if (!sockets) continue;
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }
}

// ─── Server setup ───────────────────────────────────────────────────────────

export function createWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws", maxPayload: WS_MAX_PAYLOAD });

  // Set up collaboration broadcast function
  setBroadcastFunction((workspaceId, message, excludeUserId) => {
    broadcastToWorkspace(workspaceId, message as ServerMessage, excludeUserId);
  });

  // Set up membership checker for collaboration
  setMembershipChecker(async (userId, workspaceId) => {
    try {
      const membership = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: { userId, workspaceId },
        },
        select: { id: true },
      });
      return !!membership;
    } catch {
      return false;
    }
  });

  // Heartbeat interval — ping all clients, mark dead ones
  const heartbeatTimer = setInterval(() => {
    for (const [, sockets] of userSockets) {
      for (const ws of sockets) {
        if (!ws.alive) {
          ws.terminate();
          continue;
        }
        ws.alive = false;
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }

    // Update presence status based on lastSeen
    const now = Date.now();
    for (const [uid, presence] of presenceMap) {
      const elapsed = now - presence.lastSeen;
      const newStatus = elapsed > AWAY_THRESHOLD ? "away" : "online";
      if (presence.status !== newStatus) {
        presence.status = newStatus;
        // Broadcast status change to all workspaces this user is in
        const sockets = userSockets.get(uid);
        if (sockets) {
          for (const ws of sockets) {
            for (const wid of ws.workspaceIds) {
              broadcastToWorkspace(wid, {
                type: "presence",
                workspaceId: wid,
                users: getWorkspaceUsers(wid),
              });
            }
          }
        }
      }
    }

    // Flush stale lastActiveAt writes to DB
    for (const [uid] of presenceMap) {
      const sockets = userSockets.get(uid);
      if (!sockets || sockets.size === 0) continue;
      const anySocket = [...sockets][0];
      if (now - anySocket.lastDbWrite > DB_WRITE_INTERVAL) {
        anySocket.lastDbWrite = now;
        prisma.user
          .update({
            where: { id: uid },
            data: { lastActiveAt: new Date() },
            select: { id: true },
          })
          .catch(() => {});
      }
    }
  }, HEARTBEAT_INTERVAL);

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    // ── Authenticate ──────────────────────────────────────────────────
    const cookies = parseCookies(req.headers.cookie);
    const token =
      cookies[AUTH_COOKIE_NAME] ??
      req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      ws.send(JSON.stringify({ type: "error", message: "Authentication required." }));
      ws.close(4001, "Unauthorized");
      return;
    }

    const payload: AuthJWTPayload | null = await verifyAuthToken(token);
    if (!payload) {
      ws.send(JSON.stringify({ type: "error", message: "Invalid or expired token." }));
      ws.close(4001, "Unauthorized");
      return;
    }

    const sock = ws as AuthenticatedSocket;
    sock.userId = payload.sub;
    sock.userName = payload.name;
    sock.userEmail = payload.email;
    sock.workspaceIds = new Set();
    sock.alive = true;
    sock.lastDbWrite = Date.now();
    sock.msgCount = 0;
    sock.msgWindowStart = Date.now();

    // Track sockets per user (multiple tabs)
    if (!userSockets.has(sock.userId)) {
      userSockets.set(sock.userId, new Set());
    }
    userSockets.get(sock.userId)!.add(sock);

    // Set initial presence
    if (!presenceMap.has(sock.userId)) {
      presenceMap.set(sock.userId, {
        userId: sock.userId,
        name: sock.userName,
        email: sock.userEmail,
        status: "online",
        lastSeen: Date.now(),
      });
    } else {
      const p = presenceMap.get(sock.userId)!;
      p.status = "online";
      p.lastSeen = Date.now();
    }

    // ── Handle messages ───────────────────────────────────────────────
    sock.on("message", async (raw: Buffer | string) => {
      // Flood protection: rate limit messages per connection
      const now = Date.now();
      if (now - sock.msgWindowStart > MSG_RATE_WINDOW) {
        sock.msgCount = 0;
        sock.msgWindowStart = now;
      }
      sock.msgCount++;
      if (sock.msgCount > MSG_RATE_LIMIT) {
        sock.send(JSON.stringify({ type: "error", message: "Rate limit exceeded. Slow down." }));
        return;
      }

      let msg: ClientMessage;
      try {
        msg = JSON.parse(typeof raw === "string" ? raw : raw.toString());
      } catch {
        sock.send(JSON.stringify({ type: "error", message: "Invalid JSON." }));
        return;
      }

      switch (msg.type) {
        case "join": {
          const { workspaceId } = msg;
          if (!workspaceId) break;

          // Verify workspace membership
          prisma.workspaceMember
            .findUnique({
              where: {
                userId_workspaceId: {
                  userId: sock.userId,
                  workspaceId,
                },
              },
              select: { id: true },
            })
            .then((membership) => {
              if (!membership) {
                sock.send(
                  JSON.stringify({
                    type: "error",
                    message: "Not a member of this workspace.",
                  }),
                );
                return;
              }

              sock.workspaceIds.add(workspaceId);

              if (!roomMembers.has(workspaceId)) {
                roomMembers.set(workspaceId, new Set());
              }
              roomMembers.get(workspaceId)!.add(sock.userId);

              // Broadcast join
              const user = presenceMap.get(sock.userId)!;
              broadcastToWorkspace(
                workspaceId,
                {
                  type: "user_joined",
                  workspaceId,
                  user,
                },
                sock.userId,
              );

              // Send current room presence to the joining user
              sock.send(
                JSON.stringify({
                  type: "presence",
                  workspaceId,
                  users: getWorkspaceUsers(workspaceId),
                }),
              );
            })
            .catch(() => {});
          break;
        }

        case "leave": {
          const { workspaceId } = msg;
          if (!workspaceId) break;

          sock.workspaceIds.delete(workspaceId);
          const members = roomMembers.get(workspaceId);
          if (members) {
            members.delete(sock.userId);
            if (members.size === 0) roomMembers.delete(workspaceId);
          }

          broadcastToWorkspace(workspaceId, {
            type: "user_left",
            workspaceId,
            userId: sock.userId,
          });
          break;
        }

        case "heartbeat": {
          sock.alive = true;
          const p = presenceMap.get(sock.userId);
          if (p) {
            p.lastSeen = Date.now();
            p.status = "online";
          }
          sock.send(JSON.stringify({ type: "pong" }));
          break;
        }

        default: {
          // Try collaboration messages
          const handled = await handleCollaborationMessage(
            sock.userId,
            msg as CollaborationClientMessage,
            (ws, data) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(data));
              }
            },
            userSockets as unknown as Map<string, Set<WebSocket & { userId: string; workspaceIds: Set<string> }>>,
          );
          if (!handled) {
            sock.send(
              JSON.stringify({ type: "error", message: `Unknown message type: ${(msg as Record<string, string>).type}` }),
            );
          }
          break;
        }
      }
    });

    // ── Handle disconnect ─────────────────────────────────────────────
    sock.on("close", () => {
      const sockets = userSockets.get(sock.userId);
      if (sockets) {
        sockets.delete(sock);
        if (sockets.size === 0) {
          userSockets.delete(sock.userId);
          // Mark user offline
          presenceMap.delete(sock.userId);
          // Broadcast departure from all workspaces
          for (const wid of sock.workspaceIds) {
            broadcastToWorkspace(wid, {
              type: "user_left",
              workspaceId: wid,
              userId: sock.userId,
            });
            const members = roomMembers.get(wid);
            if (members) {
              members.delete(sock.userId);
              if (members.size === 0) roomMembers.delete(wid);
            }
          }
        }
      }
    });

    sock.on("error", () => {
      sock.terminate();
    });
  });

  // Attach close handler for cleanup
  wss.on("close", () => {
    clearInterval(heartbeatTimer);
  });

  return wss;
}

// ─── Exported helpers for tests ─────────────────────────────────────────────

export function getPresence(userId: string): PresenceUser | undefined {
  return presenceMap.get(userId);
}

export function getRoomMembers(workspaceId: string): string[] {
  const members = roomMembers.get(workspaceId);
  return members ? [...members] : [];
}

export function getOnlineUsers(workspaceId: string): PresenceUser[] {
  return getWorkspaceUsers(workspaceId);
}

export function isUserOnline(userId: string): boolean {
  return userSockets.has(userId) && userSockets.get(userId)!.size > 0;
}
