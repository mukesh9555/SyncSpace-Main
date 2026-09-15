import { WebSocket } from "ws";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CollaborationMessage {
  type: string;
  workspaceId: string;
  entityId: string;
  [key: string]: unknown;
}

// ─── In-memory revision tracking ────────────────────────────────────────────
// entityType:entityId -> revision number
const revisionMap = new Map<string, number>();
// entityType:entityId -> userId (last editor)
const lastEditorMap = new Map<string, string>();

function revKey(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`;
}

export function getRevision(entityType: string, entityId: string): number {
  return revisionMap.get(revKey(entityType, entityId)) ?? 0;
}

export function setRevision(
  entityType: string,
  entityId: string,
  revision: number,
  userId: string,
): void {
  const key = revKey(entityType, entityId);
  revisionMap.set(key, revision);
  lastEditorMap.set(key, userId);
}

export function getLastEditor(
  entityType: string,
  entityId: string,
): string | undefined {
  return lastEditorMap.get(revKey(entityType, entityId));
}

// ─── Workspace-scoped broadcast ─────────────────────────────────────────────

type BroadcastFn = (
  workspaceId: string,
  message: object,
  excludeUserId?: string,
) => void;

let broadcastFn: BroadcastFn | null = null;

export function setBroadcastFunction(fn: BroadcastFn): void {
  broadcastFn = fn;
}

function broadcast(
  workspaceId: string,
  message: object,
  excludeUserId?: string,
): void {
  if (broadcastFn) broadcastFn(workspaceId, message, excludeUserId);
}

// ─── Authorization helper ───────────────────────────────────────────────────

type MembershipChecker = (
  userId: string,
  workspaceId: string,
) => Promise<boolean>;

let membershipCheckerFn: MembershipChecker | null = null;

export function setMembershipChecker(fn: MembershipChecker): void {
  membershipCheckerFn = fn;
}

async function isMember(
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  if (membershipCheckerFn) return membershipCheckerFn(userId, workspaceId);
  return false;
}

// ─── Message handlers ───────────────────────────────────────────────────────

// Notes collaboration
export interface NoteUpdateMessage {
  type: "note_update";
  workspaceId: string;
  noteId: string;
  title?: string;
  content?: string;
  revision: number;
}

export interface NoteCursorMessage {
  type: "note_cursor";
  workspaceId: string;
  noteId: string;
  cursor: { line: number; col: number };
}

// Whiteboard collaboration
export interface WhiteboardStrokeMessage {
  type: "whiteboard_stroke";
  workspaceId: string;
  whiteboardId: string;
  stroke: unknown;
  revision: number;
}

// CodeFile collaboration
export interface CodeFileUpdateMessage {
  type: "codefile_update";
  workspaceId: string;
  fileId: string;
  content?: string;
  language?: string;
  revision: number;
}

export type CollaborationClientMessage =
  | NoteUpdateMessage
  | NoteCursorMessage
  | WhiteboardStrokeMessage
  | CodeFileUpdateMessage;

// ─── Handle incoming collaboration messages ──────────────────────────────────

export async function handleCollaborationMessage(
  userId: string,
  msg: CollaborationClientMessage,
  sendToUser: (ws: WebSocket, data: object) => void,
  sockets: Map<string, Set<WebSocket & { userId: string; workspaceIds: Set<string> }>>,
): Promise<boolean> {
  // Authorize: user must be a member of the workspace
  const authorized = await isMember(userId, msg.workspaceId);
  if (!authorized) {
    return false;
  }

  switch (msg.type) {
    case "note_update": {
      const { workspaceId, noteId, title, content, revision } = msg;
      const currentRev = getRevision("note", noteId);

      // Revision check: reject stale updates
      if (revision < currentRev) {
        // Send conflict back to sender
        const senderSockets = sockets.get(userId);
        if (senderSockets) {
          const conflictMsg = {
            type: "revision_conflict",
            entityType: "note",
            entityId: noteId,
            serverRevision: currentRev,
          };
          for (const ws of senderSockets) {
            if (ws.readyState === WebSocket.OPEN) {
              sendToUser(ws, conflictMsg);
            }
          }
        }
        return true; // handled (rejected)
      }

      // Accept: increment revision
      const newRev = currentRev + 1;
      setRevision("note", noteId, newRev, userId);

      // Broadcast to workspace (excluding sender)
      broadcast(workspaceId, {
        type: "note_updated",
        workspaceId,
        noteId,
        title,
        content,
        revision: newRev,
        userId,
      }, userId);
      return true;
    }

    case "note_cursor": {
      const { workspaceId, noteId, cursor } = msg;
      // Broadcast cursor position to workspace (excluding sender)
      broadcast(workspaceId, {
        type: "note_cursor",
        workspaceId,
        noteId,
        userId,
        cursor,
      }, userId);
      return true;
    }

    case "whiteboard_stroke": {
      const { workspaceId, whiteboardId, stroke, revision } = msg;
      const currentRev = getRevision("whiteboard", whiteboardId);

      // Revision check
      if (revision < currentRev) {
        const senderSockets = sockets.get(userId);
        if (senderSockets) {
          const conflictMsg = {
            type: "revision_conflict",
            entityType: "whiteboard",
            entityId: whiteboardId,
            serverRevision: currentRev,
          };
          for (const ws of senderSockets) {
            if (ws.readyState === WebSocket.OPEN) {
              sendToUser(ws, conflictMsg);
            }
          }
        }
        return true;
      }

      const newRev = currentRev + 1;
      setRevision("whiteboard", whiteboardId, newRev, userId);

      broadcast(workspaceId, {
        type: "whiteboard_stroked",
        workspaceId,
        whiteboardId,
        stroke,
        revision: newRev,
        userId,
      }, userId);
      return true;
    }

    case "codefile_update": {
      const { workspaceId, fileId, content, language, revision } = msg;
      const currentRev = getRevision("codefile", fileId);

      // Revision check: reject stale updates
      if (revision < currentRev) {
        const senderSockets = sockets.get(userId);
        if (senderSockets) {
          const conflictMsg = {
            type: "revision_conflict",
            entityType: "codefile",
            entityId: fileId,
            serverRevision: currentRev,
          };
          for (const ws of senderSockets) {
            if (ws.readyState === WebSocket.OPEN) {
              sendToUser(ws, conflictMsg);
            }
          }
        }
        return true; // handled (rejected)
      }

      // Accept: increment revision
      const newRev = currentRev + 1;
      setRevision("codefile", fileId, newRev, userId);

      // Broadcast to workspace (excluding sender)
      broadcast(workspaceId, {
        type: "codefile_updated",
        workspaceId,
        fileId,
        content,
        language,
        revision: newRev,
        userId,
      }, userId);
      return true;
    }

    default:
      return false; // not a collaboration message
  }
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

export function cleanupEntity(entityType: string, entityId: string): void {
  const key = revKey(entityType, entityId);
  revisionMap.delete(key);
  lastEditorMap.delete(key);
}
