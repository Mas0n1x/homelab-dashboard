/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { Router } from 'express';
import { getDb } from '../services/database.js';

const router = Router();

const newId = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const isIso = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v));

// ─── Abrechnungsprofil (Rechnungssteller, Steuer) ───

const DEFAULT_PROFILE = {
  issuerName: 'Max-Cedrik Blecker',
  issuerAddress: 'Hülsenweg 5\n42579 Heiligenhaus',
  issuerEmail: '',
  taxId: '',
  vatRate: 19,
  // Kleinunternehmerregelung nach § 19 UStG: dann wird keine Umsatzsteuer
  // ausgewiesen und der Hinweis gehört auf die Rechnung.
  smallBusiness: false,
  paymentTermsDays: 14,
  invoicePrefix: 'RE',
  nextInvoiceNumber: 1,
};

function getProfile() {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = 'billing_profile'").get();
  if (!row?.value) return { ...DEFAULT_PROFILE };
  try {
    return { ...DEFAULT_PROFILE, ...JSON.parse(row.value) };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

function saveProfile(profile) {
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_profile', ?)")
    .run(JSON.stringify(profile));
  return profile;
}

// ─── Hilfen ───

/** Sekunden eines Eintrags: festgeschrieben, oder bei laufender Uhr live gerechnet. */
function entrySeconds(row) {
  if (row.ended_at) return row.seconds || 0;
  return Math.max(0, Math.round((Date.now() - Date.parse(row.started_at)) / 1000));
}

function shapeEntry(row) {
  return {
    id: row.id,
    taskId: row.task_id,
    taskTitle: row.task_title || null,
    project: row.project || '',
    description: row.description || '',
    startedAt: row.started_at,
    endedAt: row.ended_at,
    seconds: entrySeconds(row),
    running: !row.ended_at,
    billable: row.billable !== 0,
    invoicedAt: row.invoiced_at,
    source: row.source || 'timer',
  };
}

/**
 * Aufrunden auf ein Zeitraster (z. B. 15 Minuten), wie es bei Kunden-Abrechnung
 * üblich ist. 0 = sekundengenau. Wird nur für Beträge benutzt, nie für die
 * erfasste Rohzeit — die bleibt unangetastet.
 */
function billedSeconds(seconds, roundingMinutes) {
  const step = (Number(roundingMinutes) || 0) * 60;
  if (step <= 0) return seconds;
  return Math.ceil(seconds / step) * step;
}

function getRate(project) {
  const db = getDb();
  return db.prepare('SELECT * FROM billing_rates WHERE project = ?').get(project || '') || null;
}

const LIST_SQL = `
  SELECT te.*, t.title AS task_title
  FROM time_entries te
  LEFT JOIN tasks t ON t.id = te.task_id
`;

// ─── Laufende Uhr ───

router.get('/running', (req, res) => {
  const db = getDb();
  const row = db.prepare(`${LIST_SQL} WHERE te.ended_at IS NULL LIMIT 1`).get();
  res.json(row ? shapeEntry(row) : null);
});

// Uhr starten. Läuft bereits eine, wird sie zuerst sauber gestoppt — sonst
// stünden zwei offene Abschnitte in der Abrechnung.
router.post('/start', (req, res) => {
  const db = getDb();
  const { taskId, project, description } = req.body || {};

  let effectiveProject = (project || '').trim();
  let effectiveDescription = (description || '').trim();

  if (taskId) {
    const task = db.prepare('SELECT id, title, project FROM tasks WHERE id = ?').get(taskId);
    if (!task) return res.status(404).json({ error: 'Aufgabe nicht gefunden' });
    if (!effectiveProject) effectiveProject = task.project || '';
    if (!effectiveDescription) effectiveDescription = task.title;
  }

  const now = new Date().toISOString();
  const id = newId('time');
  let stopped = null;

  db.transaction(() => {
    const running = db.prepare('SELECT * FROM time_entries WHERE ended_at IS NULL').get();
    if (running) {
      const secs = Math.max(0, Math.round((Date.now() - Date.parse(running.started_at)) / 1000));
      db.prepare("UPDATE time_entries SET ended_at = ?, seconds = ?, updated_at = datetime('now') WHERE id = ?")
        .run(now, secs, running.id);
      stopped = { id: running.id, seconds: secs };
    }
    db.prepare(`
      INSERT INTO time_entries (id, task_id, project, description, started_at, source)
      VALUES (?, ?, ?, ?, ?, 'timer')
    `).run(id, taskId || null, effectiveProject, effectiveDescription, now);
  })();

  const row = db.prepare(`${LIST_SQL} WHERE te.id = ?`).get(id);
  res.json({ entry: shapeEntry(row), stopped });
});

router.post('/stop', (req, res) => {
  const db = getDb();
  const running = db.prepare('SELECT * FROM time_entries WHERE ended_at IS NULL').get();
  if (!running) return res.json(null);

  const secs = Math.max(0, Math.round((Date.now() - Date.parse(running.started_at)) / 1000));
  db.prepare("UPDATE time_entries SET ended_at = ?, seconds = ?, updated_at = datetime('now') WHERE id = ?")
    .run(new Date().toISOString(), secs, running.id);

  const row = db.prepare(`${LIST_SQL} WHERE te.id = ?`).get(running.id);
  res.json(shapeEntry(row));
});

// ─── Einträge ───

router.get('/entries', (req, res) => {
  const db = getDb();
  const { from, to, project, taskId, uninvoiced } = req.query;

  const where = [];
  const vals = [];
  if (from) { where.push('te.started_at >= ?'); vals.push(String(from)); }
  if (to) { where.push('te.started_at <= ?'); vals.push(String(to)); }
  if (project) { where.push('te.project = ?'); vals.push(String(project)); }
  if (taskId) { where.push('te.task_id = ?'); vals.push(String(taskId)); }
  if (uninvoiced === '1') where.push('te.invoiced_at IS NULL');

  const sql = `${LIST_SQL} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY te.started_at DESC LIMIT 1000`;
  res.json(db.prepare(sql).all(...vals).map(shapeEntry));
});

// Nachtragen von Hand — für Arbeit, bei der die Uhr vergessen wurde.
router.post('/entries', (req, res) => {
  const db = getDb();
  const { taskId, project, description, startedAt, endedAt, minutes, billable } = req.body || {};

  if (!startedAt || !isIso(startedAt)) return res.status(400).json({ error: 'Startzeitpunkt erforderlich' });

  let end = endedAt;
  let secs;
  if (end) {
    if (!isIso(end)) return res.status(400).json({ error: 'Endzeitpunkt ungültig' });
    secs = Math.round((Date.parse(end) - Date.parse(startedAt)) / 1000);
  } else if (minutes !== undefined) {
    secs = Math.round(Number(minutes) * 60);
    end = new Date(Date.parse(startedAt) + secs * 1000).toISOString();
  } else {
    return res.status(400).json({ error: 'Endzeitpunkt oder Dauer erforderlich' });
  }
  if (!Number.isFinite(secs) || secs <= 0) return res.status(400).json({ error: 'Dauer muss größer als 0 sein' });

  const id = newId('time');
  db.prepare(`
    INSERT INTO time_entries (id, task_id, project, description, started_at, ended_at, seconds, billable, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual')
  `).run(id, taskId || null, (project || '').trim(), (description || '').trim(), startedAt, end, secs, billable === false ? 0 : 1);

  res.json(shapeEntry(db.prepare(`${LIST_SQL} WHERE te.id = ?`).get(id)));
});

router.put('/entries/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Zeiteintrag nicht gefunden' });

  const { project, description, startedAt, endedAt, minutes, billable, taskId } = req.body || {};
  const sets = ["updated_at = datetime('now')"];
  const vals = [];

  if (project !== undefined) { sets.push('project = ?'); vals.push((project || '').trim()); }
  if (description !== undefined) { sets.push('description = ?'); vals.push((description || '').trim()); }
  if (taskId !== undefined) { sets.push('task_id = ?'); vals.push(taskId || null); }
  if (billable !== undefined) { sets.push('billable = ?'); vals.push(billable ? 1 : 0); }

  const start = startedAt !== undefined ? startedAt : existing.started_at;
  if (startedAt !== undefined) {
    if (!isIso(startedAt)) return res.status(400).json({ error: 'Startzeitpunkt ungültig' });
    sets.push('started_at = ?'); vals.push(startedAt);
  }

  if (endedAt !== undefined || minutes !== undefined) {
    let end, secs;
    if (minutes !== undefined) {
      secs = Math.round(Number(minutes) * 60);
      end = new Date(Date.parse(start) + secs * 1000).toISOString();
    } else {
      if (!isIso(endedAt)) return res.status(400).json({ error: 'Endzeitpunkt ungültig' });
      end = endedAt;
      secs = Math.round((Date.parse(end) - Date.parse(start)) / 1000);
    }
    if (!Number.isFinite(secs) || secs <= 0) return res.status(400).json({ error: 'Dauer muss größer als 0 sein' });
    sets.push('ended_at = ?'); vals.push(end);
    sets.push('seconds = ?'); vals.push(secs);
  }

  vals.push(req.params.id);
  db.prepare(`UPDATE time_entries SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  res.json(shapeEntry(db.prepare(`${LIST_SQL} WHERE te.id = ?`).get(req.params.id)));
});

router.delete('/entries/:id', (req, res) => {
  const db = getDb();
  const info = db.prepare('DELETE FROM time_entries WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Zeiteintrag nicht gefunden' });
  res.json({ ok: true });
});

// ─── Stundensätze ───

router.get('/rates', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM billing_rates ORDER BY project COLLATE NOCASE').all();
  res.json(rows.map(r => ({
    project: r.project,
    customer: r.customer || '',
    hourlyRate: r.hourly_rate || 0,
    currency: r.currency || 'EUR',
    roundingMinutes: r.rounding_minutes || 0,
    notes: r.notes || '',
  })));
});

router.put('/rates/:project', (req, res) => {
  const db = getDb();
  const project = decodeURIComponent(req.params.project);
  const { customer, hourlyRate, currency, roundingMinutes, notes } = req.body || {};

  const rate = Number(hourlyRate);
  if (!Number.isFinite(rate) || rate < 0) return res.status(400).json({ error: 'Stundensatz ungültig' });
  const rounding = Number(roundingMinutes) || 0;
  if (rounding < 0 || rounding > 120) return res.status(400).json({ error: 'Rundung muss zwischen 0 und 120 Minuten liegen' });

  db.prepare(`
    INSERT INTO billing_rates (project, customer, hourly_rate, currency, rounding_minutes, notes, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(project) DO UPDATE SET
      customer = excluded.customer, hourly_rate = excluded.hourly_rate,
      currency = excluded.currency, rounding_minutes = excluded.rounding_minutes,
      notes = excluded.notes, updated_at = datetime('now')
  `).run(project, (customer || '').trim(), rate, currency || 'EUR', rounding, (notes || '').trim());

  res.json({ ok: true });
});

router.delete('/rates/:project', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM billing_rates WHERE project = ?').run(decodeURIComponent(req.params.project));
  res.json({ ok: true });
});

// ─── Auswertung ───

// Zusammenfassung je Projekt plus Tagesverlauf für den gewählten Zeitraum.
router.get('/summary', (req, res) => {
  const db = getDb();
  const from = req.query.from ? String(req.query.from) : new Date(Date.now() - 30 * 86400000).toISOString();
  const to = req.query.to ? String(req.query.to) : new Date().toISOString();

  const rows = db.prepare(`
    SELECT * FROM time_entries WHERE started_at >= ? AND started_at <= ?
  `).all(from, to);

  const rates = new Map(db.prepare('SELECT * FROM billing_rates').all().map(r => [r.project, r]));

  const byProject = new Map();
  const byDay = new Map();
  let totalSeconds = 0;
  let totalAmount = 0;

  for (const row of rows) {
    const secs = entrySeconds(row);
    totalSeconds += secs;

    const day = row.started_at.slice(0, 10);
    byDay.set(day, (byDay.get(day) || 0) + secs);

    const key = row.project || '';
    if (!byProject.has(key)) {
      const r = rates.get(key);
      byProject.set(key, {
        project: key,
        customer: r?.customer || '',
        hourlyRate: r?.hourly_rate || 0,
        currency: r?.currency || 'EUR',
        roundingMinutes: r?.rounding_minutes || 0,
        seconds: 0,
        billableSeconds: 0,
        uninvoicedSeconds: 0,
        amount: 0,
        entries: 0,
      });
    }
    const p = byProject.get(key);
    p.seconds += secs;
    p.entries += 1;
    if (row.billable !== 0) {
      p.billableSeconds += secs;
      if (!row.invoiced_at) p.uninvoicedSeconds += secs;
    }
  }

  for (const p of byProject.values()) {
    // Die Rundung greift je Eintrag, nicht auf die Summe — sonst würde ein
    // 15-Minuten-Raster bei vielen kurzen Abschnitten zu wenig ausweisen.
    const rounded = rows
      .filter(r => (r.project || '') === p.project && r.billable !== 0)
      .reduce((sum, r) => sum + billedSeconds(entrySeconds(r), p.roundingMinutes), 0);
    p.billedSeconds = rounded;
    p.amount = parseFloat(((rounded / 3600) * p.hourlyRate).toFixed(2));
    totalAmount += p.amount;
  }

  res.json({
    from,
    to,
    totalSeconds,
    totalAmount: parseFloat(totalAmount.toFixed(2)),
    projects: [...byProject.values()].sort((a, b) => b.seconds - a.seconds),
    days: [...byDay.entries()].sort().map(([date, seconds]) => ({ date, seconds })),
  });
});

// ─── Abrechnungsprofil ───

router.get('/profile', (req, res) => res.json(getProfile()));

router.put('/profile', (req, res) => {
  const current = getProfile();
  const body = req.body || {};
  const next = {
    ...current,
    issuerName: body.issuerName ?? current.issuerName,
    issuerAddress: body.issuerAddress ?? current.issuerAddress,
    issuerEmail: body.issuerEmail ?? current.issuerEmail,
    taxId: body.taxId ?? current.taxId,
    vatRate: body.vatRate !== undefined ? Number(body.vatRate) : current.vatRate,
    smallBusiness: body.smallBusiness !== undefined ? !!body.smallBusiness : current.smallBusiness,
    paymentTermsDays: body.paymentTermsDays !== undefined ? Number(body.paymentTermsDays) : current.paymentTermsDays,
    invoicePrefix: body.invoicePrefix ?? current.invoicePrefix,
    nextInvoiceNumber: body.nextInvoiceNumber !== undefined ? Number(body.nextInvoiceNumber) : current.nextInvoiceNumber,
  };
  if (!Number.isFinite(next.vatRate) || next.vatRate < 0 || next.vatRate > 100) {
    return res.status(400).json({ error: 'Steuersatz muss zwischen 0 und 100 liegen' });
  }
  res.json(saveProfile(next));
});

// ─── Rechnungsentwurf ───

/**
 * Baut aus den Zeiteinträgen eines Zeitraums einen Rechnungsentwurf: je Aufgabe
 * (ersatzweise je Beschreibung) eine Position mit Stunden, Satz und Betrag.
 *
 * Bewusst ein ENTWURF: nichts wird versendet und nichts festgeschrieben, solange
 * nicht ausdrücklich `commit: true` mitkommt. Erst dann bekommen die Einträge
 * ihren Abrechnungsstempel und die Rechnungsnummer zählt hoch.
 */
router.post('/invoice', (req, res) => {
  const db = getDb();
  const { project, from, to, commit, onlyUninvoiced = true, note } = req.body || {};

  if (!project) return res.status(400).json({ error: 'Projekt erforderlich' });
  if (!from || !to) return res.status(400).json({ error: 'Zeitraum erforderlich' });

  const where = [
    'te.project = ?',
    'te.started_at >= ?',
    'te.started_at <= ?',
    'te.billable = 1',
    'te.ended_at IS NOT NULL',
  ];
  const vals = [project, from, to];
  if (onlyUninvoiced) where.push('te.invoiced_at IS NULL');

  const rows = db.prepare(
    `${LIST_SQL} WHERE ${where.join(' AND ')} ORDER BY te.started_at ASC`
  ).all(...vals);

  if (rows.length === 0) {
    return res.status(400).json({ error: 'Keine abrechenbaren Zeiten in diesem Zeitraum' });
  }

  const rate = getRate(project);
  const hourlyRate = rate?.hourly_rate || 0;
  const currency = rate?.currency || 'EUR';
  const rounding = rate?.rounding_minutes || 0;
  const profile = getProfile();

  // Positionen bündeln: gleiche Aufgabe bzw. gleiche Beschreibung = eine Zeile.
  const lines = new Map();
  for (const row of rows) {
    const label = row.task_title || row.description || 'Entwicklungsleistung';
    if (!lines.has(label)) lines.set(label, { label, seconds: 0, entries: 0, dates: new Set() });
    const l = lines.get(label);
    l.seconds += billedSeconds(entrySeconds(row), rounding);
    l.entries += 1;
    l.dates.add(row.started_at.slice(0, 10));
  }

  const positions = [...lines.values()].map(l => {
    const hours = parseFloat((l.seconds / 3600).toFixed(2));
    return {
      label: l.label,
      hours,
      hourlyRate,
      amount: parseFloat((hours * hourlyRate).toFixed(2)),
      entries: l.entries,
      dates: [...l.dates].sort(),
    };
  }).sort((a, b) => b.amount - a.amount);

  const net = parseFloat(positions.reduce((s, p) => s + p.amount, 0).toFixed(2));
  const vatRate = profile.smallBusiness ? 0 : profile.vatRate;
  const vat = parseFloat((net * (vatRate / 100)).toFixed(2));
  const gross = parseFloat((net + vat).toFixed(2));

  const invoiceNumber = `${profile.invoicePrefix}-${new Date().getFullYear()}-${String(profile.nextInvoiceNumber).padStart(4, '0')}`;
  const issuedAt = new Date().toISOString();
  const dueAt = new Date(Date.now() + (profile.paymentTermsDays || 14) * 86400000).toISOString();

  const draft = {
    invoiceNumber,
    issuedAt,
    dueAt,
    project,
    customer: rate?.customer || '',
    currency,
    period: { from, to },
    issuer: {
      name: profile.issuerName,
      address: profile.issuerAddress,
      email: profile.issuerEmail,
      taxId: profile.taxId,
    },
    positions,
    totals: { net, vatRate, vat, gross },
    smallBusiness: !!profile.smallBusiness,
    note: note || '',
    entryIds: rows.map(r => r.id),
    committed: false,
  };

  if (commit) {
    const stamp = new Date().toISOString();
    const mark = db.prepare('UPDATE time_entries SET invoiced_at = ? WHERE id = ?');
    db.transaction(() => {
      for (const r of rows) mark.run(stamp, r.id);
    })();
    saveProfile({ ...profile, nextInvoiceNumber: (profile.nextInvoiceNumber || 1) + 1 });
    draft.committed = true;
  }

  res.json(draft);
});

// Abrechnungsstempel wieder entfernen — falls eine Rechnung doch nicht rausging.
router.post('/invoice/revert', (req, res) => {
  const db = getDb();
  const ids = Array.isArray(req.body?.entryIds) ? req.body.entryIds : [];
  if (ids.length === 0) return res.status(400).json({ error: 'Keine Einträge angegeben' });
  const stmt = db.prepare('UPDATE time_entries SET invoiced_at = NULL WHERE id = ?');
  db.transaction(() => { for (const id of ids) stmt.run(id); })();
  res.json({ ok: true, reverted: ids.length });
});

export default router;
