import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { apiRequest } from '../../shared/utils/api';
import { useNotesApi } from '../../shared/utils/useNotesApi';
import { useWebSocket } from '../../shared/utils/useWebSocket';
import { useNotesCollaboration } from '../../shared/utils/useNotesCollaboration';
import SearchBar from './components/SearchBar';
import NoteList from './components/NoteList';
import NoteEditor from './components/NoteEditor';
import styles from './Notes.module.css';

export default function Notes() {
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceId, setWorkspaceId] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [query, setQuery] = useState('');
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const { notes, loading, error, fetchNotes, createNote, updateNote, deleteNote } =
    useNotesApi(workspaceId);

  // WebSocket for collaboration
  const { connected, send, on } = useWebSocket();

  const {
    broadcastNoteUpdate,
    broadcastNoteCursor,
    onNoteUpdated,
    onRevisionConflict,
    initRevision,
  } = useNotesCollaboration({ workspaceId, send, on, connected });

  // Track revision per note from fetched data — start at 0 (backend's initial state)
  useEffect(() => {
    for (const note of notes) {
      initRevision(note.id, 0);
    }
  }, [notes, initRevision]);

  // Handle remote note updates
  const remoteUpdateHandlerRef = useRef(null);
  useEffect(() => {
    onNoteUpdated((msg) => {
      remoteUpdateHandlerRef.current?.(msg);
    });
  }, [onNoteUpdated]);

  // Fetch workspaces on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await apiRequest('/api/v1/workspaces');
        if (!cancelled) {
          setWorkspaces(result.workspaces);
          if (result.workspaces.length > 0) {
            setWorkspaceId(result.workspaces[0].id);
          }
          setInitialLoadDone(true);
        }
      } catch {
        if (!cancelled) setInitialLoadDone(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Fetch notes when workspace changes
  useEffect(() => {
    if (workspaceId) fetchNotes();
  }, [workspaceId, fetchNotes]);

  // Reset active note when notes change
  useEffect(() => {
    if (activeId && !notes.find((n) => n.id === activeId)) {
      setActiveId(null);
    }
  }, [notes, activeId]);

  const filteredNotes = useMemo(() => {
    if (!query.trim()) return notes;
    const q = query.toLowerCase();
    return notes.filter(
      (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q),
    );
  }, [notes, query]);

  const activeNote = notes.find((n) => n.id === activeId) ?? null;

  const handleCreate = useCallback(async () => {
    try {
      const note = await createNote({ title: '', content: '' });
      setActiveId(note.id);
    } catch {
      // error handled by hook
    }
  }, [createNote]);

  const handleSelect = useCallback((id) => setActiveId(id), []);

  const handleDelete = useCallback(
    async (id) => {
      try {
        await deleteNote(id);
        setActiveId((current) => (current === id ? null : current));
      } catch {
        // error handled by hook
      }
    },
    [deleteNote],
  );

  const handleUpdate = useCallback(
    async (updatedNote) => {
      try {
        await updateNote(updatedNote.id, {
          title: updatedNote.title,
          content: updatedNote.content,
        });
        // Broadcast to other users via WebSocket
        broadcastNoteUpdate(updatedNote.id, {
          title: updatedNote.title,
          content: updatedNote.content,
        });
      } catch {
        // error handled by hook
      }
    },
    [updateNote, broadcastNoteUpdate],
  );

  if (!initialLoadDone) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>Loading...</div>
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <p>Create a workspace first to start taking notes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        {workspaces.length > 1 && (
          <select
            className={styles.workspaceSelect}
            value={workspaceId ?? ''}
            onChange={(e) => {
              setWorkspaceId(e.target.value);
              setActiveId(null);
            }}
          >
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name}
              </option>
            ))}
          </select>
        )}
        <button className={styles.newBtn} onClick={handleCreate} disabled={!workspaceId}>
          + New Note
        </button>
        <SearchBar value={query} onChange={setQuery} />
        {loading ? (
          <p style={{ padding: '1rem', color: '#64748b', fontSize: '0.875rem' }}>Loading notes...</p>
        ) : error ? (
          <p style={{ padding: '1rem', color: '#dc2626', fontSize: '0.875rem' }}>{error}</p>
        ) : (
          <NoteList
            notes={filteredNotes}
            activeId={activeId}
            onSelect={handleSelect}
            onDelete={handleDelete}
          />
        )}
        {connected && (
          <div className={styles.collabStatus}>
            <span className={styles.collabDot} /> Real-time sync active
          </div>
        )}
      </aside>

      <main className={styles.editorPane}>
        {activeNote ? (
          <NoteEditor note={activeNote} onChange={handleUpdate} />
        ) : (
          <div className={styles.emptyState}>
            <p>Select a note or create a new one to get started.</p>
          </div>
        )}
      </main>
    </div>
  );
}
