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
    const username = toAddress.split('@')[0];

    // Verify account exists
    try {
      await mail.getAccount(username);
    } catch {
      console.log(`Inbound mail for unknown account: ${toAddress}`);
      return res.status(404).json({ error: `Account ${username} not found` });
    }

    // Use admin to inject email via JMAP
    const adminUser = process.env.STALWART_ADMIN_USER || 'admin';
    const adminPass = process.env.STALWART_ADMIN_PASSWORD || '';
    const adminAuth = 'Basic ' + Buffer.from(`${adminUser}:${adminPass}`).toString('base64');

    // Get admin JMAP session
    const session = await mail.getJmapSession(adminUser, adminPass);
    const accountId = session.primaryAccounts['urn:ietf:params:jmap:mail'];

    // Upload raw email as blob
    const rawBuffer = Buffer.from(rawEmail, 'base64');
    const blob = await mail.uploadBlob(accountId, adminAuth, rawBuffer, 'message/rfc822');

    // Find user's inbox via admin (we need to use user's account, not admin's)
    // Get user's JMAP session to find their accountId
    const userAccount = await mail.getAccount(username);
    const userEmail = userAccount.emails?.[0] || `${username}@mas0n1x.online`;
    const userSecrets = userAccount.secrets;

    if (!userSecrets || !userSecrets[0]) {
      return res.status(500).json({ error: 'Cannot access user account' });
    }

    // Get user's JMAP session
    const userSession = await mail.getJmapSession(username, userSecrets[0]);
    const userAccountId = userSession.primaryAccounts['urn:ietf:params:jmap:mail'];
    const userAuth = 'Basic ' + Buffer.from(`${username}:${userSecrets[0]}`).toString('base64');

    // Upload blob to user's account
    const userBlob = await mail.uploadBlob(userAccountId, userAuth, rawBuffer, 'message/rfc822');

    // Find user's inbox
    const mailboxResult = await mail.jmapRequest(userAuth, [
      ['Mailbox/query', { accountId: userAccountId, filter: { role: 'inbox' } }, 'inbox']
    ]);
    const inboxId = mailboxResult.methodResponses?.[0]?.[1]?.ids?.[0];

    if (!inboxId) {
      return res.status(500).json({ error: 'User inbox not found' });
    }

    // Import email into user's inbox
    await mail.jmapRequest(userAuth, [
      ['Email/import', {
        accountId: userAccountId,
        emails: {
          'incoming-1': {
            blobId: userBlob.blobId,
            mailboxIds: { [inboxId]: true },
            keywords: {},
          }
        }
      }, 'import']
    ]);

    console.log(`Mail received: ${from} -> ${toAddress} (${subject})`);
    res.json({ ok: true });
  } catch (error) {
    console.error('Inbound mail error:', error.message);
    res.status(500).json({ error: error.message });
  }
}
