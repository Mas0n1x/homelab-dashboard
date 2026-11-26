/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Konsolen-Proxys für Minecraft und Pelican
import { WebSocketServer, WebSocket } from 'ws';
import { verifyToken } from '../middleware/auth.js';
import { getServer as getMcServer, accessHeaders as mcAccessHeaders } from '../services/mcServers.js';
import * as gameservers from '../services/gameservers.js';

// Minecraft-Live-Konsole: WebSocket-Proxy zum MC-Agent (Agent-Token bleibt server-seitig)
export const mcConsoleWss = new WebSocketServer({ noServer: true });
// Pelican-Spielserver: Konsole kommt per WebSocket von Wings, nicht vom mc-agent.
// Gleiches Protokoll wie beim Agent ({type:'log'|'error'|…} raus, {type:'command'} rein).
export const gsConsoleWss = new WebSocketServer({ noServer: true });
async function gameserverKonsole(client, req) {
  try {
    const u = new URL(req.url, `http://${req.headers.host}`);
    verifyToken(u.searchParams.get('token') || '');
    const id = (u.searchParams.get('server') || '').replace(/^pelican:/, '');
    const server = await gameservers.getServer(id);
    gameservers.konsoleAnhaengen(client, server);
  } catch (e) {
    client.close(e?.status === 404 ? 4004 : 4001, 'Unauthorized');
  }
}
gsConsoleWss.on('connection', gameserverKonsole);

mcConsoleWss.on('connection', (client, req) => {
  let mcServer = null;
  try {
    const u = new URL(req.url, `http://${req.headers.host}`);
    if ((u.searchParams.get('server') || '').startsWith('pelican:')) { gameserverKonsole(client, req); return; }
    verifyToken(u.searchParams.get('token') || '');
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
