/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { erneuereSitzung } from '@/lib/session';

const PUBLIC_PATHS = ['/login'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, setAuth, logout, loadFromStorage } = useAuthStore();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/s/')) {
        setChecking(false);
        return;
      }

      loadFromStorage();
      const state = useAuthStore.getState();

      // Already authenticated with access token
      if (state.isAuthenticated && state.accessToken) {
        setChecking(false);
        return;
      }

      // Anmeldung über das Sitzungs-Cookie wiederherstellen. Netzfehler werden mit
      // kurzer Pause wiederholt, statt sofort auszuloggen: beim Aufwachen des Handys
      // ist die Verbindung oft erst nach ein paar hundert Millisekunden wieder da.
      let abgelehnt = !localStorage.getItem('user') && !localStorage.getItem('refreshToken');
      for (let versuch = 0; !abgelehnt && versuch < 3; versuch++) {
        try {
          const res = await erneuereSitzung();
          if (res.ok) {
            const data = await res.json();
            setAuth({ accessToken: data.accessToken, user: data.user });
            setChecking(false);
            return;
          }
          // Token wirklich abgelehnt -> abmelden. Alles andere (5xx) ist ein
          // Serverproblem und kein Grund, den Zugang wegzuwerfen.
          if (res.status === 401 || res.status === 403) { abgelehnt = true; break; }
        } catch {
          // Netzfehler: gleich noch einmal versuchen.
        }
        await new Promise(r => setTimeout(r, 400 * (versuch + 1)));
      }

      // Not authenticated
      if (abgelehnt) logout();
      router.replace('/login');
      setChecking(false);
    };

    checkAuth();
  }, [pathname]);

  if (checking && !PUBLIC_PATHS.includes(pathname)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
