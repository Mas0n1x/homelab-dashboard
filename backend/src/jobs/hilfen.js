/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Helfer für Hintergrundjobs
import serverManager from '../services/serverManager.js';

// ─── Hintergrundjob-Helfer ───

// Overlap-Guard: verhindert, dass ein neuer Lauf startet, während der vorige
// noch läuft (langsame SSH-/Docker-Aufrufe würden sich sonst aufstauen).
export function makeJob(name, fn) {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    try {
      await fn();
    } catch (error) {
      console.error(`[job:${name}]`, error?.message || error);
    } finally {
      running = false;
    }
  };
}

// Hartes Timeout um einen einzelnen Aufruf — ein toter Server hängt dann nicht
// den ganzen Job-Lauf auf.
export function withTimeout(promise, ms, label = 'op') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout (${label}, ${ms}ms)`)), ms);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timer));
}

// Alle Server PARALLEL abarbeiten; ein Fehler/Timeout bei einem Server lässt
// die anderen unberührt (kein sequentielles await, das die Flotte blockiert).
export function forEachServer(fn) {
  return Promise.allSettled(serverManager.getAllServers().map(s => fn(s)));
}
