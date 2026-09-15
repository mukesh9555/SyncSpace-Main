import { useState, useEffect, useCallback, useRef } from 'react';

const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
const HEARTBEAT_INTERVAL = 30_000;
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000];

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef(null);
  const heartbeatTimer = useRef(null);
  const listenersRef = useRef(new Map());

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      reconnectAttempt.current = 0;

      // Start heartbeat
      heartbeatTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'heartbeat' }));
        }
      }, HEARTBEAT_INTERVAL);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const handlers = listenersRef.current.get(msg.type);
        if (handlers) {
          for (const handler of handlers) handler(msg);
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      clearInterval(heartbeatTimer.current);

      // Reconnect with exponential backoff
      const delay = RECONNECT_DELAYS[Math.min(reconnectAttempt.current, RECONNECT_DELAYS.length - 1)];
      reconnectAttempt.current += 1;
      reconnectTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  const disconnect = useCallback(() => {
    clearTimeout(reconnectTimer.current);
    clearInterval(heartbeatTimer.current);
    reconnectAttempt.current = RECONNECT_DELAYS.length; // prevent reconnect
    wsRef.current?.close();
  }, []);

  const send = useCallback((msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const on = useCallback((type, handler) => {
    if (!listenersRef.current.has(type)) {
      listenersRef.current.set(type, new Set());
    }
    listenersRef.current.get(type).add(handler);

    return () => {
      listenersRef.current.get(type)?.delete(handler);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return { connected, send, on, disconnect };
}
