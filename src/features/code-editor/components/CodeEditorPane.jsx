import { useState, useCallback, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { useTheme } from '../../theme/ThemeContext';
import styles from './CodeEditorPane.module.css';

const LANGUAGE_OPTIONS = [
  'plaintext', 'javascript', 'typescript', 'python', 'java', 'c', 'cpp',
  'csharp', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'sql',
  'html', 'css', 'scss', 'json', 'yaml', 'markdown', 'bash', 'shell',
];

export default function CodeEditorPane({ file, onSave, remoteContent, remoteVersion }) {
  const { theme: appTheme } = useTheme();
  const [monacoTheme, setMonacoTheme] = useState(
    appTheme === 'dark' ? 'vs-dark' : 'vs',
  );
  const [fontSize, setFontSize] = useState(14);
  const [language, setLanguage] = useState(file.language || 'plaintext');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const contentRef = useRef(file.content || '');
  const editorRef = useRef(null);

  const handleEditorChange = useCallback((value) => {
    contentRef.current = value ?? '';
  }, []);

  const handleEditorMount = useCallback((editor) => {
    editorRef.current = editor;
  }, []);

  useEffect(() => {
    if (!remoteVersion || !editorRef.current) return;
    const model = editorRef.current.getModel();
    if (!model) return;
    if (remoteContent === contentRef.current) return;
    editorRef.current.executeEdits('remote-update', [
      {
        range: model.getFullModelRange(),
        text: remoteContent,
      },
    ]);
    contentRef.current = remoteContent;
  }, [remoteVersion, remoteContent]);

  async function handleSave() {
    setIsSaving(true);
    try {
      await onSave(file.id, {
        content: contentRef.current,
        language,
      });
      setLastSaved(new Date());
    } finally {
      setIsSaving(false);
    }
  }

  function handleKeyDown(e) {
    const ctrlOrCmd = e.ctrlKey || e.metaKey;
    if (ctrlOrCmd && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  }

  return (
    <div className={styles.wrap} onKeyDown={handleKeyDown}>
      <div className={styles.header}>
        <span className={styles.fileName}>{file.name}</span>
        <span className={styles.filePath}>{file.path}</span>
      </div>

      <div className={styles.toolbar}>
        <select
          className={styles.select}
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          aria-label="Language"
        >
          {LANGUAGE_OPTIONS.map((lang) => (
            <option key={lang} value={lang}>{lang}</option>
          ))}
        </select>

        <button
          className={styles.toolBtn}
          onClick={() => setMonacoTheme((t) => (t === 'vs-dark' ? 'vs' : 'vs-dark'))}
        >
          {monacoTheme === 'vs-dark' ? '🌙 Dark' : '☀️ Light'}
        </button>

        <div className={styles.fontControl}>
          <button
            className={styles.fontBtn}
            onClick={() => setFontSize((s) => Math.max(10, s - 1))}
            aria-label="Decrease font size"
          >
            A-
          </button>
          <span className={styles.fontSize}>{fontSize}px</span>
          <button
            className={styles.fontBtn}
            onClick={() => setFontSize((s) => Math.min(28, s + 1))}
            aria-label="Increase font size"
          >
            A+
          </button>
        </div>

        <button className={styles.toolBtn} onClick={() => navigator.clipboard.writeText(contentRef.current)}>
          📋 Copy
        </button>

        <button
          className={`${styles.toolBtn} ${styles.saveBtn}`}
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? '⏳ Saving...' : '💾 Save'}
        </button>

        {lastSaved && (
          <span className={styles.savedAt}>
            Saved {lastSaved.toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className={styles.editorWrap}>
        <Editor
          height="100%"
          language={language}
          defaultValue={file.content || ''}
          theme={monacoTheme}
          onMount={handleEditorMount}
          onChange={handleEditorChange}
          options={{
            fontSize,
            minimap: { enabled: true },
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            formatOnPaste: true,
            formatOnType: true,
          }}
        />
      </div>
    </div>
  );
}
