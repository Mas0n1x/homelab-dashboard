/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Konsolen-Proxy für Minecraft
import { WebSocketServer, WebSocket } from 'ws';
import { verifyToken } from '../middleware/auth.js';
import { merkeSitzung } from '../services/sitzungen.js';
import { tokenAusAnfrage } from './token.js';
import { getServer as getMcServer, accessHeaders as mcAccessHeaders } from '../services/mcServers.js';

// Minecraft-Live-Konsole: WebSocket-Proxy zum MC-Agent (Agent-Token bleibt server-seitig)
export const mcConsoleWss = new WebSocketServer({ noServer: true });
mcConsoleWss.on('connection', (client, req) => {
  let mcServer = null;
  try {
    const u = new URL(req.url, `http://${req.headers.host}`);
    merkeSitzung(verifyToken(tokenAusAnfrage(req) || '').id, client);
    mcServer = getMcServer(u.searchParams.get('server') || '');
  } catch { client.close(4001, 'Unauthorized'); return; }
  if (!mcServer || !mcServer.url || !mcServer.token) { client.close(4002, 'Agent nicht konfiguriert'); return; }
  const agentWsUrl = mcServer.url.replace(/^http/, 'ws') + '/console?token=' + encodeURIComponent(mcServer.token);
  // Access-Header müssen schon im Handshake mitgehen — nachträglich geht es nicht.
  const upstream = new WebSocket(agentWsUrl, { headers: mcAccessHeaders(mcServer) });
  const queue = [];
  upstream.on('open', () => { queue.forEach(m => upstream.send(m)); queue.length = 0; });
  upstream.on('message', (data) => { if (client.readyState === client.OPEN) client.send(data.toString()); });
  upstream.on('close', () => { try { client.close(); } catch { /* */ } });
  upstream.on('error', () => { try { client.close(); } catch { /* */ } });
  client.on('message', (data) => { const m = data.toString(); if (upstream.readyState === upstream.OPEN) upstream.send(m); else queue.push(m); });
  client.on('close', () => { try { upstream.close(); } catch { /* */ } });
  client.on('error', () => { try { upstream.close(); } catch { /* */ } });
});
