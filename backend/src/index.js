import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

import { initDatabase, migrateFromConfigJson, cleanupOldUptimeData } from './services/database.js';
import serverManager from './services/serverManager.js';
import { discoverServices, hasDiscoveryChanged } from './services/discovery.js';
import { checkAllServices } from './services/uptime.js';
import * as portfolio from './services/portfolio.js';
import { ensureDefaultUser, cleanupExpiredTokens } from './services/auth.js';
import { authenticateToken, verifyToken } from './middleware/auth.js';

import authRoutes from './routes/auth.js';
import systemRoutes from './routes/system.js';
import dockerRoutes from './routes/docker.js';
import servicesRoutes from './routes/services.js';
import serversRoutes from './routes/servers.js';
import uptimeRoutes from './routes/uptime.js';
import portfolioRoutes from './routes/portfolio.js';
import favoritesRoutes from './routes/favorites.js';
import alertsRoutes from './routes/alerts.js';
import speedtestRoutes from './routes/speedtest.js';
import bookmarksRoutes from './routes/bookmarks.js';
import notesRoutes from './routes/notes.js';
import calendarRoutes from './routes/calendar.js';
import templatesRoutes from './routes/templates.js';
import trackerRoutes from './routes/tracker.js';
import mailRoutes from './routes/mail.js';
import auditRoutes from './routes/audit.js';
import backupRoutes from './routes/backup.js';
import { checkAlerts } from './services/alerting.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database
const db = initDatabase();
console.log('Database initialized');

// Migrate config.json if it exists
await migrateFromConfigJson();

// Create default admin user if none exists
await ensureDefaultUser();

// Initialize server connections
serverManager.init();

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json());

// Public routes (no auth required)
app.use('/api/auth', authRoutes);
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Mail inbound webhook (auth via webhook secret, not JWT)
import { handleInboundMail } from './routes/mailInbound.js';
app.post('/api/mail/inbound', express.json({ limit: '25mb' }), handleInboundMail);

// Auth middleware for all other /api routes
app.use('/api', authenticateToken);

// Protected routes
app.use('/api/system', systemRoutes);
app.use('/api/docker', dockerRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/servers', serversRoutes);
app.use('/api/uptime', uptimeRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/speedtest', speedtestRoutes);
app.use('/api/bookmarks', bookmarksRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/tracker', trackerRoutes);
app.use('/api/mail', mailRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/backup', backupRoutes);

// Create HTTP server
const server = createServer(app);

// WebSocket server for real-time updates
const wss = new WebSocketServer({ server, path: '/ws' });

// Track all connected clients
const clients = new Map();

// Terminal sessions: ws -> { exec, stream }
const terminalSessions = new Map();
// Log streaming sessions: ws -> Map<containerId, stream>
const logSessions = new Map();
// Previous container states for crash detection
let previousContainerStates = new Map();

async function handleTerminalOpen(ws, data) {
  const serverId = data.serverId || 'local';
  const containerId = data.containerId;

  const docker = serverManager.getDocker(serverId);
  if (!docker) {
    ws.send(JSON.stringify({ type: 'terminal-error', error: 'Server nicht verbunden' }));
    return;
  }

  try {
    // Close existing session if any
    if (terminalSessions.has(ws)) {
      const old = terminalSessions.get(ws);
      try { old.stream?.destroy(); } catch {}
      terminalSessions.delete(ws);
    }

    const container = docker.getContainer(containerId);
    const info = await container.inspect();

    if (!info.State.Running) {
      ws.send(JSON.stringify({ type: 'terminal-error', error: 'Container läuft nicht' }));
      return;
    }

    // Try sh first (works in Alpine), fall back to bash
    const exec = await container.exec({
      Cmd: ['/bin/sh'],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      Env: ['TERM=xterm-256color', 'COLUMNS=120', 'LINES=30']
    });

    const stream = await exec.start({ hijack: true, stdin: true, Tty: true });

    terminalSessions.set(ws, { exec, stream, containerId });

    stream.on('data', (chunk) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'terminal-data',
          data: chunk.toString('base64')
        }));
      }
    });

    stream.on('end', () => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'terminal-closed' }));
      }
      terminalSessions.delete(ws);
    });

    ws.send(JSON.stringify({
      type: 'terminal-opened',
      containerId,
      name: info.Name.replace(/^\//, '')
    }));

    console.log(`Terminal opened for container ${info.Name}`);
  } catch (error) {
    ws.send(JSON.stringify({ type: 'terminal-error', error: error.message }));
  }
}

function handleTerminalInput(ws, data) {
  const session = terminalSessions.get(ws);
  if (!session?.stream) return;

  try {
    const buf = Buffer.from(data.data, 'base64');
    session.stream.write(buf);
  } catch {}
}

async function handleTerminalResize(ws, data) {
  const session = terminalSessions.get(ws);
  if (!session?.exec) return;

  try {
    // Use Docker API to resize the exec TTY
    const docker = serverManager.getDocker(data.serverId || 'local');
    if (!docker) return;

    await docker.getExec(session.exec.id).resize({
      h: data.rows || 30,
      w: data.cols || 120
    });
  } catch {}
}

async function handleLogStream(ws, data) {
  const serverId = data.serverId || 'local';
  const containerId = data.containerId;
  const tail = data.tail || 100;

  const docker = serverManager.getDocker(serverId);
  if (!docker) {
    ws.send(JSON.stringify({ type: 'log-error', error: 'Server nicht verbunden' }));
    return;
  }

  try {
    // Stop existing log stream for this container
    stopLogStream(ws, containerId);

    const container = docker.getContainer(containerId);
    const stream = await container.logs({
      follow: true,
      stdout: true,
      stderr: true,
      tail: tail,
      timestamps: true,
    });

    if (!logSessions.has(ws)) logSessions.set(ws, new Map());
    logSessions.get(ws).set(containerId, stream);

    stream.on('data', (chunk) => {
      if (ws.readyState === ws.OPEN) {
        // Strip Docker stream header (8 bytes)
        const lines = chunk.toString('utf8');
        ws.send(JSON.stringify({
          type: 'log-data',
          containerId,
          data: lines,
        }));
      }
    });

    stream.on('end', () => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'log-closed', containerId }));
      }
      logSessions.get(ws)?.delete(containerId);
    });

    ws.send(JSON.stringify({ type: 'log-opened', containerId }));
  } catch (error) {
    ws.send(JSON.stringify({ type: 'log-error', containerId, error: error.message }));
  }
}

function stopLogStream(ws, containerId) {
  const streams = logSessions.get(ws);
  if (!streams) return;
  const stream = streams.get(containerId);
  if (stream) {
    try { stream.destroy(); } catch {}
    streams.delete(containerId);
  }
}

function cleanupLogSessions(ws) {
  const streams = logSessions.get(ws);
  if (streams) {
    for (const [, stream] of streams) {
      try { stream.destroy(); } catch {}
    }
    logSessions.delete(ws);
  }
}

function cleanupTerminalSession(ws) {
  const session = terminalSessions.get(ws);
  if (session) {
    try { session.stream?.destroy(); } catch {}
    terminalSessions.delete(ws);
  }
}

wss.on('connection', (ws, req) => {
  // Verify JWT token from query parameter
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    if (!token) {
      ws.close(4001, 'Unauthorized');
      return;
    }
    verifyToken(token);
  } catch (err) {
    ws.close(4001, 'Unauthorized');
    return;
  }

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

      // Terminal messages
      if (data.type === 'terminal-open') await handleTerminalOpen(ws, data);
      if (data.type === 'terminal-input') handleTerminalInput(ws, data);
      if (data.type === 'terminal-resize') await handleTerminalResize(ws, data);
      if (data.type === 'terminal-close') cleanupTerminalSession(ws);

      // Log streaming
      if (data.type === 'log-stream-start') await handleLogStream(ws, data);
      if (data.type === 'log-stream-stop') stopLogStream(ws, data.containerId);
    } catch (error) {
      console.error('WebSocket message error:', error.message);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected from WebSocket');
    clientState.intervals.forEach(i => clearInterval(i));
    cleanupTerminalSession(ws);
    cleanupLogSessions(ws);
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error.message);
    clientState.intervals.forEach(i => clearInterval(i));
    cleanupTerminalSession(ws);
    cleanupLogSessions(ws);
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

      // Send new portfolio requests + customers to alerting (Discord/Telegram webhooks)
      const requestNotifs = newNotifications.filter(n => n.type === 'new-request');
      const customerNotifs = newNotifications.filter(n => n.type === 'new-customer');
      const allRequests = requestNotifs.flatMap(n => n.requests || []);
      const allCustomers = customerNotifs.flatMap(n => n.customers || []);
      if (allRequests.length > 0 || allCustomers.length > 0) {
        await checkAlerts({
          cpuPercent: 0,
          memPercent: 0,
          crashedContainers: [],
          offlineServices: [],
          portfolioRequests: allRequests,
          portfolioCustomers: allCustomers,
        });
      }
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

// Background: Container stats (every 5 seconds)
setInterval(async () => {
  try {
    const dockerMod = await import('./services/docker.js');
    const servers = serverManager.getAllServers();
    for (const server of servers) {
      const dockerInst = serverManager.getDocker(server.id);
      if (!dockerInst) continue;
      const stats = await dockerMod.getAllContainerStats(dockerInst);
      broadcast({ type: 'container-stats', serverId: server.id, data: stats });
    }
  } catch {}
}, 5000);

// Background: Alerting check (every 30 seconds)
setInterval(async () => {
  try {
    const servers = serverManager.getAllServers();
    for (const server of servers) {
      const connection = serverManager.getConnection(server.id);
      if (!connection) continue;

      const glances = connection.glances;
      const dockerInst = connection.docker;
      const systemStats = glances ? await glances.getSystemStats().catch(() => null) : null;

      const dockerMod = await import('./services/docker.js');
      const containers = dockerInst ? await dockerMod.getContainers(dockerInst).catch(() => []) : [];

      // Detect crashed containers
      const crashedContainers = [];
      const currentStates = new Map();
      containers.forEach(c => currentStates.set(c.id, c.state));

      for (const [id, prevState] of previousContainerStates) {
        const currentState = currentStates.get(id);
        if (prevState === 'running' && currentState && currentState !== 'running') {
          const c = containers.find(x => x.id === id);
          if (c) crashedContainers.push(c);
        }
      }
      previousContainerStates = currentStates;

      await checkAlerts({
        cpuPercent: systemStats?.cpu?.total || 0,
        memPercent: systemStats?.memory?.percent || 0,
        crashedContainers,
        offlineServices: [],
      });
    }
  } catch {}
}, 30000);

// Background: Cleanup old uptime data (daily)
setInterval(() => {
  try {
    cleanupOldUptimeData();
  } catch (error) {
    console.error('Cleanup error:', error.message);
  }
}, 24 * 60 * 60 * 1000);

// Background: Cleanup expired refresh tokens (every hour)
setInterval(() => {
  try {
    cleanupExpiredTokens();
  } catch (error) {
    console.error('Token cleanup error:', error.message);
  }
}, 60 * 60 * 1000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Homelab Dashboard API running on port ${PORT}`);
  console.log(`WebSocket available at ws://localhost:${PORT}/ws`);
});
