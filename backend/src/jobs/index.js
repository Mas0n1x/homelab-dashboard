/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Alle Hintergrundjobs
import { cleanupOldUptimeData, cleanupVerlaeufe, getDb } from '../services/database.js';
import serverManager from '../services/serverManager.js';
import { discoverServices, hasDiscoveryChanged, getDiscoverySnapshot } from '../services/discovery.js';
import { recordSeenServices, purgeVanishedServices } from '../services/serviceRegistry.js';
import { checkAllServices } from '../services/uptime.js';
import * as portfolio from '../services/portfolio.js';
import { cleanupExpiredTokens } from '../services/auth.js';
import { checkAlerts, checkServiceAlerts, sendStatusReport, checkForecastAlerts, notifyImageUpdates, checkMemoryTrendAlerts, liefereSammelmeldungen } from '../services/alerting.js';
import { laufeWennFaellig } from '../services/autoCleanup.js';
import { runDueBackups, enforceBackupRetention, markiereAbgebrocheneBackups } from '../services/backup.js';
import { recordMetric, pruneMetrics, rollupHourly } from '../services/metrics.js';
import { recordDiskDaily, recordDiskMounts, pruneDiskDaily, getDiskForecast } from '../services/diskForecast.js';
import { checkFleetImageUpdates } from '../services/imageUpdates.js';
import { wss, broadcast } from '../ws/dashboard.js';
import { makeJob, withTimeout, forEachServer } from './hilfen.js';

export function starteJobs() {
  // Previous container states for crash detection — pro Server getrennt
  // (Map<serverId, Map<containerId, state>>), sonst überschreibt jeder
  // Server-Durchlauf den Zustand des vorigen und die Crash-Erkennung
  // vergleicht Container gegen den falschen Server.
  let previousContainerStatesByServer = new Map();
  // Previous uptime per server (seconds) for reboot detection
  let previousUptimeSeconds = new Map();

  // Glances-Uptime ("3 days, 4:05:06" o. "1:02:03") in Sekunden umrechnen.
  function parseUptimeSeconds(uptime) {
    if (typeof uptime === 'number') return uptime;
    if (!uptime || typeof uptime !== 'string') return null;
    let days = 0;
    let rest = uptime;
    const dayMatch = rest.match(/(\d+)\s*day/i);
    if (dayMatch) { days = parseInt(dayMatch[1], 10); rest = rest.split(',').pop(); }
    const parts = rest.trim().split(':').map(n => parseInt(n, 10)).filter(n => !isNaN(n));
    if (parts.length === 0) return days * 86400;
    const [h = 0, m = 0, s = 0] = parts.length === 3 ? parts : [0, ...parts];
    return days * 86400 + h * 3600 + m * 60 + s;
  }

  // Background: Service discovery (every 30 seconds)
  setInterval(makeJob('discovery', () => forEachServer(async (server) => {
    const discovered = await withTimeout(discoverServices(server.id), 20000, 'discovery');
    // Kein Ergebnis (SSH-Aussetzer) darf das Register nicht anfassen — sonst
    // gälten alle Dienste des Servers als verschwunden.
    if (discovered.length > 0) {
      recordSeenServices(server.id, discovered);
    }
    if (hasDiscoveryChanged(server.id, discovered)) {
      broadcast({ type: 'discovery-update', serverId: server.id, data: discovered });
    }
  })), 30000);

  // Background: Uptime checks (every 60 seconds)
  setInterval(makeJob('uptime', () => forEachServer(async (server) => {
    // Snapshot des Discovery-Jobs (läuft alle 30 s) statt eines zweiten
    // Docker-über-SSH-Aufrufs — halbiert die SSH-Last auf der Flotte.
    const snapshot = getDiscoverySnapshot(server.id);
    const discovered = snapshot?.services
      ?? await withTimeout(discoverServices(server.id), 20000, 'discovery');
    const manual = getDb().prepare('SELECT id, name, url, server_id as serverId FROM manual_services WHERE server_id = ?').all(server.id);
    const allServices = [
      ...discovered.map(s => ({ id: s.id, name: s.name, url: s.url, serverId: s.serverId, container: { state: s.state, status: s.status, bind: s.bind } })),
      ...manual
    ];
    const results = await checkAllServices(allServices);
    broadcast({ type: 'service-status', serverId: server.id, data: results });

    // Ist der ganze Server weg, meldet das „Server nicht erreichbar" — nicht jeder Dienst einzeln.
    if (serverManager.getConnection(server.id)?.reachable === false) return;
    const namen = new Map(allServices.map(s => [s.id, s.name || s.id]));
    const anzahl = new Map();
    for (const n of namen.values()) anzahl.set(n, (anzahl.get(n) || 0) + 1);
    await checkServiceAlerts({
      serverId: server.id,
      serverName: server.name || server.id,
      services: results.filter(r => r.online !== null).map(r => {
        const name = namen.get(r.serviceId) || r.serviceId;
        return { key: r.serviceId, name: anzahl.get(name) > 1 ? `${name} (${r.serviceId})` : name, online: r.online };
      }),
    });
  })), 60000);

  // Background: Portfolio notifications (every 30 seconds)
  setInterval(makeJob('portfolio', async () => {
    try {
      const newNotifications = await portfolio.checkForNotifications();
      if (newNotifications.length > 0) {
        broadcast({
          type: 'notifications',
          data: newNotifications
        });

        // Send new portfolio requests + customers to alerting (Discord/Telegram webhooks)
        const requestNotifs = newNotifications.filter(n => n.type === 'new-request');
        const customerNotifs = newNotifications.filter(n => n.type === 'new-customer');
        const allRequests = requestNotifs.flatMap(n => n.requests || []);
        const allCustomers = customerNotifs.flatMap(n => n.customers || []);
        if (allRequests.length > 0 || allCustomers.length > 0) {
          await checkAlerts({
            cpuPercent: 0,
            memPercent: 0,
            crashedContainers: [],
            portfolioRequests: allRequests,
            portfolioCustomers: allCustomers,
          });
        }
      }

      const dashboardData = await portfolio.getDashboardData();
      if (dashboardData) {
        broadcast({
          type: 'portfolio',
          data: dashboardData
        });
      }
    } catch {
      // Portfolio may be offline, that's ok
    }
  }), 30000);

  // Background: Container stats (every 5 seconds) — nur wenn jemand zuschaut (spart SSH-Last).
  // Overlap-Guard + parallele Server + Timeout: ein langsamer SSH-Server darf den
  // 5-s-Takt nicht aufstauen.
  // Fernserver höchstens alle 10 s: pro Messung läuft je Container ein stats-Aufruf über SSH.
  const letzteStats = new Map();
  setInterval(makeJob('container-stats', async () => {
    if (wss.clients.size === 0) return;
    const dockerMod = await import('../services/docker.js');
    await forEachServer(async (server) => {
      const dockerInst = serverManager.getDocker(server.id);
      if (!dockerInst) return;
      if (server.id !== 'local') {
        if (Date.now() - (letzteStats.get(server.id) || 0) < 9500) return;
        letzteStats.set(server.id, Date.now());
      }
      const stats = await withTimeout(dockerMod.getAllContainerStats(dockerInst), 8000, 'stats');
      broadcast({ type: 'container-stats', serverId: server.id, data: stats });
    });
  }), 5000);

  // Background: Alerting check (every 30 seconds)
  setInterval(makeJob('alerting', () => forEachServer(async (server) => {
    {
        const connection = serverManager.getConnection(server.id);
        if (!connection) return;

        const glances = connection.glances;
        const dockerInst = connection.docker;
        const systemStats = glances ? await withTimeout(glances.getSystemStats(), 8000, 'glances').catch(() => null) : null;
        if (glances) serverManager.markSeen(server.id, !!systemStats);

        // Metrik-Sample für Sparklines/Verlauf persistieren (Fleet-Historie)
        if (systemStats) {
          const net = systemStats.network || [];
          const disks = systemStats.disk || [];
          const dcap = disks.reduce((s, d) => s + (d.total || 0), 0);
          const dused = disks.reduce((s, d) => s + (d.used || 0), 0);
          try {
            recordMetric(server.id, {
              cpu: systemStats.cpu?.total || 0,
              mem: systemStats.fehlend?.includes('mem') ? null : (systemStats.memory?.percent || 0),
              // null statt 0, wenn die Platten-Abfrage ausfiel: eine Lücke im
              // Verlauf ist ehrlich, ein Ausschlag auf 0 % wäre erfunden.
              disk: dcap ? (dused / dcap) * 100 : null,
              rx: net.reduce((s, n) => s + (n.rxRate || 0), 0),
              tx: net.reduce((s, n) => s + (n.txRate || 0), 0),
              temp: (systemStats.temperature || []).length
                ? Math.max(...systemStats.temperature.map(t => Number(t.value) || 0))
                : null,
            });
            // Zusätzlich ein Tageswert in absoluten Bytes — Grundlage der
            // Füllstand-Prognose. metrics_history wird nach 48 Stunden geleert
            // und taugt dafür nicht.
            recordDiskDaily(server.id, dused, dcap);
            recordDiskMounts(server.id, disks);
          } catch { /* Sampling darf das Alerting nie stoppen */ }
        }

        const dockerMod = await import('../services/docker.js');
        // Hartes Zeitlimit: haengt die SSH-Verbindung zu einem toten Flotten-Server,
        // duerfte dieser Aufruf sonst ewig warten — der makeJob-Guard bliebe auf
        // `running` stehen und Alerting samt Metrik-Aufzeichnung stuenden still.
        // null = Abfrage fehlgeschlagen. Dann bleibt der gemerkte Zustand stehen,
        // sonst ginge der nächste Absturz unbemerkt durch.
        const containers = dockerInst
          ? await withTimeout(dockerMod.getContainers(dockerInst), 12000, 'docker').catch(() => null)
          : null;

        // Detect crashed + restarted containers
        const crashedContainers = [];
        const restartedContainers = [];
        const currentStates = new Map();
        containers?.forEach(c => currentStates.set(c.id, c.state));

        const prevStates = (containers && previousContainerStatesByServer.get(server.id)) || new Map();
        for (const [id, prevState] of prevStates) {
          const currentState = currentStates.get(id);
          if (prevState === 'running' && currentState && currentState !== 'running') {
            const c = containers.find(x => x.id === id);
            if (c) crashedContainers.push(c);
          } else if (prevState && prevState !== 'running' && currentState === 'running') {
            const c = containers.find(x => x.id === id);
            if (c) restartedContainers.push(c);
          }
        }
        if (containers) previousContainerStatesByServer.set(server.id, currentStates);

        // Reboot-Erkennung über Uptime-Rückgang
        let rebooted = false;
        const upSec = parseUptimeSeconds(systemStats?.uptime);
        if (upSec != null) {
          const prevUp = previousUptimeSeconds.get(server.id);
          if (prevUp != null && upSec + 60 < prevUp) rebooted = true; // Uptime gesunken
          previousUptimeSeconds.set(server.id, upSec);
        }

        await checkAlerts({
          serverId: server.id,
          serverName: server.name || server.id,
          systemStats,
          online: glances ? !!systemStats : undefined,
          cpuPercent: systemStats?.cpu?.total || 0,
          memPercent: systemStats?.memory?.percent || 0,
          crashedContainers,
          restartedContainers,
          rebooted,
        });
      }
    })), 30000);

  // Background: Periodischer Statusbericht (Intervall via STATUS_REPORT_HOURS, Standard 6h)
  const STATUS_REPORT_MS = (parseFloat(process.env.STATUS_REPORT_HOURS) || 6) * 60 * 60 * 1000;
  setInterval(makeJob('status-report', async () => {
    const servers = serverManager.getAllServers();
    const dockerMod = await import('../services/docker.js');
    const settled = await Promise.allSettled(servers.map(async (server) => {
      const connection = serverManager.getConnection(server.id);
      if (!connection) return { name: server.name || server.id, online: false };
      const systemStats = connection.glances ? await withTimeout(connection.glances.getSystemStats(), 8000, 'glances').catch(() => null) : null;
      const containers = connection.docker ? await withTimeout(dockerMod.getContainers(connection.docker), 12000, 'docker').catch(() => []) : [];
      const temps = systemStats?.temperature || [];
      return {
        name: server.name || server.id,
        online: !!systemStats,
        cpuPercent: systemStats?.cpu?.total || 0,
        memPercent: systemStats?.memory?.percent || 0,
        disks: systemStats?.disk || [],
        maxTemp: temps.length ? Math.max(...temps.map(t => Number(t.value) || 0)) : null,
        uptime: systemStats?.uptime,
        containers: { running: containers.filter(c => c.state === 'running').length, total: containers.length },
      };
    }));
    const summaries = settled.map((r, i) => r.status === 'fulfilled' ? r.value : { name: servers[i]?.name || servers[i]?.id, online: false });
    await sendStatusReport({ servers: summaries });
  }), STATUS_REPORT_MS);

  // Background: Image-Updates (alle 6 Stunden).
  // Bewusst selten: jede Manifest-Abfrage zählt gegen das Abruf-Limit von Docker
  // Hub, und ein Image-Tag bewegt sich ohnehin selten öfter als einmal am Tag.
  // Der erste Lauf startet 2 Minuten nach dem Start, damit die SSH-Verbindungen
  // zur Flotte vorher stehen.
  const IMAGE_UPDATE_MS = 6 * 60 * 60 * 1000;
  const pruefeImageUpdates = makeJob('image-updates', async () => {
    const ergebnis = await checkFleetImageUpdates();
    if (ergebnis.counts.outdated > 0) {
      console.log(`Image-Updates: ${ergebnis.counts.outdated} von ${ergebnis.counts.checked} Containern veraltet`);
    }
    if (ergebnis.rateLimited) {
      console.warn('Image-Updates: Abruf-Limit der Registry erreicht — Ergebnis unvollständig.');
    }
    await notifyImageUpdates(ergebnis);
  });
  setTimeout(pruefeImageUpdates, 2 * 60 * 1000);
  setInterval(pruefeImageUpdates, IMAGE_UPDATE_MS);

  // Background: Speicher-Prognose beobachten (alle 15 Minuten) und bei „voll in ≤ 30 Tagen" in Discord warnen.
  const pruefePrognose = makeJob('disk-forecast-alerts', async () => {
    await checkForecastAlerts(getDiskForecast(30));
  });
  setTimeout(pruefePrognose, 3 * 60 * 1000);
  setInterval(pruefePrognose, 15 * 60 * 1000);

  // Background: Stundenwerte fortschreiben + RAM-Trend beobachten (alle 15 Minuten)
  const pflegeLangzeit = makeJob('metrics-rollup', async () => {
    rollupHourly(3);
    await checkMemoryTrendAlerts();
  });
  setTimeout(pflegeLangzeit, 4 * 60 * 1000);
  setInterval(pflegeLangzeit, 15 * 60 * 1000);

  // Zurückgehaltene Meldungen (Ruhezeit, Tagesübersicht) ausliefern
  setInterval(makeJob('alert-digest', async () => { await liefereSammelmeldungen(); }), 5 * 60 * 1000);

  // Wöchentliches Docker-Aufräumen (prüft alle 10 Minuten, ob es dran ist)
  setInterval(makeJob('auto-cleanup', async () => { await laufeWennFaellig(); }), 10 * 60 * 1000);

  // Background: Geplante Backups prüfen (alle 5 Minuten; Fälligkeit anhand Intervall)
  setInterval(() => {
    runDueBackups().catch(error => console.error('Scheduled backup error:', error.message));
  }, 5 * 60 * 1000);

  // Cleanup alter Uptime-/Metrik-Daten: täglich UND einmal beim Start. Bei häufigen
  // Deploys/Restarts käme der reine 24h-Intervall-Tick sonst nie zum Zug und die
  // Tabellen (uptime_checks ~33k Zeilen/Tag) würden ungebremst wachsen.
  function runDataCleanup() {
    try {
      cleanupOldUptimeData();
    cleanupVerlaeufe(); // Alarm- und Audit-Verlauf begrenzen
      rollupHourly(47); // vor dem Aufräumen (47: das erste Fenster liegt so sicher noch voll in den Rohdaten): Rohdaten zu Stundenwerten verdichten
      pruneMetrics(48); // Rohdaten 48 h, Stundenwerte 90 Tage
      pruneDiskDaily(); // Tageswerte der Platte: gut ein Jahr behalten (Summe und je Mount)
      const removedBackups = enforceBackupRetention();
      if (removedBackups > 0) {
        console.log(`Abgelaufene Backups gelöscht: ${removedBackups}`);
      }
    } catch (error) {
      console.error('Cleanup error:', error.message);
    }
  }
  // Vor dem ersten Aufräumen: Läufe, die ein Neustart abgebrochen hat, schließen.
  markiereAbgebrocheneBackups();
  runDataCleanup();
  setInterval(runDataCleanup, 24 * 60 * 60 * 1000);

  // Dienste, die nicht mehr auf ihrem Server auftauchen, samt Historie entfernen —
  // die Statusseite bildet damit stündlich den Ist-Zustand ab.
  function runServicePurge() {
    try {
      const { purged, names } = purgeVanishedServices();
      if (purged > 0) {
        console.log(`Entfernte Dienste aufgeräumt (${purged}): ${names.join(', ')}`);
      }
    } catch (error) {
      console.error('Service purge error:', error.message);
    }
  }
  runServicePurge();
  setInterval(runServicePurge, 60 * 60 * 1000);

  // Background: Cleanup expired refresh tokens (every hour)
  setInterval(() => {
    try {
      cleanupExpiredTokens();
    } catch (error) {
      console.error('Token cleanup error:', error.message);
    }
  }, 60 * 60 * 1000);
}
