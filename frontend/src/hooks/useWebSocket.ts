'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useServerStore } from '@/stores/serverStore';
import { useNotificationStore } from '@/stores/notificationStore';

export function useWebSocket() {
  const { activeServerId } = useServerStore();
  const { addNotifications } = useNotificationStore();
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout>();
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:${window.location.port}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
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
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setConnected(false);
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
