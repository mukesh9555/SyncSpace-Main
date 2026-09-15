import { useEffect, useCallback, useRef } from 'react';

/**
 * useWhiteboardCollaboration
 *
 * Provides real-time whiteboard stroke broadcasting and receiving via WebSocket.
 * Uses a revision counter per whiteboard to detect stale updates.
 *
 * - `broadcastStroke` sends a drawing stroke to other workspace members
 * - `onRemoteStroke` registers a callback for incoming remote strokes
 * - `onRevisionConflict` handles revision conflicts
 *
 * Persistence is separate: the existing auto-save debounce continues to
 * write to PostgreSQL. This hook only handles real-time broadcasting.
 */
export function useWhiteboardCollaboration({ workspaceId, send, on, connected }) {
  const revisionMap = useRef(new Map());
  const onRemoteStrokeRef = useRef(null);
  const onConflictRef = useRef(null);

  const getRevision = useCallback((whiteboardId) => {
    return revisionMap.current.get(whiteboardId) ?? 0;
  }, []);

  const setRevision = useCallback((whiteboardId, rev) => {
    revisionMap.current.set(whiteboardId, rev);
  }, []);

  // Send a stroke to other workspace members
  const broadcastStroke = useCallback((whiteboardId, stroke) => {
    if (!connected || !workspaceId) return;
    const revision = getRevision(whiteboardId);
    send({
      type: 'whiteboard_stroke',
      workspaceId,
      whiteboardId,
      stroke,
      revision,
    });
  }, [connected, workspaceId, send, getRevision]);

  // Register callback for remote strokes
  const onRemoteStroke = useCallback((handler) => {
    onRemoteStrokeRef.current = handler;
  }, []);

  // Register callback for revision conflicts
  const onRevisionConflict = useCallback((handler) => {
    onConflictRef.current = handler;
  }, []);

  // Listen for incoming events
  useEffect(() => {
    if (!connected) return;

    const unsubs = [
      on('whiteboard_stroked', (msg) => {
        if (msg.workspaceId !== workspaceId) return;
        setRevision(msg.whiteboardId, msg.revision);
        onRemoteStrokeRef.current?.(msg);
      }),
      on('revision_conflict', (msg) => {
        if (msg.entityType !== 'whiteboard') return;
        setRevision(msg.entityId, msg.serverRevision);
        onConflictRef.current?.(msg);
      }),
    ];

    return () => unsubs.forEach((fn) => fn());
  }, [connected, on, workspaceId, setRevision]);

  const initRevision = useCallback((whiteboardId, rev) => {
    setRevision(whiteboardId, rev);
  }, [setRevision]);

  return {
    broadcastStroke,
    onRemoteStroke,
    onRevisionConflict,
    getRevision,
    initRevision,
  };
}
