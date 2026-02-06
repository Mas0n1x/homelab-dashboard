import { create } from 'zustand';
import type { Notification } from '@/lib/types';

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  addNotifications: (items: Notification[]) => void;
  markRead: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  addNotifications: (items) => {
    const existing = get().notifications;
    const newItems = items.filter(i => !existing.find(e => e.id === i.id));
    const merged = [...newItems, ...existing].slice(0, 50);
    set({
      notifications: merged,
      unreadCount: merged.filter(n => !n.read).length,
    });
  },
  markRead: (id) => {
    const notifications = get().notifications.map(n =>
      n.id === id ? { ...n, read: true } : n
    );
    set({
      notifications,
      unreadCount: notifications.filter(n => !n.read).length,
    });
  },
  clearAll: () => set({ notifications: [], unreadCount: 0 }),
}));
