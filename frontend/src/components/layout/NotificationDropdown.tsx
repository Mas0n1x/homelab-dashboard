'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell, Check, Trash2, X } from 'lucide-react';
import { useNotificationStore } from '@/stores/notificationStore';

export function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markRead, clearAll } = useNotificationStore();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function timeAgo(timestamp: string): string {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Jetzt';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  }

  const typeIcon: Record<string, string> = {
    'new-request': '\uD83D\uDCE9',
    'new-customer': '\uD83D\uDC64',
    'service-offline': '\uD83D\uDD34',
    'container-crash': '\uD83D\uDC80',
    'new-mail': '✉️',
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-white/[0.06] transition-colors"
      >
        <Bell className="w-4.5 h-4.5 text-white/50" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-accent-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-sm glass-card p-0 z-50 overflow-hidden">
          <div className="relative z-10">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <span className="text-sm font-medium">Benachrichtigungen</span>
              <div className="flex items-center gap-1">
                {notifications.length > 0 && (
                  <button
                    onClick={() => clearAll()}
                    className="p-1 rounded hover:bg-white/[0.06] text-white/30 hover:text-white/60 transition-colors"
                    title="Alle loeschen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1 rounded hover:bg-white/[0.06] text-white/30 hover:text-white/60 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Notification list */}
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-8 text-center">
                  <Bell className="w-8 h-8 mx-auto mb-2 text-white/10" />
                  <p className="text-xs text-white/30">Keine Benachrichtigungen</p>
                </div>
              ) : (
                notifications.map(notif => (
                  <div
                    key={notif.id}
                    onClick={() => markRead(notif.id)}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors cursor-pointer border-b border-white/[0.03] last:border-0 ${
                      !notif.read ? 'bg-accent/[0.03]' : ''
                    }`}
                  >
                    <span className="text-base mt-0.5">{typeIcon[notif.type] || '\uD83D\uDD14'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-xs font-medium truncate ${!notif.read ? 'text-white' : 'text-white/60'}`}>
                          {notif.title}
                        </p>
                        {!notif.read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-accent-light flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-white/40 truncate mt-0.5">{notif.message}</p>
                    </div>
                    <span className="text-[10px] text-white/20 flex-shrink-0">{timeAgo(notif.timestamp)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
