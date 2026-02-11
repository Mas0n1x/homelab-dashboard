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

function deriveFields(accounts: MailAccount[], activeAccountEmail: string | null) {
  const activeAcc = accounts.find(a => a.email === activeAccountEmail);
  return {
    email: activeAccountEmail,
    password: null,
    accountId: activeAcc?.accountId || null,
  };
}

export const useMailStore = create<MailStore>((set, get) => ({
  accounts: [],
  activeAccountEmail: null,
  email: null,
  password: null,
  accountId: null,

  setAccounts: (accounts) => {
    const active = accounts.find(a => a.isActive);
    const activeEmail = active?.email || null;
    set({ accounts, activeAccountEmail: activeEmail, ...deriveFields(accounts, activeEmail) });
  },

  setActiveAccount: (email) => {
    const { accounts } = get();
    set({ activeAccountEmail: email, ...deriveFields(accounts, email) });
  },

  addAccount: (account) => set((state) => {
    const accounts = [...state.accounts, account];
    return { accounts, activeAccountEmail: account.email, ...deriveFields(accounts, account.email) };
  }),

  removeAccount: (id) => set((state) => {
    const filtered = state.accounts.filter(a => a.id !== id);
    const active = filtered.find(a => a.isActive);
    const activeEmail = active?.email || null;
    return { accounts: filtered, activeAccountEmail: activeEmail, ...deriveFields(filtered, activeEmail) };
  }),

  // Legacy method for backward compat (sets single account as active)
  setCredentials: (email, _password, accountId) => {
    if (email && accountId) {
      const existing = get().accounts.find(a => a.email === email);
      if (existing) {
        set({ activeAccountEmail: email, ...deriveFields(get().accounts, email) });
      } else {
        const newAccount: MailAccount = {
          id: Date.now(),
          email,
          accountId,
          displayName: null,
          sortOrder: get().accounts.length,
          isActive: true,
        };
        set((state) => {
          const accounts = [...state.accounts, newAccount];
          return { accounts, activeAccountEmail: email, ...deriveFields(accounts, email) };
        });
      }
    } else {
      set({ activeAccountEmail: null, email: null, accountId: null, password: null });
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
