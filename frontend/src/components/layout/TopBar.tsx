/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Search, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { beendeSitzung } from '@/lib/session';
import { NotificationDropdown } from './NotificationDropdown';
import { WeatherChip, WEATHER_LOCATIONS } from '@/components/dashboard/WeatherWidget';

interface TopBarProps {
  connected: boolean;
}

export function TopBar({ connected }: TopBarProps) {
  const router = useRouter();
  const { logout } = useAuthStore();
  const [time, setTime] = useState('');

  // Die Uhr tickt nur, solange die Seite im Vordergrund ist UND sie überhaupt
  // sichtbar ist (ab lg). Vorher lief sie sekündlich auch auf dem Handy weiter,
  // wo sie gar nicht angezeigt wird.
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    const update = () => {
      setTime(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };

    const mq = window.matchMedia('(min-width: 1024px)');

    const steuern = () => {
      const laufen = mq.matches && document.visibilityState === 'visible';
      if (laufen && !interval) {
        update();
        interval = setInterval(update, 1000);
      } else if (!laufen && interval) {
        clearInterval(interval);
        interval = undefined;
      }
    };

    steuern();
    mq.addEventListener('change', steuern);
    document.addEventListener('visibilitychange', steuern);
    return () => {
      if (interval) clearInterval(interval);
      mq.removeEventListener('change', steuern);
      document.removeEventListener('visibilitychange', steuern);
    };
  }, []);

  const handleLogout = async () => {
    await beendeSitzung();
    logout();
    router.replace('/login');
  };

  const openCommandPalette = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
  };

  return (
    <header className="h-14 flex items-center justify-between px-4 lg:px-6 flex-shrink-0 border-b border-white/[0.04]">
      {/* Left: Command Bar Trigger + Wetter */}
      <div className="flex items-center gap-2 min-w-0">
      <button
        onClick={openCommandPalette}
        aria-label="Suche und Befehle öffnen (Strg+K)"
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.1] transition-all text-sm text-white/50 hover:text-white/65 max-w-xs"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Suchen...</span>
        <kbd className="hidden sm:inline ml-auto text-[11px] px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-white/50 font-mono">
          {'\u2318'}K
        </kbd>
      </button>
      <div className="hidden xl:flex items-center gap-1.5">
        {WEATHER_LOCATIONS.map(l => <WeatherChip key={l.city} location={l} />)}
      </div>
      </div>

      {/* Right: Status + Notifications + Clock + Logout */}
      <div className="flex items-center gap-2">
        {/* Connection Status */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06]">
          {connected ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span className="text-[12px] text-emerald-400/80 font-medium">Live</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-red-400/60" />
              <span className="text-[12px] text-red-400/60 font-medium">Offline</span>
            </>
          )}
        </div>

        {/* Notifications */}
        <NotificationDropdown />

        {/* Clock */}
        <span className="text-[12px] font-mono text-white/50 hidden lg:flex items-center px-2 py-1 rounded-lg bg-white/[0.02] border border-white/[0.04]">
          {time}
        </span>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-all duration-200 text-white/50 hover:text-white/70"
          title="Abmelden"
          aria-label="Abmelden"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
