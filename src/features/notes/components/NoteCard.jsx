import styles from './NoteCard.module.css';

export default function NoteCard({ note, isActive, onSelect, onDelete }) {
  return (
    <li
      className={`${styles.card} ${isActive ? styles.active : ''}`}
      onClick={() => onSelect(note.id)}
    >
      <div className={styles.textCol}>
        <p className={styles.title}>{note.title || 'Untitled'}</p>
        <p className={styles.preview}>
          {(note.content || '').slice(0, 40) || 'No content yet'}
        </p>
      </div>
      <button
        className={styles.deleteBtn}
        onClick={(e) => {
          e.stopPropagation(); // don't trigger onSelect
          onDelete(note.id);
        }}
        aria-label="Delete note"
        title="Delete note"
      >
        🗑
      </button>
    </li>
  );
}
