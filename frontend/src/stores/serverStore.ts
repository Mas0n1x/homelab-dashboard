/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { create } from 'zustand';
import type { Server } from '@/lib/types';

interface ServerStore {
  activeServerId: string;
  servers: Server[];
  wsFallbackMode: boolean;
  setActiveServer: (id: string) => void;
  setServers: (servers: Server[]) => void;
  setWsFallbackMode: (val: boolean) => void;
}

export const useServerStore = create<ServerStore>((set) => ({
  activeServerId: 'local',
  servers: [],
  wsFallbackMode: false,
  setActiveServer: (id) => set({ activeServerId: id }),
  setServers: (servers) => set({ servers }),
  setWsFallbackMode: (val) => set({ wsFallbackMode: val }),
}));
