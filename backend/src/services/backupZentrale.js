/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Ein Blick auf alle Sicherungen: Dashboard samt Bot-Datenbanken, Off-Site-Kopie
// und die Proxmox-Sicherungen der VMs und Container.
import { getDb } from './database.js';
import { getBackupSchedule, getOffsiteConfig, getOffsiteStatus } from './backup.js';
import { begleiter } from './backupDateien.js';
import { pve, istKonfiguriert } from './proxmox.js';

// Proxmox sichert täglich; ab anderthalb Tagen ist ein Lauf ausgefallen.
const GAST_UEBERFAELLIG_STUNDEN = 36;
const stundenSeit = (ms) => (Date.now() - ms) / 3600000;
const sqlZeit = (t) => Date.parse(String(t).replace(' ', 'T') + 'Z');

function dashboardStand() {
  const db = getDb();
  const zeitplan = getBackupSchedule();
  const letztes = db.prepare("SELECT * FROM backups WHERE status = 'completed' ORDER BY completed_at DESC, id DESC LIMIT 1").get();
  const letzterLauf = db.prepare("SELECT status, error FROM backups WHERE status != 'running' ORDER BY id DESC LIMIT 1").get();
  const getestet = db.prepare('SELECT tested_at, test_ok, test_detail, completed_at FROM backups WHERE tested_at IS NOT NULL ORDER BY completed_at DESC, id DESC LIMIT 1').get();

  let status = 'ok';
  if (!letztes) status = 'fehlt';
  else if (letzterLauf?.status === 'failed' || (getestet && !getestet.test_ok)) status = 'fehler';
  else if (!zeitplan.enabled) status = 'ohne-zeitplan';
  else if (stundenSeit(sqlZeit(letztes.completed_at)) > zeitplan.intervalHours * 1.5) status = 'ueberfaellig';

  return {
    status,
    letzte: letztes ? new Date(sqlZeit(letztes.completed_at)).toISOString() : null,
    letzteId: letztes?.id ?? null,
    groesse: letztes?.size ?? null,
    hinweis: letzterLauf?.status === 'failed' ? letzterLauf.error : letztes?.note ?? null,
    botDatenbanken: letztes?.path ? begleiter(letztes.path).length : 0,
    test: getestet ? {
      am: new Date(sqlZeit(getestet.tested_at)).toISOString(),
      ok: !!getestet.test_ok,
      detail: getestet.test_detail,
      stand: new Date(sqlZeit(getestet.completed_at)).toISOString(),
    } : null,
    offsite: { aktiv: getOffsiteConfig().enabled, letzte: getOffsiteStatus() },
  };
}

async function proxmoxStand() {
  if (!istKonfiguriert()) return { konfiguriert: false, gaeste: [] };
  const ressourcen = await pve('GET', '/cluster/resources');
  const gaeste = ressourcen.filter((r) => (r.type === 'qemu' || r.type === 'lxc') && r.template !== 1);
  const knoten = [...new Set(gaeste.map((g) => g.node))];
  const jobs = await pve('GET', '/cluster/backup').catch(() => []);

  const dateien = [];
  for (const node of knoten) {
    const speicher = await pve('GET', `/nodes/${node}/storage?content=backup`);
    for (const s of speicher.filter((x) => x.active)) {
      const inhalt = await pve('GET', `/nodes/${node}/storage/${s.storage}/content?content=backup`).catch(() => []);
      dateien.push(...inhalt.map((d) => ({ ...d, storage: s.storage })));
    }
  }

  const aktiveJobs = jobs.filter((j) => j.enabled !== 0);
  const jobFuer = (vmid) => aktiveJobs.find((j) => (j.all
    ? !String(j.exclude || '').split(',').includes(String(vmid))
    : String(j.vmid || '').split(',').includes(String(vmid))));

  return {
    konfiguriert: true,
    gaeste: gaeste.sort((a, b) => a.vmid - b.vmid).map((g) => {
      const eigene = dateien.filter((d) => Number(d.vmid) === Number(g.vmid)).sort((a, b) => b.ctime - a.ctime);
      const job = jobFuer(g.vmid);
      const letzte = eigene[0];
      let status = 'ok';
      if (!letzte) status = job ? 'fehlt' : 'ungesichert';
      else if (!job) status = 'ohne-zeitplan';
      else if (stundenSeit(letzte.ctime * 1000) > GAST_UEBERFAELLIG_STUNDEN) status = 'ueberfaellig';
      return {
        vmid: g.vmid, name: g.name || `${g.type}-${g.vmid}`, typ: g.type, status,
        letzte: letzte ? new Date(letzte.ctime * 1000).toISOString() : null,
        groesse: letzte?.size ?? null, anzahl: eigene.length,
        ziel: letzte?.storage ?? job?.storage ?? null, zeitplan: job?.schedule ?? null,
      };
    }),
  };
}

export async function backupZentrale() {
  const proxmox = await proxmoxStand().catch((e) => ({ konfiguriert: true, gaeste: [], fehler: e.message }));
  return { dashboard: dashboardStand(), proxmox };
}
