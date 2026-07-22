import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import styles from './CanvasBoard.module.css';

/**
 * CanvasBoard
 *
 * Drawing state (isDrawing, last point) lives entirely in refs, NOT
 * React state — mousemove fires far too often for setState to be
 * appropriate there (it would force a re-render on every pixel of
 * mouse movement). Only the undo/redo *availability* is reported back
 * to the parent (Whiteboard.jsx) via a callback, since that's the only
 * piece the Toolbar UI actually needs to react to.
 *
 * Undo/redo strategy: after every completed stroke (mouseup), we
 * snapshot the canvas as a PNG dataURL into a history array. Undo/redo
 * just restores a snapshot. Simple and correct for a lightweight
 * whiteboard; a production infinite-canvas app would store vector
 * strokes instead of raster snapshots, but that's out of scope here.
 */
const CanvasBoard = forwardRef(function CanvasBoard(
  { tool, color, brushSize, showGrid, onHistoryChange },
  ref
) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });
  const historyRef = useRef([]); // array of dataURLs
  const historyIndexRef = useRef(-1);

  // Keep latest tool/color/brushSize available inside event handlers
  // that are attached once, without re-attaching listeners every render.
  const settingsRef = useRef({ tool, color, brushSize });
  useEffect(() => {
    settingsRef.current = { tool, color, brushSize };
  }, [tool, color, brushSize]);

  function reportHistory() {
    onHistoryChange({
      canUndo: historyIndexRef.current > 0,
      canRedo: historyIndexRef.current < historyRef.current.length - 1,
    });
  }

  function pushSnapshot() {
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    // Discard any "future" redo states once a new stroke is drawn
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(dataUrl);
    historyIndexRef.current += 1;
    reportHistory();
  }

  function restoreSnapshot(dataUrl) {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = dataUrl;
  }

  // Setup canvas + initial blank snapshot on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas.parentElement;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctxRef.current = ctx;

    pushSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getPoint(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function handlePointerDown(e) {
    isDrawingRef.current = true;
    lastPointRef.current = getPoint(e);
  }

  function handlePointerMove(e) {
    if (!isDrawingRef.current) return;
    const ctx = ctxRef.current;
    const { tool: currentTool, color: currentColor, brushSize: currentSize } = settingsRef.current;
    const point = getPoint(e);

    ctx.strokeStyle = currentTool === 'eraser' ? '#ffffff' : currentColor;
    ctx.lineWidth = currentTool === 'eraser' ? currentSize * 2 : currentSize;

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();

    lastPointRef.current = point;
  }

  function handlePointerUp() {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    pushSnapshot();
  }

  // Imperative API exposed to Whiteboard.jsx (for Toolbar buttons +
  // keyboard shortcuts, which live in the parent).
  useImperativeHandle(ref, () => ({
    undo() {
      if (historyIndexRef.current <= 0) return;
      historyIndexRef.current -= 1;
      restoreSnapshot(historyRef.current[historyIndexRef.current]);
      reportHistory();
    },
    redo() {
      if (historyIndexRef.current >= historyRef.current.length - 1) return;
      historyIndexRef.current += 1;
      restoreSnapshot(historyRef.current[historyIndexRef.current]);
      reportHistory();
    },
    clear() {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      pushSnapshot();
    },
    download() {
      const canvas = canvasRef.current;
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = 'syncspace-whiteboard.png';
      a.click();
    },
  }));

  return (
    <div className={`${styles.canvasWrap} ${showGrid ? styles.gridOn : ''}`}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      />
    </div>
  );
});

export default CanvasBoard;
