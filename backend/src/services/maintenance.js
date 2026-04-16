import serverManager from './serverManager.js';

/**
 * Get process list from Glances API for a specific server
 */
export async function getProcessList(serverId) {
  const glances = serverManager.getGlances(serverId);
  if (!glances) {
    throw new Error(`No Glances connection for server ${serverId}`);
  }

  try {
    const client = glances;
    // Glances processlist endpoint returns all processes
    const baseUrl = serverManager.getConnection(serverId)?.config?.glances_url || process.env.GLANCES_URL || 'http://localhost:61208';
    const response = await fetch(`${baseUrl}/api/4/processlist`);
    if (!response.ok) throw new Error(`Glances error: ${response.status}`);
    const processes = await response.json();

    // Sort by CPU descending and return top 50
    return (Array.isArray(processes) ? processes : [])
      .sort((a, b) => (b.cpu_percent || 0) - (a.cpu_percent || 0))
      .slice(0, 50)
      .map(p => ({
        pid: p.pid,
        name: p.name,
        username: p.username || 'unknown',
        cpuPercent: p.cpu_percent || 0,
        memPercent: p.memory_percent || 0,
        memRss: p.memory_info?.[0] || 0, // RSS in bytes
        status: p.status || 'unknown',
        numThreads: p.num_threads || 0,
        cmdline: Array.isArray(p.cmdline) ? p.cmdline.join(' ') : (p.cmdline || p.name),
        nice: p.nice || 0,
        ioRead: p.io_counters?.[0] || 0,
        ioWrite: p.io_counters?.[1] || 0,
      }));
  } catch (error) {
    console.error(`Error fetching processes for ${serverId}:`, error.message);
    throw error;
  }
}

/**
 * Get network configuration from Glances
 */
export async function getNetworkConfig(serverId) {
  const baseUrl = getGlancesUrl(serverId);

  try {
    const [networkResp, ipResp] = await Promise.all([
      fetch(`${baseUrl}/api/4/network`),
      fetch(`${baseUrl}/api/4/ip`).catch(() => null),
    ]);

    if (!networkResp.ok) throw new Error(`Glances error: ${networkResp.status}`);
    const network = await networkResp.json();
    const ipInfo = ipResp?.ok ? await ipResp.json() : null;

    const interfaces = (Array.isArray(network) ? network : [])
      .filter(n => n.interface_name !== 'lo')
      .map(n => ({
        name: n.interface_name,
        isUp: n.is_up !== false,
        speed: n.speed || 0,
        rxBytes: n.bytes_recv || n.cumulative_rx || 0,
        txBytes: n.bytes_sent || n.cumulative_tx || 0,
        rxRate: n.bytes_recv_rate_per_sec || n.bytes_recv_rate || 0,
        txRate: n.bytes_sent_rate_per_sec || n.bytes_sent_rate || 0,
      }));

    return {
      interfaces,
      publicIp: ipInfo?.public_address || null,
      publicIpv6: ipInfo?.public_address_v6 || null,
    };
  } catch (error) {
    console.error(`Error fetching network config for ${serverId}:`, error.message);
    throw error;
  }
}

/**
 * Get disk health info from Glances
 */
export async function getDiskHealth(serverId) {
  const baseUrl = getGlancesUrl(serverId);

  try {
    const [fsResp, diskioResp] = await Promise.all([
      fetch(`${baseUrl}/api/4/fs`),
      fetch(`${baseUrl}/api/4/diskio`).catch(() => null),
    ]);

    if (!fsResp.ok) throw new Error(`Glances error: ${fsResp.status}`);
    const fs = await fsResp.json();
    const diskio = diskioResp?.ok ? await diskioResp.json() : [];

    const disks = (Array.isArray(fs) ? fs : []).map(d => ({
      mountPoint: d.mnt_point,
      device: d.device_name,
      fsType: d.fs_type || 'unknown',
      total: d.size || 0,
      used: d.used || 0,
      free: d.free || 0,
      percent: d.percent || 0,
    }));

    const io = (Array.isArray(diskio) ? diskio : []).map(d => ({
      name: d.disk_name,
      readBytes: d.read_bytes || 0,
      writeBytes: d.write_bytes || 0,
      readRate: d.read_bytes_rate_per_sec || d.read_bytes_rate || 0,
      writeRate: d.write_bytes_rate_per_sec || d.write_bytes_rate || 0,
    }));

    return { disks, io };
  } catch (error) {
    console.error(`Error fetching disk health for ${serverId}:`, error.message);
    throw error;
  }
}

/**
 * Get systemd-like services monitored by Glances
 */
export async function getSystemdServices(serverId) {
  const baseUrl = getGlancesUrl(serverId);

  try {
    // Glances has a services plugin if configured
    const response = await fetch(`${baseUrl}/api/4/services`);
    if (!response.ok) {
      // Services plugin may not be enabled - return empty
      return [];
    }
    const services = await response.json();

    return (Array.isArray(services) ? services : []).map(s => ({
      name: s.service_name || s.name || 'unknown',
      status: s.status === 0 ? 'running' : s.status === 1 ? 'stopped' : 'unknown',
      cpu: s.cpu_percent || 0,
      mem: s.mem_percent || 0,
    }));
  } catch (error) {
    // Services plugin often not available - fail gracefully
    return [];
  }
}

/**
 * Get system update info via Docker exec on a management container
 * Falls back to returning "unavailable" if no method is available
 */
export async function getUpdateStatus(serverId) {
  const docker = serverManager.getDocker(serverId);
  if (!docker) {
    return { available: false, packages: [], lastCheck: null, error: 'No Docker connection' };
  }

  try {
    // Try to run apt in a privileged container that has access to the host's package state
    // First, try to find a running container with the 'dashboard.maintenance' label
    const containers = await docker.listContainers({ all: false });
    const maintenanceContainer = containers.find(c =>
      c.Labels?.['dashboard.maintenance'] === 'true'
    );

    if (!maintenanceContainer) {
      // Try running apt list via a temporary alpine container with host mount
      // This is a best-effort approach
      return {
        available: false,
        packages: [],
        lastCheck: new Date().toISOString(),
        error: 'Kein Wartungs-Container gefunden. Label "dashboard.maintenance=true" auf einem Container setzen.',
      };
    }

    // Execute apt list --upgradable in the container
    const container = docker.getContainer(maintenanceContainer.Id);
    const exec = await container.exec({
      Cmd: ['sh', '-c', 'apt list --upgradable 2>/dev/null || apk list --upgradable 2>/dev/null || echo "no-package-manager"'],
      AttachStdout: true,
      AttachStderr: true,
    });

    const stream = await exec.start({ Detach: false });
    const output = await new Promise((resolve) => {
      let data = '';
      stream.on('data', (chunk) => { data += chunk.toString(); });
      stream.on('end', () => resolve(data));
      setTimeout(() => resolve(data), 5000);
    });

    const lines = output.split('\n').filter(l => l.trim() && !l.includes('Listing...') && !l.includes('no-package-manager'));
    const packages = lines.map(line => {
      const match = line.match(/^([^\s/]+)\/?\S*\s+(\S+)/);
      return match ? { name: match[1], version: match[2] } : { name: line.trim(), version: '' };
    }).filter(p => p.name);

    return {
      available: packages.length > 0,
      packages,
      count: packages.length,
      lastCheck: new Date().toISOString(),
      error: null,
    };
  } catch (error) {
    return {
      available: false,
      packages: [],
      lastCheck: new Date().toISOString(),
      error: error.message,
    };
  }
}

// Helper to get glances base URL for a server
function getGlancesUrl(serverId) {
  const connection = serverManager.getConnection(serverId);
  return connection?.config?.glances_url || process.env.GLANCES_URL || 'http://localhost:61208';
}
