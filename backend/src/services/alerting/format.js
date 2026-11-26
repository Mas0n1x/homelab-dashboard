/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Formatierungs-Helfer

// ── Formatierungs-Helfer ─────────────────────────────────────────
export function fmtPct(n) { return `${Number(n || 0).toFixed(1)}%`; }
export function fmtBytes(b) {
  if (!b || b <= 0) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = b, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${u[i]}`;
}
export function progressBar(pct) {
  const p = Math.max(0, Math.min(100, Number(pct || 0)));
  const filled = Math.round(p / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}
// Rohe Image-Referenzen lesbar machen (nackte sha256-Hashes kürzen).
export function fmtImage(img) {
  const s = String(img || '').trim();
  const m = s.match(/^sha256:([0-9a-f]{12})/i);
  if (m) return `\`${m[1]}\``;
  return s.length > 48 ? `\`${s.substring(0, 45)}…\`` : `\`${s}\``;
}
// Container-Status mit Punkt-Indikator lesbar darstellen.
export function fmtContainerState(state) {
  const s = String(state || 'unbekannt').toLowerCase();
  const map = { running: '🟢 läuft', exited: '⚪ beendet', dead: '🔴 tot', created: '🔵 erstellt', paused: '🟠 pausiert', restarting: '🟠 startet neu' };
  return map[s] || `⚪ ${s}`;
}

// Gemeinsame Kontext-Felder für System-Alerts.
export function contextFields(data) {
  const f = [];
  if (data.serverName) f.push({ name: '🖥️ Server', value: data.serverName, inline: true });
  if (data.systemStats?.uptime && data.systemStats.uptime !== 'N/A') {
    f.push({ name: '⏱️ Uptime', value: String(data.systemStats.uptime), inline: true });
  }
  return f;
}
