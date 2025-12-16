const GLANCES_URL = process.env.GLANCES_URL || 'http://localhost:61208';

export async function getSystemStats() {
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
      disk: Array.isArray(disk) ? disk.map(d => ({
        mountPoint: d.mnt_point,
        device: d.device_name,
        total: d.size,
        used: d.used,
        free: d.free,
        percent: d.percent
      })) : [],
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
}

export async function getCpu() {
  return fetchGlances('/api/4/cpu');
}

export async function getMemory() {
  return fetchGlances('/api/4/mem');
}

export async function getDisk() {
  return fetchGlances('/api/4/fs');
}

export async function getNetwork() {
  return fetchGlances('/api/4/network');
}

export async function getSensors() {
  return fetchGlances('/api/4/sensors');
}

async function fetchGlances(endpoint) {
  const response = await fetch(`${GLANCES_URL}${endpoint}`);
  if (!response.ok) {
    throw new Error(`Glances API error: ${response.status}`);
  }
  return response.json();
}
