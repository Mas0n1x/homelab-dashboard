/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */

/**
 * Öffentliche Hostnamen aus der Cloudflare-Tunnel-Konfiguration.
 *
 * Die Dienst-Erkennung kennt sonst nur `http://<LAN-IP>:<Port>` — von außerhalb
 * des Heimnetzes unerreichbar und auch drinnen nicht die „richtige" Adresse.
 * Der Pi-Tunnel bildet aber jeden Hostnamen auf genau so ein `http://ip:port`
 * ab. Daraus bauen wir eine Port -> Hostname-Tabelle und hängen sie in die
 * anklickbaren Service-URLs.
 *
 * Bewusst nur nach Port gematcht (nicht IP:Port): alle lokalen Dienste laufen
 * auf demselben Pi, und die LAN-IP in den Ingress-Regeln driftet erfahrungs-
 * gemäß (Umzug, DHCP) — der Port ist der stabile Teil.
 */

const ACCOUNT_ID = process.env.CF_ACCOUNT_ID || '2916e63238fd7f5347e2b5a250125c9b';
// Der Tunnel, der den Pi frontet. Bei Bedarf per .env übersteuern.
const PI_TUNNEL_NAME = process.env.CF_PI_TUNNEL_NAME || 'zuhause.max';
const TTL_MS = 10 * 60 * 1000;

let cache = { at: 0, map: new Map() };

/** @returns {Promise<Map<string, string>>} Port (als String) -> Hostname */
export async function getIngressHostMap() {
  if (cache.map.size && Date.now() - cache.at < TTL_MS) return cache.map;

  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) return cache.map;

  try {
    const headers = { Authorization: `Bearer ${token}` };
    const listRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/cfd_tunnel?is_deleted=false`,
      { headers, signal: AbortSignal.timeout(10000) },
    );
    const listJson = await listRes.json();
    const tunnels = listJson?.result || [];
    const tunnel = tunnels.find(t => t.name === PI_TUNNEL_NAME) || tunnels[0];
    if (!tunnel) return cache.map;

    const cfgRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/cfd_tunnel/${tunnel.id}/configurations`,
      { headers, signal: AbortSignal.timeout(10000) },
    );
    const cfgJson = await cfgRes.json();
    const ingress = cfgJson?.result?.config?.ingress || [];

    const map = new Map();
    for (const rule of ingress) {
      if (!rule.hostname || !rule.service) continue;
      const m = /^(https?):\/\/[^/:]+(?::(\d+))?/.exec(rule.service);
      if (!m) continue;
      const port = m[2] || (m[1] === 'https' ? '443' : '80');
      // Erste Regel je Port gewinnt (Ingress wird von oben abgearbeitet).
      if (!map.has(port)) map.set(port, rule.hostname);
    }

    if (map.size) cache = { at: Date.now(), map };
    return cache.map;
  } catch {
    // Cloudflare nicht erreichbar: die zuletzt bekannte Tabelle behalten,
    // notfalls leer — dann bleibt es bei den IP-URLs.
    return cache.map;
  }
}

/** Öffentliche URL für einen Dienst anhand seiner veröffentlichten Ports, sonst null. */
export function publicUrlFromPorts(ports, ingressMap) {
  if (!ports || !ingressMap || ingressMap.size === 0) return null;
  for (const p of ports) {
    if (!p.PublicPort) continue;
    const host = ingressMap.get(String(p.PublicPort));
    if (host) return `https://${host}`;
  }
  return null;
}
