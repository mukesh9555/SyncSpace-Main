import { useEffect, useCallback, useRef } from 'react';

/**
 * useCodeFilesCollaboration
 *
 * Provides real-time code file update broadcasting and receiving via WebSocket.
 * Uses a revision counter per file to detect stale updates.
 *
 * - `broadcastFileUpdate` sends a file change to other workspace members
 * - `onFileUpdated` registers a callback for incoming remote file updates
 * - `onRevisionConflict` handles revision conflicts (server rejected stale update)
 *
 * Persistence is separate: the existing Ctrl+S save continues to
 * write to PostgreSQL. This hook only handles real-time broadcasting.
 */
export function useCodeFilesCollaboration({ workspaceId, send, on, connected }) {
  const revisionMap = useRef(new Map());
  const onRemoteUpdateRef = useRef(null);
  const onConflictRef = useRef(null);

  const getRevision = useCallback((fileId) => {
    return revisionMap.current.get(fileId) ?? 0;
  }, []);

  const setRevision = useCallback((fileId, rev) => {
    revisionMap.current.set(fileId, rev);
  }, []);

  // Send a file update to other workspace members
  const broadcastFileUpdate = useCallback((fileId, { content, language }) => {
    if (!connected || !workspaceId) return;
    const revision = getRevision(fileId);
    send({
      type: 'codefile_update',
      workspaceId,
      fileId,
      content,
      language,
      revision,
    });
  }, [connected, workspaceId, send, getRevision]);

  // Register callback for remote updates
  const onFileUpdated = useCallback((handler) => {
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
      on('codefile_updated', (msg) => {
        if (msg.workspaceId !== workspaceId) return;
        setRevision(msg.fileId, msg.revision);
        onRemoteUpdateRef.current?.(msg);
      }),
      on('revision_conflict', (msg) => {
        if (msg.entityType !== 'codefile') return;
        setRevision(msg.entityId, msg.serverRevision);
        onConflictRef.current?.(msg);
      }),
    ];

    return () => unsubs.forEach((fn) => fn());
  }, [connected, on, workspaceId, setRevision]);

  // Initialize revision from server data
  const initRevision = useCallback((fileId, rev) => {
    setRevision(fileId, rev);
  }, [setRevision]);

  return {
    broadcastFileUpdate,
    onFileUpdated,
    onRevisionConflict,
    getRevision,
    initRevision,
  };
}
