/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { Router } from 'express';
import * as dockerService from '../services/docker.js';
import serverManager from '../services/serverManager.js';
import { logAudit } from '../services/audit.js';
import { checkFleetImageUpdates, getLastImageUpdateRun } from '../services/imageUpdates.js';

const router = Router();

// Hartes Zeitlimit für einen einzelnen Docker-Aufruf gegen einen Remote-Server.
// Ohne das hängt ein Request bei toter SSH-Verbindung endlos — und da der
// Browser pro Domain nur ~6 Verbindungen offen hält, legt ein einziger
// klemmender Server nach wenigen Polls das GESAMTE Dashboard lahm (keine
// andere Ansicht lädt mehr). Der SSH-Agent heilt sich inzwischen selbst,
// aber bis dahin muss der Request sauber mit 504 zurückkommen.
const DOCKER_ZEITLIMIT_MS = 15000;

function mitZeitlimit(ziel, ms = DOCKER_ZEITLIMIT_MS) {
  if (ziel == null || (typeof ziel !== 'object' && typeof ziel !== 'function')) return ziel;
  return new Proxy(ziel, {
    get(obj, prop, empfaenger) {
      const wert = Reflect.get(obj, prop, empfaenger);
      if (typeof wert !== 'function') return wert;
      return function (...args) {
        const ergebnis = wert.apply(obj, args);
        if (ergebnis && typeof ergebnis.then === 'function') {
          let timer;
          const limit = new Promise((_, ablehnen) => {
            timer = setTimeout(() => {
              const e = new Error(`Docker-Aufruf "${String(prop)}" nach ${ms} ms ohne Antwort — Server nicht erreichbar?`);
              e.statusCode = 504;
              ablehnen(e);
            }, ms);
            timer.unref?.();
          });
          return Promise.race([ergebnis, limit]).finally(() => clearTimeout(timer));
        }
        // Kein Promise (z. B. getContainer(id)) — erneut einhüllen, damit
        // auch .inspect()/.stats() darauf unter dem Zeitlimit stehen.
        return mitZeitlimit(ergebnis, ms);
      };
    },
  });
}

// Wählt die Docker-Instanz anhand ?serverId= (Default: lokaler Server).
// Wirft, wenn der Server existiert, aber keinen Docker-Zugriff hat (nur Monitoring).
function dockerFor(req) {
  const serverId = req.query.serverId || 'local';
  if (serverId === 'local') return undefined; // Service nutzt dann den lokalen Default
  const docker = serverManager.getDocker(serverId);
  if (!docker) {
    const err = new Error(`Server "${serverId}" hat keinen Docker-Zugriff (nur Monitoring)`);
    err.statusCode = 409;
    throw err;
  }
  // Nur Remote-Server über SSH können hängen — der lokale Socket nicht.
  return mitZeitlimit(docker);
}

// Einheitliches Fehler-Mapping: nutzt error.statusCode (z. B. 409) sonst 500.
function fail(res, error, fallbackMessage) {
  res.status(error.statusCode || 500).json({ error: fallbackMessage, message: error.message });
}

// Get Docker info
router.get('/info', async (req, res) => {
  try {
    const info = await dockerService.getDockerInfo(dockerFor(req));
    res.json(info);
  } catch (error) {
    fail(res, error, 'Failed to fetch Docker info');
  }
});

// Get all containers
router.get('/containers', async (req, res) => {
  try {
    const containers = await dockerService.getContainers(dockerFor(req));
    res.json(containers);
  } catch (error) {
    fail(res, error, 'Failed to fetch containers');
  }
});

// Get container stats
router.get('/containers/:id/stats', async (req, res) => {
  try {
    const stats = await dockerService.getContainerStats(req.params.id, dockerFor(req));
    res.json(stats);
  } catch (error) {
    fail(res, error, 'Failed to fetch container stats');
  }
});

// Get container details (inspect)
router.get('/containers/:id/details', async (req, res) => {
  try {
    const details = await dockerService.getContainerDetails(req.params.id, dockerFor(req));
    res.json(details);
  } catch (error) {
    fail(res, error, 'Failed to fetch container details');
  }
});

// Get container logs
router.get('/containers/:id/logs', async (req, res) => {
  try {
    const tail = parseInt(req.query.tail) || 100;
    const logs = await dockerService.getContainerLogs(req.params.id, tail, dockerFor(req));
    res.json({ logs });
  } catch (error) {
    fail(res, error, 'Failed to fetch container logs');
  }
});

// Start container
router.post('/containers/:id/start', async (req, res) => {
  try {
    const result = await dockerService.startContainer(req.params.id, dockerFor(req));
    logAudit('container.start', req.params.id, null, req.user?.id);
    res.json(result);
  } catch (error) {
    fail(res, error, 'Failed to start container');
  }
});

// Stop container
router.post('/containers/:id/stop', async (req, res) => {
  try {
    const result = await dockerService.stopContainer(req.params.id, dockerFor(req));
    logAudit('container.stop', req.params.id, null, req.user?.id);
    res.json(result);
  } catch (error) {
    fail(res, error, 'Failed to stop container');
  }
});

// Restart container
router.post('/containers/:id/restart', async (req, res) => {
  try {
    const result = await dockerService.restartContainer(req.params.id, dockerFor(req));
    logAudit('container.restart', req.params.id, null, req.user?.id);
    res.json(result);
  } catch (error) {
    fail(res, error, 'Failed to restart container');
  }
});

// Update container restart policy
router.put('/containers/:id/restart-policy', async (req, res) => {
  try {
    const { policy } = req.body; // 'no', 'always', 'unless-stopped', 'on-failure'
    if (!['no', 'always', 'unless-stopped', 'on-failure'].includes(policy)) {
      return res.status(400).json({ error: 'Invalid restart policy' });
    }
    const result = await dockerService.updateRestartPolicy(req.params.id, policy, dockerFor(req));
    res.json(result);
  } catch (error) {
    fail(res, error, 'Failed to update restart policy');
  }
});

// ==================== IMAGES ====================

// Get all images
router.get('/images', async (req, res) => {
  try {
    const images = await dockerService.getImages(dockerFor(req));
    res.json(images);
  } catch (error) {
    fail(res, error, 'Failed to fetch images');
  }
});

// Delete image
router.delete('/images/:id', async (req, res) => {
  try {
    const force = req.query.force === 'true';
    const result = await dockerService.deleteImage(req.params.id, force, dockerFor(req));
    res.json(result);
  } catch (error) {
    fail(res, error, 'Failed to delete image');
  }
});

// Prune unused images
router.post('/images/prune', async (req, res) => {
  try {
    const result = await dockerService.pruneImages(dockerFor(req));
    res.json(result);
  } catch (error) {
    fail(res, error, 'Failed to prune images');
  }
});

// ==================== VOLUMES ====================

// Get all volumes
router.get('/volumes', async (req, res) => {
  try {
    const volumes = await dockerService.getVolumes(dockerFor(req));
    res.json(volumes);
  } catch (error) {
    fail(res, error, 'Failed to fetch volumes');
  }
});

// Delete volume
router.delete('/volumes/:name', async (req, res) => {
  try {
    const force = req.query.force === 'true';
    const result = await dockerService.deleteVolume(req.params.name, force, dockerFor(req));
    res.json(result);
  } catch (error) {
    fail(res, error, 'Failed to delete volume');
  }
});

// Prune unused volumes
router.post('/volumes/prune', async (req, res) => {
  try {
    const result = await dockerService.pruneVolumes(dockerFor(req));
    res.json(result);
  } catch (error) {
    fail(res, error, 'Failed to prune volumes');
  }
});

// ==================== NETWORKS ====================

// Get all networks
router.get('/networks', async (req, res) => {
  try {
    const networks = await dockerService.getNetworks(dockerFor(req));
    res.json(networks);
  } catch (error) {
    fail(res, error, 'Failed to fetch networks');
  }
});

// ==================== PORTS ====================

// Get ports overview
router.get('/ports', async (req, res) => {
  try {
    const ports = await dockerService.getPortsOverview(dockerFor(req));
    res.json(ports);
  } catch (error) {
    fail(res, error, 'Failed to fetch ports overview');
  }
});

// ==================== SYSTEM ====================

// System prune
router.post('/system/prune', async (req, res) => {
  try {
    const options = req.body || {};
    const result = await dockerService.systemPrune(options, dockerFor(req));
    res.json(result);
  } catch (error) {
    fail(res, error, 'Failed to prune system');
  }
});

// ==================== COMPOSE PROJECTS ====================

router.get('/compose/projects', async (req, res) => {
  try {
    const projects = await dockerService.getComposeProjects(dockerFor(req));
    res.json(projects);
  } catch (error) {
    fail(res, error, error.message);
  }
});

router.post('/compose/:project/:action', async (req, res) => {
  try {
    const { project, action } = req.params;
    if (!['start', 'stop', 'restart'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    const result = await dockerService.composeAction(project, action, dockerFor(req));
    res.json(result);
  } catch (error) {
    fail(res, error, error.message);
  }
});

// ==================== COMPOSE FILE EDITOR ====================

router.get('/compose/:project/file', async (req, res) => {
  try {
    const serverId = req.query.serverId || 'local';
    const result = await dockerService.getComposeFile(req.params.project, serverId);
    res.json(result);
  } catch (error) {
    fail(res, error, error.message);
  }
});

router.put('/compose/:project/file', async (req, res) => {
  try {
    const serverId = req.query.serverId || 'local';
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required' });
    const result = await dockerService.saveComposeFile(req.params.project, content, serverId);
    logAudit('compose.save', req.params.project, null, req.user?.id);
    res.json(result);
  } catch (error) {
    fail(res, error, error.message);
  }
});

// ==================== IMAGE UPDATES ====================

// Flotten-Übersicht: welche Container laufen auf einem veralteten Image?
// Liest NUR das Ergebnis des Hintergrundlaufs — die Prüfung selbst gehört nicht
// in den Anfrageweg, sie spricht mit fremden Registries.
router.get('/updates/summary', (req, res) => {
  const letzter = getLastImageUpdateRun();
  if (!letzter) {
    return res.json({
      servers: [], outdated: [],
      counts: { outdated: 0, checked: 0, failed: 0 },
      rateLimited: false, checkedAt: null,
      pending: true,
    });
  }
  res.json({ ...letzter, pending: false });
});

// Prüfung von Hand anstoßen (der Hintergrundjob läuft alle 6 Stunden).
router.post('/updates/refresh', async (req, res) => {
  try {
    res.json(await checkFleetImageUpdates());
  } catch (error) {
    fail(res, error, 'Update-Prüfung fehlgeschlagen');
  }
});

router.get('/updates/check', async (req, res) => {
  try {
    const updates = await dockerService.checkImageUpdates(dockerFor(req));
    res.json(updates);
  } catch (error) {
    fail(res, error, error.message);
  }
});

router.post('/updates/pull/:id', async (req, res) => {
  try {
    const result = await dockerService.pullAndRecreate(req.params.id, dockerFor(req));
    res.json(result);
  } catch (error) {
    fail(res, error, error.message);
  }
});

// ==================== DISK USAGE ====================

router.get('/disk-usage', async (req, res) => {
  try {
    const usage = await dockerService.getDiskUsage(dockerFor(req));
    res.json(usage);
  } catch (error) {
    fail(res, error, error.message);
  }
});

// ==================== CONTAINER STATS BATCH ====================

router.get('/stats/all', async (req, res) => {
  try {
    const stats = await dockerService.getAllContainerStats(dockerFor(req));
    res.json(stats);
  } catch (error) {
    fail(res, error, error.message);
  }
});

export default router;
