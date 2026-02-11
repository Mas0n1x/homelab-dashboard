import { getDb } from '../services/database.js';
import * as mail from '../services/mail.js';

const WEBHOOK_SECRET = process.env.MAIL_WEBHOOK_SECRET || 'homelab-mail-webhook-secret';

export async function handleInboundMail(req, res) {
  try {
    const authHeader = req.headers['x-webhook-secret'];
    if (authHeader !== WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { from, to, subject, rawEmail } = req.body;
    if (!to || !rawEmail) {
      return res.status(400).json({ error: 'to and rawEmail required' });
    }

    const toAddress = Array.isArray(to) ? to[0] : to;
    const fromAddress = from || 'unknown@unknown';
    const username = toAddress.split('@')[0];

    // Look up recipient's stored credentials in the dashboard DB
    const db = getDb();
    const account = db.prepare(`
      SELECT email, password_encrypted, account_id
      FROM mail_accounts
      WHERE email = ?
      LIMIT 1
    `).get(toAddress);

    if (!account) {
      console.log(`Inbound mail for unknown account: ${toAddress}`);
      return res.status(404).json({ error: `No stored credentials for ${toAddress}` });
    }

    const password = mail.decryptPassword(account.password_encrypted);
    const userAuth = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

    // Get JMAP session if we don't have accountId
    let accountId = account.account_id;
    if (!accountId) {
      const session = await mail.getJmapSession(username, password);
      accountId = session.primaryAccounts['urn:ietf:params:jmap:mail'];
    }

    // Upload raw email as blob
    const rawBuffer = Buffer.from(rawEmail, 'base64');
    const blob = await mail.uploadBlob(accountId, userAuth, rawBuffer, 'message/rfc822');

    if (!blob.blobId) {
      throw new Error('Blob upload failed - no blobId returned');
    }

    // Find user's inbox
    const mailboxResult = await mail.jmapRequest(userAuth, [
      ['Mailbox/query', { accountId, filter: { role: 'inbox' } }, 'inbox']
    ]);
    const inboxId = mailboxResult.methodResponses?.[0]?.[1]?.ids?.[0];
    if (!inboxId) {
      throw new Error('Inbox not found');
    }

    // Import email directly into inbox (bypasses spam filtering)
    const importResult = await mail.jmapRequest(userAuth, [
      ['Email/import', {
        accountId,
        emails: {
          'incoming': {
            blobId: blob.blobId,
            mailboxIds: { [inboxId]: true },
            keywords: {},
          }
        }
      }, 'import']
    ]);

    const importResponse = importResult.methodResponses?.[0]?.[1];
    if (importResponse?.notCreated) {
      throw new Error(`Import failed: ${JSON.stringify(importResponse.notCreated)}`);
    }

    console.log(`Mail received: ${fromAddress} -> ${toAddress} (${subject})`);

    // Send notification to all connected WebSocket clients
    if (req.app.locals.broadcast) {
      req.app.locals.broadcast({
        type: 'notifications',
        data: [{
          id: `mail-${Date.now()}`,
          type: 'new-mail',
          title: 'Neue E-Mail',
          message: `Von ${fromAddress}: ${subject || '(Kein Betreff)'}`,
          timestamp: new Date().toISOString(),
          read: false,
        }]
      });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Inbound mail error:', error.message);
    res.status(500).json({ error: error.message });
  }
}
