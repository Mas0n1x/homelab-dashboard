/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Live-Verbindung der Oberfläche
import { WebSocketServer } from 'ws';
import serverManager from '../services/serverManager.js';
import { verifyToken } from '../middleware/auth.js';
import { merkeSitzung } from '../services/sitzungen.js';
import { handleTerminalOpen, handleHostShellOpen, handleTerminalInput, handleTerminalResize, handleLogStream, stopLogStream, cleanupLogSessions, cleanupTerminalSession } from './terminals.js';
import { withTimeout } from '../jobs/hilfen.js';

// WebSocket server for real-time updates (noServer: Upgrades werden unten geroutet)
export const wss = new WebSocketServer({ noServer: true });

// Track all connected clients
const clients = new Map();

wss.on('connection', (ws, req) => {
  // Verify JWT token from query parameter
  let benutzer;
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    if (!token) {
      ws.close(4001, 'Unauthorized');
      return;
    }
    benutzer = verifyToken(token);
  } catch (err) {
    ws.close(4001, 'Unauthorized');
    return;
  }

  merkeSitzung(benutzer.id, ws);
  ws.benutzer = benutzer;
  console.log('Client connected to WebSocket');
  // Ein Takt je abonniertem Server: Abbestellen oder erneutes Abonnieren trifft nur ihn.
  const clientState = { intervals: new Map() };
  const stoppeTakt = (serverId) => {
    clearInterval(clientState.intervals.get(serverId));
    clientState.intervals.delete(serverId);
  };
  const stoppeAlle = () => [...clientState.intervals.keys()].forEach(stoppeTakt);
  clients.set(ws, clientState);

  ws.on('message', async (message) => {
    if (ws.readyState !== ws.OPEN) return;
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'subscribe') {
        const serverId = data.serverId || 'local';

        // Overlap-Guard: hängt ein Aufruf (z. B. SSH-Kanal nach einem Tunnelabriss),
        // stauen sich sonst alle 10 s weitere hängende Läufe auf — und die Karte
        // bleibt auf „Verbinde…", obwohl der Host längst wieder da ist.
        let sendetGerade = false;
        const sendUpdates = async () => {
          if (sendetGerade) return;
          sendetGerade = true;
          try {
            const connection = serverManager.getConnection(serverId);
            if (!connection) return;

            const glances = connection.glances;
            const dockerInst = connection.docker;

            const dockerMod = await import('../services/docker.js');
            // Jede Teilabfrage mit eigenem Zeitlimit: die Systemwerte (Glances)
            // dürfen nie auf einen hängenden Docker-Aufruf warten.
            const [systemStats, containers, dockerInfo] = await Promise.all([
              glances ? withTimeout(glances.getSystemStats(), 8000, 'glances').catch(() => null) : null,
              dockerInst ? withTimeout(dockerMod.getContainers(dockerInst), 12000, 'docker').catch(() => []) : [],
              dockerInst ? withTimeout(dockerMod.getDockerInfo(dockerInst), 12000, 'docker-info').catch(() => null) : null
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
          } finally {
            sendetGerade = false;
          }
        };

        // Send immediately
        sendUpdates();

        // Danach alle 10 Sekunden. Bewusst nicht schneller: jeder Lauf fragt
        // die ganze Flotte ab, das war bei 2 Sekunden unnoetige Dauerlast.
        stoppeTakt(serverId);
        clientState.intervals.set(serverId, setInterval(sendUpdates, 10000));
      }

      // Ohne serverId: alles abbestellen (Serverwechsel in der Oberfläche).
      if (data.type === 'unsubscribe') {
        if (data.serverId) stoppeTakt(data.serverId);
        else stoppeAlle();
      }

      // Terminal messages
      if (data.type === 'terminal-open') await handleTerminalOpen(ws, data);
      if (data.type === 'host-shell-open') await handleHostShellOpen(ws, data);
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
    stoppeAlle();
    cleanupTerminalSession(ws);
    cleanupLogSessions(ws);
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error.message);
    stoppeAlle();
    cleanupTerminalSession(ws);
    cleanupLogSessions(ws);
    clients.delete(ws);
  });
});

// Broadcast to all connected clients
export function broadcast(message) {
  const payload = JSON.stringify(message);
  wss.clients.forEach(client => {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  });
}
