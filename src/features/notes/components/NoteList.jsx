import NoteCard from './NoteCard';
import styles from './NoteList.module.css';

export default function NoteList({ notes, activeId, onSelect, onDelete }) {
  if (notes.length === 0) {
    return <p className={styles.empty}>No notes match your search.</p>;
  }

  return (
    <ul className={styles.list}>
      {notes.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          isActive={note.id === activeId}
          onSelect={onSelect}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}
