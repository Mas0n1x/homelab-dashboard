/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { getDb } from './database.js';
import serverManager from './serverManager.js';
import { lineareRegression } from './regression.js';

// Wie lange die Tageswerte aufgehoben werden.
const KEEP_DAYS = 400;

// Weniger Tage taugen nicht für eine Aussage — bei drei Messpunkten bestimmt
// ein einzelner Docker-Build die Steigung.
const MIN_DAYS = 7;

// Standard-Fenster für die Regression. Ältere Daten schleppen längst
// aufgeräumte Altlasten mit und verfälschen den aktuellen Trend.
const WINDOW_DAYS = 30;

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

export function pruneDiskDaily() {
  const db = getDb();
  const cutoff = new Date(Date.now() - KEEP_DAYS * 86400000).toISOString().slice(0, 10);
  return db.prepare('DELETE FROM disk_daily WHERE day < ?').run(cutoff).changes;
}

/**
 * Prognose je Server: wie viele Tage bleiben, bis die Platte voll ist?
 *
 * `null` bei daysUntilFull heißt bewusst „keine Aussage" — entweder fehlen
 * Tage, oder der Verbrauch sinkt gerade, oder die Streuung ist zu groß. Eine
 * erfundene Zahl wäre hier schlimmer als gar keine.
 */
export function getDiskForecast(windowDays = WINDOW_DAYS) {
  const db = getDb();
  const seit = new Date(Date.now() - windowDays * 86400000).toISOString().slice(0, 10);
  const servers = serverManager.getAllServers();

  const ergebnisse = [];

  for (const server of servers) {
    const zeilen = db.prepare(
      'SELECT day, used_bytes, total_bytes, percent FROM disk_daily WHERE server_id = ? AND day >= ? ORDER BY day ASC'
    ).all(server.id, seit);

    const aktuell = zeilen[zeilen.length - 1] || null;

    const basis = {
      serverId: server.id,
      serverName: server.name,
      usedBytes: aktuell?.used_bytes ?? null,
      totalBytes: aktuell?.total_bytes ?? null,
      percent: aktuell?.percent ?? null,
      historyDays: zeilen.length,
      bytesPerDay: null,
      daysUntilFull: null,
      fullAt: null,
      confidence: null,
      trend: 'unbekannt',
    };

    if (zeilen.length < MIN_DAYS || !aktuell?.total_bytes) {
      basis.reason = zeilen.length < MIN_DAYS
        ? `Noch zu wenig Verlauf (${zeilen.length} von ${MIN_DAYS} Tagen)`
        : 'Keine Plattengröße bekannt';
      ergebnisse.push(basis);
      continue;
    }

    // x = Tage seit dem ersten Messpunkt, y = belegte Bytes.
    const start = Date.parse(zeilen[0].day + 'T00:00:00Z');
    const punkte = zeilen.map(z => ({
      x: (Date.parse(z.day + 'T00:00:00Z') - start) / 86400000,
      y: z.used_bytes,
    }));

    const { steigung, r2 } = lineareRegression(punkte);
    basis.bytesPerDay = Math.round(steigung);
    basis.confidence = parseFloat(r2.toFixed(2));
    basis.trend = steigung > 1024 * 1024 ? 'steigend' : steigung < -1024 * 1024 ? 'fallend' : 'stabil';

    const frei = aktuell.total_bytes - aktuell.used_bytes;

    if (steigung > 0 && frei > 0) {
      const tage = frei / steigung;
      // Über zwei Jahre hinaus ist die Zahl bedeutungslos — bis dahin ist die
      // Platte längst getauscht oder aufgeräumt.
      if (tage <= 730) {
        basis.daysUntilFull = Math.round(tage);
        basis.fullAt = new Date(Date.now() + tage * 86400000).toISOString();
      } else {
        basis.reason = 'Wächst so langsam, dass eine Prognose keinen Sinn ergibt';
      }
    } else if (steigung <= 0) {
      basis.reason = 'Belegung wächst gerade nicht';
    } else {
      basis.reason = 'Platte ist bereits voll';
    }

    ergebnisse.push(basis);
  }

  // Was zuerst voll ist, steht oben; Server ohne Aussage ans Ende.
  ergebnisse.sort((a, b) => {
    if (a.daysUntilFull === null && b.daysUntilFull === null) return (b.percent ?? 0) - (a.percent ?? 0);
    if (a.daysUntilFull === null) return 1;
    if (b.daysUntilFull === null) return -1;
    return a.daysUntilFull - b.daysUntilFull;
  });

  return { servers: ergebnisse, windowDays, minDays: MIN_DAYS };
}
