'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Activity, Server, LogOut } from 'lucide-react';
import { clsx } from 'clsx';
import { NAV_ITEMS, getIcon } from '@/lib/constants';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { NotificationDropdown } from './NotificationDropdown';

interface HeaderProps {
  connected: boolean;
}

export function Header({ connected }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { activeServerId, servers } = useServerStore();
  const { logout, refreshToken } = useAuthStore();
  const [time, setTime] = useState('');
  const [showServerDropdown, setShowServerDropdown] = useState(false);
  const { setActiveServer } = useServerStore();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // ignore
    }
    logout();
    router.replace('/login');
  };

  useEffect(() => {
    const update = () => {
      setTime(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const activeServer = servers.find(s => s.id === activeServerId);

  return (
    <header className="glass-nav sticky top-0 z-40">
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo + Nav */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                <Activity className="w-4.5 h-4.5 text-accent-light" />
              </div>
              <span className="text-base font-semibold hidden sm:block">Homelab</span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map(item => {
                const Icon = getIcon(item.icon);
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      'flex items-center gap-2 px-2 lg:px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-white/[0.08] text-white'
                        : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
                    )}
                    title={item.label}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden lg:inline">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Server Switcher */}
            <div className="relative">
              <button
                onClick={() => setShowServerDropdown(!showServerDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-all text-sm"
              >
                <Server className="w-3.5 h-3.5 text-white/50" />
                <span className="hidden sm:block text-white/70">{activeServer?.name || 'Local'}</span>
              </button>

              {showServerDropdown && (
                <div className="absolute right-0 top-full mt-2 w-56 glass-card p-2 z-50">
                  <div className="relative z-10">
                    {servers.map(server => (
                      <button
                        key={server.id}
                        onClick={() => {
                          setActiveServer(server.id);
                          setShowServerDropdown(false);
                        }}
                        className={clsx(
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                          server.id === activeServerId
                            ? 'bg-white/[0.08] text-white'
                            : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
                        )}
                      >
                        <span className={clsx(
                          'w-2 h-2 rounded-full',
                          server.status === 'connected' ? 'bg-emerald-400' : 'bg-red-400'
                        )} />
                        <span className="flex-1 text-left">{server.name}</span>
                        {server.id === activeServerId && (
                          <span className="text-xs text-accent-light">Aktiv</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Connection Status */}
            <StatusBadge
              status={connected ? 'connected' : 'offline'}
              label={connected ? 'Live' : 'Offline'}
              size="sm"
            />

            {/* Notifications */}
            <NotificationDropdown />

            {/* Time */}
            <span className="text-sm font-mono text-white/40 hidden lg:block">{time}</span>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              title="Abmelden"
            >
              <LogOut className="w-4 h-4 text-white/40 hover:text-white/70" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
