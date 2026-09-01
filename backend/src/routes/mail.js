/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { Router } from 'express';
import { getDb } from '../services/database.js';
import * as mail from '../services/mail.js';

const router = Router();

// ─── Helper: Get mail auth from database (password lookup) ───

function getMailAuth(req) {
  const email = req.headers['x-mail-account'];
  if (!email) throw new Error('Mail-Konto nicht konfiguriert');

  const db = getDb();
  const row = db.prepare(`
    SELECT email, password_encrypted, account_id
    FROM mail_accounts
    WHERE user_id = ? AND email = ?
  `).get(req.user.id, email);

  if (!row) throw new Error('Mail-Konto nicht gefunden');

  const password = mail.decryptPassword(row.password_encrypted);
  // Stalwart authenticates with username, not full email
  const username = row.email.includes('@') ? row.email.split('@')[0] : row.email;
  return {
    account: row.email,
    password,
    accountId: row.account_id,
    authHeader: 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64'),
  };
}

// ─── JMAP Proxy ───

// GET /session — fetch JMAP session resource
router.get('/session', async (req, res) => {
  try {
    const { account, password } = getMailAuth(req);
    const session = await mail.getJmapSession(account, password);
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /jmap — generic JMAP method call proxy
router.post('/jmap', async (req, res) => {
  try {
    const { authHeader } = getMailAuth(req);
    const { methodCalls } = req.body;
    if (!methodCalls || !Array.isArray(methodCalls)) {
      return res.status(400).json({ error: 'methodCalls erforderlich' });
    }
    const result = await mail.jmapRequest(authHeader, methodCalls);
    // Alles, was Mails verändert (gelesen, verschoben, gelöscht), macht die
    // zwischengespeicherten Ungelesen-Zähler sofort ungültig — sonst hinkt das
    // Zeichen an der Bottom-Bar bis zu 20 Sekunden hinterher.
    if (methodCalls.some(c => typeof c?.[0] === 'string' && c[0].endsWith('/set'))) {
      overviewCache.delete(req.user.id);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /upload — upload attachment blob
router.post('/upload', async (req, res) => {
  try {
    const { authHeader } = getMailAuth(req);
    const accountId = req.headers['x-mail-account-id'];
    if (!accountId) return res.status(400).json({ error: 'Account-ID fehlt' });

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    const contentType = req.headers['content-type'] || 'application/octet-stream';

    const result = await mail.uploadBlob(accountId, authHeader, buffer, contentType);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /download/:accountId/:blobId/:name — stream attachment download
router.get('/download/:accountId/:blobId/:name', async (req, res) => {
  try {
    const { authHeader } = getMailAuth(req);
    const { accountId, blobId, name } = req.params;

    const response = await mail.downloadBlob(accountId, blobId, name, authHeader);
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}"`);

    const reader = response.body.getReader();
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    };
    await pump();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Übersicht über ALLE Postfächer ───

/** Zugangsdaten eines Kontos anhand seiner E-Mail-Adresse (ohne Header). */
function authFor(userId, email) {
  const db = getDb();
  const row = db.prepare(
    'SELECT email, password_encrypted, account_id FROM mail_accounts WHERE user_id = ? AND email = ?'
  ).get(userId, email);
  if (!row) throw new Error('Mail-Konto nicht gefunden');
  const password = mail.decryptPassword(row.password_encrypted);
  const username = row.email.includes('@') ? row.email.split('@')[0] : row.email;
  return {
    account: row.email,
    accountId: row.account_id,
    authHeader: 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64'),
  };
}

// Kurzer Cache je Nutzer: Übersicht und Sammel-Eingang fragen dieselben Postfächer
// ab, und die Oberfläche lädt beides gleichzeitig. Ohne Cache wären das bei fünf
// Konten zehn JMAP-Runden pro Seitenaufruf — mobil deutlich spürbar.
const overviewCache = new Map();
const OVERVIEW_TTL = 20000;

async function loadOverview(userId) {
  const cached = overviewCache.get(userId);
  if (cached && Date.now() - cached.at < OVERVIEW_TTL) return cached.data;

  const db = getDb();
  const accounts = db.prepare(`
    SELECT id, email, account_id, display_name, sort_order
    FROM mail_accounts WHERE user_id = ? ORDER BY sort_order ASC, added_at ASC
  `).all(userId);

  // Alle Konten PARALLEL — ein langsamer Server darf die anderen nicht ausbremsen.
  const results = await Promise.all(accounts.map(async (acc) => {
    const base = {
      id: acc.id,
      email: acc.email,
      accountId: acc.account_id,
      displayName: acc.display_name || acc.email.split('@')[0],
      sortOrder: acc.sort_order,
    };
    try {
      const { authHeader, accountId } = authFor(userId, acc.email);
      if (!accountId) return { ...base, folders: [], unread: 0, total: 0, error: 'Konto-Kennung fehlt' };

      const result = await mail.jmapRequest(authHeader, [
        ['Mailbox/get', { accountId, ids: null }, '0'],
      ]);
      const folders = result?.methodResponses?.[0]?.[1]?.list || [];
      const inbox = folders.find(f => f.role === 'inbox');

      return {
        ...base,
        accountId,
        folders: folders.map(f => ({
          id: f.id,
          name: f.name,
          role: f.role,
          unread: f.unreadEmails || 0,
          total: f.totalEmails || 0,
        })),
        // Als „ungelesen" zählt der Posteingang. Die Summe über alle Ordner wäre
        // irreführend: ungelesene Werbung im Spam-Ordner ist keine offene Mail.
        unread: inbox?.unreadEmails || 0,
        total: inbox?.totalEmails || 0,
        error: null,
      };
    } catch (error) {
      // Ein defektes Konto darf die Übersicht nicht kippen — es wird mit
      // Fehlertext angezeigt, die anderen laden normal.
      return { ...base, folders: [], unread: 0, total: 0, error: error.message };
    }
  }));

  const data = {
    accounts: results,
    totalUnread: results.reduce((s, a) => s + a.unread, 0),
  };
  overviewCache.set(userId, { data, at: Date.now() });
  return data;
}

// GET /overview — alle Postfächer mit Ordnern und Ungelesen-Zählern auf einmal.
router.get('/overview', async (req, res) => {
  try {
    res.json(await loadOverview(req.user.id));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /unread — nur die Zähler, für Badge in Navigation und Bottom-Bar.
router.get('/unread', async (req, res) => {
  try {
    const data = await loadOverview(req.user.id);
    res.json({
      total: data.totalUnread,
      accounts: data.accounts.map(a => ({ id: a.id, email: a.email, unread: a.unread })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /unified — Posteingänge ALLER Konten zu einer Liste zusammengeführt.
router.get('/unified', async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(5, parseInt(req.query.limit, 10) || 40));
    const overview = await loadOverview(req.user.id);

    const perAccount = await Promise.all(overview.accounts.map(async (acc) => {
      const inbox = acc.folders.find(f => f.role === 'inbox');
      if (!inbox || acc.error) return [];
      try {
        const { authHeader } = authFor(req.user.id, acc.email);
        const result = await mail.jmapRequest(authHeader, [
          ['Email/query', {
            accountId: acc.accountId,
            filter: { inMailbox: inbox.id },
            sort: [{ property: 'receivedAt', isAscending: false }],
            limit,
          }, '0'],
          ['Email/get', {
            accountId: acc.accountId,
            '#ids': { resultOf: '0', name: 'Email/query', path: '/ids' },
            properties: ['id', 'subject', 'from', 'to', 'receivedAt', 'preview', 'keywords', 'hasAttachment', 'mailboxIds', 'threadId'],
          }, '1'],
        ]);
        const emails = result?.methodResponses?.[1]?.[1]?.list || [];
        // Jede Mail trägt ihr Konto mit — die Liste zeigt sonst nicht, in
        // welchem Postfach sie liegt, und Antworten gingen vom falschen ab.
        return emails.map(e => ({
          ...e,
          accountEmail: acc.email,
          accountId: acc.accountId,
          accountDisplayName: acc.displayName,
          mailboxId: inbox.id,
        }));
      } catch {
        return [];
      }
    }));

    const merged = perAccount
      .flat()
      .sort((a, b) => String(b.receivedAt || '').localeCompare(String(a.receivedAt || '')))
      .slice(0, limit);

    res.json({ emails: merged });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Multi-Account Management ───

router.get('/accounts', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT id, email, account_id, display_name, sort_order, is_active, added_at
      FROM mail_accounts
      WHERE user_id = ?
      ORDER BY sort_order ASC, added_at ASC
    `).all(req.user.id);
    const accounts = rows.map(row => ({
      id: row.id,
      email: row.email,
      accountId: row.account_id,
      displayName: row.display_name,
      sortOrder: row.sort_order,
      isActive: row.is_active === 1,
      addedAt: row.added_at,
    }));
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/accounts', async (req, res) => {
  try {
    const { email, displayName } = req.body;
    // Mail-Account-Passwort serverseitig aus der Umgebung (nicht mehr aus dem Client-Bundle)
    const password = process.env.MAIL_ACCOUNT_PASSWORD || req.body.password;
    if (!email) {
      return res.status(400).json({ error: 'E-Mail erforderlich' });
    }
    if (!password) {
      return res.status(500).json({ error: 'MAIL_ACCOUNT_PASSWORD ist serverseitig nicht konfiguriert.' });
    }

    // Test connection first
    let session;
    try {
      session = await mail.getJmapSession(email, password);
    } catch (authError) {
      // Account might not exist on Stalwart yet — auto-create it
      const username = email.includes('@') ? email.split('@')[0] : email;
      const domain = email.includes('@') ? email.split('@')[1] : undefined;
      try {
        await mail.createAccount(username, password, displayName || username, domain);
      } catch (createError) {
        // Ignore if account already exists (409), re-throw otherwise
        if (!createError.message.includes('409') && !createError.message.includes('already')) {
          return res.status(400).json({ error: `Konto konnte nicht erstellt werden: ${createError.message}` });
        }
      }
      // Retry authentication after account creation
      try {
        session = await mail.getJmapSession(email, password);
      } catch (retryError) {
        return res.status(400).json({ error: `Verbindung fehlgeschlagen: ${retryError.message}` });
      }
    }
    const accountId = session?.primaryAccounts?.['urn:ietf:params:jmap:mail'] || null;

    const db = getDb();
    const encrypted = mail.encryptPassword(password);

    // Get max sort_order for user
    const maxSort = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as max FROM mail_accounts WHERE user_id = ?').get(req.user.id);
    const sortOrder = (maxSort?.max || -1) + 1;

    // Check if this is the first account (set as active)
    const count = db.prepare('SELECT COUNT(*) as cnt FROM mail_accounts WHERE user_id = ?').get(req.user.id);
    const isActive = count.cnt === 0 ? 1 : 0;

    const result = db.prepare(`
      INSERT INTO mail_accounts (user_id, email, password_encrypted, account_id, display_name, sort_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, email, encrypted, accountId, displayName || null, sortOrder, isActive);

    res.json({
      id: result.lastInsertRowid,
      email,
      accountId,
      displayName,
      sortOrder,
      isActive: isActive === 1
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/accounts/:id/activate', (req, res) => {
  try {
    const db = getDb();

    // Verify ownership
    const account = db.prepare('SELECT email FROM mail_accounts WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!account) return res.status(404).json({ error: 'Konto nicht gefunden' });

    // Deactivate all, activate selected (transaction)
    db.transaction(() => {
      db.prepare('UPDATE mail_accounts SET is_active = 0 WHERE user_id = ?').run(req.user.id);
      db.prepare('UPDATE mail_accounts SET is_active = 1 WHERE id = ?').run(req.params.id);
    })();

    res.json({ ok: true, email: account.email });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/accounts/:id', (req, res) => {
  try {
    const db = getDb();

    // Verify ownership and get info
    const account = db.prepare('SELECT is_active FROM mail_accounts WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!account) return res.status(404).json({ error: 'Konto nicht gefunden' });

    db.prepare('DELETE FROM mail_accounts WHERE id = ?').run(req.params.id);

    // If deleted account was active, activate the first remaining account
    if (account.is_active === 1) {
      const firstAccount = db.prepare('SELECT id FROM mail_accounts WHERE user_id = ? ORDER BY sort_order ASC LIMIT 1').get(req.user.id);
      if (firstAccount) {
        db.prepare('UPDATE mail_accounts SET is_active = 1 WHERE id = ?').run(firstAccount.id);
      }
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Mail Credentials (backward compatibility - uses mail_accounts) ───

router.get('/credentials', (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare(`
      SELECT email, password_encrypted, account_id
      FROM mail_accounts
      WHERE user_id = ? AND is_active = 1
      ORDER BY sort_order ASC
      LIMIT 1
    `).get(req.user.id);
    if (!row) return res.json({ email: null, password: null, accountId: null });
    res.json({
      email: row.email,
      password: mail.decryptPassword(row.password_encrypted),
      accountId: row.account_id,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/credentials', (req, res) => {
  try {
    const { email, password, accountId } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'E-Mail und Passwort erforderlich' });

    const db = getDb();
    const encrypted = mail.encryptPassword(password);

    // Check if account exists
    const existing = db.prepare('SELECT id FROM mail_accounts WHERE user_id = ? AND email = ?').get(req.user.id, email);

    if (existing) {
      // Update existing
      db.prepare(`
        UPDATE mail_accounts
        SET password_encrypted = ?, account_id = ?, is_active = 1, updated_at = datetime('now')
        WHERE id = ?
      `).run(encrypted, accountId || null, existing.id);

      // Deactivate others
      db.prepare('UPDATE mail_accounts SET is_active = 0 WHERE user_id = ? AND id != ?').run(req.user.id, existing.id);
    } else {
      // Insert new
      db.prepare(`
        INSERT INTO mail_accounts (user_id, email, password_encrypted, account_id, is_active, sort_order)
        VALUES (?, ?, ?, ?, 1, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM mail_accounts WHERE user_id = ?))
      `).run(req.user.id, email, encrypted, accountId || null, req.user.id);

      // Deactivate others
      db.prepare('UPDATE mail_accounts SET is_active = 0 WHERE user_id = ? AND email != ?').run(req.user.id, email);
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/credentials', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM mail_accounts WHERE user_id = ? AND is_active = 1').run(req.user.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Admin: Account Management ───

router.get('/admin/accounts', async (req, res) => {
  try {
    const accounts = await mail.listAccounts();
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/accounts', async (req, res) => {
  try {
    const { username, displayName, domain } = req.body;
    const password = process.env.MAIL_ACCOUNT_PASSWORD || req.body.password;
    if (!username) return res.status(400).json({ error: 'Benutzername erforderlich' });
    if (!password) return res.status(500).json({ error: 'MAIL_ACCOUNT_PASSWORD ist serverseitig nicht konfiguriert.' });
    const result = await mail.createAccount(username, password, displayName, domain);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/admin/accounts/:username', async (req, res) => {
  try {
    const result = await mail.deleteAccount(req.params.username);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/admin/accounts/:username/password', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Passwort erforderlich' });
    const result = await mail.updateAccountPassword(req.params.username, password);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Admin: Domains & DKIM ───

router.get('/admin/domains', async (req, res) => {
  try {
    const domains = await mail.listDomains();
    const names = domains.map(d => typeof d === 'string' ? d : d.name).filter(Boolean);
    res.json(names);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/dkim/:domain', async (req, res) => {
  try {
    const dkim = await mail.getDkim(req.params.domain);
    res.json(dkim);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
