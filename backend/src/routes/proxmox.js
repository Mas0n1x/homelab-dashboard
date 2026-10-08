/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { Router } from 'express';
import { pve, istKonfiguriert, ProxmoxFehler } from '../services/proxmox.js';
import { logAudit } from '../services/audit.js';

const router = Router();

const TYPEN = new Set(['qemu', 'lxc']);
// Erlaubte Gast-Aktionen je Typ. reset/suspend/resume gibt es nur bei VMs.
const AKTIONEN = {
  qemu: new Set(['start', 'shutdown', 'stop', 'reboot', 'reset', 'suspend', 'resume']),
  lxc: new Set(['start', 'shutdown', 'stop', 'reboot']),
};
const SNAPNAME = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/;

function fehler(res, err) {
  const status = err instanceof ProxmoxFehler ? err.status : 502;
  res.status(status).json({ error: err.message });
}

// Gast (VMID) im Cluster suchen: liefert Node und Typ, damit das Frontend
// weder Node-Namen noch Typen frei vorgeben kann.
async function gastFinden(typ, vmid) {
  if (!TYPEN.has(typ) || !/^\d{1,9}$/.test(String(vmid))) {
    throw new ProxmoxFehler('Ungültiger Gast', 400);
  }
  const ressourcen = await pve('GET', '/cluster/resources');
  const gast = ressourcen.find((r) => r.type === typ && String(r.vmid) === String(vmid));
  if (!gast) throw new ProxmoxFehler('Gast nicht gefunden', 404);
  return gast;
}

async function nodeName() {
  const ressourcen = await pve('GET', '/cluster/resources?type=node');
  const node = ressourcen[0]?.node;
  if (!node) throw new ProxmoxFehler('Kein Proxmox-Node gefunden', 502);
  return node;
}

router.get('/status', async (req, res) => {
  if (!istKonfiguriert()) return res.json({ konfiguriert: false });
  try {
    const node = await nodeName();
    const [ressourcen, version, status] = await Promise.all([
      pve('GET', '/cluster/resources'),
      pve('GET', '/version'),
      pve('GET', `/nodes/${node}/status`),
    ]);
    const gaeste = ressourcen
      .filter((r) => r.type === 'qemu' || r.type === 'lxc')
      .map((g) => ({
        typ: g.type, vmid: g.vmid, name: g.name || `${g.type}-${g.vmid}`, status: g.status,
        cpu: g.cpu ?? 0, maxcpu: g.maxcpu ?? 0, mem: g.mem ?? 0, maxmem: g.maxmem ?? 0,
        disk: g.disk ?? 0, maxdisk: g.maxdisk ?? 0, uptime: g.uptime ?? 0,
        vorlage: g.template === 1, node: g.node,
      }))
      .sort((a, b) => a.vmid - b.vmid);
    const speicher = ressourcen
      .filter((r) => r.type === 'storage')
      .map((s) => ({ name: s.storage, art: s.plugintype, inhalt: s.content, status: s.status, disk: s.disk ?? 0, maxdisk: s.maxdisk ?? 0 }));
    res.json({
      konfiguriert: true,
      version: version.version,
      node: {
        name: node, status: status.uptime ? 'online' : 'unbekannt',
        cpu: status.cpu ?? 0, maxcpu: status.cpuinfo?.cpus ?? 0, cpuModell: status.cpuinfo?.model ?? '',
        mem: status.memory?.used ?? 0, maxmem: status.memory?.total ?? 0,
        disk: status.rootfs?.used ?? 0, maxdisk: status.rootfs?.total ?? 0,
        swap: status.swap?.used ?? 0, maxswap: status.swap?.total ?? 0,
        uptime: status.uptime ?? 0, last: status.loadavg ?? [], kernel: status['current-kernel']?.release ?? '',
      },
      gaeste,
      speicher,
    });
  } catch (err) {
    fehler(res, err);
  }
});

router.get('/tasks', async (req, res) => {
  try {
    const node = await nodeName();
    const aufgaben = await pve('GET', `/nodes/${node}/tasks?limit=25`);
    res.json(aufgaben.map((a) => ({
      upid: a.upid, art: a.type, vmid: a.id || null, benutzer: a.user,
      start: a.starttime, ende: a.endtime || null, status: a.status || 'läuft',
    })));
  } catch (err) {
    fehler(res, err);
  }
});

router.post('/gast/:typ/:vmid/:aktion', async (req, res) => {
  const { typ, vmid, aktion } = req.params;
  try {
    if (!AKTIONEN[typ]?.has(aktion)) throw new ProxmoxFehler('Aktion nicht erlaubt', 400);
    const gast = await gastFinden(typ, vmid);
    if (gast.template === 1) throw new ProxmoxFehler('Vorlagen lassen sich nicht steuern', 400);
    const upid = await pve('POST', `/nodes/${gast.node}/${typ}/${vmid}/status/${aktion}`);
    logAudit(`proxmox.${aktion}`, `${typ}/${vmid} (${gast.name || ''})`, null, req.user?.id);
    res.json({ ok: true, upid });
  } catch (err) {
    fehler(res, err);
  }
});

router.get('/gast/:typ/:vmid/snapshots', async (req, res) => {
  try {
    const gast = await gastFinden(req.params.typ, req.params.vmid);
    const liste = await pve('GET', `/nodes/${gast.node}/${req.params.typ}/${req.params.vmid}/snapshot`);
    res.json(liste.filter((s) => s.name !== 'current').map((s) => ({
      name: s.name, beschreibung: s.description || '', zeit: s.snaptime || null, eltern: s.parent || null,
    })));
  } catch (err) {
    fehler(res, err);
  }
});

router.post('/gast/:typ/:vmid/snapshots', async (req, res) => {
  const { typ, vmid } = req.params;
  try {
    const name = String(req.body?.name || '');
    if (!SNAPNAME.test(name)) throw new ProxmoxFehler('Name: Buchstabe am Anfang, dann Buchstaben, Ziffern, _ oder -, max. 40 Zeichen', 400);
    const gast = await gastFinden(typ, vmid);
    const beschreibung = String(req.body?.beschreibung || '').slice(0, 200);
    const upid = await pve('POST', `/nodes/${gast.node}/${typ}/${vmid}/snapshot`, { snapname: name, description: beschreibung });
    logAudit('proxmox.snapshot.create', `${typ}/${vmid}`, name, req.user?.id);
    res.json({ ok: true, upid });
  } catch (err) {
    fehler(res, err);
  }
});

router.post('/gast/:typ/:vmid/snapshots/:name/rollback', async (req, res) => {
  const { typ, vmid, name } = req.params;
  try {
    if (!SNAPNAME.test(name)) throw new ProxmoxFehler('Ungültiger Snapshot-Name', 400);
    const gast = await gastFinden(typ, vmid);
    const upid = await pve('POST', `/nodes/${gast.node}/${typ}/${vmid}/snapshot/${name}/rollback`);
    logAudit('proxmox.snapshot.rollback', `${typ}/${vmid}`, name, req.user?.id);
    res.json({ ok: true, upid });
  } catch (err) {
    fehler(res, err);
  }
});

router.delete('/gast/:typ/:vmid/snapshots/:name', async (req, res) => {
  const { typ, vmid, name } = req.params;
  try {
    if (!SNAPNAME.test(name)) throw new ProxmoxFehler('Ungültiger Snapshot-Name', 400);
    const gast = await gastFinden(typ, vmid);
    const upid = await pve('DELETE', `/nodes/${gast.node}/${typ}/${vmid}/snapshot/${name}`);
    logAudit('proxmox.snapshot.delete', `${typ}/${vmid}`, name, req.user?.id);
    res.json({ ok: true, upid });
  } catch (err) {
    fehler(res, err);
  }
});

// Cerberus selbst neu starten oder herunterfahren. Mit ausdruecklicher
// Bestaetigung im Body, damit ein verirrter Aufruf nie den Host stoppt.
router.post('/node/:aktion', async (req, res) => {
  try {
    const { aktion } = req.params;
    if (!['reboot', 'shutdown'].includes(aktion)) throw new ProxmoxFehler('Aktion nicht erlaubt', 400);
    if (req.body?.bestaetigt !== true) throw new ProxmoxFehler('Bestätigung fehlt', 400);
    const node = await nodeName();
    logAudit(`proxmox.node.${aktion}`, node, null, req.user?.id);
    await pve('POST', `/nodes/${node}/status`, { command: aktion });
    res.json({ ok: true });
  } catch (err) {
    fehler(res, err);
  }
});

export default router;
