/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
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

  /**
   * `unified` = Sammel-Eingang über alle Konten, `folder` = ein einzelner Ordner
   * eines Kontos. Ersetzt das frühere serverseitige Umschalten des „aktiven"
   * Kontos: der Wechsel ist damit sofort und ohne Netzrunde.
   */
  viewMode: 'unified' | 'folder';
  showUnified: () => void;
  selectFolder: (accountEmail: string, folderId: string) => void;

  selectedEmailId: string | null;
  setSelectedEmailId: (id: string | null) => void;
  /** Konto der geöffneten Mail — im Sammel-Eingang nicht zwingend das aktive. */
  selectedEmailAccount: string | null;
  openEmail: (id: string, accountEmail: string) => void;
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
  setActiveFolderId: (id) => set({ activeFolderId: id, selectedEmailId: null, selectedEmailAccount: null }),

  viewMode: 'unified',
  showUnified: () => set({ viewMode: 'unified', selectedEmailId: null, selectedEmailAccount: null }),
  selectFolder: (accountEmail, folderId) => {
    const { accounts } = get();
    set({
      viewMode: 'folder',
      activeFolderId: folderId,
      selectedEmailId: null,
      selectedEmailAccount: null,
      activeAccountEmail: accountEmail,
      ...deriveFields(accounts, accountEmail),
    });
  },

  selectedEmailId: null,
  setSelectedEmailId: (id) => set({ selectedEmailId: id, ...(id ? {} : { selectedEmailAccount: null }) }),
  selectedEmailAccount: null,
  openEmail: (id, accountEmail) => {
    const { accounts, activeAccountEmail } = get();
    // Eine Mail aus dem Sammel-Eingang gehört zu ihrem eigenen Konto — ohne
    // Umschalten würde sie mit den Zugangsdaten des falschen Postfachs geladen.
    if (accountEmail !== activeAccountEmail) {
      set({ activeAccountEmail: accountEmail, ...deriveFields(accounts, accountEmail) });
    }
    set({ selectedEmailId: id, selectedEmailAccount: accountEmail });
  },
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
