/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import * as api from '@/lib/api';

export type PushState = 'unsupported' | 'blocked' | 'off' | 'on' | 'working';

function base64ToUint8(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

/** Kurzer, lesbarer Gerätename aus dem User-Agent („Chrome · Android"). */
function geraeteName(): string {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Gerät';
  return `${browser} · ${os}`;
}

/** Web-Push für dieses Gerät: aktivieren, abmelden, Zustand. */
export function usePush() {
  const [state, setState] = useState<PushState>('off');
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') { setState('blocked'); return; }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setEndpoint(sub?.endpoint ?? null);
      setState(sub ? 'on' : 'off');
    } catch {
      setState('off');
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const enable = useCallback(async () => {
    setError(null);
    setState('working');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setState(perm === 'denied' ? 'blocked' : 'off'); return false; }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const { publicKey } = await api.getVapidKey();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ToUint8(publicKey) as BufferSource,
      });
      await api.subscribePush({ subscription: sub.toJSON(), name: geraeteName() });
      setEndpoint(sub.endpoint);
      setState('on');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Aktivierung fehlgeschlagen');
      await refresh();
      return false;
    }
  }, [refresh]);

  const disable = useCallback(async () => {
    setState('working');
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      await sub?.unsubscribe();
    } catch { /* egal: der Kanal wird serverseitig ohnehin entfernt */ }
    setEndpoint(null);
    setState('off');
  }, []);

  return { state, endpoint, error, enable, disable };
}
