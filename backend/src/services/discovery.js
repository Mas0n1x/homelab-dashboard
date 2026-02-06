import serverManager from './serverManager.js';

let previousDiscovered = new Map();

export async function discoverServices(serverId = 'local') {
  const docker = serverManager.getDocker(serverId);
  if (!docker) return [];

  try {
    const containers = await docker.listContainers({ all: true });

    return containers
      .filter(c => c.Labels?.['dashboard.enable'] === 'true')
      .map(c => ({
        id: `docker-${c.Id.substring(0, 12)}`,
        source: 'docker',
        containerId: c.Id,
        serverId,
        name: c.Labels['dashboard.name'] || c.Names[0]?.replace(/^\//, '') || 'unknown',
        icon: c.Labels['dashboard.icon'] || 'box',
        url: c.Labels['dashboard.url'] || detectUrlFromPorts(c.Ports),
        description: c.Labels['dashboard.description'] || '',
        category: c.Labels['dashboard.category'] || 'Allgemein',
        order: parseInt(c.Labels['dashboard.order'] || '999'),
        state: c.State,
        image: c.Image
      }));
  } catch (error) {
    console.error(`Discovery error for server ${serverId}:`, error.message);
    return [];
  }
}

function detectUrlFromPorts(ports) {
  if (!ports || ports.length === 0) return null;

  const webPorts = [80, 443, 8080, 8443, 3000, 8000, 8888, 9000];
  const webPort = ports.find(p => p.PublicPort && webPorts.includes(p.PrivatePort));

  if (webPort) {
    const protocol = webPort.PrivatePort === 443 || webPort.PrivatePort === 8443 ? 'https' : 'http';
    return `${protocol}://192.168.2.103:${webPort.PublicPort}`;
  }

  // Fall back to first public port
  const firstPublic = ports.find(p => p.PublicPort);
  if (firstPublic) {
    return `http://192.168.2.103:${firstPublic.PublicPort}`;
  }

  return null;
}

export function hasDiscoveryChanged(serverId, newDiscovered) {
  const key = serverId;
  const prev = previousDiscovered.get(key);

  if (!prev) {
    previousDiscovered.set(key, newDiscovered);
    return true;
  }

  const prevIds = new Set(prev.map(s => s.id));
  const newIds = new Set(newDiscovered.map(s => s.id));

  const changed = prevIds.size !== newIds.size ||
    newDiscovered.some(s => !prevIds.has(s.id)) ||
    newDiscovered.some(s => {
      const prevService = prev.find(p => p.id === s.id);
      return prevService && (prevService.state !== s.state || prevService.url !== s.url);
    });

  if (changed) {
    previousDiscovered.set(key, newDiscovered);
  }

  return changed;
}
