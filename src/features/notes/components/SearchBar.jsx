import styles from './SearchBar.module.css';

export default function SearchBar({ value, onChange }) {
  return (
    <div className={styles.wrap}>
      <span className={styles.icon}>🔍</span>
      <input
        className={styles.input}
        type="text"
        placeholder="Search notes..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
