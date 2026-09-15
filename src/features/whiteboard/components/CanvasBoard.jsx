import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import styles from './CanvasBoard.module.css';

const CanvasBoard = forwardRef(function CanvasBoard(
  { tool, color, brushSize, showGrid, onHistoryChange, initialContent, onStrokeComplete },
  ref
) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const loadedRef = useRef(false);
  const strokeBufferRef = useRef([]);

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

  // Setup canvas + load initial content or blank snapshot
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

    // Try to load saved content
    if (initialContent && !loadedRef.current) {
      loadedRef.current = true;
      try {
        const parsed = JSON.parse(initialContent);
        if (parsed.history && parsed.history.length > 0) {
          historyRef.current = parsed.history;
          historyIndexRef.current = parsed.index ?? parsed.history.length - 1;
          restoreSnapshot(historyRef.current[historyIndexRef.current]);
          reportHistory();
          return;
        }
      } catch {
        // corrupted content — fall through to blank canvas
      }
    }

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
    const { tool: currentTool, color: currentColor, brushSize: currentSize } = settingsRef.current;
    strokeBufferRef.current = [{
      type: 'start',
      tool: currentTool,
      color: currentColor,
      size: currentSize,
      point: lastPointRef.current,
    }];
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

    strokeBufferRef.current.push({
      type: 'line',
      from: lastPointRef.current,
      to: point,
      tool: currentTool,
      color: currentColor,
      size: currentSize,
    });

    lastPointRef.current = point;
  }

  function handlePointerUp() {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    strokeBufferRef.current.push({ type: 'end' });
    pushSnapshot();
    // Broadcast the completed stroke to other users
    onStrokeComplete?.(strokeBufferRef.current);
    strokeBufferRef.current = [];
  }

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
    getContent() {
      return JSON.stringify({
        history: historyRef.current,
        index: historyIndexRef.current,
      });
    },
    applyRemoteStroke(stroke) {
      const ctx = ctxRef.current;
      if (!ctx || !stroke) return;
      for (const op of stroke) {
        if (op.type === 'start') {
          ctx.strokeStyle = op.tool === 'eraser' ? '#ffffff' : op.color;
          ctx.lineWidth = op.tool === 'eraser' ? op.size * 2 : op.size;
          ctx.beginPath();
          ctx.moveTo(op.point.x, op.point.y);
        } else if (op.type === 'line') {
          ctx.strokeStyle = op.tool === 'eraser' ? '#ffffff' : op.color;
          ctx.lineWidth = op.tool === 'eraser' ? op.size * 2 : op.size;
          ctx.beginPath();
          ctx.moveTo(op.from.x, op.from.y);
          ctx.lineTo(op.to.x, op.to.y);
          ctx.stroke();
        }
      }
      // Push snapshot so undo/redo includes remote strokes
      pushSnapshot();
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
