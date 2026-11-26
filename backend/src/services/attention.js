/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { getDb } from './database.js';
import serverManager from './serverManager.js';
import { getAlertOverview, getMaintenance } from './alerting.js';
import { buildStatusBoard } from './statusBoard.js';
import { getDiskForecast } from './diskForecast.js';
import { getLastImageUpdateRun } from './imageUpdates.js';
import { getMemoryTrends } from './metrics.js';

const SCHWERE = { critical: 0, warning: 1, info: 2 };

function tageBis(iso) {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : Math.ceil((t - Date.now()) / 86400000);
}

/**
 * Alles, was Aufmerksamkeit braucht, in EINER Liste.
 *
 * Bündelt, was sich vorher über vier Widgets verteilte, und liefert dazu die
 * Gesamtampel. Rein lesend und ohne Netzaufrufe: alle Quellen sind bereits
 * zwischengespeicherte Ergebnisse der Hintergrundjobs.
 */
export function buildAttention() {
  const db = getDb();
  const items = [];
  const add = (severity, kind, title, detail, href, serverId = null) =>
    items.push({ id: `${kind}:${serverId || ''}:${title}`, severity, kind, title, detail, href, serverId });

  const servers = serverManager.getAllServers();
  const overview = getAlertOverview();

  // 1) Server nicht erreichbar
  for (const s of servers) {
    if (s.status === 'disconnected') {
      const wartung = overview[s.id]?.maintenance;
      if (wartung) continue; // geplant: unter „Wartung" aufgeführt
      add('critical', 'offline', `${s.name} ist nicht erreichbar`, s.lastSeen ? `Letzter Kontakt ${new Date(s.lastSeen).toLocaleString('de-DE')}` : 'Noch kein Kontakt seit dem Start', `/server/${s.id}`, s.id);
    }
  }

  // 2) Aktive Schwellwert-Alarme (mit Hysterese, Overrides und Wartung berücksichtigt)
  for (const [serverId, o] of Object.entries(overview)) {
    if (o.maintenance) continue;
    for (const a of o.alerts) {
      const kritisch = a.metric === 'disk' || a.metric === 'temp';
      const einheit = a.metric === 'temp' ? ' °C' : ' %';
      add(kritisch ? 'critical' : 'warning', 'alarm', `${o.name}: ${a.label} hoch`,
        `${String(a.value).replace('.', ',')}${einheit} (Schwelle ${a.limit}${einheit})`, `/server/${serverId}`, serverId);
    }
  }

  // 3) Dienste, die nicht antworten
  try {
    const board = buildStatusBoard(1);
    for (const g of board.groups || []) {
      if (g.stale) continue; // Discovery lief nicht — keine belastbare Aussage
      const down = (g.services || []).filter(sv => sv.current === false && !sv.vanished);
      if (down.length) {
        add('warning', 'dienst', `${down.length} ${down.length === 1 ? 'Dienst' : 'Dienste'} offline auf ${g.server.name}`,
          down.slice(0, 4).map(sv => sv.name).join(', ') + (down.length > 4 ? ` und ${down.length - 4} weitere` : ''), '/status', g.server.id);
      }
    }
  } catch { /* Statusboard nicht kritisch für die Liste */ }

  // 4) Backup
  try {
    const letztes = db.prepare('SELECT status, started_at, completed_at FROM backups ORDER BY started_at DESC LIMIT 1').get();
    const ok = db.prepare("SELECT completed_at FROM backups WHERE status = 'completed' ORDER BY completed_at DESC LIMIT 1").get();
    if (letztes?.status === 'failed') {
      add('warning', 'backup', 'Letztes Dashboard-Backup fehlgeschlagen', `Gestartet ${new Date(letztes.started_at).toLocaleString('de-DE')}`, '/settings');
    } else if (ok?.completed_at) {
      const alter = Math.floor((Date.now() - new Date(ok.completed_at).getTime()) / 86400000);
      if (alter >= 3) add('warning', 'backup', `Kein Backup seit ${alter} Tagen`, 'Letztes erfolgreiches Backup ist älter als 3 Tage', '/settings');
    } else if (letztes) {
      add('warning', 'backup', 'Noch kein erfolgreiches Backup', 'Es gibt keinen abgeschlossenen Lauf', '/settings');
    }
  } catch { /* Tabelle fehlt o. Ä. */ }

  // 5) Platte läuft voll
  try {
    for (const s of getDiskForecast(30).servers || []) {
      if (s.daysUntilFull != null && s.daysUntilFull <= 30) {
        add(s.daysUntilFull <= 7 ? 'critical' : 'warning', 'prognose', `${s.serverName}: Platte${s.mountPoint ? ` ${s.mountPoint}` : ''} in ca. ${s.daysUntilFull} Tagen voll`,
          `${Math.round(s.percent || 0)} % belegt`, `/server/${s.serverId}`, s.serverId);
      }
    }
  } catch { /* Prognose optional */ }

  // 6) RAM-Trend (Speicherleck-Verdacht)
  try {
    for (const t of getMemoryTrends()) {
      if (t.status === 'steigend') {
        add('warning', 'ram-trend', `${t.serverName}: RAM-Bedarf steigt`,
          `+${String(t.slopePerDay).replace('.', ',')} Prozentpunkte/Tag seit ${t.days} Tagen${t.daysUntilFull ? ` · voll in ca. ${t.daysUntilFull} Tagen` : ''}`, `/server/${t.serverId}`, t.serverId);
      }
    }
  } catch { /* Trend optional */ }

  // 7) Server-Laufzeit (Vertrag, Rechnung)
  for (const s of servers) {
    const tage = s.expires_at ? tageBis(s.expires_at) : null;
    if (tage != null && tage <= 14) {
      add(tage <= 3 ? 'critical' : 'warning', 'ablauf', tage <= 0 ? `${s.name} ist abgelaufen` : `${s.name} läuft in ${tage} Tagen ab`, 'Laufzeit laut Server-Daten', '/settings', s.id);
    }
  }

  // 8) Veraltete Images
  const lauf = getLastImageUpdateRun();
  if (lauf?.counts?.outdated > 0) {
    add('info', 'images', `${lauf.counts.outdated} Container mit veraltetem Image`, 'Updates stehen bereit', '/');
  }

  // 9) Laufende Wartungsfenster (rein informativ)
  const wartung = getMaintenance();
  for (const w of wartung) {
    const name = w.serverId === '*' ? 'Alle Server' : (overview[w.serverId]?.name || w.serverId);
    add('info', 'wartung', `Wartung: ${name}`, `${w.reason || 'Keine Benachrichtigungen'} · bis ${new Date(w.until).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`, '/alerts', w.serverId === '*' ? null : w.serverId);
  }

  items.sort((a, b) => SCHWERE[a.severity] - SCHWERE[b.severity]);
  const counts = {
    critical: items.filter(i => i.severity === 'critical').length,
    warning: items.filter(i => i.severity === 'warning').length,
    info: items.filter(i => i.severity === 'info').length,
  };
  return {
    status: counts.critical ? 'critical' : counts.warning ? 'warning' : 'ok',
    counts,
    items,
    generatedAt: new Date().toISOString(),
  };
}
