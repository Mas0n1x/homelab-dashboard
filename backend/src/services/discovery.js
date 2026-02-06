import serverManager from './serverManager.js';

let previousDiscovered = new Map();

// Ports that indicate a database or non-web service
const DB_PORTS = new Set([5432, 3306, 27017, 6379, 11211, 9200, 5672, 4369, 15672, 2181, 9092]);
// Ports that are typically web-accessible
const WEB_PORTS = new Set([80, 443, 3000, 3001, 4000, 5000, 5173, 8000, 8080, 8081, 8090, 8443, 8888, 9000, 9090]);

// Container names to always skip (our own dashboard containers)
const SKIP_CONTAINERS = new Set(['homelab-frontend', 'homelab-backend', 'homelab-nginx']);

// Known name mappings for common images
const IMAGE_NAMES = {
  'nginx': 'Web Server',
  'postgres': 'PostgreSQL',
  'mysql': 'MySQL',
  'redis': 'Redis',
  'mongo': 'MongoDB',
};

export async function discoverServices(serverId = 'local') {
  const docker = serverManager.getDocker(serverId);
  if (!docker) return [];

  try {
    const containers = await docker.listContainers({ all: true });

    return containers
      .filter(c => {
        const name = c.Names[0]?.replace(/^\//, '') || '';

        // Skip our own dashboard containers
        if (SKIP_CONTAINERS.has(name)) return false;

        // Explicit opt-out
        if (c.Labels?.['dashboard.enable'] === 'false') return false;

        // Explicit opt-in always works
        if (c.Labels?.['dashboard.enable'] === 'true') return true;

        // Auto-detect: include if container has public port mappings
        const hasPublicPort = c.Ports?.some(p => p.PublicPort && !DB_PORTS.has(p.PrivatePort));
        return hasPublicPort;
      })
      .map(c => {
        const name = c.Names[0]?.replace(/^\//, '') || 'unknown';
        const composeService = c.Labels?.['com.docker.compose.service'] || '';
        const composeProject = c.Labels?.['com.docker.compose.project'] || '';

        return {
          id: `docker-${c.Id.substring(0, 12)}`,
          source: 'docker',
          containerId: c.Id,
          serverId,
          name: c.Labels?.['dashboard.name'] || formatContainerName(composeService || name),
          icon: c.Labels?.['dashboard.icon'] || guessIcon(composeService || name, c.Image),
          url: c.Labels?.['dashboard.url'] || detectUrlFromPorts(c.Ports),
          description: c.Labels?.['dashboard.description'] || formatDescription(composeProject, composeService, c.Image),
          category: c.Labels?.['dashboard.category'] || guessCategory(composeProject, composeService, name),
          order: parseInt(c.Labels?.['dashboard.order'] || '999'),
          state: c.State,
          status: c.Status,
          image: c.Image,
          project: composeProject
        };
      });
  } catch (error) {
    console.error(`Discovery error for server ${serverId}:`, error.message);
    return [];
  }
}

function formatContainerName(name) {
  // Turn "mas0n1x-portfolio" into "Mas0n1x Portfolio" etc.
  return name
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

function formatDescription(project, service, image) {
  if (project && service && project !== service) {
    return `${formatContainerName(project)} — ${formatContainerName(service)}`;
  }
  // Extract base image name
  const baseImage = image?.split(':')[0]?.split('/').pop() || '';
  return baseImage ? `Image: ${baseImage}` : '';
}

function guessIcon(name, image) {
  const lower = (name + ' ' + image).toLowerCase();

  if (lower.includes('wiki')) return 'book-open';
  if (lower.includes('portfolio')) return 'globe';
  if (lower.includes('dashboard') || lower.includes('lspd')) return 'shield';
  if (lower.includes('personal')) return 'users';
  if (lower.includes('map') || lower.includes('leaflet') || lower.includes('karte')) return 'map';
  if (lower.includes('bot') || lower.includes('discord')) return 'bot';
  if (lower.includes('monitor') || lower.includes('glances') || lower.includes('grafana')) return 'activity';
  if (lower.includes('handbuch') || lower.includes('docs') || lower.includes('book')) return 'file-text';
  if (lower.includes('cloudflare') || lower.includes('tunnel')) return 'cloud';
  if (lower.includes('nginx') || lower.includes('proxy') || lower.includes('traefik')) return 'server';
  if (lower.includes('postgres') || lower.includes('mysql') || lower.includes('mongo') || lower.includes('redis') || lower.includes('db')) return 'database';
  if (lower.includes('mail') || lower.includes('smtp')) return 'mail';
  if (lower.includes('git') || lower.includes('gitea') || lower.includes('gitlab')) return 'git-branch';
  if (lower.includes('download') || lower.includes('torrent')) return 'download';
  if (lower.includes('media') || lower.includes('plex') || lower.includes('jellyfin')) return 'play';
  if (lower.includes('home') || lower.includes('hass')) return 'home';
  if (lower.includes('sales') || lower.includes('shop') || lower.includes('store')) return 'shopping-cart';

  return 'box';
}

function guessCategory(project, service, name) {
  const lower = (project + ' ' + service + ' ' + name).toLowerCase();

  if (lower.includes('lspd') || lower.includes('corleone') || lower.includes('personal') || lower.includes('handbuch') || lower.includes('karte')) return 'LSPD';
  if (lower.includes('portfolio') || lower.includes('mas0n1x')) return 'Portfolio';
  if (lower.includes('monitor') || lower.includes('glances') || lower.includes('grafana')) return 'Monitoring';
  if (lower.includes('wiki') || lower.includes('docs') || lower.includes('handbuch')) return 'Dokumentation';
  if (lower.includes('db') || lower.includes('postgres') || lower.includes('mysql') || lower.includes('redis')) return 'Datenbank';

  return 'Dienste';
}

function detectUrlFromPorts(ports) {
  if (!ports || ports.length === 0) return null;

  // Find the best web port
  const publicPorts = ports.filter(p => p.PublicPort && !DB_PORTS.has(p.PrivatePort));

  if (publicPorts.length === 0) return null;

  // Prefer known web ports
  const webPort = publicPorts.find(p => WEB_PORTS.has(p.PrivatePort)) || publicPorts[0];

  if (webPort) {
    const protocol = webPort.PrivatePort === 443 || webPort.PrivatePort === 8443 ? 'https' : 'http';
    return `${protocol}://192.168.2.103:${webPort.PublicPort}`;
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
