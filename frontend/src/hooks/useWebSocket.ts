'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useServerStore } from '@/stores/serverStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useAuthStore } from '@/stores/authStore';

export function useWebSocket() {
  const { activeServerId, setWsFallbackMode } = useServerStore();
  const { addNotifications } = useNotificationStore();
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout>();
  const fallbackTimerRef = useRef<NodeJS.Timeout>();
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;

    const { accessToken } = useAuthStore.getState();
    if (!accessToken) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.port
      ? `${window.location.hostname}:${window.location.port}`
      : window.location.hostname;
    const wsUrl = `${protocol}//${host}/ws?token=${encodeURIComponent(accessToken)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setWsFallbackMode(false);
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
      ws.send(JSON.stringify({ type: 'subscribe', serverId: activeServerId }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case 'stats':
            queryClient.setQueryData(['systemStats', msg.serverId], msg.data.system);
            queryClient.setQueryData(['containers', msg.serverId], msg.data.containers);
            queryClient.setQueryData(['dockerInfo', msg.serverId], msg.data.docker);
            break;

          case 'discovery-update':
            queryClient.invalidateQueries({ queryKey: ['services', msg.serverId] });
            break;

          case 'service-status':
            queryClient.setQueryData(['serviceStatus', msg.serverId], msg.data);
            break;

          case 'portfolio':
            queryClient.setQueryData(['portfolio'], msg.data);
            break;

          case 'notifications':
            addNotifications(msg.data);
            break;

          case 'container-stats':
            queryClient.setQueryData(['containerStats', msg.serverId], msg.data);
            break;
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // Activate fallback polling after 5s of disconnection
      fallbackTimerRef.current = setTimeout(() => setWsFallbackMode(true), 5000);
      reconnectTimerRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [activeServerId, queryClient, addNotifications]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  // When server changes, re-subscribe
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'unsubscribe' }));
      wsRef.current.send(JSON.stringify({ type: 'subscribe', serverId: activeServerId }));
    }
  }, [activeServerId]);

  return { connected };
}
