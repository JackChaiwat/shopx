import { useEffect, useRef, useCallback } from "react";

type WSMessage = Record<string, unknown>;

interface UseWebSocketOptions {
  onMessage?: (data: WSMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  enabled?: boolean;
}

export function useWebSocket(path: string, options: UseWebSocketOptions = {}) {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const mounted = useRef(true);

  const connect = useCallback(() => {
    if (!mounted.current) return;

    const token = localStorage.getItem("access_token");
    if (!token) return;

    const configuredBase = import.meta.env.VITE_WS_BASE_URL;
    const base =
      configuredBase ||
      `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;
    const url = `${base}${path}?token=${token}`;

    const socket = new WebSocket(url);
    ws.current = socket;

    socket.onopen = () => {
      options.onOpen?.();
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WSMessage;
        options.onMessage?.(data);
      } catch {
        // ignore parse errors
      }
    };

    socket.onclose = (event) => {
      options.onClose?.();
      if (mounted.current && event.code !== 4001) {
        reconnectTimer.current = setTimeout(connect, 3000);
      }
    };

    socket.onerror = () => {
      socket.close();
    };
  }, [path]);

  const send = useCallback((data: WSMessage) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (options.enabled !== false) connect();

    return () => {
      mounted.current = false;
      clearTimeout(reconnectTimer.current);
      ws.current?.close(1000);
    };
  }, [connect, options.enabled]);

  return { send };
}
