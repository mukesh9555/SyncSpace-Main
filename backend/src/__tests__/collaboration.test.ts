import { describe, it, expect, beforeEach } from "vitest";
import {
  getRevision,
  setRevision,
  getLastEditor,
  handleCollaborationMessage,
  cleanupEntity,
  setBroadcastFunction,
  setMembershipChecker,
} from "../ws/collaboration.js";

// ─── Test helpers ──────────────────────────────────────────────────────────

interface MockSocket {
  userId: string;
  workspaceIds: Set<string>;
  readyState: number;
  sent: object[];
}

function createMockSocket(userId: string, workspaceIds: string[] = []): MockSocket {
  return {
    userId,
    workspaceIds: new Set(workspaceIds),
    readyState: 1, // OPEN
    sent: [],
  };
}

function createSocketMap(
  entries: Array<{ userId: string; sockets: Array<{ workspaceIds: string[] }> }>,
): Map<string, Set<MockSocket>> {
  const map = new Map<string, Set<MockSocket>>();
  for (const entry of entries) {
    const sockets = new Set<MockSocket>();
    for (const cfg of entry.sockets) {
      sockets.add(createMockSocket(entry.userId, cfg.workspaceIds));
    }
    map.set(entry.userId, sockets);
  }
  return map;
}

// ─── Setup ─────────────────────────────────────────────────────────────────

let broadcastCalls: { workspaceId: string; message: object; excludeUserId?: string }[] = [];
let membershipMap: Map<string, Set<string>> = new Map();

  beforeEach(() => {
    // Reset revision tracking
    cleanupEntity("note", "note-1");
    cleanupEntity("note", "note-2");
    cleanupEntity("whiteboard", "wb-1");
    cleanupEntity("whiteboard", "wb-2");
    cleanupEntity("codefile", "cf-1");
    cleanupEntity("codefile", "cf-2");

  broadcastCalls = [];
  membershipMap = new Map([
    ["ws-1", new Set(["user-1", "user-2", "user-3"])],
    ["ws-2", new Set(["user-4"])],
  ]);

  setBroadcastFunction((workspaceId, message, excludeUserId) => {
    broadcastCalls.push({ workspaceId, message, excludeUserId });
  });

  setMembershipChecker(async (userId, workspaceId) => {
    return membershipMap.get(workspaceId)?.has(userId) ?? false;
  });
});

// ─── Revision tracking ─────────────────────────────────────────────────────

describe("Revision tracking", () => {
  it("returns 0 for unknown entity", () => {
    expect(getRevision("note", "unknown")).toBe(0);
  });

  it("stores and retrieves revision", () => {
    setRevision("note", "note-1", 5, "user-1");
    expect(getRevision("note", "note-1")).toBe(5);
    expect(getLastEditor("note", "note-1")).toBe("user-1");
  });

  it("tracks separate revisions per entity type", () => {
    setRevision("note", "note-1", 3, "user-1");
    setRevision("whiteboard", "note-1", 7, "user-2");
    expect(getRevision("note", "note-1")).toBe(3);
    expect(getRevision("whiteboard", "note-1")).toBe(7);
  });

  it("cleanupEntity removes all data", () => {
    setRevision("note", "note-1", 10, "user-1");
    cleanupEntity("note", "note-1");
    expect(getRevision("note", "note-1")).toBe(0);
    expect(getLastEditor("note", "note-1")).toBeUndefined();
  });
});

// ─── note_update ───────────────────────────────────────────────────────────

describe("note_update", () => {
  const sockets = createSocketMap([
    { userId: "user-1", sockets: [{ workspaceIds: ["ws-1"] }] },
    { userId: "user-2", sockets: [{ workspaceIds: ["ws-1"] }] },
  ]);

  it("broadcasts to workspace excluding sender", async () => {
    const result = await handleCollaborationMessage(
      "user-1",
      { type: "note_update", workspaceId: "ws-1", noteId: "note-1", title: "Test", content: "Body", revision: 0 },
      () => {},
      sockets as any,
    );

    expect(result).toBe(true);
    expect(broadcastCalls.length).toBe(1);
    expect(broadcastCalls[0].workspaceId).toBe("ws-1");
    expect(broadcastCalls[0].excludeUserId).toBe("user-1");
    const msg = broadcastCalls[0].message as Record<string, unknown>;
    expect(msg.type).toBe("note_updated");
    expect(msg.noteId).toBe("note-1");
    expect(msg.title).toBe("Test");
    expect(msg.revision).toBe(1);
    expect(getRevision("note", "note-1")).toBe(1);
  });

  it("rejects stale update and sends conflict", async () => {
    // Set current revision to 5
    setRevision("note", "note-1", 5, "user-2");

    const sentMessages: object[] = [];
    const senderSocket = createMockSocket("user-1", ["ws-1"]);
    const senderSockets = new Set([senderSocket]);
    const testSockets = new Map([["user-1", senderSockets]]);

    const result = await handleCollaborationMessage(
      "user-1",
      { type: "note_update", workspaceId: "ws-1", noteId: "note-1", title: "Stale", content: "Old", revision: 3 },
      (ws: any, data) => { ws.sent.push(data); },
      testSockets as any,
    );

    expect(result).toBe(true);
    expect(broadcastCalls.length).toBe(0); // rejected, no broadcast
    expect(getRevision("note", "note-1")).toBe(5); // unchanged

    // Sender should receive conflict
    const conflicts = senderSocket.sent.filter((m: any) => m.type === "revision_conflict");
    expect(conflicts.length).toBe(1);
    expect((conflicts[0] as any).serverRevision).toBe(5);
  });

  it("accepts update with equal revision (no conflict)", async () => {
    setRevision("note", "note-1", 3, "user-2");

    const result = await handleCollaborationMessage(
      "user-1",
      { type: "note_update", workspaceId: "ws-1", noteId: "note-1", title: "Sync", content: "Data", revision: 3 },
      () => {},
      sockets as any,
    );

    expect(result).toBe(true);
    expect(broadcastCalls.length).toBe(1);
    expect(getRevision("note", "note-1")).toBe(4);
  });

  it("rejects unauthorized user", async () => {
    const result = await handleCollaborationMessage(
      "user-unauth",
      { type: "note_update", workspaceId: "ws-1", noteId: "note-1", title: "X", content: "Y", revision: 0 },
      () => {},
      sockets as any,
    );

    expect(result).toBe(false);
    expect(broadcastCalls.length).toBe(0);
  });

  it("rejects user not in workspace", async () => {
    const result = await handleCollaborationMessage(
      "user-4", // user-4 is in ws-2, not ws-1
      { type: "note_update", workspaceId: "ws-1", noteId: "note-1", title: "X", content: "Y", revision: 0 },
      () => {},
      sockets as any,
    );

    expect(result).toBe(false);
  });
});

// ─── note_cursor ───────────────────────────────────────────────────────────

describe("note_cursor", () => {
  const sockets = createSocketMap([
    { userId: "user-1", sockets: [{ workspaceIds: ["ws-1"] }] },
    { userId: "user-2", sockets: [{ workspaceIds: ["ws-1"] }] },
  ]);

  it("broadcasts cursor to workspace excluding sender", async () => {
    const result = await handleCollaborationMessage(
      "user-1",
      { type: "note_cursor", workspaceId: "ws-1", noteId: "note-1", cursor: { line: 5, col: 10 } },
      () => {},
      sockets as any,
    );

    expect(result).toBe(true);
    expect(broadcastCalls.length).toBe(1);
    expect(broadcastCalls[0].excludeUserId).toBe("user-1");
    const msg = broadcastCalls[0].message as Record<string, unknown>;
    expect(msg.type).toBe("note_cursor");
    expect(msg.cursor).toEqual({ line: 5, col: 10 });
    expect(msg.userId).toBe("user-1");
  });

  it("rejects unauthorized cursor broadcast", async () => {
    const result = await handleCollaborationMessage(
      "user-unauth",
      { type: "note_cursor", workspaceId: "ws-1", noteId: "note-1", cursor: { line: 1, col: 1 } },
      () => {},
      sockets as any,
    );

    expect(result).toBe(false);
    expect(broadcastCalls.length).toBe(0);
  });
});

// ─── whiteboard_stroke ─────────────────────────────────────────────────────

describe("whiteboard_stroke", () => {
  const sockets = createSocketMap([
    { userId: "user-1", sockets: [{ workspaceIds: ["ws-1"] }] },
    { userId: "user-2", sockets: [{ workspaceIds: ["ws-1"] }] },
  ]);

  it("broadcasts stroke to workspace excluding sender", async () => {
    const stroke = [{ type: "start", point: { x: 10, y: 20 } }, { type: "line", from: { x: 10, y: 20 }, to: { x: 50, y: 60 } }];
    const result = await handleCollaborationMessage(
      "user-1",
      { type: "whiteboard_stroke", workspaceId: "ws-1", whiteboardId: "wb-1", stroke, revision: 0 },
      () => {},
      sockets as any,
    );

    expect(result).toBe(true);
    expect(broadcastCalls.length).toBe(1);
    const msg = broadcastCalls[0].message as Record<string, unknown>;
    expect(msg.type).toBe("whiteboard_stroked");
    expect(msg.whiteboardId).toBe("wb-1");
    expect(msg.stroke).toEqual(stroke);
    expect(msg.revision).toBe(1);
    expect(getRevision("whiteboard", "wb-1")).toBe(1);
  });

  it("rejects stale whiteboard stroke", async () => {
    setRevision("whiteboard", "wb-1", 10, "user-2");

    const senderSocket = createMockSocket("user-1", ["ws-1"]);
    const testSockets = new Map([["user-1", new Set([senderSocket])]]);

    const result = await handleCollaborationMessage(
      "user-1",
      { type: "whiteboard_stroke", workspaceId: "ws-1", whiteboardId: "wb-1", stroke: [], revision: 5 },
      (ws: any, data) => { ws.sent.push(data); },
      testSockets as any,
    );

    expect(result).toBe(true);
    expect(broadcastCalls.length).toBe(0);
    expect(getRevision("whiteboard", "wb-1")).toBe(10);

    const conflicts = senderSocket.sent.filter((m: any) => m.type === "revision_conflict");
    expect(conflicts.length).toBe(1);
    expect((conflicts[0] as any).entityType).toBe("whiteboard");
    expect((conflicts[0] as any).serverRevision).toBe(10);
  });
});

// ─── codefile_update ─────────────────────────────────────────────────────

describe("codefile_update", () => {
  const sockets = createSocketMap([
    { userId: "user-1", sockets: [{ workspaceIds: ["ws-1"] }] },
    { userId: "user-2", sockets: [{ workspaceIds: ["ws-1"] }] },
  ]);

  it("broadcasts to workspace excluding sender", async () => {
    const result = await handleCollaborationMessage(
      "user-1",
      { type: "codefile_update", workspaceId: "ws-1", fileId: "cf-1", content: "console.log('hello');", language: "javascript", revision: 0 },
      () => {},
      sockets as any,
    );

    expect(result).toBe(true);
    expect(broadcastCalls.length).toBe(1);
    expect(broadcastCalls[0].workspaceId).toBe("ws-1");
    expect(broadcastCalls[0].excludeUserId).toBe("user-1");
    const msg = broadcastCalls[0].message as Record<string, unknown>;
    expect(msg.type).toBe("codefile_updated");
    expect(msg.fileId).toBe("cf-1");
    expect(msg.content).toBe("console.log('hello');");
    expect(msg.language).toBe("javascript");
    expect(msg.revision).toBe(1);
    expect(getRevision("codefile", "cf-1")).toBe(1);
  });

  it("rejects stale update and sends conflict", async () => {
    setRevision("codefile", "cf-1", 5, "user-2");

    const senderSocket = createMockSocket("user-1", ["ws-1"]);
    const testSockets = new Map([["user-1", new Set([senderSocket])]]);

    const result = await handleCollaborationMessage(
      "user-1",
      { type: "codefile_update", workspaceId: "ws-1", fileId: "cf-1", content: "stale", revision: 3 },
      (ws: any, data) => { ws.sent.push(data); },
      testSockets as any,
    );

    expect(result).toBe(true);
    expect(broadcastCalls.length).toBe(0);
    expect(getRevision("codefile", "cf-1")).toBe(5);

    const conflicts = senderSocket.sent.filter((m: any) => m.type === "revision_conflict");
    expect(conflicts.length).toBe(1);
    expect((conflicts[0] as any).entityType).toBe("codefile");
    expect((conflicts[0] as any).serverRevision).toBe(5);
  });

  it("accepts update with equal revision (no conflict)", async () => {
    setRevision("codefile", "cf-1", 3, "user-2");

    const result = await handleCollaborationMessage(
      "user-1",
      { type: "codefile_update", workspaceId: "ws-1", fileId: "cf-1", content: "updated", language: "typescript", revision: 3 },
      () => {},
      sockets as any,
    );

    expect(result).toBe(true);
    expect(broadcastCalls.length).toBe(1);
    expect(getRevision("codefile", "cf-1")).toBe(4);
  });

  it("rejects unauthorized user", async () => {
    const result = await handleCollaborationMessage(
      "user-unauth",
      { type: "codefile_update", workspaceId: "ws-1", fileId: "cf-1", content: "x", revision: 0 },
      () => {},
      sockets as any,
    );

    expect(result).toBe(false);
    expect(broadcastCalls.length).toBe(0);
  });

  it("rejects user not in workspace", async () => {
    const result = await handleCollaborationMessage(
      "user-4",
      { type: "codefile_update", workspaceId: "ws-1", fileId: "cf-1", content: "x", revision: 0 },
      () => {},
      sockets as any,
    );

    expect(result).toBe(false);
  });

  it("broadcasts language change", async () => {
    const result = await handleCollaborationMessage(
      "user-1",
      { type: "codefile_update", workspaceId: "ws-1", fileId: "cf-1", language: "python", revision: 0 },
      () => {},
      sockets as any,
    );

    expect(result).toBe(true);
    const msg = broadcastCalls[0].message as Record<string, unknown>;
    expect(msg.language).toBe("python");
  });

  it("tracks last editor per codefile", async () => {
    await handleCollaborationMessage(
      "user-1",
      { type: "codefile_update", workspaceId: "ws-1", fileId: "cf-1", content: "first", revision: 0 },
      () => {},
      sockets as any,
    );

    expect(getLastEditor("codefile", "cf-1")).toBe("user-1");

    await handleCollaborationMessage(
      "user-2",
      { type: "codefile_update", workspaceId: "ws-1", fileId: "cf-1", content: "second", revision: 1 },
      () => {},
      sockets as any,
    );

    expect(getLastEditor("codefile", "cf-1")).toBe("user-2");
  });

  it("multi-tab conflict goes to all sender sockets", async () => {
    setRevision("codefile", "cf-1", 5, "user-2");

    const ws1 = createMockSocket("user-1", ["ws-1"]);
    const ws2 = createMockSocket("user-1", ["ws-1"]);
    const testSockets = new Map([["user-1", new Set([ws1, ws2])]]);

    await handleCollaborationMessage(
      "user-1",
      { type: "codefile_update", workspaceId: "ws-1", fileId: "cf-1", content: "x", revision: 2 },
      (ws: any, data) => { ws.sent.push(data); },
      testSockets as any,
    );

    expect(ws1.sent.filter((m: any) => m.type === "revision_conflict").length).toBe(1);
    expect(ws2.sent.filter((m: any) => m.type === "revision_conflict").length).toBe(1);
  });
});

// ─── Unknown message types ─────────────────────────────────────────────────

describe("Unknown message types", () => {
  it("returns false for non-collaboration message", async () => {
    const result = await handleCollaborationMessage(
      "user-1",
      { type: "unknown_type", workspaceId: "ws-1", noteId: "x", revision: 0 } as any,
      () => {},
      new Map() as any,
    );

    expect(result).toBe(false);
  });
});

// ─── Multi-tab sender ─────────────────────────────────────────────────────

describe("Multi-tab sender", () => {
  it("sends conflict to all sender sockets", async () => {
    setRevision("note", "note-1", 5, "user-2");

    const ws1 = createMockSocket("user-1", ["ws-1"]);
    const ws2 = createMockSocket("user-1", ["ws-1"]);
    const senderSockets = new Set([ws1, ws2]);
    const testSockets = new Map([["user-1", senderSockets]]);

    await handleCollaborationMessage(
      "user-1",
      { type: "note_update", workspaceId: "ws-1", noteId: "note-1", title: "X", content: "Y", revision: 2 },
      (ws: any, data) => { ws.sent.push(data); },
      testSockets as any,
    );

    const conflicts1 = ws1.sent.filter((m: any) => m.type === "revision_conflict");
    const conflicts2 = ws2.sent.filter((m: any) => m.type === "revision_conflict");
    expect(conflicts1.length).toBe(1);
    expect(conflicts2.length).toBe(1);
  });
});

// ─── Revision increment model ──────────────────────────────────────────────

describe("Revision increment model", () => {
  it("starts revision at 0 for new codefile", () => {
    expect(getRevision("codefile", "cf-new")).toBe(0);
  });

  it("increments revision sequentially across multiple updates", async () => {
    const sockets = createSocketMap([
      { userId: "user-1", sockets: [{ workspaceIds: ["ws-1"] }] },
      { userId: "user-2", sockets: [{ workspaceIds: ["ws-1"] }] },
    ]);

    await handleCollaborationMessage(
      "user-1",
      { type: "codefile_update", workspaceId: "ws-1", fileId: "cf-seq", content: "first", revision: 0 },
      () => {},
      sockets as any,
    );
    expect(getRevision("codefile", "cf-seq")).toBe(1);

    await handleCollaborationMessage(
      "user-2",
      { type: "codefile_update", workspaceId: "ws-1", fileId: "cf-seq", content: "second", revision: 1 },
      () => {},
      sockets as any,
    );
    expect(getRevision("codefile", "cf-seq")).toBe(2);

    await handleCollaborationMessage(
      "user-1",
      { type: "codefile_update", workspaceId: "ws-1", fileId: "cf-seq", content: "third", revision: 2 },
      () => {},
      sockets as any,
    );
    expect(getRevision("codefile", "cf-seq")).toBe(3);
  });

  it("increments revision sequentially across multiple note updates", async () => {
    const sockets = createSocketMap([
      { userId: "user-1", sockets: [{ workspaceIds: ["ws-1"] }] },
    ]);

    await handleCollaborationMessage(
      "user-1",
      { type: "note_update", workspaceId: "ws-1", noteId: "note-seq", title: "A", content: "1", revision: 0 },
      () => {},
      sockets as any,
    );
    expect(getRevision("note", "note-seq")).toBe(1);

    await handleCollaborationMessage(
      "user-1",
      { type: "note_update", workspaceId: "ws-1", noteId: "note-seq", title: "B", content: "2", revision: 1 },
      () => {},
      sockets as any,
    );
    expect(getRevision("note", "note-seq")).toBe(2);
  });

  it("broadcast message contains the incremented revision", async () => {
    const sockets = createSocketMap([
      { userId: "user-1", sockets: [{ workspaceIds: ["ws-1"] }] },
    ]);

    await handleCollaborationMessage(
      "user-1",
      { type: "codefile_update", workspaceId: "ws-1", fileId: "cf-rev", content: "x", revision: 0 },
      () => {},
      sockets as any,
    );

    const msg = broadcastCalls[0].message as Record<string, unknown>;
    expect(msg.revision).toBe(1);

    await handleCollaborationMessage(
      "user-1",
      { type: "codefile_update", workspaceId: "ws-1", fileId: "cf-rev", content: "y", revision: 1 },
      () => {},
      sockets as any,
    );

    const msg2 = broadcastCalls[1].message as Record<string, unknown>;
    expect(msg2.revision).toBe(2);
  });

  it("rejected update does not change revision", async () => {
    setRevision("codefile", "cf-frozen", 10, "user-2");

    const senderSocket = createMockSocket("user-1", ["ws-1"]);
    const testSockets = new Map([["user-1", new Set([senderSocket])]]);

    await handleCollaborationMessage(
      "user-1",
      { type: "codefile_update", workspaceId: "ws-1", fileId: "cf-frozen", content: "stale", revision: 3 },
      (ws: any, data) => { ws.sent.push(data); },
      testSockets as any,
    );

    expect(getRevision("codefile", "cf-frozen")).toBe(10);
  });

  it("conflict message carries correct serverRevision", async () => {
    setRevision("codefile", "cf-conflict", 7, "user-2");

    const senderSocket = createMockSocket("user-1", ["ws-1"]);
    const testSockets = new Map([["user-1", new Set([senderSocket])]]);

    await handleCollaborationMessage(
      "user-1",
      { type: "codefile_update", workspaceId: "ws-1", fileId: "cf-conflict", content: "old", revision: 2 },
      (ws: any, data) => { ws.sent.push(data); },
      testSockets as any,
    );

    const conflict = senderSocket.sent.find((m: any) => m.type === "revision_conflict") as any;
    expect(conflict).toBeDefined();
    expect(conflict.serverRevision).toBe(7);
    expect(conflict.entityType).toBe("codefile");
    expect(conflict.entityId).toBe("cf-conflict");
  });
});

// ─── Remote content application ────────────────────────────────────────────

describe("Remote content application", () => {
  it("broadcasts content to workspace members", async () => {
    const sockets = createSocketMap([
      { userId: "user-1", sockets: [{ workspaceIds: ["ws-1"] }] },
      { userId: "user-2", sockets: [{ workspaceIds: ["ws-1"] }] },
    ]);

    await handleCollaborationMessage(
      "user-1",
      { type: "codefile_update", workspaceId: "ws-1", fileId: "cf-content", content: "function hello() {}", language: "javascript", revision: 0 },
      () => {},
      sockets as any,
    );

    const msg = broadcastCalls[0].message as Record<string, unknown>;
    expect(msg.type).toBe("codefile_updated");
    expect(msg.content).toBe("function hello() {}");
    expect(msg.language).toBe("javascript");
    expect(msg.fileId).toBe("cf-content");
    expect(msg.workspaceId).toBe("ws-1");
  });

  it("broadcasts content updates from user-2 to user-1", async () => {
    const sockets = createSocketMap([
      { userId: "user-1", sockets: [{ workspaceIds: ["ws-1"] }] },
      { userId: "user-2", sockets: [{ workspaceIds: ["ws-1"] }] },
    ]);

    // user-1 creates file at rev 0
    await handleCollaborationMessage(
      "user-1",
      { type: "codefile_update", workspaceId: "ws-1", fileId: "cf-remote", content: "initial", revision: 0 },
      () => {},
      sockets as any,
    );

    // user-2 updates at rev 1
    await handleCollaborationMessage(
      "user-2",
      { type: "codefile_update", workspaceId: "ws-1", fileId: "cf-remote", content: "updated by user-2", revision: 1 },
      () => {},
      sockets as any,
    );

    expect(broadcastCalls.length).toBe(2);
    const msg2 = broadcastCalls[1].message as Record<string, unknown>;
    expect(msg2.content).toBe("updated by user-2");
    expect(msg2.revision).toBe(2);
    expect(msg2.userId).toBe("user-2");
    expect(broadcastCalls[1].excludeUserId).toBe("user-2");
  });

  it("does not broadcast to the sender (sender excluded)", async () => {
    const sockets = createSocketMap([
      { userId: "user-1", sockets: [{ workspaceIds: ["ws-1"] }] },
    ]);

    await handleCollaborationMessage(
      "user-1",
      { type: "codefile_update", workspaceId: "ws-1", fileId: "cf-excl", content: "solo", revision: 0 },
      () => {},
      sockets as any,
    );

    expect(broadcastCalls[0].excludeUserId).toBe("user-1");
  });

  it("concurrent edits at same revision: first succeeds, second rejected", async () => {
    const sockets = createSocketMap([
      { userId: "user-1", sockets: [{ workspaceIds: ["ws-1"] }] },
      { userId: "user-2", sockets: [{ workspaceIds: ["ws-1"] }] },
    ]);

    // user-1 sends first at rev 0 — accepted
    await handleCollaborationMessage(
      "user-1",
      { type: "codefile_update", workspaceId: "ws-1", fileId: "cf-concurrent", content: "user1 edit", revision: 0 },
      () => {},
      sockets as any,
    );
    expect(getRevision("codefile", "cf-concurrent")).toBe(1);

    // user-2 also sends at rev 0 — rejected because server is now at rev 1
    const senderSocket = createMockSocket("user-2", ["ws-1"]);
    const testSockets = new Map([["user-2", new Set([senderSocket])]]);

    await handleCollaborationMessage(
      "user-2",
      { type: "codefile_update", workspaceId: "ws-1", fileId: "cf-concurrent", content: "user2 edit", revision: 0 },
      (ws: any, data) => { ws.sent.push(data); },
      testSockets as any,
    );
    expect(getRevision("codefile", "cf-concurrent")).toBe(1);
    const conflict = senderSocket.sent.find((m: any) => m.type === "revision_conflict") as any;
    expect(conflict).toBeDefined();
    expect(conflict.serverRevision).toBe(1);

    // user-2 resyncs and resends at rev 1 — accepted
    await handleCollaborationMessage(
      "user-2",
      { type: "codefile_update", workspaceId: "ws-1", fileId: "cf-concurrent", content: "user2 edit resynced", revision: 1 },
      () => {},
      sockets as any,
    );
    expect(getRevision("codefile", "cf-concurrent")).toBe(2);
    expect(broadcastCalls.length).toBe(2);
  });

  it("rejected content is not broadcast", async () => {
    setRevision("codefile", "cf-reject", 5, "user-2");
    const sockets = createSocketMap([
      { userId: "user-1", sockets: [{ workspaceIds: ["ws-1"] }] },
    ]);

    await handleCollaborationMessage(
      "user-1",
      { type: "codefile_update", workspaceId: "ws-1", fileId: "cf-reject", content: "stale", revision: 2 },
      () => {},
      sockets as any,
    );

    expect(broadcastCalls.length).toBe(0);
  });

  it("language-only update broadcasts language", async () => {
    const sockets = createSocketMap([
      { userId: "user-1", sockets: [{ workspaceIds: ["ws-1"] }] },
    ]);

    await handleCollaborationMessage(
      "user-1",
      { type: "codefile_update", workspaceId: "ws-1", fileId: "cf-lang", language: "python", revision: 0 },
      () => {},
      sockets as any,
    );

    const msg = broadcastCalls[0].message as Record<string, unknown>;
    expect(msg.language).toBe("python");
    expect(msg.type).toBe("codefile_updated");
  });
});

// ─── Conflict flow ─────────────────────────────────────────────────────────

describe("Conflict flow", () => {
  it("stale sender receives conflict and can resync revision", async () => {
    setRevision("codefile", "cf-flow", 5, "user-2");

    const senderSocket = createMockSocket("user-1", ["ws-1"]);
    const testSockets = new Map([["user-1", new Set([senderSocket])]]);

    // User-1 sends stale update
    await handleCollaborationMessage(
      "user-1",
      { type: "codefile_update", workspaceId: "ws-1", fileId: "cf-flow", content: "old", revision: 2 },
      (ws: any, data) => { ws.sent.push(data); },
      testSockets as any,
    );

    // Verify conflict sent
    const conflict = senderSocket.sent.find((m: any) => m.type === "revision_conflict") as any;
    expect(conflict).toBeDefined();
    expect(conflict.serverRevision).toBe(5);

    // User-1 resyncs: now at revision 5, sends again — should succeed
    await handleCollaborationMessage(
      "user-1",
      { type: "codefile_update", workspaceId: "ws-1", fileId: "cf-flow", content: "resynced", revision: 5 },
      () => {},
      createSocketMap([
        { userId: "user-1", sockets: [{ workspaceIds: ["ws-1"] }] },
      ]) as any,
    );

    expect(getRevision("codefile", "cf-flow")).toBe(6);
    expect(broadcastCalls.length).toBe(1);
    const msg = broadcastCalls[0].message as Record<string, unknown>;
    expect(msg.content).toBe("resynced");
    expect(msg.revision).toBe(6);
  });

  it("multiple conflicts in sequence all carry correct server revision", async () => {
    setRevision("codefile", "cf-multi", 3, "user-2");

    const senderSocket = createMockSocket("user-1", ["ws-1"]);
    const testSockets = new Map([["user-1", new Set([senderSocket])]]);

    await handleCollaborationMessage(
      "user-1",
      { type: "codefile_update", workspaceId: "ws-1", fileId: "cf-multi", content: "a", revision: 1 },
      (ws: any, data) => { ws.sent.push(data); },
      testSockets as any,
    );

    await handleCollaborationMessage(
      "user-1",
      { type: "codefile_update", workspaceId: "ws-1", fileId: "cf-multi", content: "b", revision: 2 },
      (ws: any, data) => { ws.sent.push(data); },
      testSockets as any,
    );

    const conflicts = senderSocket.sent.filter((m: any) => m.type === "revision_conflict");
    expect(conflicts.length).toBe(2);
    expect((conflicts[0] as any).serverRevision).toBe(3);
    expect((conflicts[1] as any).serverRevision).toBe(3);
  });

  it("conflict carries entityType and entityId for codefile", async () => {
    setRevision("codefile", "cf-id", 2, "user-2");

    const senderSocket = createMockSocket("user-1", ["ws-1"]);
    const testSockets = new Map([["user-1", new Set([senderSocket])]]);

    await handleCollaborationMessage(
      "user-1",
      { type: "codefile_update", workspaceId: "ws-1", fileId: "cf-id", content: "x", revision: 0 },
      (ws: any, data) => { ws.sent.push(data); },
      testSockets as any,
    );

    const conflict = senderSocket.sent.find((m: any) => m.type === "revision_conflict") as any;
    expect(conflict.entityType).toBe("codefile");
    expect(conflict.entityId).toBe("cf-id");
  });

  it("conflict carries entityType and entityId for note", async () => {
    setRevision("note", "note-cf", 4, "user-2");

    const senderSocket = createMockSocket("user-1", ["ws-1"]);
    const testSockets = new Map([["user-1", new Set([senderSocket])]]);

    await handleCollaborationMessage(
      "user-1",
      { type: "note_update", workspaceId: "ws-1", noteId: "note-cf", title: "X", content: "Y", revision: 1 },
      (ws: any, data) => { ws.sent.push(data); },
      testSockets as any,
    );

    const conflict = senderSocket.sent.find((m: any) => m.type === "revision_conflict") as any;
    expect(conflict.entityType).toBe("note");
    expect(conflict.entityId).toBe("note-cf");
    expect(conflict.serverRevision).toBe(4);
  });
});
