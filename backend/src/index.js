/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';

import { initDatabase, migrateFromConfigJson } from './services/database.js';
import serverManager from './services/serverManager.js';
import { ensureDefaultUser } from './services/auth.js';
import { authenticateToken } from './middleware/auth.js';

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
import tasksRoutes from './routes/tasks.js';
import templatesRoutes from './routes/templates.js';
import mailRoutes from './routes/mail.js';
import auditRoutes from './routes/audit.js';
import backupRoutes from './routes/backup.js';
import maintenanceRoutes from './routes/maintenance.js';
import minecraftRoutes from './routes/minecraft.js';
import trafficRoutes from './routes/traffic.js';
import salenetRoutes from './routes/salenet.js';
import businessRoutes from './routes/business.js';
import proxmoxRoutes from './routes/proxmox.js';
import pelicanRoutes from './routes/pelican.js';
import gameserverRoutes from './routes/gameservers.js';
import statusRoutes from './routes/status.js';
import timeRoutes from './routes/time.js';
import etsyRoutes, { createEtsyCallback } from './routes/etsy.js';
import metricsRoutes from './routes/metrics.js';
import tunnelsRoutes from './routes/tunnels.js';
import ssoRoutes from './routes/sso.js';
import botsRoutes, { createBotWebhookPassthrough, createBotEventsIngest } from './routes/bots.js';
import filesRoutes from './routes/files.js';
import { sharesAdminRoutes, sharePublicRoutes } from './routes/shares.js';
import { wss, broadcast } from './ws/dashboard.js';
import { mcConsoleWss, gsConsoleWss } from './ws/consoles.js';
import { starteJobs } from './jobs/index.js';
import { protokolliereAenderungen } from './middleware/audit.js';
import { botServerStatus } from './routes/intern.js';

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
// Ohne CORS_ORIGIN keine Wildcard-Origin mit Credentials (Fehlkonfiguration).
// Fehlt die Variable, wird der Origin nicht gespiegelt (same-origin only).
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean)
  : false;
app.use(cors({ origin: corsOrigins, credentials: true }));

// Bot-Webhook-Passthrough (öffentlich, HMAC wird in der Bot-Runtime geprüft) — MUSS vor
// dem globalen JSON-Parser stehen, damit der rohe Body für die Signatur erhalten bleibt.
app.post('/api/bots/:bot/webhook/github', express.json({ limit: '5mb', verify: (req, _res, buf) => { req.rawBody = buf; } }), createBotWebhookPassthrough());

// Business-Events aus Portfolio/SaleNet (öffentlich, per Bearer-Token gesichert)
app.post('/api/bots/:bot/events', express.json({ limit: '2mb' }), createBotEventsIngest());

// Uploads kommen als roher Body. Ohne diese Ausnahme schluckt der JSON-Parser
// hochgeladene .json-Dateien, und gespeichert würde eine leere Datei.
const jsonParser = express.json({ limit: '48mb' });
const ROH_UPLOADS = new Set(['/api/files/upload', '/api/mail/upload']);
app.use((req, res, next) => (ROH_UPLOADS.has(req.path) ? next() : jsonParser(req, res, next)));

// Public routes (no auth required)
// Nur-Lese-Zugang für die Bot-Runtime im Compose-Netz (eigenes Token, kein Konto)
app.get('/api/intern/server-status', botServerStatus);
app.use('/api/auth', authRoutes);
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Mail inbound webhook (auth via webhook secret, not JWT)
import { handleInboundMail } from './routes/mailInbound.js';
app.post('/api/mail/inbound', express.json({ limit: '25mb' }), handleInboundMail);

// Etsy-Rückruf: Etsy schickt den Browser hierher, ohne Bearer-Token. Muss
// deshalb VOR der Anmelde-Middleware stehen; abgesichert über den
// Zustandswert aus dem Anmeldevorgang.
app.get('/api/etsy/callback', createEtsyCallback());

// Öffentliche Freigabelinks (Download per Token, optional Passwort) — VOR der Anmelde-Middleware.
app.use('/api/share', sharePublicRoutes);

// Auth middleware for all other /api routes
app.use('/api', authenticateToken);
app.use('/api', protokolliereAenderungen);

// Protected routes
app.use('/api/system', systemRoutes);
app.use('/api/docker', dockerRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/servers', serversRoutes);
app.use('/api/minecraft', minecraftRoutes);
app.use('/api/traffic', trafficRoutes);
app.use('/api/salenet', salenetRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/proxmox', proxmoxRoutes);
app.use('/api/pelican', pelicanRoutes);
app.use('/api/gameservers', gameserverRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/time', timeRoutes);
app.use('/api/etsy', etsyRoutes);
app.use('/api/uptime', uptimeRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/speedtest', speedtestRoutes);
app.use('/api/bookmarks', bookmarksRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/mail', mailRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/tunnels', tunnelsRoutes);
app.use('/api/sso', ssoRoutes);
app.use('/api/bots', botsRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/shares', sharesAdminRoutes);

app.locals.broadcast = broadcast;

// Create HTTP server
const server = createServer(app);

// Upgrade-Router: /ws (Dashboard) und /api/minecraft/console (MC-Konsole)
server.on('upgrade', (req, socket, head) => {
  let pathname = '/';
  try { pathname = new URL(req.url, `http://${req.headers.host}`).pathname; } catch { /* */ }
  if (pathname === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  } else if (pathname === '/api/minecraft/console') {
    mcConsoleWss.handleUpgrade(req, socket, head, (ws) => mcConsoleWss.emit('connection', ws, req));
  } else if (pathname === '/api/gameservers/console') {
    gsConsoleWss.handleUpgrade(req, socket, head, (ws) => gsConsoleWss.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

starteJobs();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Homelab Dashboard API running on port ${PORT}`);
  console.log(`WebSocket available at ws://localhost:${PORT}/ws`);
});

// Graceful Shutdown: vor dem Beenden die WAL in die Haupt-DB schreiben und die
// Verbindung sauber schließen. Ohne das riskiert ein SIGKILL nach dem Compose-
// Stop-Timeout WAL-Inkonsistenzen (bekannte DB-Korruptionsfalle).
let shuttingDown = false;
function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} empfangen — fahre sauber herunter...`);
  try { server.close(); } catch { /* egal */ }
  // Dauerhafte SSH-Verbindungen zu den Remote-Servern sauber beenden.
  try { serverManager.closeAll(); } catch { /* egal */ }
  try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) { console.error('WAL-Checkpoint fehlgeschlagen:', e.message); }
  try { db.close(); } catch (e) { console.error('DB-Close fehlgeschlagen:', e.message); }
  process.exit(0);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
