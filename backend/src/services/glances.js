/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
const DEFAULT_URL = process.env.GLANCES_URL || 'http://localhost:61208';

export function createGlancesClient(baseUrl) {
  const rawUrl = baseUrl || DEFAULT_URL;
  let url = rawUrl;
  let authHeader = null;
  try {
    const u = new URL(rawUrl);
    if (u.username || u.password) {
      authHeader = 'Basic ' + Buffer.from(`${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`).toString('base64');
      url = u.origin;
    }
  } catch (e) {}

  async function fetchGlances(endpoint) {
    const response = await fetch(`${url}${endpoint}`, authHeader ? { headers: { Authorization: authHeader } } : undefined);
    if (!response.ok) {
      throw new Error(`Glances API error: ${response.status}`);
    }
    return response.json();
  }

  return {
    async getSystemStats() {
      try {
        const [cpu, mem, disk, network, sensors, uptime] = await Promise.all([
          fetchGlances('/api/4/cpu'),
          fetchGlances('/api/4/mem'),
          fetchGlances('/api/4/fs'),
          fetchGlances('/api/4/network'),
          fetchGlances('/api/4/sensors'),
          fetchGlances('/api/4/uptime')
        ]);

        return {
          cpu: {
            total: cpu.total || 0,
            user: cpu.user || 0,
            system: cpu.system || 0,
            idle: cpu.idle || 0
          },
          memory: {
            total: mem.total || 0,
            used: mem.used || 0,
            free: mem.free || 0,
            percent: mem.percent || 0
          },
          disk: (() => {
            if (!Array.isArray(disk)) return [];
            // Nur echte Block-Devices, Host-Mount-Praefix (/hostfs/root) entfernen,
            // pro Device den kuerzesten Mountpoint behalten (echte Partition statt Bind-Mount-Datei)
            const byDev = new Map();
            for (const d of disk) {
              const device = d.device_name || '';
              if (!device.startsWith('/dev/')) continue;
              let mnt = d.mnt_point || '';
              for (const pre of ['/hostfs/root', '/hostfs']) {
                if (mnt.startsWith(pre)) mnt = mnt.slice(pre.length) || '/';
              }
              const entry = { mountPoint: mnt, device, total: d.size, used: d.used, free: d.free, percent: d.percent };
              const prev = byDev.get(device);
              if (!prev || mnt.length < prev.mountPoint.length) byDev.set(device, entry);
            }
            return Array.from(byDev.values()).sort((a, b) => (b.total || 0) - (a.total || 0));
          })(),
          network: Array.isArray(network) ? network.filter(n => n.interface_name !== 'lo').map(n => ({
            interface: n.interface_name,
            rxBytes: n.bytes_recv || 0,
            txBytes: n.bytes_sent || 0,
            rxRate: n.bytes_recv_rate_per_sec || n.bytes_recv_rate || 0,
            txRate: n.bytes_sent_rate_per_sec || n.bytes_sent_rate || 0
          })) : [],
          temperature: Array.isArray(sensors) ? sensors.filter(s => s.type === 'temperature_core').map(s => ({
            label: s.label,
            value: s.value
          })) : [],
          uptime: uptime || 'N/A'
        };
      } catch (error) {
        console.error('Error fetching Glances stats:', error.message);
        throw error;
      }
    },

    getCpu: () => fetchGlances('/api/4/cpu'),
    getMemory: () => fetchGlances('/api/4/mem'),
    getDisk: () => fetchGlances('/api/4/fs'),
    getNetwork: () => fetchGlances('/api/4/network'),
    getSensors: () => fetchGlances('/api/4/sensors')
  };
}

// Default client for backward compatibility
const defaultClient = createGlancesClient(DEFAULT_URL);

export const getSystemStats = () => defaultClient.getSystemStats();
export const getCpu = () => defaultClient.getCpu();
export const getMemory = () => defaultClient.getMemory();
export const getDisk = () => defaultClient.getDisk();
export const getNetwork = () => defaultClient.getNetwork();
export const getSensors = () => defaultClient.getSensors();
