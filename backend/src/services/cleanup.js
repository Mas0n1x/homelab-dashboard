/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Aufräumen je Server: erst zeigen, was wegkäme, dann nur das Gewählte löschen.
// Volumes sind bewusst nicht dabei — dort liegen Daten, keine Reste.
const istVerwaist = (i) => !i.RepoTags?.length || i.RepoTags.every((t) => t.startsWith('<none>'));
const kurz = (id) => String(id || '').replace('sha256:', '').slice(0, 12);

function gruppe(eintraege) {
  const sortiert = eintraege.sort((a, b) => b.size - a.size);
  return { count: sortiert.length, size: sortiert.reduce((s, e) => s + e.size, 0), items: sortiert.slice(0, 50) };
}

export async function vorschau(docker) {
  const df = await docker.df();
  // Geteilte Schichten bleiben liegen, deshalb zählt nur der eigene Anteil.
  const image = (i) => ({ name: i.RepoTags?.find((t) => !t.startsWith('<none>')) || kurz(i.Id), size: Math.max(0, (i.Size || 0) - Math.max(0, i.SharedSize || 0)) });
  const unbenutzt = (df.Images || []).filter((i) => i.Containers === 0);
  const cache = (df.BuildCache || []).filter((b) => !b.InUse);
  return {
    buildCache: gruppe(cache.map((b) => ({ name: b.Description || b.Type || kurz(b.ID), size: b.Size || 0 }))),
    danglingImages: gruppe(unbenutzt.filter(istVerwaist).map(image)),
    unusedImages: gruppe(unbenutzt.filter((i) => !istVerwaist(i)).map(image)),
    containers: gruppe((df.Containers || [])
      .filter((c) => ['exited', 'created', 'dead'].includes(c.State))
      .map((c) => ({ name: c.Names?.[0]?.replace(/^\//, '') || kurz(c.Id), size: c.SizeRw || 0 }))),
  };
}

// dockerode reicht an /build/prune keine Optionen durch; ohne all=true bliebe
// der größte Teil des Zwischenspeichers liegen.
function leereBuildCache(docker) {
  return new Promise((resolve, reject) => {
    docker.modem.dial({ path: '/build/prune?all=true', method: 'POST', statusCodes: { 200: true, 500: 'server error' } },
      (err, data) => (err ? reject(err) : resolve(data)));
  });
}

export async function aufraeumen(docker, auswahl = {}) {
  const ergebnis = {};
  const schritt = async (name, fn) => {
    try {
      const r = await fn();
      ergebnis[name] = { ok: true, freigegeben: r?.SpaceReclaimed || 0 };
    } catch (e) {
      ergebnis[name] = { ok: false, freigegeben: 0, error: e.message };
    }
  };
  // Container zuerst: sonst gelten ihre Images noch als benutzt.
  if (auswahl.containers) await schritt('containers', () => docker.pruneContainers());
  if (auswahl.unusedImages) await schritt('images', () => docker.pruneImages({ filters: { dangling: { false: true } } }));
  else if (auswahl.danglingImages) await schritt('images', () => docker.pruneImages({ filters: { dangling: { true: true } } }));
  if (auswahl.buildCache) await schritt('buildCache', () => leereBuildCache(docker));
  return { ergebnis, freigegeben: Object.values(ergebnis).reduce((s, e) => s + e.freigegeben, 0) };
}
