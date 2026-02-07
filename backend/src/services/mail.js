import crypto from 'crypto';

const STALWART_URL = process.env.STALWART_URL || 'http://stalwart:8080';
const STALWART_ADMIN_USER = process.env.STALWART_ADMIN_USER || 'admin';
const STALWART_ADMIN_PASSWORD = process.env.STALWART_ADMIN_PASSWORD || '';
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

// ─── Credential Encryption ───

function getEncryptionKey() {
  const secret = process.env.JWT_SECRET || 'homelab-dashboard-change-me';
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptPassword(password) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

export function decryptPassword(encrypted) {
  const key = getEncryptionKey();
  const [ivHex, tagHex, data] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ─── JMAP API ───

export async function getJmapSession(email, password) {
  const authHeader = 'Basic ' + Buffer.from(`${email}:${password}`).toString('base64');
  const res = await fetch(`${STALWART_URL}/.well-known/jmap`, {
    headers: { Authorization: authHeader },
    redirect: 'follow',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`JMAP Session fehlgeschlagen (${res.status}): ${text}`);
  }
  return res.json();
}

export async function jmapRequest(authHeader, methodCalls) {
  const res = await fetch(`${STALWART_URL}/jmap`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body: JSON.stringify({
      using: [
        'urn:ietf:params:jmap:core',
        'urn:ietf:params:jmap:mail',
        'urn:ietf:params:jmap:submission',
      ],
      methodCalls,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`JMAP Fehler (${res.status}): ${text}`);
  }
  return res.json();
}

export async function uploadBlob(accountId, authHeader, buffer, contentType) {
  const res = await fetch(`${STALWART_URL}/jmap/upload/${accountId}/`, {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      Authorization: authHeader,
    },
    body: buffer,
  });
  if (!res.ok) throw new Error(`Upload fehlgeschlagen (${res.status})`);
  return res.json();
}

export async function downloadBlob(accountId, blobId, name, authHeader) {
  const res = await fetch(
    `${STALWART_URL}/jmap/download/${accountId}/${encodeURIComponent(blobId)}/${encodeURIComponent(name)}`,
    { headers: { Authorization: authHeader } }
  );
  if (!res.ok) throw new Error(`Download fehlgeschlagen (${res.status})`);
  return res;
}

// ─── Admin Management API ───

async function adminRequest(method, path, body) {
  if (!STALWART_ADMIN_PASSWORD) throw new Error('STALWART_ADMIN_PASSWORD nicht konfiguriert');
  const authHeader = 'Basic ' + Buffer.from(`${STALWART_ADMIN_USER}:${STALWART_ADMIN_PASSWORD}`).toString('base64');
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${STALWART_URL}/api/${path}`, options);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Admin API Fehler (${res.status}): ${text}`);
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return res.json();
  return { ok: true };
}

export async function listAccounts() {
  const result = await adminRequest('GET', 'principal?types=individual');
  return result?.data?.items || [];
}

export async function getAccount(username) {
  const result = await adminRequest('GET', `principal/${encodeURIComponent(username)}`);
  return result?.data || result;
}

export async function ensureDomain(domain) {
  try {
    await adminRequest('POST', 'principal', {
      type: 'domain',
      name: domain,
    });
  } catch (e) {
    // Domain may already exist — ignore conflict errors
    if (!e.message.includes('409') && !e.message.includes('already')) throw e;
  }
}

export async function createAccount(username, password, displayName) {
  // Ensure domain exists before creating account
  await ensureDomain('mas0n1x.online');
  return adminRequest('POST', 'principal', {
    type: 'individual',
    name: username,
    secrets: [password],
    description: displayName || username,
    emails: [`${username}@mas0n1x.online`],
    roles: ['user'],
  });
}

export async function deleteAccount(username) {
  return adminRequest('DELETE', `principal/${encodeURIComponent(username)}`);
}

export async function updateAccountPassword(username, password) {
  return adminRequest('PATCH', `principal/${encodeURIComponent(username)}`, [
    {
      action: 'set',
      field: 'secrets',
      value: [password],
    },
  ]);
}

export async function listDomains() {
  const result = await adminRequest('GET', 'principal?types=domain');
  return result?.data?.items || [];
}

export async function getDkim(domain) {
  return adminRequest('GET', `dns/records/${encodeURIComponent(domain)}`);
}
