import { Router } from 'express';
import { getDb } from '../services/database.js';
import serverManager from '../services/serverManager.js';

const router = Router();

// Default templates
const DEFAULT_TEMPLATES = [
  { id: 'tpl-nginx', name: 'Nginx', description: 'Webserver & Reverse Proxy', image: 'nginx:alpine', ports: ['80:80', '443:443'], env: [], volumes: [], restart_policy: 'unless-stopped', category: 'Web' },
  { id: 'tpl-postgres', name: 'PostgreSQL', description: 'Relationale Datenbank', image: 'postgres:16-alpine', ports: ['5432:5432'], env: ['POSTGRES_PASSWORD=changeme', 'POSTGRES_DB=mydb'], volumes: ['pgdata:/var/lib/postgresql/data'], restart_policy: 'unless-stopped', category: 'Datenbank' },
  { id: 'tpl-redis', name: 'Redis', description: 'In-Memory Cache & Message Broker', image: 'redis:alpine', ports: ['6379:6379'], env: [], volumes: ['redis-data:/data'], restart_policy: 'unless-stopped', category: 'Datenbank' },
  { id: 'tpl-mariadb', name: 'MariaDB', description: 'MySQL-kompatibler Datenbankserver', image: 'mariadb:11', ports: ['3306:3306'], env: ['MARIADB_ROOT_PASSWORD=changeme', 'MARIADB_DATABASE=mydb'], volumes: ['mariadb-data:/var/lib/mysql'], restart_policy: 'unless-stopped', category: 'Datenbank' },
  { id: 'tpl-mongo', name: 'MongoDB', description: 'NoSQL Datenbank', image: 'mongo:7', ports: ['27017:27017'], env: [], volumes: ['mongo-data:/data/db'], restart_policy: 'unless-stopped', category: 'Datenbank' },
  { id: 'tpl-portainer', name: 'Portainer', description: 'Docker Management UI', image: 'portainer/portainer-ce:latest', ports: ['9443:9443'], env: [], volumes: ['/var/run/docker.sock:/var/run/docker.sock', 'portainer-data:/data'], restart_policy: 'always', category: 'Management' },
  { id: 'tpl-uptime-kuma', name: 'Uptime Kuma', description: 'Self-hosted Monitoring', image: 'louislam/uptime-kuma:latest', ports: ['3001:3001'], env: [], volumes: ['uptime-kuma:/app/data'], restart_policy: 'unless-stopped', category: 'Monitoring' },
  { id: 'tpl-grafana', name: 'Grafana', description: 'Metriken & Dashboards', image: 'grafana/grafana:latest', ports: ['3000:3000'], env: [], volumes: ['grafana-data:/var/lib/grafana'], restart_policy: 'unless-stopped', category: 'Monitoring' },
  { id: 'tpl-pihole', name: 'Pi-hole', description: 'DNS-basierter Adblocker', image: 'pihole/pihole:latest', ports: ['53:53/tcp', '53:53/udp', '8082:80'], env: ['WEBPASSWORD=changeme'], volumes: ['pihole-etc:/etc/pihole', 'pihole-dns:/etc/dnsmasq.d'], restart_policy: 'unless-stopped', category: 'Netzwerk' },
  { id: 'tpl-wireguard', name: 'WireGuard', description: 'VPN Server', image: 'linuxserver/wireguard:latest', ports: ['51820:51820/udp'], env: ['PUID=1000', 'PGID=1000', 'TZ=Europe/Berlin'], volumes: ['wireguard-config:/config'], restart_policy: 'unless-stopped', category: 'Netzwerk' },
];

router.get('/', (req, res) => {
  const db = getDb();
  const custom = db.prepare('SELECT * FROM container_templates ORDER BY category, name').all().map(t => ({
    ...t,
    ports: JSON.parse(t.ports || '[]'),
    env: JSON.parse(t.env || '[]'),
    volumes: JSON.parse(t.volumes || '[]'),
    isCustom: true,
  }));
  const all = [...DEFAULT_TEMPLATES.map(t => ({ ...t, isCustom: false })), ...custom];
  res.json(all);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { name, description, image, ports, env, volumes, restart_policy, category } = req.body;
  if (!name || !image) return res.status(400).json({ error: 'Name and image required' });
  const id = `tpl-custom-${Date.now()}`;
  db.prepare('INSERT INTO container_templates (id, name, description, image, ports, env, volumes, restart_policy, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, name, description || '', image, JSON.stringify(ports || []), JSON.stringify(env || []), JSON.stringify(volumes || []), restart_policy || 'unless-stopped', category || 'Allgemein');
  res.json({ id });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM container_templates WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Deploy template as container
router.post('/:id/deploy', async (req, res) => {
  try {
    const docker = serverManager.getDocker(req.body.serverId || 'local');
    if (!docker) return res.status(400).json({ error: 'Server nicht verbunden' });

    const { containerName, ports, env, volumes, restart_policy, image } = req.body;
    if (!image || !containerName) return res.status(400).json({ error: 'Image and name required' });

    // Pull image first
    await new Promise((resolve, reject) => {
      docker.pull(image, (err, stream) => {
        if (err) return reject(err);
        docker.modem.followProgress(stream, (err) => err ? reject(err) : resolve(null));
      });
    });

    // Parse port bindings
    const exposedPorts = {};
    const portBindings = {};
    (ports || []).forEach(p => {
      const [hostPort, containerPort] = p.split(':');
      const proto = containerPort.includes('/') ? '' : '/tcp';
      const key = containerPort.includes('/') ? containerPort : `${containerPort}${proto}`;
      exposedPorts[key] = {};
      portBindings[key] = [{ HostPort: hostPort }];
    });

    // Parse volumes
    const binds = (volumes || []).filter(v => v.includes(':'));

    const container = await docker.createContainer({
      name: containerName,
      Image: image,
      Env: env || [],
      ExposedPorts: exposedPorts,
      HostConfig: {
        PortBindings: portBindings,
        Binds: binds,
        RestartPolicy: { Name: restart_policy || 'unless-stopped' },
      },
    });

    await container.start();
    res.json({ id: container.id, name: containerName });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
