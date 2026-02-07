import { create } from 'zustand';
import type { MailEmail } from '@/lib/types';

interface MailStore {
  // Credentials (loaded from backend)
  email: string | null;
  password: string | null;
  accountId: string | null;
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

export const useMailStore = create<MailStore>((set) => ({
  email: null,
  password: null,
  accountId: null,
  setCredentials: (email, password, accountId) => set({ email, password, accountId }),

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
