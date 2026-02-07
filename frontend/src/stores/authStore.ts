import { create } from 'zustand';

interface AuthUser {
  id: number;
  username: string;
}

interface AuthStore {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  setupCompleted: boolean;

  setAuth: (data: { accessToken: string; refreshToken: string; user: AuthUser; setupCompleted?: boolean }) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
  setSetupCompleted: (val: boolean) => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,
  setupCompleted: true,

  setAuth: ({ accessToken, refreshToken, user, setupCompleted }) => {
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    if (setupCompleted !== undefined) {
      localStorage.setItem('setupCompleted', String(setupCompleted));
    }
    set({
      accessToken,
      refreshToken,
      user,
      isAuthenticated: true,
      setupCompleted: setupCompleted ?? get().setupCompleted,
    });
  },

  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem('refreshToken', refreshToken);
    set({ accessToken, refreshToken, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('setupCompleted');
    set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false });
  },

  setSetupCompleted: (val) => {
    localStorage.setItem('setupCompleted', String(val));
    set({ setupCompleted: val });
  },

  loadFromStorage: () => {
    const refreshToken = localStorage.getItem('refreshToken');
    const userStr = localStorage.getItem('user');
    const setupCompleted = localStorage.getItem('setupCompleted') !== 'false';
    if (refreshToken && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ refreshToken, user, setupCompleted });
      } catch {
        // ignore parse errors
      }
    }
  },
}));
