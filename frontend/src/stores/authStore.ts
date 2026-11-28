/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { create } from 'zustand';

interface AuthUser {
  id: number;
  username: string;
}

interface AuthStore {
  accessToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  setupCompleted: boolean;

  setAuth: (data: { accessToken: string; user: AuthUser; setupCompleted?: boolean }) => void;
  setAccessToken: (accessToken: string) => void;
  logout: () => void;
  setSetupCompleted: (val: boolean) => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,
  setupCompleted: true,

  setAuth: ({ accessToken, user, setupCompleted }) => {
    localStorage.setItem('user', JSON.stringify(user));
    if (setupCompleted !== undefined) {
      localStorage.setItem('setupCompleted', String(setupCompleted));
    }
    set({
      accessToken,
      user,
      isAuthenticated: true,
      setupCompleted: setupCompleted ?? get().setupCompleted,
    });
  },

  setAccessToken: (accessToken) => set({ accessToken, isAuthenticated: true }),

  logout: () => {
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('setupCompleted');
    set({ accessToken: null, user: null, isAuthenticated: false });
  },

  setSetupCompleted: (val) => {
    localStorage.setItem('setupCompleted', String(val));
    set({ setupCompleted: val });
  },

  loadFromStorage: () => {
    const userStr = localStorage.getItem('user');
    const setupCompleted = localStorage.getItem('setupCompleted') !== 'false';
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ user, setupCompleted });
      } catch {
        // ignore parse errors
      }
    }
  },
}));
