import { Link } from 'react-router-dom';
import { getItem, STORAGE_KEYS } from '../../../shared/utils/localStorage';
import styles from './RecentNotes.module.css';

/**
 * Unlike ActivityTimeline/RecentRooms (mock data — no backend for rooms
 * yet), Recent Notes reads REAL data straight from LocalStorage, since
 * the Notes feature is fully implemented in this phase.
 */
export default function RecentNotes() {
  const notes = getItem(STORAGE_KEYS.NOTES, []);
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
