#!/usr/bin/env node
// Cloudflare-Tunnel-Werkzeug für das Homelab.
//
// Warum es das gibt: Der cloudflared-Container läuft token-basiert, die
// Ingress-Regeln liegen also in der Cloud und werden per API **als Ganzes
// ersetzt**. Ein Fehlgriff nimmt alle Domains gleichzeitig offline (darunter
// lawnet.sale und das Portfolio). Jede Regel enthält außerdem die LAN-IP des
// Pi (`http://192.168.2.67:<port>`) – zieht der Pi in ein anderes Netz, sind
// alle Domains tot, bis die IP in jeder Regel getauscht ist.
//
// Dieses Skript macht genau das sicher: sichern, anzeigen, gezielt patchen,
// Diff zeigen, erst mit --apply schreiben.
//
// Zugang (Reihenfolge): CLOUDFLARE_API_TOKEN aus der Umgebung, sonst --token.
// Der Token braucht die Rechte "Cloudflare Tunnel: Edit" und "DNS: Edit".
//
// Aufrufe:
//   node cf-tunnel.mjs list                      Tunnel + Hostnames anzeigen
//   node cf-tunnel.mjs backup                    Config als JSON sichern
//   node cf-tunnel.mjs set-ip <alt> <neu>        LAN-IP in allen Regeln tauschen
//   node cf-tunnel.mjs add <hostname> <service>  Regel vor die 404-Auffangregel
//   node cf-tunnel.mjs remove <hostname>         Regel entfernen
//   node cf-tunnel.mjs dns <hostname>            proxied CNAME auf den Tunnel
//                                                (biegt einen vorhandenen CNAME um)
//
// Ohne --apply ist alles ein Dry-Run mit Diff. Beispiel Umzug:
//   node cf-tunnel.mjs backup
//   node cf-tunnel.mjs set-ip 192.168.2.67 192.168.178.50 --apply
//
// Beispiel SSH-Zugang über den Tunnel (dann per
// `cloudflared access ssh --hostname ssh.mas0n1x.online` erreichbar):
//   node cf-tunnel.mjs add ssh.mas0n1x.online ssh://192.168.2.67:22 --apply
//   node cf-tunnel.mjs dns ssh.mas0n1x.online --apply
// ⚠️ Danach in Cloudflare Zero Trust eine Access-Policy auf den Hostname legen,
//    sonst darf jeder den SSH-Port über den Tunnel erreichen.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ACCOUNT_ID = '2916e63238fd7f5347e2b5a250125c9b';
const ZONES = {
  'mas0n1x.online': '39c3eed9b086cd9452316d4df82dd0f3',
  'corleone-lspd.de': 'e1f3751e9a41c1c5282c7266b1708ee0',
  'lawnet.sale': 'ab7899425d9319f09c47e6ce0393a9e7',
};
const API = 'https://api.cloudflare.com/client/v4';
const BACKUP_DIR = process.env.CF_BACKUP_DIR || join(process.cwd(), 'cf-backups');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const positional = args.filter((a) => !a.startsWith('--'));
const cmd = positional[0];

const tokenArg = args.find((a) => a.startsWith('--token='));
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || (tokenArg ? tokenArg.split('=')[1] : null);
if (!TOKEN) {
  console.error('Kein Token. CLOUDFLARE_API_TOKEN setzen oder --token=<wert> übergeben.');
  console.error('Auf dem Pi liegt er in /srv/homelab-dashboard/.env.');
  process.exit(1);
}

async function cf(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) {
    const msg = data?.errors?.map((e) => `${e.code}: ${e.message}`).join('; ') || `HTTP ${res.status}`;
    throw new Error(`${init.method || 'GET'} ${path} → ${msg}`);
  }
  return data.result;
}

// Der Pi-Tunnel ist der einzige aktive Tunnel mit Ingress-Regeln; bei mehreren
// wird nach Name gefiltert (--tunnel=<name>).
async function findTunnel() {
  const wanted = args.find((a) => a.startsWith('--tunnel='))?.split('=')[1];
  const tunnels = await cf(`/accounts/${ACCOUNT_ID}/cfd_tunnel?is_deleted=false`);
  if (!tunnels.length) throw new Error('Kein Tunnel im Account gefunden');
  if (wanted) {
    const t = tunnels.find((x) => x.name === wanted);
    if (!t) throw new Error(`Tunnel "${wanted}" nicht gefunden. Vorhanden: ${tunnels.map((x) => x.name).join(', ')}`);
    return t;
  }
  if (tunnels.length > 1) {
    console.log('Mehrere Tunnel vorhanden:');
    for (const t of tunnels) console.log(`  ${t.name} (${t.id}) – Status ${t.status}`);
    console.log('Mit --tunnel=<name> auswählen.');
  }
  return tunnels[0];
}

const getConfig = (id) => cf(`/accounts/${ACCOUNT_ID}/cfd_tunnel/${id}/configurations`);

function showIngress(ingress) {
  for (const r of ingress) {
    const host = r.hostname || '(Auffangregel)';
    console.log(`  ${host.padEnd(40)} → ${r.service}${r.path ? ` [Pfad ${r.path}]` : ''}`);
  }
}

function backupConfig(tunnel, config) {
  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = join(BACKUP_DIR, `tunnel-${tunnel.name}-${stamp}.json`);
  writeFileSync(file, JSON.stringify(config, null, 2), 'utf8');
  console.log(`Sicherung: ${file}`);
  return file;
}

async function putConfig(tunnel, config, ingress) {
  const neu = { ...config.config, ingress };
  if (!APPLY) {
    console.log('\nDRY-RUN – nichts geschrieben. Mit --apply ausführen.');
    return;
  }
  await cf(`/accounts/${ACCOUNT_ID}/cfd_tunnel/${tunnel.id}/configurations`, {
    method: 'PUT',
    body: JSON.stringify({ config: neu }),
  });
  const nachher = await getConfig(tunnel.id);
  console.log('\nGeschrieben. Stand danach:');
  showIngress(nachher.config?.ingress || []);
}

// Pflicht bei jeder Änderung: die Auffangregel (ohne hostname) muss letzte bleiben,
// sonst greift sie für alles und der ganze Tunnel liefert 404.
function assertCatchAllLast(ingress) {
  const idx = ingress.findIndex((r) => !r.hostname);
  if (idx === -1) throw new Error('Keine Auffangregel gefunden – Abbruch, das wäre gefährlich.');
  if (idx !== ingress.length - 1) throw new Error('Auffangregel steht nicht am Ende – Abbruch.');
}

const tunnel = await findTunnel();
const config = await getConfig(tunnel.id);
const ingress = structuredClone(config.config?.ingress || []);

switch (cmd) {
  case 'list': {
    console.log(`Tunnel: ${tunnel.name} (${tunnel.id}), Status ${tunnel.status}`);
    console.log(`Regeln: ${ingress.length}`);
    showIngress(ingress);
    break;
  }

  case 'backup': {
    backupConfig(tunnel, config);
    console.log(`${ingress.length} Regeln gesichert.`);
    break;
  }

  case 'set-ip': {
    const [, alt, neu] = positional;
    if (!alt || !neu) throw new Error('Aufruf: set-ip <alte-IP> <neue-IP>');
    backupConfig(tunnel, config);
    let n = 0;
    for (const r of ingress) {
      if (r.service?.includes(alt)) {
        const vorher = r.service;
        r.service = r.service.replaceAll(alt, neu);
        console.log(`  ${(r.hostname || '(Auffangregel)').padEnd(40)} ${vorher} → ${r.service}`);
        n++;
      }
    }
    console.log(`\n${n} von ${ingress.length} Regeln betroffen.`);
    if (!n) break;
    assertCatchAllLast(ingress);
    await putConfig(tunnel, config, ingress);
    break;
  }

  case 'add': {
    const [, hostname, service] = positional;
    if (!hostname || !service) throw new Error('Aufruf: add <hostname> <service-url>');
    if (ingress.some((r) => r.hostname === hostname)) throw new Error(`${hostname} hat schon eine Regel.`);
    backupConfig(tunnel, config);
    const catchAll = ingress.pop();
    ingress.push({ hostname, service }, catchAll);
    console.log(`Neue Regel vor der Auffangregel: ${hostname} → ${service}`);
    assertCatchAllLast(ingress);
    await putConfig(tunnel, config, ingress);
    break;
  }

  case 'remove': {
    const [, hostname] = positional;
    if (!hostname) throw new Error('Aufruf: remove <hostname>');
    const treffer = ingress.filter((r) => r.hostname === hostname);
    if (!treffer.length) throw new Error(`Keine Regel für ${hostname}`);
    backupConfig(tunnel, config);
    const rest = ingress.filter((r) => r.hostname !== hostname);
    console.log(`Entfernt: ${treffer.map((r) => `${r.hostname} → ${r.service}`).join(', ')}`);
    assertCatchAllLast(rest);
    await putConfig(tunnel, config, rest);
    break;
  }

  case 'dns': {
    const [, hostname] = positional;
    if (!hostname) throw new Error('Aufruf: dns <hostname>');
    const zone = Object.keys(ZONES).find((z) => hostname.endsWith(z));
    if (!zone) throw new Error(`Zone für ${hostname} unbekannt – in ZONES ergänzen.`);
    const target = `${tunnel.id}.cfargotunnel.com`;
    const vorhanden = await cf(`/zones/${ZONES[zone]}/dns_records?name=${encodeURIComponent(hostname)}`);
    if (vorhanden.length) {
      console.log(`Vorhanden: ${vorhanden.map((r) => `${r.type} ${r.name} → ${r.content} (proxied=${r.proxied})`).join(', ')}`);
      if (vorhanden.some((r) => r.type === 'CNAME' && r.content === target && r.proxied)) {
        console.log('Zeigt schon korrekt auf den Tunnel – nichts zu tun.');
        break;
      }
    }
    // Ein vorhandener CNAME wird umgebogen, nicht ein zweiter angelegt –
    // sonst scheitert der POST an „record already exists". Andere Typen
    // (A/AAAA) fasst das Skript nicht an, das waere zu riskant.
    const cname = vorhanden.find((r) => r.type === 'CNAME');
    const blocker = vorhanden.filter((r) => r.type !== 'CNAME' && ['A', 'AAAA'].includes(r.type));
    if (blocker.length) {
      throw new Error(
        `${hostname} hat ${blocker.map((r) => r.type).join('/')}-Eintraege – bitte manuell klaeren.`
      );
    }
    if (cname) {
      console.log(`Geplant: CNAME ${hostname} umbiegen ${cname.content} → ${target} (proxied)`);
      if (!APPLY) { console.log('DRY-RUN – nichts geschrieben.'); break; }
      await cf(`/zones/${ZONES[zone]}/dns_records/${cname.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ type: 'CNAME', name: hostname, content: target, proxied: true, ttl: 1 }),
      });
      console.log('CNAME umgebogen.');
      break;
    }
    console.log(`Geplant: CNAME ${hostname} → ${target} (proxied)`);
    if (!APPLY) { console.log('DRY-RUN – nichts geschrieben.'); break; }
    await cf(`/zones/${ZONES[zone]}/dns_records`, {
      method: 'POST',
      body: JSON.stringify({ type: 'CNAME', name: hostname, content: target, proxied: true }),
    });
    console.log('CNAME angelegt.');
    break;
  }

  default:
    console.log('Befehle: list | backup | set-ip <alt> <neu> | add <hostname> <service> | remove <hostname> | dns <hostname>');
    console.log('Optionen: --apply (schreibt wirklich), --tunnel=<name>, --token=<wert>');
    console.log('\nAktueller Tunnel:', tunnel.name, `(${ingress.length} Regeln)`);
}
