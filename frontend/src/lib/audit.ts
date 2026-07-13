/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import type { LucideIcon } from 'lucide-react';
import {
  LogIn, LogOut, KeyRound, ShieldAlert, Play, Square, RotateCw, Boxes,
  Plus, Pencil, Trash2, Server, HardDriveDownload, Bell, Activity,
} from 'lucide-react';

export interface FormattedAudit {
  label: string;      // Lesbare Aktion, z. B. "Anmeldung"
  detail?: string;    // Ziel/Zusatz (Container-Name, Nutzer …)
  Icon: LucideIcon;
  tint: string;       // Text-Farbklasse fürs Icon
  group: 'auth' | 'container' | 'service' | 'server' | 'backup' | 'alert' | 'system';
}

/** Filtert Platzhalter-Werte ("null"/"undefined") aus alten Datensätzen heraus. */
export function cleanAuditValue(v?: string | null): string | undefined {
  if (v == null) return undefined;
  let s = String(v).trim();
  if (!s || s === 'null' || s === 'undefined' || s === '{}') return undefined;
  // Einfache JSON-Details lesbar machen: {"url":"…"} → url: …
  if (s.startsWith('{') && s.endsWith('}')) {
    try {
      const obj = JSON.parse(s);
      const parts = Object.entries(obj)
        .filter(([, val]) => val != null && val !== '')
        .map(([k, val]) => `${k}: ${val}`);
      s = parts.join(' · ');
    } catch { /* roh lassen */ }
  }
  return s || undefined;
}

const MAP: Record<string, Omit<FormattedAudit, 'detail'>> = {
  'auth.login': { label: 'Anmeldung', Icon: LogIn, tint: 'text-indigo-400', group: 'auth' },
  'auth.logout': { label: 'Abmeldung', Icon: LogOut, tint: 'text-white/40', group: 'auth' },
  'auth.login.failed': { label: 'Fehlgeschlagene Anmeldung', Icon: ShieldAlert, tint: 'text-red-400', group: 'auth' },
  'auth.failed': { label: 'Fehlgeschlagene Anmeldung', Icon: ShieldAlert, tint: 'text-red-400', group: 'auth' },
  'auth.password': { label: 'Passwort geändert', Icon: KeyRound, tint: 'text-amber-400', group: 'auth' },
  'container.start': { label: 'Container gestartet', Icon: Play, tint: 'text-emerald-400', group: 'container' },
  'container.stop': { label: 'Container gestoppt', Icon: Square, tint: 'text-amber-400', group: 'container' },
  'container.restart': { label: 'Container neu gestartet', Icon: RotateCw, tint: 'text-cyan-400', group: 'container' },
  'container.remove': { label: 'Container entfernt', Icon: Trash2, tint: 'text-red-400', group: 'container' },
  'service.add': { label: 'Dienst hinzugefügt', Icon: Plus, tint: 'text-emerald-400', group: 'service' },
  'service.update': { label: 'Dienst geändert', Icon: Pencil, tint: 'text-cyan-400', group: 'service' },
  'service.delete': { label: 'Dienst entfernt', Icon: Trash2, tint: 'text-red-400', group: 'service' },
  'server.add': { label: 'Server hinzugefügt', Icon: Plus, tint: 'text-emerald-400', group: 'server' },
  'server.update': { label: 'Server geändert', Icon: Pencil, tint: 'text-cyan-400', group: 'server' },
  'server.delete': { label: 'Server entfernt', Icon: Trash2, tint: 'text-red-400', group: 'server' },
  'backup.run': { label: 'Backup erstellt', Icon: HardDriveDownload, tint: 'text-violet-400', group: 'backup' },
  'backup.restore': { label: 'Backup wiederhergestellt', Icon: HardDriveDownload, tint: 'text-amber-400', group: 'backup' },
};

const PREFIX: Record<string, Omit<FormattedAudit, 'detail'>> = {
  auth: { label: 'Konto-Aktion', Icon: KeyRound, tint: 'text-indigo-400', group: 'auth' },
  container: { label: 'Container-Aktion', Icon: Boxes, tint: 'text-cyan-400', group: 'container' },
  service: { label: 'Dienst-Aktion', Icon: Activity, tint: 'text-emerald-400', group: 'service' },
  server: { label: 'Server-Aktion', Icon: Server, tint: 'text-white/50', group: 'server' },
  backup: { label: 'Backup-Aktion', Icon: HardDriveDownload, tint: 'text-violet-400', group: 'backup' },
};

export function formatAudit(action: string, target?: string | null, details?: string | null): FormattedAudit {
  const act = (action || '').toLowerCase();
  const base = MAP[act] || PREFIX[act.split('.')[0]] || {
    label: action || 'Aktion', Icon: Activity, tint: 'text-white/50', group: 'system' as const,
  };
  const detail = cleanAuditValue(target) ?? cleanAuditValue(details);
  return { ...base, detail };
}

/** Für Alarm-Ereignisse (kind === 'alert') im Ereignis-Widget. */
export function alertMeta(): Pick<FormattedAudit, 'Icon' | 'tint'> {
  return { Icon: Bell, tint: 'text-amber-400' };
}
