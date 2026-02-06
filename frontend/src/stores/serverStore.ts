import { create } from 'zustand';
import type { Server } from '@/lib/types';

interface ServerStore {
  activeServerId: string;
  servers: Server[];
  setActiveServer: (id: string) => void;
  setServers: (servers: Server[]) => void;
}

export const useServerStore = create<ServerStore>((set) => ({
  activeServerId: 'local',
  servers: [],
  setActiveServer: (id) => set({ activeServerId: id }),
  setServers: (servers) => set({ servers }),
}));
