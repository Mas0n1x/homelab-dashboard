import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

import { initDatabase, migrateFromConfigJson, cleanupOldUptimeData } from './services/database.js';
import serverManager from './services/serverManager.js';
import { discoverServices, hasDiscoveryChanged } from './services/discovery.js';
import { checkAllServices } from './services/uptime.js';
import * as portfolio from './services/portfolio.js';

import systemRoutes from './routes/system.js';
import dockerRoutes from './routes/docker.js';
import servicesRoutes from './routes/services.js';
import serversRoutes from './routes/servers.js';
import uptimeRoutes from './routes/uptime.js';
import portfolioRoutes from './routes/portfolio.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database
const db = initDatabase();
console.log('Database initialized');

// Migrate config.json if it exists
await migrateFromConfigJson();

// Initialize server connections
serverManager.init();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/system', systemRoutes);
app.use('/api/docker', dockerRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/servers', serversRoutes);
app.use('/api/uptime', uptimeRoutes);
app.use('/api/portfolio', portfolioRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Create HTTP server
const server = createServer(app);

// WebSocket server for real-time updates
const wss = new WebSocketServer({ server, path: '/ws' });

// Track all connected clients
const clients = new Map();

wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket');
  const clientState = { subscriptions: new Set(), intervals: [] };
  clients.set(ws, clientState);

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'subscribe') {
        const serverId = data.serverId || 'local';
        clientState.subscriptions.add(serverId);

        const sendUpdates = async () => {
          try {
            const connection = serverManager.getConnection(serverId);
            if (!connection) return;

            const glances = connection.glances;
            const dockerInst = connection.docker;

            const dockerMod = await import('./services/docker.js');
            const [systemStats, containers, dockerInfo] = await Promise.all([
              glances?.getSystemStats().catch(() => null),
              dockerInst ? dockerMod.getContainers(dockerInst).catch(() => []) : [],
              dockerInst ? dockerMod.getDockerInfo(dockerInst).catch(() => null) : null
            ]);

            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({
                type: 'stats',
                serverId,
                data: {
                  system: systemStats,
                  containers,
                  docker: dockerInfo,
                  timestamp: new Date().toISOString()
                }
              }));
            }
          } catch (error) {
            console.error('Error sending stats:', error.message);
          }
        };

        // Send immediately
        sendUpdates();

        // Then every 2 seconds
        const interval = setInterval(sendUpdates, 2000);
        clientState.intervals.push(interval);
      }

      if (data.type === 'unsubscribe') {
        const serverId = data.serverId || 'local';
        clientState.subscriptions.delete(serverId);
        clientState.intervals.forEach(i => clearInterval(i));
        clientState.intervals = [];
      }
    } catch (error) {
      console.error('WebSocket message error:', error.message);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected from WebSocket');
    clientState.intervals.forEach(i => clearInterval(i));
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error.message);
    clientState.intervals.forEach(i => clearInterval(i));
    clients.delete(ws);
  });
});

// Broadcast to all connected clients
function broadcast(message) {
  const payload = JSON.stringify(message);
  wss.clients.forEach(client => {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  });
}

// Background: Service discovery (every 30 seconds)
setInterval(async () => {
  try {
    const servers = serverManager.getAllServers();
    for (const server of servers) {
      const discovered = await discoverServices(server.id);
      if (hasDiscoveryChanged(server.id, discovered)) {
        broadcast({
          type: 'discovery-update',
          serverId: server.id,
          data: discovered
        });
      }
    }
  } catch (error) {
    console.error('Discovery error:', error.message);
  }
}, 30000);

// Background: Uptime checks (every 60 seconds)
setInterval(async () => {
  try {
    const servers = serverManager.getAllServers();
    for (const server of servers) {
      const discovered = await discoverServices(server.id);
      const manual = db.prepare('SELECT id, url, server_id as serverId FROM manual_services WHERE server_id = ?').all(server.id);
      const allServices = [
        ...discovered.map(s => ({ id: s.id, url: s.url, serverId: s.serverId })),
        ...manual
      ];
      const results = await checkAllServices(allServices);
      broadcast({
        type: 'service-status',
        serverId: server.id,
        data: results
      });
    }
  } catch (error) {
    console.error('Uptime check error:', error.message);
  }
}, 60000);

// Background: Portfolio notifications (every 30 seconds)
setInterval(async () => {
  try {
    const newNotifications = await portfolio.checkForNotifications();
    if (newNotifications.length > 0) {
      broadcast({
        type: 'notifications',
        data: newNotifications
      });
    }

    const dashboardData = await portfolio.getDashboardData();
    if (dashboardData) {
      broadcast({
        type: 'portfolio',
        data: dashboardData
      });
    }
  } catch {
    // Portfolio may be offline, that's ok
  }
}, 30000);

// Background: Cleanup old uptime data (daily)
setInterval(() => {
  try {
    cleanupOldUptimeData();
  } catch (error) {
    console.error('Cleanup error:', error.message);
  }
}, 24 * 60 * 60 * 1000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Homelab Dashboard API running on port ${PORT}`);
  console.log(`WebSocket available at ws://localhost:${PORT}/ws`);
});
