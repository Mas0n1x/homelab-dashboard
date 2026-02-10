import { create } from 'zustand';
import type { MailEmail } from '@/lib/types';

interface MailAccount {
  id: number;
  email: string;
  accountId: string | null;
  displayName: string | null;
  sortOrder: number;
  isActive: boolean;
  unreadCount?: number;
}

interface MailStore {
  // Multi-Account State
  accounts: MailAccount[];
  activeAccountEmail: string | null;
  setAccounts: (accounts: MailAccount[]) => void;
  setActiveAccount: (email: string) => void;
  addAccount: (account: MailAccount) => void;
  removeAccount: (id: number) => void;

  // Computed getters (backward compat)
  email: string | null;
  password: string | null; // DEPRECATED - no longer used
  accountId: string | null;

  // Legacy method (backward compat)
  setCredentials: (email: string | null, password: string | null, accountId: string | null) => void;

  // UI State
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeFolderId: string | null;
  setActiveFolderId: (id: string | null) => void;
  selectedEmailId: string | null;
  setSelectedEmailId: (id: string | null) => void;
  composeOpen: boolean;
  setComposeOpen: (open: boolean) => void;
  composeMode: 'new' | 'reply' | 'replyAll' | 'forward';
  setComposeMode: (mode: 'new' | 'reply' | 'replyAll' | 'forward') => void;
  replyToEmail: MailEmail | null;
  setReplyToEmail: (email: MailEmail | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchActive: boolean;
  setSearchActive: (active: boolean) => void;
}

export const useMailStore = create<MailStore>((set, get) => ({
  accounts: [],
  activeAccountEmail: null,

  setAccounts: (accounts) => {
    const active = accounts.find(a => a.isActive);
    set({ accounts, activeAccountEmail: active?.email || null });
  },

  setActiveAccount: (email) => set({ activeAccountEmail: email }),

  addAccount: (account) => set((state) => ({
    accounts: [...state.accounts, account],
    activeAccountEmail: account.email,
  })),

  removeAccount: (id) => set((state) => {
    const filtered = state.accounts.filter(a => a.id !== id);
    const active = filtered.find(a => a.isActive);
    return {
      accounts: filtered,
      activeAccountEmail: active?.email || null,
    };
  }),

  // Computed getters
  get email() {
    return get().activeAccountEmail;
  },

  get password() {
    // DEPRECATED - passwords no longer stored in frontend
    return null;
  },

  get accountId() {
    const { accounts, activeAccountEmail } = get();
    return accounts.find(a => a.email === activeAccountEmail)?.accountId || null;
  },

  // Legacy method for backward compat (sets single account as active)
  setCredentials: (email, password, accountId) => {
    if (email && accountId) {
      // Check if account already exists
      const existing = get().accounts.find(a => a.email === email);
      if (existing) {
        set({ activeAccountEmail: email });
      } else {
        // Add as new account
        const newAccount: MailAccount = {
          id: Date.now(), // temporary ID
          email,
          accountId,
          displayName: null,
          sortOrder: get().accounts.length,
          isActive: true,
        };
        set((state) => ({
          accounts: [...state.accounts, newAccount],
          activeAccountEmail: email,
        }));
      }
    } else {
      set({ activeAccountEmail: null });
    }
  },

  activeTab: 'posteingang',
  setActiveTab: (tab) => set({ activeTab: tab }),
  activeFolderId: null,
  setActiveFolderId: (id) => set({ activeFolderId: id, selectedEmailId: null }),
  selectedEmailId: null,
  setSelectedEmailId: (id) => set({ selectedEmailId: id }),
  composeOpen: false,
  setComposeOpen: (open) => set({ composeOpen: open }),
  composeMode: 'new',
  setComposeMode: (mode) => set({ composeMode: mode }),
  replyToEmail: null,
  setReplyToEmail: (email) => set({ replyToEmail: email }),
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  searchActive: false,
  setSearchActive: (active) => set({ searchActive: active }),
}));
