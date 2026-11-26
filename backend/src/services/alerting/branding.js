/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Aussehen und Einordnung der Meldungen

// ── Discord-Embed-Branding ───────────────────────────────────────
// Zentrale Optik für alle Alerts: einheitlicher Absender, verfeinerte
// Discord-native Farbpalette, Severity-Author-Zeile und Kategorie-Label.
export const BRAND = {
  name: process.env.HOMELAB_WEBHOOK_NAME || 'Homelab Monitor',
  avatar: process.env.HOMELAB_WEBHOOK_AVATAR || null, // optional: URL zu einem Avatar-Bild
};

// Severity-Definitionen (Discord-native Töne wirken edler als grelle Vollfarben).
export const SEVERITY = {
  critical: { color: 0xed4245, icon: '🔴', label: 'Kritisch' },
  warning:  { color: 0xf0a020, icon: '🟠', label: 'Warnung' },
  success:  { color: 0x57f287, icon: '🟢', label: 'Entwarnung' },
  info:     { color: 0x5865f2, icon: '🔵', label: 'Info' },
};

// Alte Roh-Farben der Aufrufer auf ein Severity-Level abbilden.
export function severityFromColor(color) {
  switch (color) {
    case 0x00ff88:
    case 0x10b981: return 'success';
    case 0xff8800: return 'warning';
    case 0x00d4ff:
    case 0x6366f1: return 'info';
    case 0xff4444: return 'critical';
    default:       return 'info';
  }
}

// Lesbares Kategorie-Label aus dem Event-Typ (Suffixe wie ::ok / ::/mnt weg).
const EVENT_CATEGORY = {
  cpu_high: 'System · CPU',
  ram_high: 'System · Arbeitsspeicher',
  disk_high: 'System · Speicherplatz',
  temp_high: 'System · Temperatur',
  reboot: 'System · Neustart',
  container_crash: 'Docker · Container',
  container_restart: 'Docker · Container',
  service_offline: 'Dienste',
  server_offline: 'System · Erreichbarkeit',
  status_report: 'Statusbericht',
  new_portfolio_request: 'Portfolio · Anfrage',
  new_portfolio_customer: 'Portfolio · Kunde',
  backup_completed: 'Backup · Erfolg',
  backup_failed: 'Backup · Fehler',
  disk_forecast: 'Speicher · Prognose',
  ram_trend: 'System · RAM-Trend',
  image_updates: 'Docker · Updates',
  test: 'Verbindungstest',
};
export function categoryFromEvent(event) {
  const base = String(event || '').split('::')[0];
  return EVENT_CATEGORY[base] || 'Homelab';
}
