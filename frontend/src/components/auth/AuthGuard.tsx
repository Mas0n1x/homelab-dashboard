'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

const PUBLIC_PATHS = ['/login'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, setAuth, logout, loadFromStorage } = useAuthStore();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (PUBLIC_PATHS.includes(pathname)) {
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

      // Try to refresh using stored refresh token
      const storedRefreshToken = localStorage.getItem('refreshToken');
      if (storedRefreshToken) {
        try {
          const res = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: storedRefreshToken }),
          });
          if (res.ok) {
            const data = await res.json();
            setAuth({
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
              user: data.user,
            });
            setChecking(false);
            return;
          }
        } catch {
          // refresh failed
        }
      }

      // Not authenticated
      logout();
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
