/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */

/*
 * Registry der Minecraft-Server. Erlaubt mehrere Server (je eigener mc-agent).
 * Konfiguration bevorzugt per MC_SERVERS (JSON-Array), z. B.:
 *   MC_SERVERS=[{"id":"survival","name":"Survival","host":"188.34.130.109:25565",
 *     "version":"Paper 26.2","map":"https://map.mas0n1x.online",
 *     "url":"https://mc-agent.mas0n1x.online","token":"..."}]
 * Fallback (Abwärtskompatibilität): einzelner Server aus MC_AGENT_URL/MC_AGENT_TOKEN.
 *
 * Liegt der Agent hinter Cloudflare Access (self-hosted App mit non_identity-Policy),
 * braucht jeder Aufruf zusätzlich ein Service-Token als Header-Paar. Quelle dafür:
 * pro Server "accessClientId"/"accessClientSecret" in MC_SERVERS, sonst global
 * MC_AGENT_ACCESS_CLIENT_ID / MC_AGENT_ACCESS_CLIENT_SECRET. Fehlen sie, werden
 * keine Header gesetzt — der direkte Weg ohne Access funktioniert unverändert.
 */

function parseServers() {
  const raw = process.env.MC_SERVERS;
  if (raw && raw.trim()) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        const list = arr
          .filter((s) => s && s.url && s.token)
          .map((s, i) => ({
            id: String(s.id || `srv${i + 1}`),
            name: s.name || `Server ${i + 1}`,
            host: s.host || '',
            version: s.version || '',
            map: s.map || '',
            url: String(s.url).replace(/\/+$/, ''),
            token: s.token,
            accessClientId: s.accessClientId || process.env.MC_AGENT_ACCESS_CLIENT_ID || '',
            accessClientSecret: s.accessClientSecret || process.env.MC_AGENT_ACCESS_CLIENT_SECRET || '',
          }));
        if (list.length) return list;
      }
    } catch (e) {
      console.error('[mc] MC_SERVERS ist kein gültiges JSON:', e.message);
    }
  }
  const url = (process.env.MC_AGENT_URL || '').replace(/\/+$/, '');
  const token = process.env.MC_AGENT_TOKEN || '';
  if (!url || !token) return [];
  return [{
    id: 'default',
    name: 'Minecraft',
    host: process.env.MC_HOST || '',
    version: process.env.MC_SERVER_VERSION || '',
    map: process.env.MC_MAP_URL || '',
    url,
    token,
    accessClientId: process.env.MC_AGENT_ACCESS_CLIENT_ID || '',
    accessClientSecret: process.env.MC_AGENT_ACCESS_CLIENT_SECRET || '',
  }];
}

let CACHE = null;
function servers() {
  if (!CACHE) CACHE = parseServers();
  return CACHE;
}

/** Vollständige Server-Objekte inkl. Token (nur server-seitig verwenden). */
export function getServers() {
  return servers();
}

/** Einen Server per id auflösen; ohne/unbekannte id → erster Server. */
export function getServer(id) {
  const list = servers();
  if (!list.length) return null;
  if (!id) return list[0];
  return list.find((s) => s.id === id) || list[0];
}

/**
 * Header-Paar für Cloudflare Access. Leeres Objekt, wenn kein Service-Token
 * hinterlegt ist — dann bleibt der Aufruf unverändert.
 */
export function accessHeaders(server) {
  if (!server || !server.accessClientId || !server.accessClientSecret) return {};
  return {
    'CF-Access-Client-Id': server.accessClientId,
    'CF-Access-Client-Secret': server.accessClientSecret,
  };
}

/** Öffentliche Liste (ohne Token) für das Frontend. */
export function publicServers() {
  return servers().map(({ id, name, host, version, map }) => ({ id, name, host, version, map }));
}
