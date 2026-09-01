/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
const DEFAULT_URL = process.env.GLANCES_URL || 'http://localhost:61208';

// Zeitbudget je Einzelabruf. Zwei Versuche plus Pause bleiben zusammen unter
// den 8 s, die der Alerting-Job als Gesamtlimit setzt — sonst käme die
// Wiederholung nie zum Zug.
const ANFRAGE_TIMEOUT_MS = 3000;
const VERSUCHE = 2;
const WIEDERHOLPAUSE_MS = 200;

// Die sechs Teilabfragen einer Systemmessung. Bewusst einzeln statt über
// /api/4/all: das liefert denselben Inhalt in 260 KB statt in 2,5 KB.
const TEILE = ['cpu', 'mem', 'fs', 'network', 'sensors', 'uptime'];

/**
 * Netzwerkaussetzer, die beim zweiten Versuch meist durchgehen — über den
 * Cloudflare-Tunnel zu den Fernhosts kommen sie regelmäßig vor.
 * HTTP-Fehler (404, 500) und ECONNREFUSED gehören NICHT dazu: die bedeuten
 * „Dienst antwortet, aber nicht so" bzw. „niemand da" und wiederholen sich.
 */
function istVoruebergehend(fehler) {
  if (fehler?.name === 'AbortError' || fehler?.name === 'TimeoutError') return true;
  const code = fehler?.cause?.code || fehler?.code;
  return ['ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'EPIPE', 'ENETUNREACH',
    'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET', 'UND_ERR_HEADERS_TIMEOUT'].includes(code);
}

// „fetch failed" allein ist nicht diagnostizierbar — die eigentliche Ursache
// steckt in error.cause.
function beschreibe(fehler) {
  if (fehler?.name === 'AbortError' || fehler?.name === 'TimeoutError') {
    return `Zeitlimit von ${ANFRAGE_TIMEOUT_MS} ms überschritten`;
  }
  const code = fehler?.cause?.code || fehler?.code;
  return `${fehler?.message || fehler}${code ? ` (${code})` : ''}`;
}

export function createGlancesClient(baseUrl) {
  const rawUrl = baseUrl || DEFAULT_URL;
  let url = rawUrl;
  let authHeader = null;
  try {
    const u = new URL(rawUrl);
    if (u.username || u.password) {
      authHeader = 'Basic ' + Buffer.from(`${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`).toString('base64');
      url = u.origin;
    }
  } catch (e) {}

  // Anzeigename ohne Zugangsdaten — Fehlermeldungen dürfen kein Passwort tragen.
  const anzeigeUrl = url.replace(/\/\/[^@/]*@/, '//');

  async function einVersuch(endpoint) {
    // Hartes Timeout: ein hängender/toter Glances-Host darf den aufrufenden
    // Hintergrundjob nicht unbegrenzt blockieren.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ANFRAGE_TIMEOUT_MS);
    try {
      const response = await fetch(`${url}${endpoint}`, {
        signal: controller.signal,
        ...(authHeader ? { headers: { Authorization: authHeader } } : {}),
      });
      if (!response.ok) {
        throw new Error(`Glances API error: ${response.status}`);
      }
      // Bewusst `await`: mit `return response.json()` läuft das finally schon
      // vor dem Lesen des Rumpfes und räumt das Zeitlimit ab. Ein im Tunnel
      // hängender Rumpf lief dann nicht nach Sekunden aus, sondern erst in den
      // TCP-Timeout des Systems — genau die ETIMEDOUT-Meldungen der Fernhosts.
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchGlances(endpoint) {
    let letzterFehler;
    for (let versuch = 1; versuch <= VERSUCHE; versuch++) {
      try {
        return await einVersuch(endpoint);
      } catch (fehler) {
        letzterFehler = fehler;
        if (versuch === VERSUCHE || !istVoruebergehend(fehler)) break;
        await new Promise(r => setTimeout(r, WIEDERHOLPAUSE_MS));
      }
    }
    throw letzterFehler;
  }

  return {
    async getSystemStats() {
      // allSettled statt all: fällt eine der sechs Teilabfragen aus, wären mit
      // Promise.all auch die fünf gelungenen verloren. Über einen Tunnel mit
      // gelegentlichen Aussetzern verliert man so ein Vielfaches an Messwerten.
      const ergebnisse = await Promise.allSettled(TEILE.map(t => fetchGlances(`/api/4/${t}`)));

      const werte = {};
      const fehlend = [];
      let letzterFehler;
      ergebnisse.forEach((r, i) => {
        if (r.status === 'fulfilled') werte[TEILE[i]] = r.value;
        else { fehlend.push(TEILE[i]); letzterFehler = r.reason; }
      });

      // Ohne CPU oder Speicher ist die Messung wertlos — dann gilt der Server
      // als nicht erreichbar, wie bisher.
      if (fehlend.includes('cpu') || fehlend.includes('mem')) {
        console.error(`[glances] ${anzeigeUrl} nicht erreichbar: ${beschreibe(letzterFehler)}`);
        throw letzterFehler;
      }
      if (fehlend.length) {
        console.warn(`[glances] ${anzeigeUrl}: ${fehlend.join(', ')} fehlt (${beschreibe(letzterFehler)})`);
      }

      {
        const { cpu, mem, fs: disk, network, sensors, uptime } = werte;

        return {
          // Welche Teile fehlen — Aufrufer dürfen daraus keine Nullwerte
          // ableiten. Ein „0 % belegt" wäre eine Falschaussage, keine Lücke.
          fehlend,
          cpu: {
            total: cpu.total || 0,
            user: cpu.user || 0,
            system: cpu.system || 0,
            idle: cpu.idle || 0
          },
          memory: {
            total: mem.total || 0,
            used: mem.used || 0,
            free: mem.free || 0,
            percent: mem.percent || 0
          },
          disk: (() => {
            if (!Array.isArray(disk)) return [];
            // Nur echte Block-Devices, Host-Mount-Präfix (/hostfs/root) entfernen,
            // pro Device den kürzesten Mountpoint behalten (echte Partition statt Bind-Mount-Datei)
            const byDev = new Map();
            for (const d of disk) {
              const device = d.device_name || '';
              // ZFS meldet als Gerät den Datensatznamen (`rpool/subvol-20005-disk-0`),
              // keinen /dev-Pfad — auf dem AMO-VPS (LXC auf ZFS) fiel dadurch die
              // gesamte Platte aus der Anzeige und die Karte zeigte 0 %.
              // Die Entrümpelung übernimmt ohnehin die Dedupe-Regel darunter.
              if (!device.startsWith('/dev/') && d.fs_type !== 'zfs') continue;
              let mnt = d.mnt_point || '';
              for (const pre of ['/hostfs/root', '/hostfs']) {
                if (mnt.startsWith(pre)) mnt = mnt.slice(pre.length) || '/';
              }
              const entry = { mountPoint: mnt, device, total: d.size, used: d.used, free: d.free, percent: d.percent };
              const prev = byDev.get(device);
              if (!prev || mnt.length < prev.mountPoint.length) byDev.set(device, entry);
            }
            return Array.from(byDev.values()).sort((a, b) => (b.total || 0) - (a.total || 0));
          })(),
          network: Array.isArray(network) ? network.filter(n => n.interface_name !== 'lo').map(n => ({
            interface: n.interface_name,
            rxBytes: n.bytes_recv || 0,
            txBytes: n.bytes_sent || 0,
            rxRate: n.bytes_recv_rate_per_sec || n.bytes_recv_rate || 0,
            txRate: n.bytes_sent_rate_per_sec || n.bytes_sent_rate || 0
          })) : [],
          temperature: Array.isArray(sensors) ? sensors.filter(s => s.type === 'temperature_core').map(s => ({
            label: s.label,
            value: s.value
          })) : [],
          uptime: uptime || 'N/A'
        };
      }
    },

    getCpu: () => fetchGlances('/api/4/cpu'),
    getMemory: () => fetchGlances('/api/4/mem'),
    getDisk: () => fetchGlances('/api/4/fs'),
    getNetwork: () => fetchGlances('/api/4/network'),
    getSensors: () => fetchGlances('/api/4/sensors'),
    // Anzahl CPU-Kerne (logisch/physisch) — für Hardware-Specs
    getCore: () => fetchGlances('/api/4/core')
  };
}

// Default client for backward compatibility
const defaultClient = createGlancesClient(DEFAULT_URL);

export const getSystemStats = () => defaultClient.getSystemStats();
export const getCpu = () => defaultClient.getCpu();
export const getMemory = () => defaultClient.getMemory();
export const getDisk = () => defaultClient.getDisk();
export const getNetwork = () => defaultClient.getNetwork();
export const getSensors = () => defaultClient.getSensors();
