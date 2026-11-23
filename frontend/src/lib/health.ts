/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */

/**
 * Eine gemeinsame Quelle für „ok / Warnung / kritisch".
 *
 * Vorher hatten Ring (70/90), Summary-Leiste (50/80), Balken (75/90) und
 * Temperatur (60/75) je eigene Schwellen — dieselbe Last war in einem Element
 * grün und im nächsten gelb. Jetzt zählt die konfigurierte Alarm-Schwelle des
 * Servers: kritisch darüber, Warnung ab 15 Punkten darunter.
 */
export type Level = 'ok' | 'warn' | 'crit';

export const WARN_ABSTAND = 15;

export function level(value: number | null | undefined, limit: number | null | undefined): Level {
  if (value == null || limit == null) return 'ok';
  if (value > limit) return 'crit';
  if (value > limit - WARN_ABSTAND) return 'warn';
  return 'ok';
}

export const LEVEL_HEX: Record<Level, string> = { ok: '#10b981', warn: '#f59e0b', crit: '#ef4444' };
export const LEVEL_TEXT: Record<Level, string> = { ok: 'text-emerald-400', warn: 'text-amber-400', crit: 'text-red-400' };

export const LEVEL_RANG: Record<Level, number> = { ok: 0, warn: 1, crit: 2 };

/** Standard-Schwellen, bis das Backend geantwortet hat. */
export const DEFAULT_LIMITS = { cpu: 90, ram: 90, disk: 90, temp: 75 } as const;
