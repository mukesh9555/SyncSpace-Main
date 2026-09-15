import { useEffect, useCallback, useRef } from 'react';

/**
 * useNotesCollaboration
 *
 * Provides real-time note update broadcasting and receiving via WebSocket.
 * Uses a revision counter per note to detect stale updates.
 *
 * - `broadcastNoteUpdate` sends a note change to other workspace members
 * - `onNoteUpdated` registers a callback for incoming remote note updates
 * - `onRevisionConflict` handles revision conflicts (server rejected stale update)
 *
 * Persistence is separate: the existing auto-save debounce continues to
 * write to PostgreSQL. This hook only handles real-time broadcasting.
 */
export function useNotesCollaboration({ workspaceId, send, on, connected }) {
  const revisionMap = useRef(new Map());
  const onRemoteUpdateRef = useRef(null);
  const onConflictRef = useRef(null);

  // Track revision per note
  const getRevision = useCallback((noteId) => {
    return revisionMap.current.get(noteId) ?? 0;
  }, []);

  const setRevision = useCallback((noteId, rev) => {
    revisionMap.current.set(noteId, rev);
  }, []);

  // Send a note update to other workspace members
  const broadcastNoteUpdate = useCallback((noteId, { title, content }) => {
    if (!connected || !workspaceId) return;
    const revision = getRevision(noteId);
    send({
      type: 'note_update',
      workspaceId,
      noteId,
      title,
      content,
      revision,
    });
  }, [connected, workspaceId, send, getRevision]);

  // Send cursor position to other workspace members
  const broadcastNoteCursor = useCallback((noteId, cursor) => {
    if (!connected || !workspaceId) return;
    send({
      type: 'note_cursor',
      workspaceId,
      noteId,
      cursor,
    });
  }, [connected, workspaceId, send]);

  // Register callback for remote updates
  const onNoteUpdated = useCallback((handler) => {
    onRemoteUpdateRef.current = handler;
  }, []);

  // Register callback for revision conflicts
  const onRevisionConflict = useCallback((handler) => {
    onConflictRef.current = handler;
  }, []);

  // Listen for incoming events
  useEffect(() => {
    if (!connected) return;

    const unsubs = [
      on('note_updated', (msg) => {
        if (msg.workspaceId !== workspaceId) return;
        setRevision(msg.noteId, msg.revision);
        onRemoteUpdateRef.current?.(msg);
      }),
      on('revision_conflict', (msg) => {
        if (msg.entityType !== 'note') return;
        setRevision(msg.entityId, msg.serverRevision);
        onConflictRef.current?.(msg);
      }),
    ];

    return () => unsubs.forEach((fn) => fn());
  }, [connected, on, workspaceId, setRevision]);

  // Initialize revision from server data
  const initRevision = useCallback((noteId, rev) => {
    setRevision(noteId, rev);
  }, [setRevision]);

  return {
    broadcastNoteUpdate,
    broadcastNoteCursor,
    onNoteUpdated,
    onRevisionConflict,
    getRevision,
    initRevision,
  };
}
