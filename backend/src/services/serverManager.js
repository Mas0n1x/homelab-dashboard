import Docker from 'dockerode';
import { getDb } from './database.js';
import { createGlancesClient } from './glances.js';

class ServerManager {
  constructor() {
    this.connections = new Map();
  }

  init() {
    const db = getDb();
    const servers = db.prepare('SELECT * FROM servers').all();
    for (const server of servers) {
      this.connect(server);
    }
    console.log(`ServerManager initialized with ${servers.length} server(s)`);
  }

  connect(serverConfig) {
    let dockerInstance;
    if (serverConfig.is_local || serverConfig.docker_socket) {
      dockerInstance = new Docker({
        socketPath: serverConfig.docker_socket || '/var/run/docker.sock'
      });
    } else if (serverConfig.docker_host) {
      const url = new URL(serverConfig.docker_host);
      dockerInstance = new Docker({
        host: url.hostname,
        port: url.port || 2376,
        protocol: url.protocol === 'https:' ? 'https' : 'http'
      });
    }

    const glancesClient = serverConfig.glances_url
      ? createGlancesClient(serverConfig.glances_url)
      : null;

    this.connections.set(serverConfig.id, {
      config: serverConfig,
      docker: dockerInstance,
      glances: glancesClient,
      status: 'connected',
      lastSeen: new Date().toISOString()
    });
  }

  getConnection(serverId = 'local') {
    return this.connections.get(serverId);
  }

  getDocker(serverId = 'local') {
    return this.connections.get(serverId)?.docker;
  }

  getGlances(serverId = 'local') {
    return this.connections.get(serverId)?.glances;
  }

  getAllServers() {
    const db = getDb();
    const servers = db.prepare('SELECT * FROM servers').all();
    return servers.map(s => ({
      ...s,
      status: this.connections.get(s.id)?.status || 'disconnected',
      lastSeen: this.connections.get(s.id)?.lastSeen || null
    }));
  }

  addServer(config) {
    const db = getDb();
    const id = config.id || `server-${Date.now()}`;
    db.prepare(
      'INSERT INTO servers (id, name, host, is_local, glances_url, docker_socket, docker_host) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, config.name, config.host, 0, config.glancesUrl || null, config.dockerSocket || null, config.dockerHost || null);

    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(id);
    this.connect(server);
    return server;
  }

  removeServer(serverId) {
    if (serverId === 'local') {
      throw new Error('Cannot remove the local server');
    }
    const db = getDb();
    db.prepare('DELETE FROM servers WHERE id = ?').run(serverId);
    this.connections.delete(serverId);
  }

  updateServer(serverId, updates) {
    const db = getDb();
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (['name', 'host', 'glances_url', 'docker_socket', 'docker_host'].includes(key)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(serverId);
      db.prepare(`UPDATE servers SET ${fields.join(', ')} WHERE id = ?`).run(...values);

      // Reconnect with new config
      const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
      if (server) this.connect(server);
    }

    return db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
  }
}

const serverManager = new ServerManager();
export default serverManager;
