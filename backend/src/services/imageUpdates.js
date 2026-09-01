/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import serverManager from './serverManager.js';

/**
 * Prüft, ob Container auf einem veralteten Image laufen — OHNE etwas zu laden.
 *
 * Die bestehende Prüfung in `docker.js` zieht zum Vergleich jedes Image per
 * `docker pull` herunter. Das ist für einen Knopfdruck vertretbar, für ein
 * Dashboard-Feld nicht: bei vier Servern wären das jedes Mal etliche Gigabyte
 * über die Leitung des Pi. Hier wird stattdessen nur der **Manifest-Digest** bei
 * der Registry erfragt (ein HEAD je Image, ein paar hundert Byte) und mit dem
 * lokalen Digest verglichen.
 */

// Registry-Antworten für diese Zeit behalten. Ein Image-Tag bewegt sich selten
// öfter als einmal am Tag, und Docker Hub zählt jede Manifest-Abfrage gegen das
// Abruf-Limit.
const REGISTRY_CACHE_MS = 6 * 60 * 60 * 1000;
const registryCache = new Map();

// Ergebnis des letzten vollständigen Durchlaufs, vom Hintergrundjob gefüllt.
let letzterLauf = null;

const HUB = 'registry-1.docker.io';

// Docker Hub erlaubt anonym nur begrenzt viele Manifest-Abfragen pro IP.
// Mit hinterlegtem Konto ist das Limit höher — optional, nichts bricht ohne.
const HUB_USER = process.env.DOCKERHUB_USER || '';
const HUB_TOKEN = process.env.DOCKERHUB_TOKEN || '';

/**
 * Zerlegt eine Image-Angabe in Registry, Repository und Tag.
 *
 * `nginx` → docker.io/library/nginx:latest
 * `mas0n1x/portfolio:v2` → docker.io/mas0n1x/portfolio:v2
 * `ghcr.io/org/app:main` → ghcr.io/org/app:main
 */
export function parseImageRef(ref) {
  if (!ref || ref.startsWith('sha256:')) return null;

  // Digest-gepinnte Images können sich per Definition nicht ändern.
  if (ref.includes('@sha256:')) return null;

  let rest = ref;
  let registry = HUB;

  const ersterTeil = rest.split('/')[0];
  // Ein Punkt, ein Doppelpunkt oder „localhost" macht den ersten Teil zur
  // Registry — sonst ist es ein Namensraum auf Docker Hub.
  if (rest.includes('/') && (ersterTeil.includes('.') || ersterTeil.includes(':') || ersterTeil === 'localhost')) {
    registry = ersterTeil;
    rest = rest.slice(ersterTeil.length + 1);
  }

  let tag = 'latest';
  const doppelpunkt = rest.lastIndexOf(':');
  if (doppelpunkt > rest.lastIndexOf('/')) {
    tag = rest.slice(doppelpunkt + 1);
    rest = rest.slice(0, doppelpunkt);
  }

  // Auf Docker Hub liegen Ein-Wort-Images unter „library".
  if (registry === HUB && !rest.includes('/')) rest = `library/${rest}`;

  return { registry, repository: rest, tag, canonical: `${registry}/${rest}:${tag}` };
}

/**
 * Holt ein Zugriffs-Token für die Registry.
 *
 * Statt die Token-Adresse je Registry fest zu verdrahten, wird der
 * Authentifizierungs-Hinweis aus dem `WWW-Authenticate`-Header gelesen — so
 * funktionieren Docker Hub, GHCR und alles andere mit demselben Code.
 */
async function holeToken(registry, repository) {
  const probe = await fetch(`https://${registry}/v2/`, {
    method: 'GET',
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);

  if (!probe) return null;
  if (probe.status !== 401) return null; // offene Registry, kein Token nötig

  const hinweis = probe.headers.get('www-authenticate') || '';
  const realm = /realm="([^"]+)"/.exec(hinweis)?.[1];
  if (!realm) return null;
  const service = /service="([^"]+)"/.exec(hinweis)?.[1];

  const url = new URL(realm);
  if (service) url.searchParams.set('service', service);
  url.searchParams.set('scope', `repository:${repository}:pull`);

  const headers = {};
  if (registry === HUB && HUB_USER && HUB_TOKEN) {
    headers.Authorization = 'Basic ' + Buffer.from(`${HUB_USER}:${HUB_TOKEN}`).toString('base64');
  }

  const antwort = await fetch(url, { headers, signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!antwort?.ok) return null;

  const daten = await antwort.json().catch(() => null);
  return daten?.token || daten?.access_token || null;
}

/** Der aktuelle Digest eines Tags in der Registry — ohne das Image zu laden. */
async function holeRegistryDigest(registry, repository, tag) {
  const schluessel = `${registry}/${repository}:${tag}`;
  const zwischen = registryCache.get(schluessel);
  if (zwischen && Date.now() - zwischen.at < REGISTRY_CACHE_MS) return zwischen.wert;

  const merken = (wert) => {
    registryCache.set(schluessel, { wert, at: Date.now() });
    return wert;
  };

  try {
    const token = await holeToken(registry, repository);

    const antwort = await fetch(`https://${registry}/v2/${repository}/manifests/${encodeURIComponent(tag)}`, {
      method: 'HEAD',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        // Ohne die Multi-Architektur-Typen liefert die Registry den Digest der
        // Einzelarchitektur — der weicht auf dem Pi (arm64) immer vom lokalen
        // ab und JEDES Image gälte als veraltet.
        Accept: [
          'application/vnd.docker.distribution.manifest.list.v2+json',
          'application/vnd.oci.image.index.v1+json',
          'application/vnd.docker.distribution.manifest.v2+json',
          'application/vnd.oci.image.manifest.v1+json',
        ].join(', '),
      },
      signal: AbortSignal.timeout(10000),
    });

    if (antwort.status === 429) return merken({ digest: null, fehler: 'Abruf-Limit der Registry erreicht' });
    if (antwort.status === 404) return merken({ digest: null, fehler: 'Tag existiert nicht mehr' });
    if (!antwort.ok) return merken({ digest: null, fehler: `Registry antwortete mit ${antwort.status}` });

    const digest = antwort.headers.get('docker-content-digest');
    return merken(digest ? { digest, fehler: null } : { digest: null, fehler: 'Kein Digest im Kopf' });
  } catch (error) {
    // Netzfehler NICHT zwischenspeichern — beim nächsten Lauf erneut versuchen.
    return { digest: null, fehler: error.message };
  }
}

/**
 * Ein Server: welche Container laufen auf einem veralteten Image?
 *
 * Nutzt EINEN `listImages`-Aufruf statt eines `inspect` je Container.
 */
async function pruefeServer(server) {
  const docker = serverManager.getDocker(server.id);
  if (!docker) return { serverId: server.id, serverName: server.name, containers: [], skipped: 'Kein Docker-Zugriff' };

  const [container, images] = await Promise.all([
    docker.listContainers({ all: true }),
    docker.listImages(),
  ]);

  const imageNachId = new Map(images.map(i => [i.Id, i]));
  const ergebnis = [];

  for (const c of container) {
    const ref = parseImageRef(c.Image);
    if (!ref) continue;

    const lokal = imageNachId.get(c.ImageID);
    const repoDigests = lokal?.RepoDigests || [];

    // Selbst gebaute Images (unser eigenes Frontend/Backend, die Bot-Runtime)
    // haben keinen Registry-Digest — für die gibt es nichts zu vergleichen.
    if (repoDigests.length === 0) continue;

    const passend = repoDigests.find(d => d.startsWith(ref.repository + '@') || d.includes(`/${ref.repository.split('/').pop()}@`));
    const lokalerDigest = (passend || repoDigests[0]).split('@')[1];
    if (!lokalerDigest) continue;

    const { digest, fehler } = await holeRegistryDigest(ref.registry, ref.repository, ref.tag);

    ergebnis.push({
      containerId: c.Id,
      containerName: c.Names[0]?.replace(/^\//, '') || 'unbekannt',
      project: c.Labels?.['com.docker.compose.project'] || null,
      image: c.Image,
      state: c.State,
      localDigest: lokalerDigest.slice(0, 19),
      remoteDigest: digest ? digest.slice(0, 19) : null,
      // Ohne Antwort der Registry gilt bewusst „kein Update", nicht „Update da".
      // Ein Fehlalarm würde zu einem unnötigen Neuaufbau verleiten.
      hasUpdate: !!digest && digest !== lokalerDigest,
      error: fehler,
    });
  }

  return { serverId: server.id, serverName: server.name, containers: ergebnis, skipped: null };
}

/**
 * Vollständiger Durchlauf über die ganze Flotte.
 *
 * Die Server laufen parallel, die Registry-Abfragen teilen sich den Cache —
 * ein Image, das auf drei Servern läuft, wird nur einmal erfragt.
 */
export async function checkFleetImageUpdates() {
  const servers = serverManager.getAllServers();

  const ergebnisse = await Promise.all(servers.map(s =>
    pruefeServer(s).catch(error => ({
      serverId: s.id,
      serverName: s.name,
      containers: [],
      skipped: error.message,
    })),
  ));

  const veraltet = ergebnisse.flatMap(r => r.containers.filter(c => c.hasUpdate));
  const fehler = ergebnisse.flatMap(r => r.containers.filter(c => c.error));
  const geprueft = ergebnisse.reduce((s, r) => s + r.containers.length, 0);

  letzterLauf = {
    servers: ergebnisse,
    outdated: veraltet,
    counts: {
      outdated: veraltet.length,
      checked: geprueft,
      failed: fehler.length,
    },
    // Ein erreichtes Abruf-Limit muss sichtbar sein — sonst hält man ein
    // unvollständiges Ergebnis für ein sauberes.
    rateLimited: fehler.some(f => f.error?.includes('Abruf-Limit')),
    checkedAt: new Date().toISOString(),
  };

  return letzterLauf;
}

/** Ergebnis des letzten Durchlaufs (ohne neuen anzustoßen). */
export function getLastImageUpdateRun() {
  return letzterLauf;
}
