'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useServerStore } from '@/stores/serverStore';
import { useFleetStore } from '@/stores/fleetStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useAuthStore } from '@/stores/authStore';

export function useFleetWebSocket() {
  const { servers } = useServerStore();
  const { setServerData } = useFleetStore();
  const { addNotifications } = useNotificationStore();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout>();
  const subscribedServersRef = useRef<Set<string>>(new Set());

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
      // Subscribe to all servers
      subscribedServersRef.current.clear();
      servers.forEach(server => {
        ws.send(JSON.stringify({ type: 'subscribe', serverId: server.id }));
        subscribedServersRef.current.add(server.id);
      });
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'stats':
            setServerData(msg.serverId, {
              system: msg.data.system,
              containers: msg.data.containers,
              docker: msg.data.docker,
            });
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
      reconnectTimerRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [servers, setServerData, addNotifications]);

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

  // When servers list changes, update subscriptions
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const currentIds = new Set(servers.map(s => s.id));
    // Subscribe to new servers
    servers.forEach(server => {
      if (!subscribedServersRef.current.has(server.id)) {
        ws.send(JSON.stringify({ type: 'subscribe', serverId: server.id }));
        subscribedServersRef.current.add(server.id);
      }
    });
    // Unsubscribe from removed servers
    subscribedServersRef.current.forEach(id => {
      if (!currentIds.has(id)) {
        ws.send(JSON.stringify({ type: 'unsubscribe', serverId: id }));
        subscribedServersRef.current.delete(id);
      }
    });
  }, [servers]);
}
