import { useState, useRef, useEffect, useCallback } from 'react';
import { apiRequest } from '../../shared/utils/api';
import { useWhiteboards } from '../../shared/utils/useWhiteboardsApi';
import { useWebSocket } from '../../shared/utils/useWebSocket';
import { useWhiteboardCollaboration } from '../../shared/utils/useWhiteboardCollaboration';
import Toolbar from './components/Toolbar';
import CanvasBoard from './components/CanvasBoard';
import styles from './Whiteboard.module.css';

export default function Whiteboard() {
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceId, setWorkspaceId] = useState(null);
  const [whiteboards, setWhiteboards] = useState([]);
  const [activeWhiteboardId, setActiveWhiteboardId] = useState(null);
  const [activeWhiteboard, setActiveWhiteboard] = useState(null);
  const [initialContent, setInitialContent] = useState(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const [tool, setTool] = useState('brush');
  const [color, setColor] = useState('#111827');
  const [brushSize, setBrushSize] = useState(6);
  const [showGrid, setShowGrid] = useState(false);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
  const [isSaving, setIsSaving] = useState(false);

  const canvasApiRef = useRef(null);
  const autoSaveTimerRef = useRef(null);

  // WebSocket for collaboration
  const { connected, send, on } = useWebSocket();

  const {
    broadcastStroke,
    onRemoteStroke,
    onRevisionConflict,
    initRevision,
  } = useWhiteboardCollaboration({ workspaceId, send, on, connected });

  const {
    fetchWhiteboards,
    createWhiteboard,
    fetchWhiteboard,
    updateWhiteboard,
    deleteWhiteboard,
  } = useWhiteboards(workspaceId);

  // Load workspaces
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await apiRequest('/api/v1/workspaces');
        if (!cancelled) {
          setWorkspaces(result.workspaces);
          if (result.workspaces.length > 0) setWorkspaceId(result.workspaces[0].id);
          setInitialLoadDone(true);
        }
      } catch {
        if (!cancelled) setInitialLoadDone(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Load whiteboards when workspace changes
  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    async function load() {
      const result = await apiRequest(`/api/v1/workspaces/${workspaceId}/whiteboards`);
      if (!cancelled) {
        setWhiteboards(result.whiteboards);
        setActiveWhiteboardId(null);
        setActiveWhiteboard(null);
        setInitialContent(null);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [workspaceId]);

  // Load whiteboard content when selection changes
  useEffect(() => {
    if (!activeWhiteboardId) {
      setActiveWhiteboard(null);
      setInitialContent(null);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const result = await apiRequest(
          `/api/v1/workspaces/${workspaceId}/whiteboards/${activeWhiteboardId}`,
        );
        if (!cancelled) {
          setActiveWhiteboard(result.whiteboard);
          setInitialContent(result.whiteboard.content || '{}');
          // Initialize revision at 0 (backend's initial state)
          initRevision(activeWhiteboardId, 0);
        }
      } catch {
        // handle error
      }
    }
    load();
    return () => { cancelled = true; };
  }, [activeWhiteboardId, workspaceId, initRevision]);

  // Listen for remote strokes from other users
  useEffect(() => {
    if (!connected) return;
    const unsub = onRemoteStroke((msg) => {
      if (msg.whiteboardId === activeWhiteboardId && canvasApiRef.current) {
        // Apply remote stroke to canvas
        canvasApiRef.current.applyRemoteStroke?.(msg.stroke);
      }
    });
    return unsub;
  }, [connected, onRemoteStroke, activeWhiteboardId]);

  // Auto-save on changes (debounced 2s)
  const scheduleAutoSave = useCallback(() => {
    if (!activeWhiteboardId || !canvasApiRef.current) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        const content = canvasApiRef.current.getContent();
        await updateWhiteboard(activeWhiteboardId, { content });
      } finally {
        setIsSaving(false);
      }
    }, 2000);
  }, [activeWhiteboardId, updateWhiteboard]);

  // Broadcast stroke when drawing
  const handleStrokeComplete = useCallback((stroke) => {
    if (!activeWhiteboardId || !connected) return;
    broadcastStroke(activeWhiteboardId, stroke);
    scheduleAutoSave();
  }, [activeWhiteboardId, connected, broadcastStroke, scheduleAutoSave]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e) {
      const isTypingInField = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
      if (isTypingInField) return;
      const ctrlOrCmd = e.ctrlKey || e.metaKey;

      if (ctrlOrCmd && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleManualSave();
      } else if (ctrlOrCmd && e.key.toLowerCase() === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      } else if (ctrlOrCmd && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (e.key.toLowerCase() === 'b') {
        setTool('brush');
      } else if (e.key.toLowerCase() === 'e') {
        setTool('eraser');
      } else if (e.key === '[') {
        setBrushSize((s) => Math.max(1, s - 2));
      } else if (e.key === ']') {
        setBrushSize((s) => Math.min(40, s + 2));
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeWhiteboardId]);

  const handleUndo = useCallback(() => canvasApiRef.current?.undo(), []);
  const handleRedo = useCallback(() => canvasApiRef.current?.redo(), []);

  const handleClear = useCallback(() => {
    if (window.confirm('Clear the whole canvas? This cannot be undone once you draw again.')) {
      canvasApiRef.current?.clear();
      scheduleAutoSave();
    }
  }, [scheduleAutoSave]);

  const handleDownload = useCallback(() => canvasApiRef.current?.download(), []);

  const handleManualSave = useCallback(async () => {
    if (!activeWhiteboardId || !canvasApiRef.current) return;
    setIsSaving(true);
    try {
      const content = canvasApiRef.current.getContent();
      await updateWhiteboard(activeWhiteboardId, { content });
    } finally {
      setIsSaving(false);
    }
  }, [activeWhiteboardId, updateWhiteboard]);

  const handleCreate = useCallback(async () => {
    const name = prompt('Whiteboard name:', 'Untitled');
    if (name === null) return;
    try {
      const wb = await createWhiteboard({ name: name || 'Untitled', content: '{}' });
      setActiveWhiteboardId(wb.id);
    } catch {
      // handled by hook
    }
  }, [createWhiteboard]);

  const handleSelect = useCallback((id) => {
    setActiveWhiteboardId(id);
  }, []);

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm('Delete this whiteboard?')) return;
    try {
      await deleteWhiteboard(id);
      setActiveWhiteboardId((current) => (current === id ? null : current));
    } catch {
      // handled by hook
    }
  }, [deleteWhiteboard]);

  if (!initialLoadDone) {
    return (
      <div className={styles.page}>
        <div className={styles.hint}>Loading...</div>
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.hint}>Create a workspace first to use whiteboards.</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.sidebar}>
        {workspaces.length > 1 && (
          <select
            className={styles.select}
            value={workspaceId ?? ''}
            onChange={(e) => { setWorkspaceId(e.target.value); setActiveWhiteboardId(null); }}
          >
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>{ws.name}</option>
            ))}
          </select>
        )}
        <button className={styles.newBtn} onClick={handleCreate} disabled={!workspaceId}>
          + New Board
        </button>
        <ul className={styles.boardList}>
          {whiteboards.map((wb) => (
            <li
              key={wb.id}
              className={`${styles.boardItem} ${wb.id === activeWhiteboardId ? styles.boardItemActive : ''}`}
              onClick={() => handleSelect(wb.id)}
            >
              <span className={styles.boardName}>{wb.name}</span>
              <button
                className={styles.deleteBtn}
                onClick={(e) => { e.stopPropagation(); handleDelete(wb.id); }}
                title="Delete"
              >
                🗑
              </button>
            </li>
          ))}
          {whiteboards.length === 0 && (
            <li className={styles.emptyMsg}>No boards yet</li>
          )}
        </ul>
      </div>

      <div className={styles.main}>
        {activeWhiteboardId ? (
          <>
            <Toolbar
              tool={tool} setTool={setTool}
              color={color} setColor={setColor}
              brushSize={brushSize} setBrushSize={setBrushSize}
              showGrid={showGrid} setShowGrid={setShowGrid}
              onUndo={handleUndo} onRedo={handleRedo}
              canUndo={historyState.canUndo} canRedo={historyState.canRedo}
              onClear={handleClear} onDownload={handleDownload}
            />
            <div className={styles.canvasArea}>
              <CanvasBoard
                ref={canvasApiRef}
                tool={tool}
                color={color}
                brushSize={brushSize}
                showGrid={showGrid}
                onHistoryChange={setHistoryState}
                initialContent={initialContent}
                onStrokeComplete={handleStrokeComplete}
                key={activeWhiteboardId}
              />
            </div>
            <div className={styles.statusBar}>
              <span>{activeWhiteboard?.name}</span>
              {isSaving && <span className={styles.saving}>Saving...</span>}
              {connected && <span className={styles.collabIndicator}>● Live</span>}
              <span className={styles.shortcuts}>
                <kbd>B</kbd> brush · <kbd>E</kbd> eraser · <kbd>Ctrl+S</kbd> save
              </span>
            </div>
          </>
        ) : (
          <div className={styles.hint}>
            Select a whiteboard or create a new one.
          </div>
        )}
      </div>
    </div>
  );
}
