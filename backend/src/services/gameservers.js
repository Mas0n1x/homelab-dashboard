/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import net from 'node:net';
import { WebSocket } from 'ws';

/*
 * Spielserver über Pelican. Jeder Server, der im Panel angelegt wird, taucht hier
 * automatisch auf — es gibt keine Liste, die man pflegen müsste.
 *
 * Gesteuert wird über die Client-API des Panels (PELICAN_CLIENT_KEY, Präfix pacc_,
 * Konto-API-Schlüssel eines Admins). Konsole und Live-Werte kommen über den
 * WebSocket von Wings; das Panel stellt dafür nur Token und Adresse aus.
 */

const PANEL_URL = (process.env.PELICAN_URL || '').replace(/\/+$/, '');
const CLIENT_KEY = process.env.PELICAN_CLIENT_KEY || '';
const PUBLIC_HOST = process.env.PELICAN_PUBLIC_HOST || '';

const LIST_TTL = 30 * 1000;
const STATE_TTL = 3 * 1000;
const MAX_LINES = 1000;
const MAX_HISTORY = 120;
const IDLE_MS = 90 * 1000;

export const konfiguriert = () => !!(PANEL_URL && CLIENT_KEY);

export class PelicanError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Client-API
// ---------------------------------------------------------------------------

/** Ruft die Client-API auf; JSON-Antworten werden geparst, alles andere kommt als Text. */
export async function panel(path, { method = 'GET', body, headers = {}, timeout = 15000 } = {}) {
  if (!konfiguriert()) throw new PelicanError('Pelican ist nicht eingerichtet (PELICAN_URL / PELICAN_CLIENT_KEY fehlen)', 503);
  const isJson = body !== undefined && typeof body !== 'string';
  let res;
  try {
    res = await fetch(`${PANEL_URL}/api/client${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${CLIENT_KEY}`,
        Accept: 'application/json',
        ...(isJson ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : isJson ? JSON.stringify(body) : body,
      signal: AbortSignal.timeout(timeout),
    });
  } catch (e) {
    throw new PelicanError(`Pelican nicht erreichbar: ${e.cause?.code || e.message}`);
  }
  const text = await res.text();
  if (!res.ok) {
    let detail = '';
    try { detail = JSON.parse(text)?.errors?.[0]?.detail || ''; } catch { /* kein JSON */ }
    const hint = res.status === 401 || res.status === 403
      ? ' — Client-Schlüssel ungültig oder ohne Rechte'
      : '';
    throw new PelicanError(`${detail || `Pelican antwortete mit ${res.status}`}${hint}`, res.status === 404 ? 404 : 502);
  }
  if (!text) return {};
  try { return JSON.parse(text); } catch { return text; }
}

// ---------------------------------------------------------------------------
// Server-Liste & Spiel-Erkennung
// ---------------------------------------------------------------------------

const GAMES = [
  { kind: 'minecraft', label: 'Minecraft', test: /\beula\b|minecraft|neoforge|forge|fabric|paper|spigot|purpur|unix_args|server\.jar/ },
  { kind: 'fivem', label: 'FiveM', test: /fivem|fxserver|txadmin|redm|cfx/ },
  { kind: 'rimworld', label: 'RimWorld', test: /rimworld|open ?world/ },
  { kind: 'valheim', label: 'Valheim', test: /valheim/ },
  { kind: 'terraria', label: 'Terraria', test: /terraria|tshock/ },
  { kind: 'ark', label: 'ARK', test: /\bark\b|shootergame/ },
  { kind: 'rust', label: 'Rust', test: /rustdedicated|\brust\b/ },
  { kind: 'cs2', label: 'Counter-Strike 2', test: /\bcs2\b|counter-?strike|srcds/ },
  { kind: 'palworld', label: 'Palworld', test: /palworld/ },
  { kind: 'satisfactory', label: 'Satisfactory', test: /satisfactory/ },
];

function erkenneSpiel(a) {
  const heu = `${a.name} ${a.description || ''} ${a.invocation || ''} ${a.docker_image || ''} ${(a.egg_features || []).join(' ')}`.toLowerCase();
  // Spezifische Spiele zuerst: Stichworte wie "paper" oder "forge" sollen keinen fremden Server als Minecraft einordnen.
  const spezifisch = GAMES.filter(g => g.kind !== 'minecraft').find(g => g.test.test(heu));
  const treffer = spezifisch || GAMES.find(g => g.kind === 'minecraft' && g.test.test(heu));
  return treffer ? { kind: treffer.kind, label: treffer.label } : { kind: 'generic', label: 'Gameserver' };
}

function adresse(allocs) {
  const a = allocs.find(x => x.is_default) || allocs[0];
  if (!a) return { host: '', port: null };
  const intern = !a.ip_alias && /^(0\.0\.0\.0|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.ip);
  const host = a.ip_alias || (intern ? PUBLIC_HOST : a.ip);
  return { host: host || a.ip, port: a.port };
}

function normalisieren(item) {
  const a = item.attributes;
  const allocs = (a.relationships?.allocations?.data || []).map(x => x.attributes);
  const { host, port } = adresse(allocs);
  const game = erkenneSpiel(a);
  return {
    id: a.identifier,
    uuid: a.uuid,
    name: a.name,
    description: a.description || '',
    node: a.node,
    game: game.kind,
    gameLabel: game.label,
    host: port ? `${host}:${port}` : '',
    hostName: host,
    port,
    allocations: allocs.map(x => ({ id: x.id, ip: x.ip, alias: x.ip_alias, port: x.port, notes: x.notes, default: !!x.is_default })),
    limits: {
      memory: a.limits?.memory || 0, // MB, 0 = unbegrenzt
      disk: a.limits?.disk || 0,
      cpu: a.limits?.cpu || 0,
    },
    backupLimit: a.feature_limits?.backups ?? 0,
    installing: !!a.is_installing,
    suspended: !!a.is_suspended,
    maintenance: !!a.is_node_under_maintenance,
  };
}

let listeCache = { at: 0, servers: [] };
let listeLaeuft = null;

export async function listServers({ frisch = false } = {}) {
  if (!frisch && Date.now() - listeCache.at < LIST_TTL) return listeCache.servers;
  // Gleichzeitige Aufrufer teilen sich eine Anfrage, sonst feuert jede Sidebar einen eigenen Abruf.
  if (!listeLaeuft) {
    listeLaeuft = (async () => {
      const servers = [];
      for (let page = 1; page <= 10; page++) {
        const r = await panel(`?type=admin-all&per_page=100&page=${page}`);
        servers.push(...(r.data || []).map(normalisieren));
        if (page >= (r.meta?.pagination?.total_pages || 1)) break;
      }
      listeCache = { at: Date.now(), servers };
      return servers;
    })().finally(() => { listeLaeuft = null; });
  }
  try {
    return await listeLaeuft;
  } catch (e) {
    // Veraltete Liste ist besser als eine leere Sidebar, wenn das Panel kurz weg ist.
    if (listeCache.servers.length) return listeCache.servers;
    throw e;
  }
}

/** Löst einen Server per Kennung auf; unbekannte Kennungen werden abgewiesen (kein Pfad-Einschleusen). */
export async function getServer(id) {
  if (!/^[a-z0-9-]{4,64}$/i.test(String(id || ''))) throw new PelicanError('Ungültige Server-Kennung', 400);
  let s = (await listServers()).find(x => x.id === id || x.uuid === id);
  if (!s) s = (await listServers({ frisch: true })).find(x => x.id === id || x.uuid === id);
  if (!s) throw new PelicanError('Server nicht gefunden', 404);
  return s;
}

// ---------------------------------------------------------------------------
// Zustand (Power-Status + Ressourcen)
// ---------------------------------------------------------------------------

const ZUSTAENDE = {
  running: { running: true, label: 'Läuft', health: 'healthy' },
  starting: { running: true, label: 'Startet…', health: 'starting' },
  stopping: { running: true, label: 'Stoppt…', health: 'stopping' },
  offline: { running: false, label: 'Gestoppt', health: 'offline' },
};

const stateCache = new Map(); // id → { at, value }

function ausRessourcen(server, r) {
  const a = r.attributes || {};
  const res = a.resources || {};
  const z = ZUSTAENDE[a.current_state] || ZUSTAENDE.offline;
  const memLimit = (server.limits.memory || 0) * 1024 * 1024;
  return {
    state: a.current_state || 'offline',
    running: z.running,
    health: z.health,
    label: a.is_suspended ? 'Gesperrt' : z.label,
    suspended: !!a.is_suspended,
    startedAt: z.running && res.uptime ? new Date(Date.now() - res.uptime).toISOString() : null,
    uptime: res.uptime || 0,
    cpu: Math.round((res.cpu_absolute || 0) * 10) / 10,
    memory: res.memory_bytes || 0,
    memoryLimit: memLimit,
    disk: res.disk_bytes || 0,
    rx: res.network_rx_bytes || 0,
    tx: res.network_tx_bytes || 0,
  };
}

export async function getState(server) {
  const hit = stateCache.get(server.id);
  if (hit && Date.now() - hit.at < STATE_TTL) return hit.value;
  const r = await panel(`/servers/${server.id}/resources`);
  const value = ausRessourcen(server, r);
  stateCache.set(server.id, { at: Date.now(), value });
  return value;
}

export function invalidateState(id) { stateCache.delete(id); }

/** Server-Liste samt aktuellem Zustand — Grundlage für Sidebar und Übersichten. */
export async function listWithState() {
  const servers = await listServers();
  return Promise.all(servers.map(async (s) => {
    try { return { ...s, state: await getState(s) }; }
    catch (e) { return { ...s, state: { state: 'unknown', running: false, health: 'unknown', label: 'Nicht erreichbar', error: e.message } }; }
  }));
}

// ---------------------------------------------------------------------------
// Konsole & Live-Werte (WebSocket von Wings)
// ---------------------------------------------------------------------------

const sitzungen = new Map(); // id → Sitzung

class Sitzung {
  constructor(server) {
    this.id = server.id;
    this.lines = [];
    this.history = [];
    this.stats = null;
    this.state = null;
    this.listeners = new Set();
    this.ws = null;
    this.reconnect = null;
    this.lastUse = Date.now();
    this.closed = false;
    this.verbunden = false;
  }

  touch() {
    this.lastUse = Date.now();
    if (!this.ws && !this.reconnect) this.connect();
  }

  emit(ev) { for (const fn of this.listeners) { try { fn(ev); } catch { /* Zuhörer darf die Sitzung nicht killen */ } } }

  push(text) {
    const lines = String(text).replace(/\r/g, '').split('\n');
    for (const l of lines) if (l !== '') { this.lines.push(l); }
    if (this.lines.length > MAX_LINES) this.lines.splice(0, this.lines.length - MAX_LINES);
    this.emit({ type: 'log', data: lines.filter(l => l !== '').join('\n') + '\n' });
  }

  async connect() {
    if (this.closed || this.ws) return;
    try {
      const r = await panel(`/servers/${this.id}/websocket`);
      const { token, socket } = r.data || {};
      if (!token || !socket) throw new Error('Panel lieferte keinen WebSocket');
      // Wings prüft die Herkunft gegen die Panel-Adresse; ohne passenden Origin lehnt es ab.
      const ws = new WebSocket(socket, { headers: { Origin: PANEL_URL } });
      this.ws = ws;
      ws.on('open', () => ws.send(JSON.stringify({ event: 'auth', args: [token] })));
      ws.on('message', (raw) => this.onMessage(ws, raw.toString()));
      ws.on('close', () => this.onClose(ws));
      ws.on('error', () => { /* close folgt */ });
    } catch (e) {
      this.ws = null;
      this.emit({ type: 'error', data: `Konsole nicht verfügbar: ${e.message}` });
      this.planeReconnect(10000);
    }
  }

  onMessage(ws, raw) {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    const arg = m.args?.[0];
    switch (m.event) {
      case 'auth success':
        this.verbunden = true;
        ws.send(JSON.stringify({ event: 'send logs', args: [null] }));
        ws.send(JSON.stringify({ event: 'send stats', args: [null] }));
        this.emit({ type: 'connected' });
        break;
      case 'console output':
      case 'install output':
        if (arg != null) this.push(arg);
        break;
      case 'daemon message':
        if (arg != null) this.push(`[Daemon] ${arg}`);
        break;
      case 'daemon error':
        if (arg != null) this.push(`[Daemon-Fehler] ${arg}`);
        break;
      case 'status':
        this.state = arg;
        invalidateState(this.id);
        this.emit({ type: 'state', data: arg });
        break;
      case 'stats': {
        let s; try { s = JSON.parse(arg); } catch { return; }
        this.state = s.state || this.state;
        this.stats = {
          cpu: Math.round((s.cpu_absolute || 0) * 10) / 10,
          memory: s.memory_bytes || 0,
          memoryLimit: s.memory_limit_bytes || 0,
          disk: s.disk_bytes || 0,
          rx: s.network?.rx_bytes || 0,
          tx: s.network?.tx_bytes || 0,
          uptime: s.uptime || 0,
          at: Date.now(),
        };
        // Wings sendet jede Sekunde; die Verlaufskurve braucht nur alle 3 s einen Punkt.
        const last = this.history[this.history.length - 1];
        if (!last || this.stats.at - last.t >= 3000) {
          this.history.push({ t: this.stats.at, cpu: this.stats.cpu, memory: this.stats.memory, rx: this.stats.rx, tx: this.stats.tx });
          if (this.history.length > MAX_HISTORY) this.history.shift();
        }
        this.emit({ type: 'stats', data: this.stats });
        break;
      }
      case 'token expiring':
        panel(`/servers/${this.id}/websocket`)
          .then(r => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ event: 'auth', args: [r.data.token] })))
          .catch(() => { /* beim Ablauf verbinden wir neu */ });
        break;
      case 'token expired':
      case 'jwt error':
        try { ws.close(); } catch { /* */ }
        break;
      default:
    }
  }

  onClose(ws) {
    if (this.ws !== ws) return;
    this.ws = null;
    this.verbunden = false;
    this.emit({ type: 'disconnected' });
    this.planeReconnect(3000);
  }

  planeReconnect(ms) {
    if (this.closed || this.reconnect) return;
    this.reconnect = setTimeout(() => {
      this.reconnect = null;
      // Nur neu verbinden, wenn noch jemand zusieht — sonst räumt der Wächter auf.
      if (Date.now() - this.lastUse < IDLE_MS || this.listeners.size) this.connect();
    }, ms);
  }

  close() {
    this.closed = true;
    clearTimeout(this.reconnect);
    try { this.ws?.close(); } catch { /* */ }
    this.ws = null;
  }
}

setInterval(() => {
  for (const [id, s] of sitzungen) {
    if (!s.listeners.size && Date.now() - s.lastUse > IDLE_MS) { s.close(); sitzungen.delete(id); }
  }
}, 30 * 1000).unref();

/** Liefert die (ggf. neu geöffnete) Konsolen-Sitzung eines Servers. */
export function sitzung(server) {
  let s = sitzungen.get(server.id);
  if (!s) { s = new Sitzung(server); sitzungen.set(server.id, s); }
  s.touch();
  return s;
}

/** Hängt eine Browser-Verbindung an die Konsole: erst der bisherige Verlauf, dann live. */
export function konsoleAnhaengen(client, server) {
  const s = sitzung(server);
  const send = (o) => { if (client.readyState === client.OPEN) client.send(JSON.stringify(o)); };
  if (s.lines.length) send({ type: 'log', data: s.lines.join('\n') + '\n' });
  const hoerer = (ev) => send(ev);
  s.listeners.add(hoerer);
  client.on('message', async (data) => {
    let m; try { m = JSON.parse(data.toString()); } catch { return; }
    if (m.type !== 'command' || !String(m.command || '').trim()) return;
    try { await befehl(server, String(m.command)); }
    catch (e) { send({ type: 'error', data: e.message }); }
  });
  const weg = () => { s.listeners.delete(hoerer); s.lastUse = Date.now(); };
  client.on('close', weg);
  client.on('error', weg);
}

// ---------------------------------------------------------------------------
// Steuerung
// ---------------------------------------------------------------------------

export async function power(server, action) {
  const signal = { start: 'start', stop: 'stop', restart: 'restart', kill: 'kill' }[action];
  if (!signal) throw new PelicanError('Unbekannte Aktion', 400);
  await panel(`/servers/${server.id}/power`, { method: 'POST', body: { signal } });
  invalidateState(server.id);
}

export async function befehl(server, command) {
  await panel(`/servers/${server.id}/command`, { method: 'POST', body: { command } });
}

/** Letzte Konsolenzeilen. Ohne offene Sitzung (frisch gestartet) aus logs/latest.log nachladen. */
export async function logs(server, tail = 250) {
  const s = sitzung(server);
  if (s.lines.length) return s.lines.slice(-tail).join('\n');
  try {
    const text = await dateiLesen(server, '/logs/latest.log');
    return String(text).split('\n').slice(-tail).join('\n');
  } catch { return ''; }
}

export function verlauf(server) {
  const s = sitzung(server);
  return { history: s.history, stats: s.stats };
}

// ---------------------------------------------------------------------------
// Dateien
// ---------------------------------------------------------------------------

const TEXT_ENDUNGEN = /\.(txt|log|json|jsonc|ya?ml|toml|properties|cfg|conf|ini|cfx|lua|js|ts|xml|md|sh|bat|env|csv|mcmeta|snbt|nbtt|zs|zenscript|json5|rules|secret|lang|html|css|sql)$/i;
const TEXT_NAMEN = /^(eula|whitelist|ops|banned-.+|server|user_jvm_args|usercache)(\.[a-z]+)?$/i;

export function bearbeitbar(name, size) {
  return (TEXT_ENDUNGEN.test(name) || TEXT_NAMEN.test(name) || !name.includes('.')) && size < 2 * 1024 * 1024;
}

const pfad = (p) => '/' + String(p || '').replace(/^\/+/, '').replace(/\/+$/, '');

export async function dateien(server, verzeichnis) {
  const dir = pfad(verzeichnis);
  const r = await panel(`/servers/${server.id}/files/list?directory=${encodeURIComponent(dir)}`);
  const entries = (r.data || []).map(x => x.attributes).map(a => ({
    name: a.name,
    type: a.is_file ? 'file' : 'dir',
    size: a.size || 0,
    modified: a.modified_at,
    mode: a.mode,
    editable: a.is_file ? bearbeitbar(a.name, a.size || 0) : false,
  })).sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, 'de') : a.type === 'dir' ? -1 : 1));
  return { path: dir === '/' ? '' : dir.slice(1), entries };
}

export async function dateiLesen(server, datei) {
  return panel(`/servers/${server.id}/files/contents?file=${encodeURIComponent(pfad(datei))}`, { headers: { Accept: 'text/plain' } });
}

export async function dateiSchreiben(server, datei, inhalt) {
  await panel(`/servers/${server.id}/files/write?file=${encodeURIComponent(pfad(datei))}`, {
    method: 'POST', body: String(inhalt), headers: { 'Content-Type': 'text/plain' }, timeout: 30000,
  });
}

export async function dateiLoeschen(server, verzeichnis, namen) {
  await panel(`/servers/${server.id}/files/delete`, { method: 'POST', body: { root: pfad(verzeichnis), files: namen } });
}

export async function ordnerAnlegen(server, verzeichnis, name) {
  await panel(`/servers/${server.id}/files/create-folder`, { method: 'POST', body: { root: pfad(verzeichnis), name } });
}

export async function umbenennen(server, verzeichnis, von, nach) {
  await panel(`/servers/${server.id}/files/rename`, { method: 'PUT', body: { root: pfad(verzeichnis), files: [{ from: von, to: nach }] } });
}

export async function hochladen(server, verzeichnis, name, buffer) {
  const r = await panel(`/servers/${server.id}/files/upload`);
  const url = r.attributes?.url;
  if (!url) throw new PelicanError('Panel lieferte keine Upload-Adresse');
  const form = new FormData();
  form.append('files', new Blob([buffer]), name);
  const res = await fetch(`${url}&directory=${encodeURIComponent(pfad(verzeichnis))}`, {
    method: 'POST', body: form, headers: { Origin: PANEL_URL }, signal: AbortSignal.timeout(10 * 60 * 1000),
  }).catch(e => { throw new PelicanError(`Upload fehlgeschlagen: ${e.cause?.code || e.message}`); });
  if (!res.ok) throw new PelicanError(`Upload fehlgeschlagen (${res.status})`);
}

export async function downloadLink(server, datei) {
  const r = await panel(`/servers/${server.id}/files/download?file=${encodeURIComponent(pfad(datei))}`);
  return r.attributes?.url || '';
}

// ---------------------------------------------------------------------------
// Backups
// ---------------------------------------------------------------------------

function backupAus(item) {
  const a = item.attributes;
  return {
    id: a.uuid,
    name: a.name,
    size: a.bytes || 0,
    created: a.completed_at || a.created_at,
    done: !!a.completed_at,
    ok: a.is_successful !== false,
    locked: !!a.is_locked,
  };
}

export async function backups(server) {
  const r = await panel(`/servers/${server.id}/backups?per_page=50`);
  return (r.data || []).map(backupAus).sort((a, b) => String(b.created).localeCompare(String(a.created)));
}

export async function backupAnlegen(server, name) {
  const r = await panel(`/servers/${server.id}/backups`, { method: 'POST', body: name ? { name } : {} });
  return backupAus(r);
}

export async function backupLoeschen(server, uuid) {
  await panel(`/servers/${server.id}/backups/${encodeURIComponent(uuid)}`, { method: 'DELETE' });
}

export async function backupWiederherstellen(server, uuid) {
  await panel(`/servers/${server.id}/backups/${encodeURIComponent(uuid)}/restore`, { method: 'POST', body: { truncate: true } });
  invalidateState(server.id);
}

export async function backupLink(server, uuid) {
  const r = await panel(`/servers/${server.id}/backups/${encodeURIComponent(uuid)}/download`);
  return r.attributes?.url || '';
}

// ---------------------------------------------------------------------------
// Zeitpläne
// ---------------------------------------------------------------------------

function zeitplanAus(item) {
  const a = item.attributes;
  return {
    id: a.id,
    name: a.name,
    cron: a.cron,
    active: !!a.is_active,
    processing: !!a.is_processing,
    onlyWhenOnline: !!a.only_when_online,
    lastRun: a.last_run_at,
    nextRun: a.next_run_at,
    tasks: (a.relationships?.tasks?.data || []).map(t => ({
      id: t.attributes.id, action: t.attributes.action, payload: t.attributes.payload, offset: t.attributes.time_offset,
    })),
  };
}

export async function zeitplaene(server) {
  const r = await panel(`/servers/${server.id}/schedules`);
  return (r.data || []).map(zeitplanAus);
}

export async function zeitplanAnlegen(server, { name, cron, task }) {
  const r = await panel(`/servers/${server.id}/schedules`, {
    method: 'POST',
    body: {
      name,
      minute: cron.minute, hour: cron.hour, day_of_month: cron.day_of_month, month: cron.month, day_of_week: cron.day_of_week,
      is_active: true, only_when_online: false,
    },
  });
  const id = r.attributes?.id;
  if (id && task) {
    await panel(`/servers/${server.id}/schedules/${id}/tasks`, {
      method: 'POST', body: { action: task.action, payload: task.payload || '', time_offset: 0, continue_on_failure: false },
    });
  }
  return id;
}

export async function zeitplanSchalten(server, id, active) {
  const all = await panel(`/servers/${server.id}/schedules`);
  const z = (all.data || []).find(x => String(x.attributes.id) === String(id));
  if (!z) throw new PelicanError('Zeitplan nicht gefunden', 404);
  const a = z.attributes;
  await panel(`/servers/${server.id}/schedules/${id}`, {
    method: 'POST',
    body: {
      name: a.name,
      minute: a.cron.minute, hour: a.cron.hour, day_of_month: a.cron.day_of_month, month: a.cron.month, day_of_week: a.cron.day_of_week,
      is_active: !!active, only_when_online: !!a.only_when_online,
    },
  });
}

export const zeitplanAusfuehren = (server, id) => panel(`/servers/${server.id}/schedules/${id}/execute`, { method: 'POST' });
export const zeitplanLoeschen = (server, id) => panel(`/servers/${server.id}/schedules/${id}`, { method: 'DELETE' });

// ---------------------------------------------------------------------------
// Start-Optionen (Egg-Variablen)
// ---------------------------------------------------------------------------

export async function startOptionen(server) {
  const r = await panel(`/servers/${server.id}/startup`);
  return {
    command: r.meta?.startup_command || '',
    variables: (r.data || []).map(v => v.attributes).map(a => ({
      key: a.env_variable,
      name: a.name,
      description: a.description,
      value: a.server_value ?? a.default_value ?? '',
      default: a.default_value ?? '',
      editable: !!a.is_editable,
      rules: a.rules || '',
    })),
  };
}

export async function startOptionSetzen(server, key, value) {
  await panel(`/servers/${server.id}/startup/variable`, { method: 'PUT', body: { key, value: String(value) } });
}

// ---------------------------------------------------------------------------
// Minecraft: Server List Ping (Spieler, Version) — ohne RCON, ohne Plugin
// ---------------------------------------------------------------------------

function varInt(n) {
  const out = [];
  do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; out.push(b); } while (n);
  return Buffer.from(out);
}

function readVarInt(buf, off) {
  let n = 0, shift = 0, b;
  do {
    if (off >= buf.length) return null;
    b = buf[off++]; n |= (b & 0x7f) << shift; shift += 7;
  } while (b & 0x80);
  return { value: n, next: off };
}

const pingCache = new Map(); // id → { at, value }

export function minecraftPing(server) {
  const hit = pingCache.get(server.id);
  if (hit && Date.now() - hit.at < 5000) return Promise.resolve(hit.value);
  return new Promise((resolve) => {
    // 0.0.0.0 heißt „überall“ — aus dem Container wäre 127.0.0.1 der Container selbst, also die öffentliche Adresse nehmen.
    const host = server.hostName || server.allocations.find(a => a.default)?.ip;
    const ziel = /^(0\.0\.0\.0|)$/.test(host || '') ? '127.0.0.1' : host;
    const sock = net.connect({ host: ziel, port: server.port, timeout: 3000 });
    let buf = Buffer.alloc(0);
    const fertig = (v) => { sock.destroy(); pingCache.set(server.id, { at: Date.now(), value: v }); resolve(v); };
    sock.on('connect', () => {
      const hostBuf = Buffer.from(String(ziel));
      const handshake = Buffer.concat([varInt(0), varInt(767), varInt(hostBuf.length), hostBuf, Buffer.from([server.port >> 8, server.port & 255]), varInt(1)]);
      sock.write(Buffer.concat([varInt(handshake.length), handshake, Buffer.from([1, 0])]));
    });
    sock.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      const len = readVarInt(buf, 0); if (!len) return;
      if (buf.length < len.next + len.value) return;
      const id = readVarInt(buf, len.next); if (!id) return;
      const jl = readVarInt(buf, id.next); if (!jl) return;
      try {
        const j = JSON.parse(buf.slice(jl.next, jl.next + jl.value).toString('utf8'));
        fertig({
          online: (j.players?.sample || []).map(p => p.name),
          count: j.players?.online ?? 0,
          max: j.players?.max ?? null,
          version: j.version?.name || '',
        });
      } catch { fertig(null); }
    });
    sock.on('timeout', () => fertig(null));
    sock.on('error', () => fertig(null));
  });
}
