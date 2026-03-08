import { useEffect, useRef, useCallback } from "react";
import useEventStore from "./useEventStore";

const WS_URL = "ws://localhost:3001";

export default function useWebSocket() {
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectDelay = useRef(1000);
  const viewportTimer = useRef(null);

  const addEvent = useEventStore((s) => s.addEvent);
  const addEvents = useEventStore((s) => s.addEvents);
  const addInsight = useEventStore((s) => s.addInsight);
  const setConnectionStatus = useEventStore((s) => s.setConnectionStatus);
  const setChannel = useEventStore((s) => s.setChannel);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnectionStatus("connecting");
    // Connect with the DEV fallback Sovereign key required by the API Gateway
    const ws = new WebSocket(`${WS_URL}?token=7f9e1d3c5b7a9f2e4d6c8b0a2f4e6d7f9e1d`);

    ws.onopen = () => {
      console.log("[WS] Connected");
      setConnectionStatus("connected");
      reconnectDelay.current = 1000;

      // Request history
      ws.send(JSON.stringify({ action: "get_history", count: 500 }));
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);

        switch (msg.type) {
          case "event":
            if (msg.data) addEvent(msg.data);
            break;
          case "event_batch":
            if (Array.isArray(msg.data)) addEvents(msg.data);
            break;
          case "history":
            if (msg.events) addEvents(msg.events);
            break;
          case "insight":
            if (msg.data) addInsight(msg.data);
            break;
          case "connected":
            console.log("[WS]", msg.message);
            break;
          case "channel_info":
            console.log("[WS] Channel assigned:", msg.channel, "permissions:", msg.permissions);
            if (msg.channel) setChannel(msg.channel, msg.permissions || []);
            break;
          default:
            break;
        }
      } catch (err) {
        console.warn("[WS] Parse error:", err);
      }
    };

    ws.onclose = () => {
      console.log("[WS] Disconnected");
      setConnectionStatus("disconnected");
      scheduleReconnect();
    };

    ws.onerror = (err) => {
      console.error("[WS] Error:", err);
      setConnectionStatus("error");
    };

    wsRef.current = ws;
  }, [addEvent, addEvents, addInsight, setConnectionStatus, setChannel]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    reconnectTimer.current = setTimeout(() => {
      console.log(
        `[WS] Reconnecting in ${reconnectDelay.current}ms...`
      );
      setConnectionStatus("reconnecting");
      reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
      connect();
    }, reconnectDelay.current);
  }, [connect, setConnectionStatus]);

  const sendMessage = useCallback((msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // Send viewport bbox to the gateway for server-side spatial filtering
  const sendViewport = useCallback((bbox) => {
    // Debounce viewport updates to avoid flooding the server
    if (viewportTimer.current) clearTimeout(viewportTimer.current);
    viewportTimer.current = setTimeout(() => {
      sendMessage({ action: "set_viewport", bbox });
    }, 300);
  }, [sendMessage]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (viewportTimer.current) clearTimeout(viewportTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on intentional close
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { sendMessage, sendViewport };
}
