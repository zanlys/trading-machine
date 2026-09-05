"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { SignalData, ScanStatus, WsMessage } from "@/types";

const WS_URL  = process.env.NEXT_PUBLIC_WS_URL  ?? "ws://localhost:8000/ws";
const API_URL = process.env.NEXT_PUBLIC_API_URL  ?? "http://localhost:8000";

const DEFAULT_STATUS: ScanStatus = {
  running:        false,
  progress:       0,
  total:          0,
  current_symbol: "",
  last_scan:      null,
  signal_count:   0,
};

export function useScanner() {
  const [signals,   setSignals]   = useState<SignalData[]>([]);
  const [status,    setStatus]    = useState<ScanStatus>(DEFAULT_STATUS);
  const [connected, setConnected] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const wsRef      = useRef<WebSocket | null>(null);
  const pingRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryRef   = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const retryCount = useRef(0);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // Clear any pending retry before opening a new connection
    if (retryRef.current) {
      clearTimeout(retryRef.current);
      retryRef.current = null;
    }

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError(null);
      retryCount.current = 0;
      // heartbeat
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
      }, 20_000);
    };

    ws.onmessage = (ev) => {
      try {
        const msg: WsMessage = JSON.parse(ev.data);
        switch (msg.type) {
          case "init":
            setSignals(msg.signals);
            setStatus(msg.status);
            break;
          case "scan_start":
            setStatus((s) => ({ ...s, running: true, progress: 0, total: 0, current_symbol: "" }));
            break;
          case "scan_complete":
            setSignals(msg.signals);
            setStatus((s) => ({
              ...s,
              running:        false,
              signal_count:   msg.count,
              progress:       0,
              total:          0,
              current_symbol: "",
            }));
            break;
          case "progress":
            setStatus((s) => ({
              ...s,
              progress:       msg.current,
              total:          msg.total,
              current_symbol: msg.symbol,
            }));
            break;
          case "error":
            setError(msg.message);
            setStatus((s) => ({ ...s, running: false }));
            break;
        }
      } catch {/* ignore parse errors */}
    };

    ws.onerror = () => setError("WebSocket connection failed");

    ws.onclose = () => {
      setConnected(false);
      if (pingRef.current) {
        clearInterval(pingRef.current);
        pingRef.current = null;
      }
      // exponential back-off reconnect — only if not intentionally closed
      if (wsRef.current === ws) {
        const delay = Math.min(1000 * 2 ** retryCount.current, 30_000);
        retryCount.current += 1;
        retryRef.current = setTimeout(connect, delay);
      }
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      // Signal to onclose that this is intentional (not a reconnect)
      if (wsRef.current) {
        const ws = wsRef.current;
        wsRef.current = null; // nullify first so onclose skips retry
        ws.close();
      }
      if (pingRef.current)  clearInterval(pingRef.current);
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [connect]);

  const triggerScan = useCallback(async () => {
    try {
      await fetch(`${API_URL}/scan/trigger`, { method: "POST" });
    } catch {
      setError("Cannot reach backend");
    }
  }, []);

  return { signals, status, connected, error, triggerScan };
}
