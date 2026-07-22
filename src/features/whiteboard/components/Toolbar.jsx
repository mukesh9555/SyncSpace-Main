import styles from './Toolbar.module.css';

const COLORS = ['#111827', '#dc2626', '#16a34a', '#4f46e5', '#d97706', '#06b6d4'];

export default function Toolbar({
  tool, setTool,
  color, setColor,
  brushSize, setBrushSize,
  showGrid, setShowGrid,
  onUndo, onRedo, canUndo, canRedo,
  onClear, onDownload,
}) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.group}>
        <button
          className={`${styles.toolBtn} ${tool === 'brush' ? styles.active : ''}`}
          onClick={() => setTool('brush')}
          title="Brush (B)"
        >
          🖌 Brush
        </button>
        <button
          className={`${styles.toolBtn} ${tool === 'eraser' ? styles.active : ''}`}
          onClick={() => setTool('eraser')}
          title="Eraser (E)"
        >
          🧹 Eraser
        </button>
      </div>

      <div className={styles.group}>
        {COLORS.map((c) => (
          <button
            key={c}
            className={`${styles.swatch} ${color === c ? styles.swatchActive : ''}`}
            style={{ background: c }}
            onClick={() => setColor(c)}
            aria-label={`Color ${c}`}
          />
        ))}
        <input
          type="color"
          className={styles.colorPicker}
          value={color}
          onChange={(e) => setColor(e.target.value)}
          title="Custom color"
        />
      </div>

      <div className={styles.group}>
        <label className={styles.sizeLabel} htmlFor="brushSize">Size</label>
        <input
          id="brushSize"
          type="range"
          min="1"
          max="40"
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          title="Brush size ( [ / ] )"
        />
        <span className={styles.sizeValue}>{brushSize}px</span>
      </div>

      <div className={styles.group}>
        <button
          className={`${styles.toolBtn} ${showGrid ? styles.active : ''}`}
          onClick={() => setShowGrid((g) => !g)}
          title="Toggle grid"
        >
          ▦ Grid
        </button>
      </div>

      <div className={styles.group}>
        <button className={styles.toolBtn} onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          ↶ Undo
        </button>
        <button className={styles.toolBtn} onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
          ↷ Redo
        </button>
      </div>

      <div className={styles.group}>
        <button className={styles.toolBtn} onClick={onClear} title="Clear canvas">
          🗑 Clear
        </button>
        <button className={styles.toolBtn} onClick={onDownload} title="Download PNG">
          ⬇ Download
        </button>
      </div>
    </div>
  );
}
