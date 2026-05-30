/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { create } from 'zustand';
import type { SystemStats, Container, DockerInfo } from '@/lib/types';

export interface ServerData {
  system: SystemStats | null;
  containers: Container[];
  docker: DockerInfo | null;
  lastUpdated: number;
}

interface FleetStore {
  serverData: Record<string, ServerData>;
  setServerData: (serverId: string, data: Partial<ServerData>) => void;
  getServerData: (serverId: string) => ServerData;
}

const emptyServerData: ServerData = {
  system: null,
  containers: [],
  docker: null,
  lastUpdated: 0,
};

export const useFleetStore = create<FleetStore>((set, get) => ({
  serverData: {},
  setServerData: (serverId, data) =>
    set((state) => ({
      serverData: {
        ...state.serverData,
        [serverId]: {
          ...(state.serverData[serverId] || emptyServerData),
          ...data,
          lastUpdated: Date.now(),
        },
      },
    })),
  getServerData: (serverId) => get().serverData[serverId] || emptyServerData,
}));
