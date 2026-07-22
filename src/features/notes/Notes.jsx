import { useState, useMemo, useCallback } from 'react';
import { useLocalStorageState } from '../../shared/utils/useLocalStorageState';
import { STORAGE_KEYS } from '../../shared/utils/localStorage';
import SearchBar from './components/SearchBar';
import NoteList from './components/NoteList';
import NoteEditor from './components/NoteEditor';
import styles from './Notes.module.css';

function createEmptyNote() {
  return {
    id: crypto.randomUUID(),
    title: '',
    content: '',
    updatedAt: new Date().toISOString(),
  };
}

export default function Notes() {
  const [notes, setNotes] = useLocalStorageState(STORAGE_KEYS.NOTES, []);
  const [activeId, setActiveId] = useState(notes[0]?.id ?? null);
  const [query, setQuery] = useState('');

  // useMemo: avoids re-filtering the full notes array on every unrelated
  // re-render (e.g. Monaco firing onChange for the active note updates
  // `notes` state, which would otherwise re-run this filter every keystroke).
  const filteredNotes = useMemo(() => {
    if (!query.trim()) return notes;
    const q = query.toLowerCase();
    return notes.filter(
      (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    );
  }, [notes, query]);

  const activeNote = notes.find((n) => n.id === activeId) ?? null;

  // useCallback: passed down to NoteList -> NoteCard as onSelect/onDelete.
  // Stabilizes identity so NoteCard (a list item, re-rendered often) does
  // not re-render purely because the parent function reference changed.
  const handleCreate = useCallback(() => {
    const note = createEmptyNote();
    setNotes((prev) => [note, ...prev]);
    setActiveId(note.id);
  }, [setNotes]);

  const handleSelect = useCallback((id) => setActiveId(id), []);

  const handleDelete = useCallback(
    (id) => {
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setActiveId((current) => (current === id ? null : current));
    },
    [setNotes]
  );

  const handleUpdate = useCallback(
    (updatedNote) => {
      setNotes((prev) => prev.map((n) => (n.id === updatedNote.id ? updatedNote : n)));
    },
    [setNotes]
  );

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <button className={styles.newBtn} onClick={handleCreate}>
          + New Note
        </button>
        <SearchBar value={query} onChange={setQuery} />
        <NoteList
          notes={filteredNotes}
          activeId={activeId}
          onSelect={handleSelect}
          onDelete={handleDelete}
        />
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
