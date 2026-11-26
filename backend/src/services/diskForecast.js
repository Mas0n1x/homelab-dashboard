/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { getDb } from './database.js';
import serverManager from './serverManager.js';
import { lineareRegression, ohneEinmalSpruenge } from './regression.js';

// Wie lange die Tageswerte aufgehoben werden.
const KEEP_DAYS = 400;

// Weniger Tage taugen nicht für eine Aussage — bei drei Messpunkten bestimmt
// ein einzelner Docker-Build die Steigung.
const MIN_DAYS = 7;

// Standard-Fenster für die Regression. Ältere Daten schleppen längst
// aufgeräumte Altlasten mit und verfälschen den aktuellen Trend.
const WINDOW_DAYS = 30;

// Ein Rückgang über dieser Schwelle (Anteil der Platte, mindestens aber der
// Festbetrag) gilt als Aufräumaktion und nicht als Schwankung. Davor zählen die
// Tage nicht mehr: sonst rechnet die Regression eine Löschaktion als Trend ein
// und meldet z. B. „voll in 13 Tagen", obwohl gerade 90 GB frei geworden sind.
const AUFRAEUMEN_ANTEIL = 0.08;
const AUFRAEUMEN_MIN_BYTES = 10 * 1024 ** 3;

// Ein Zuwachs über dieser Schwelle gilt als einmaliger Sprung (neues Modell,
// großes Image), wenn er aus dem Verlauf heraussticht — siehe ohneEinmalSpruenge.
const SPRUNG_ANTEIL = 0.05;
const SPRUNG_MIN_BYTES = 5 * 1024 ** 3;

// Erklärt die Gerade weniger als diesen Teil der Schwankung, gibt es keine Prognose.
const MIN_R2 = 0.5;

/**
 * Index der ersten Zeile NACH dem letzten großen Rückgang (0, wenn es keinen gab).
 */
function indexNachAufraeumen(zeilen) {
  for (let i = zeilen.length - 1; i > 0; i--) {
    const rueckgang = zeilen[i - 1].used_bytes - zeilen[i].used_bytes;
    const schwelle = Math.max(AUFRAEUMEN_MIN_BYTES, (zeilen[i].total_bytes || 0) * AUFRAEUMEN_ANTEIL);
    if (rueckgang >= schwelle) return i;
  }
  return 0;
}

/**
 * Tageswert der Plattenbelegung festhalten.
 *
 * Wird bei jedem Metrik-Sample aufgerufen (alle 30 s) und schreibt pro Server
 * und Tag EINE Zeile fort: der zuletzt gesehene Stand des Tages gewinnt.
 * Bewusst der letzte und nicht der Mittelwert — für einen Füllstand zählt, wo
 * er am Ende des Tages stand, nicht wie er über den Tag schwankte.
 */
export function recordDiskDaily(serverId, usedBytes, totalBytes) {
  if (!serverId || !totalBytes || totalBytes <= 0) return;
  const db = getDb();
  const day = new Date().toISOString().slice(0, 10);
  const percent = (usedBytes / totalBytes) * 100;

  db.prepare(`
    INSERT INTO disk_daily (server_id, day, used_bytes, total_bytes, percent, samples, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
    ON CONFLICT(server_id, day) DO UPDATE SET
      used_bytes = excluded.used_bytes,
      total_bytes = excluded.total_bytes,
      percent = excluded.percent,
      samples = disk_daily.samples + 1,
      updated_at = datetime('now')
  `).run(serverId, day, Math.round(usedBytes), Math.round(totalBytes), percent);
}

/** Tageswert je Einhängepunkt — der zuletzt gesehene Stand des Tages gewinnt. */
export function recordDiskMounts(serverId, disks = []) {
  if (!serverId) return;
  const stmt = getDb().prepare(`
    INSERT INTO disk_mount_daily (server_id, mount, day, used_bytes, total_bytes, percent) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(server_id, mount, day) DO UPDATE SET
      used_bytes = excluded.used_bytes, total_bytes = excluded.total_bytes, percent = excluded.percent
  `);
  const day = new Date().toISOString().slice(0, 10);
  for (const d of disks) {
    const mount = d.mountPoint || d.device;
    if (!mount || !(d.total > 0)) continue;
    stmt.run(serverId, mount, day, Math.round(d.used || 0), Math.round(d.total), ((d.used || 0) / d.total) * 100);
  }
}

export function pruneDiskDaily() {
  const db = getDb();
  const cutoff = new Date(Date.now() - KEEP_DAYS * 86400000).toISOString().slice(0, 10);
  db.prepare('DELETE FROM disk_mount_daily WHERE day < ?').run(cutoff);
  return db.prepare('DELETE FROM disk_daily WHERE day < ?').run(cutoff).changes;
}

// Prognose für EINE Messreihe (ein Mount oder die Summe eines Servers).
function bewerte(server, alle, mountPoint = null) {
  // Nur der Verlauf seit der letzten Aufräumaktion taugt für den Trend.
  const ab = indexNachAufraeumen(alle);
  const zeilen = alle.slice(ab);
  const aufgeraeumtAm = ab > 0 ? alle[ab].day : null;

  const aktuell = zeilen[zeilen.length - 1] || null;

  const basis = {
    serverId: server.id,
    serverName: server.name,
    mountPoint,
    usedBytes: aktuell?.used_bytes ?? null,
    totalBytes: aktuell?.total_bytes ?? null,
    percent: aktuell?.percent ?? null,
    historyDays: zeilen.length,
    bytesPerDay: null,
    daysUntilFull: null,
    fullAt: null,
    confidence: null,
    trend: 'unbekannt',
    aufgeraeumtAm,
  };

  if (zeilen.length < MIN_DAYS || !aktuell?.total_bytes) {
    const datum = aufgeraeumtAm ? aufgeraeumtAm.split('-').reverse().slice(0, 2).join('.') + '.' : null;
    basis.reason = zeilen.length < MIN_DAYS
      ? (datum
        ? `Aufgeräumt am ${datum} — neuer Verlauf: ${zeilen.length} von ${MIN_DAYS} Tagen`
        : `Noch zu wenig Verlauf (${zeilen.length} von ${MIN_DAYS} Tagen)`)
      : 'Keine Plattengröße bekannt';
    return basis;
  }

  // x = Tage seit dem ersten Messpunkt, y = belegte Bytes ohne Einmal-Sprünge.
  const start = Date.parse(zeilen[0].day + 'T00:00:00Z');
  const bereinigt = ohneEinmalSpruenge(
    zeilen.map(z => z.used_bytes),
    Math.max(SPRUNG_MIN_BYTES, aktuell.total_bytes * SPRUNG_ANTEIL),
  );
  const punkte = zeilen.map((z, i) => ({
    x: (Date.parse(z.day + 'T00:00:00Z') - start) / 86400000,
    y: bereinigt[i],
  }));

  const { steigung, r2 } = lineareRegression(punkte);
  basis.bytesPerDay = Math.round(steigung);
  basis.confidence = parseFloat(r2.toFixed(2));
  basis.trend = steigung > 1024 * 1024 ? 'steigend' : steigung < -1024 * 1024 ? 'fallend' : 'stabil';

  const frei = aktuell.total_bytes - aktuell.used_bytes;

  if (frei <= 0) {
    basis.reason = 'Platte ist bereits voll';
  } else if (steigung <= 0) {
    basis.reason = 'Belegung wächst gerade nicht';
  } else if (r2 < MIN_R2) {
    basis.reason = 'Verlauf zu sprunghaft für eine Prognose';
  } else if (frei / steigung > 730) {
    // Über zwei Jahre hinaus ist die Zahl bedeutungslos — bis dahin ist die
    // Platte längst getauscht oder aufgeräumt.
    basis.reason = 'Wächst so langsam, dass eine Prognose keinen Sinn ergibt';
  } else {
    basis.daysUntilFull = Math.round(frei / steigung);
    basis.fullAt = new Date(Date.now() + (frei / steigung) * 86400000).toISOString();
  }
  return basis;
}

// Dringlichste Aussage zuerst: kürzeste Restzeit, sonst höchste Belegung.
function dringender(a, b) {
  if (a.daysUntilFull === null && b.daysUntilFull === null) return (b.percent ?? 0) - (a.percent ?? 0);
  if (a.daysUntilFull === null) return 1;
  if (b.daysUntilFull === null) return -1;
  return a.daysUntilFull - b.daysUntilFull;
}

/**
 * Prognose je Server: wie viele Tage bleiben, bis eine Platte voll ist?
 *
 * Gerechnet wird je Einhängepunkt, gemeldet der dringlichste. Solange noch kein
 * Mount genug Verlauf hat, gilt die Summe aller Platten.
 *
 * `null` bei daysUntilFull heißt bewusst „keine Aussage" — entweder fehlen
 * Tage, oder der Verbrauch sinkt gerade, oder die Streuung ist zu groß. Eine
 * erfundene Zahl wäre hier schlimmer als gar keine.
 */
export function getDiskForecast(windowDays = WINDOW_DAYS) {
  const db = getDb();
  const seit = new Date(Date.now() - windowDays * 86400000).toISOString().slice(0, 10);
  const servers = serverManager.getAllServers();

  const ergebnisse = servers.map((server) => {
    const mountZeilen = db.prepare(
      'SELECT mount, day, used_bytes, total_bytes, percent FROM disk_mount_daily WHERE server_id = ? AND day >= ? ORDER BY day ASC'
    ).all(server.id, seit);
    const letzterTag = mountZeilen.at(-1)?.day;
    const jeMount = new Map();
    for (const z of mountZeilen) {
      if (!jeMount.has(z.mount)) jeMount.set(z.mount, []);
      jeMount.get(z.mount).push(z);
    }
    const mounts = [...jeMount]
      .filter(([, zeilen]) => zeilen.at(-1).day === letzterTag) // ausgehängte Platten zählen nicht
      .map(([mount, zeilen]) => bewerte(server, zeilen, mount))
      .filter(e => e.historyDays >= MIN_DAYS);
    if (mounts.length) return mounts.sort(dringender)[0];

    return bewerte(server, db.prepare(
      'SELECT day, used_bytes, total_bytes, percent FROM disk_daily WHERE server_id = ? AND day >= ? ORDER BY day ASC'
    ).all(server.id, seit));
  });

  // Was zuerst voll ist, steht oben; Server ohne Aussage ans Ende.
  ergebnisse.sort(dringender);

  return { servers: ergebnisse, windowDays, minDays: MIN_DAYS };
}
