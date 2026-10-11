/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Zahl mit deutschem Dezimalkomma. `toFixed` liefert immer den Punkt — in einer
// deutschen Oberfläche steht dort „9.9 GB" statt „9,9 GB". Nur für Anzeigetexte;
// SVG-Pfade und CSS-Werte brauchen weiterhin den Punkt.
export function zahl(wert: number, nachkomma = 1): string {
  if (!Number.isFinite(wert)) return '–';
  return wert.toLocaleString('de-DE', { minimumFractionDigits: nachkomma, maximumFractionDigits: nachkomma });
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(sizes.length - 1, Math.max(0, Math.floor(Math.log(bytes) / Math.log(k))));
  // Überflüssige Nullen weglassen (wie zuvor parseFloat), aber mit Komma
  return (bytes / Math.pow(k, i)).toLocaleString('de-DE', { maximumFractionDigits: decimals }) + ' ' + sizes[i];
}

export function formatBytesPerSec(bytes: number): string {
  if (!bytes) return '0 B/s';
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.min(sizes.length - 1, Math.max(0, Math.floor(Math.log(bytes) / Math.log(k))));
  return (bytes / Math.pow(k, i)).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' ' + sizes[i];
}

export function formatPercent(value: number): string {
  return zahl(value, 1) + '%';
}

// Glances und der Proxmox-Gast liefern die Laufzeit englisch („2 days, 10:02:17").
export function formatUptime(uptime: string | null | undefined): string {
  if (!uptime) return 'n. v.';
  return uptime.replace(/(\d+) days?,\s*/, (_, n) => `${n} ${Number(n) === 1 ? 'Tag' : 'Tage'}, `);
}

// Monatspreis: „2,10 €" — immer zwei Nachkommastellen, Symbol je Währung.
export function formatPreis(wert: number, waehrung?: string | null): string {
  return `${zahl(wert, 2)} ${waehrung === 'USD' ? '$' : '€'}`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

export function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Gerade eben';
  if (minutes < 60) return `vor ${minutes} Min.`;
  if (hours < 24) return `vor ${hours} Std.`;
  if (days < 7) return `vor ${days} Tag${days > 1 ? 'en' : ''}`;
  return formatDate(dateStr);
}

// 'monitoring' = nur Glances, kein Docker-Zugriff (z. B. Proxmox-Host): der
// Server ist erreichbar und liefert Daten. Nur 'disconnected' heisst offline.
export function istErreichbar(status: string | undefined | null): boolean {
  return status === 'connected' || status === 'monitoring';
}
