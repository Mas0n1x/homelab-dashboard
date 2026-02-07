import { Router } from 'express';
import { getDb } from '../services/database.js';
import * as mail from '../services/mail.js';

const router = Router();

// ─── Helper: Get mail auth from request headers ───

function getMailAuth(req) {
  const account = req.headers['x-mail-account'];
  const password = req.headers['x-mail-password'];
  if (!account || !password) throw new Error('Mail-Konto nicht konfiguriert');
  return {
    account,
    password,
    authHeader: 'Basic ' + Buffer.from(`${account}:${password}`).toString('base64'),
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

// ─── Mail Credentials (stored encrypted per dashboard user) ───

router.get('/credentials', (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT email, password_encrypted, account_id FROM mail_credentials WHERE user_id = ?').get(req.user.id);
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
    db.prepare(`
      INSERT INTO mail_credentials (user_id, email, password_encrypted, account_id, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        email = excluded.email,
        password_encrypted = excluded.password_encrypted,
        account_id = excluded.account_id,
        updated_at = datetime('now')
    `).run(req.user.id, email, encrypted, accountId || null);

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/credentials', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM mail_credentials WHERE user_id = ?').run(req.user.id);
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
    const { username, password, displayName } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Benutzername und Passwort erforderlich' });
    const result = await mail.createAccount(username, password, displayName);
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
    res.json(domains);
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
