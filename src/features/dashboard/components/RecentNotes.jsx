import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../../shared/utils/api';
import styles from './RecentNotes.module.css';

export default function RecentNotes() {
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const wsResult = await apiRequest('/api/v1/workspaces');
        const workspaces = wsResult.workspaces;
        if (!workspaces.length || cancelled) return;

        const noteResult = await apiRequest(
          `/api/v1/workspaces/${workspaces[0].id}/notes`,
        );
        if (!cancelled) setNotes(noteResult.notes);
      } catch {
        // silently fail — dashboard still renders
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const recent = [...notes]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 4);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.title}>Recent Notes</h3>
        <Link to="/notes" className={styles.viewAll}>View all</Link>
      </div>
      {recent.length === 0 ? (
        <p className={styles.empty}>No notes yet — create your first one.</p>
      ) : (
        <ul className={styles.list}>
          {recent.map((note) => (
            <li key={note.id} className={styles.item}>
              <span className={styles.dot} />
              <div>
                <p className={styles.noteTitle}>{note.title || 'Untitled'}</p>
                <span className={styles.time}>
                  {new Date(note.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
