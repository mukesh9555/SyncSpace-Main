import { useState, useRef, useEffect, useCallback } from 'react';
import Toolbar from './components/Toolbar';
import CanvasBoard from './components/CanvasBoard';
import styles from './Whiteboard.module.css';

export default function Whiteboard() {
  const [tool, setTool] = useState('brush');
  const [color, setColor] = useState('#111827');
  const [brushSize, setBrushSize] = useState(6);
  const [showGrid, setShowGrid] = useState(false);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

  const canvasApiRef = useRef(null);

  const handleUndo = useCallback(() => canvasApiRef.current?.undo(), []);
  const handleRedo = useCallback(() => canvasApiRef.current?.redo(), []);
  const handleClear = useCallback(() => {
    if (window.confirm('Clear the whole canvas? This cannot be undone once you draw again.')) {
      canvasApiRef.current?.clear();
    }
  }, []);
  const handleDownload = useCallback(() => canvasApiRef.current?.download(), []);

  // Keyboard shortcuts, scoped to this page only (listener attached on
  // mount, removed on unmount — never leaks to other routes).
  useEffect(() => {
    function handleKeyDown(e) {
      const isTypingInField = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
      if (isTypingInField) return;

      const ctrlOrCmd = e.ctrlKey || e.metaKey;

      if (ctrlOrCmd && e.key.toLowerCase() === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      } else if (ctrlOrCmd && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (e.key.toLowerCase() === 'b') {
        setTool('brush');
      } else if (e.key.toLowerCase() === 'e') {
        setTool('eraser');
      } else if (e.key === '[') {
        setBrushSize((s) => Math.max(1, s - 2));
      } else if (e.key === ']') {
        setBrushSize((s) => Math.min(40, s + 2));
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  return (
    <div className={styles.page}>
      <Toolbar
        tool={tool} setTool={setTool}
        color={color} setColor={setColor}
        brushSize={brushSize} setBrushSize={setBrushSize}
        showGrid={showGrid} setShowGrid={setShowGrid}
        onUndo={handleUndo} onRedo={handleRedo}
        canUndo={historyState.canUndo} canRedo={historyState.canRedo}
        onClear={handleClear} onDownload={handleDownload}
      />
      <div className={styles.canvasArea}>
        <CanvasBoard
          ref={canvasApiRef}
          tool={tool}
          color={color}
          brushSize={brushSize}
          showGrid={showGrid}
          onHistoryChange={setHistoryState}
        />
      </div>
      <p className={styles.hint}>
        Shortcuts: <kbd>B</kbd> brush · <kbd>E</kbd> eraser · <kbd>[</kbd>/<kbd>]</kbd> brush size ·{' '}
        <kbd>Ctrl+Z</kbd> undo · <kbd>Ctrl+Shift+Z</kbd> redo
      </p>
    </div>
  );
}
