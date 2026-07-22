import { useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { useTheme } from '../../theme/ThemeContext';
import styles from './NoteEditor.module.css';

const LANGUAGE_OPTIONS = [
  'plaintext', 'javascript', 'typescript', 'python', 'json', 'markdown', 'css', 'html',
];

/**
 * NoteEditor
 *
 * Wraps Monaco. Monaco's own `theme` prop is separate from our app's
 * `data-theme` CSS variable system — Monaco renders to a <canvas>-like
 * internal DOM it fully controls, so it can't inherit CSS variables.
 * We default Monaco's theme to follow the app theme, but still expose
 * a manual override switch (per the spec: "Theme Switch").
 */
export default function NoteEditor({ note, onChange }) {
  const { theme: appTheme } = useTheme();
  const [monacoTheme, setMonacoTheme] = useState(
    appTheme === 'dark' ? 'vs-dark' : 'vs'
  );
  const [fontSize, setFontSize] = useState(14);
  const [language, setLanguage] = useState('plaintext');
  const [copied, setCopied] = useState(false);

  const handleEditorChange = useCallback(
    (value) => {
      onChange({ ...note, content: value ?? '', updatedAt: new Date().toISOString() });
    },
    [note, onChange]
  );

  function handleTitleChange(e) {
    onChange({ ...note, title: e.target.value, updatedAt: new Date().toISOString() });
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(note.content || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleDownload() {
    const extMap = {
      javascript: 'js', typescript: 'ts', python: 'py', json: 'json',
      markdown: 'md', css: 'css', html: 'html', plaintext: 'txt',
    };
    const ext = extMap[language] ?? 'txt';
    const blob = new Blob([note.content || ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.title || 'note'}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.wrap}>
      <input
        className={styles.titleInput}
        value={note.title}
        onChange={handleTitleChange}
        placeholder="Note title..."
      />

      <div className={styles.toolbar}>
        <select
          className={styles.select}
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          aria-label="Syntax language"
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

        <button className={styles.toolBtn} onClick={handleCopy}>
          {copied ? '✓ Copied' : '📋 Copy'}
        </button>
        <button className={styles.toolBtn} onClick={handleDownload}>
          ⬇ Download
        </button>
      </div>

      <div className={styles.editorWrap}>
        <Editor
          height="100%"
          language={language}
          value={note.content}
          theme={monacoTheme}
          onChange={handleEditorChange}
          options={{
            fontSize,
            minimap: { enabled: false },
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  );
}
