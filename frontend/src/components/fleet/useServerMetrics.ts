/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useAlertOverview } from '@/hooks/useAttention';
import { istErreichbar } from '@/lib/formatters';
import { DEFAULT_LIMITS, LEVEL_RANG, level, type Level } from '@/lib/health';
import type { ServerData } from '@/stores/fleetStore';
import type { Server as ServerType, ServerAlertState } from '@/lib/types';

/**
 * Abgeleitete Kennzahlen einer Server-Karte — gemeinsam für Kompakt-, Detail-
 * und Listenansicht, damit alle drei dasselbe zeigen und dieselben Farben nutzen.
 */
export function useServerMetrics(server: ServerType, data: ServerData) {
  const { data: overview } = useAlertOverview();
  return berechneMetriken(server, data, overview?.servers?.[server.id]);
}

/** Reine Rechnung (ohne Hook) — wird auch für die Sortierung der Flotte gebraucht. */
export function berechneMetriken(server: ServerType, data: ServerData, state: ServerAlertState | undefined) {
  const limits = state?.limits ?? DEFAULT_LIMITS;

  const { system, containers } = data;
  const isOnline = istErreichbar(server.status);
  const hasData = system !== null;

  const cpu = system?.cpu.total ?? 0;
  const mem = system?.memory.percent ?? 0;
  const memFehlt = !!system?.fehlend?.includes('mem');
  const diskFehlt = !!system?.fehlend?.includes('fs');
  const disks = system?.disk ?? [];
  const diskTotal = disks.reduce((s, d) => s + (d.total || 0), 0);
  const diskUsed = disks.reduce((s, d) => s + (d.used || 0), 0);
  const disk = diskTotal ? (diskUsed / diskTotal) * 100 : null;
  const temp = system?.temperature?.[0]?.value ?? null;

  const hasDocker = !!(server.is_local || server.docker_socket || server.docker_host || server.ssh_host);
  const running = containers?.filter(c => c.state === 'running').length ?? 0;
  const totalCt = containers?.length ?? 0;

  const net = system?.network ?? [];
  const rx = net.reduce((s, n) => s + (n.rxRate || 0), 0);
  const tx = net.reduce((s, n) => s + (n.txRate || 0), 0);

  const levels: Record<'cpu' | 'ram' | 'disk' | 'temp', Level> = {
    cpu: hasData ? level(cpu, limits.cpu) : 'ok',
    ram: hasData && !memFehlt ? level(mem, limits.ram) : 'ok',
    disk: disk != null && !diskFehlt ? level(disk, limits.disk) : 'ok',
    temp: temp != null ? level(temp, limits.temp) : 'ok',
  };

  // Alarm = vom Backend bestätigt (anhaltend, Hysterese, Overrides, Wartung).
  const alerts = state?.alerts ?? [];
  const maintenance = state?.maintenance ?? null;
  const worst: Level = !isOnline ? 'crit' : alerts.length ? 'crit' : (Object.values(levels).sort((a, b) => LEVEL_RANG[b] - LEVEL_RANG[a])[0] ?? 'ok');

  return {
    isOnline, hasData, cpu, mem, memFehlt, disk, diskFehlt, diskUsed, diskTotal, disks, temp,
    hasDocker, running, totalCt, rx, tx, limits, levels, alerts, maintenance, worst,
    /** Sortierrang: größer = dringender. */
    urgency: (!isOnline ? 100 : 0) + alerts.length * 10 + LEVEL_RANG[worst],
  };
}
