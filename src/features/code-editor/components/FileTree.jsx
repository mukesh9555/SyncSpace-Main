import { useState, useRef, useEffect } from 'react';
import styles from './FileTree.module.css';

export default function FileTree({
  files,
  activeFileId,
  renamingId,
  onSelect,
  onRename,
  onStartRename,
  onDelete,
}) {
  return (
    <ul className={styles.tree}>
      {files.length === 0 ? (
        <li className={styles.empty}>No files yet</li>
      ) : (
        files.map((file) => (
          <FileNode
            key={file.id}
            file={file}
            isActive={file.id === activeFileId}
            isRenaming={file.id === renamingId}
            onSelect={() => onSelect(file.id)}
            onRename={(newName) => onRename(file.id, newName)}
            onStartRename={() => onStartRename(file.id)}
            onDelete={() => {
              if (window.confirm(`Delete "${file.name}"?`)) onDelete(file.id);
            }}
          />
        ))
      )}
    </ul>
  );
}

function FileNode({ file, isActive, isRenaming, onSelect, onRename, onStartRename, onDelete }) {
  const [editName, setEditName] = useState(file.name);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isRenaming) {
      setEditName(file.name);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isRenaming, file.name]);

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (editName.trim() && editName !== file.name) onRename(editName.trim());
      else onStartRename();
    } else if (e.key === 'Escape') {
      onStartRename();
    }
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const icon = FILE_ICONS[ext] || '📄';

  if (isRenaming) {
    return (
      <li className={`${styles.node} ${styles.renaming}`}>
        <input
          ref={inputRef}
          className={styles.renameInput}
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (editName.trim() && editName !== file.name) onRename(editName.trim());
            else onStartRename();
          }}
        />
      </li>
    );
  }

  return (
    <li
      className={`${styles.node} ${isActive ? styles.active : ''}`}
      onClick={onSelect}
      onDoubleClick={onStartRename}
    >
      <span className={styles.icon}>{icon}</span>
      <span className={styles.name}>{file.name}</span>
      <span className={styles.actions}>
        <button
          className={styles.actionBtn}
          onClick={(e) => { e.stopPropagation(); onStartRename(); }}
          title="Rename"
        >
          ✏️
        </button>
        <button
          className={styles.actionBtn}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete"
        >
          🗑️
        </button>
      </span>
    </li>
  );
}

const FILE_ICONS = {
  js: '📜', jsx: '⚛️', ts: '📘', tsx: '⚛️',
  py: '🐍', java: '☕', c: '🔧', cpp: '🔧', cs: '🔧',
  go: '🐹', rs: '🦀', rb: '💎', php: '🐘',
  html: '🌐', css: '🎨', scss: '🎨',
  json: '📋', yaml: '📋', yml: '📋', md: '📝',
  sh: '🖥️', bash: '🖥️', sql: '🗃️',
};
