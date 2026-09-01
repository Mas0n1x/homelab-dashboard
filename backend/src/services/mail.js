/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import crypto from 'crypto';
import { execFileSync } from 'child_process';

const STALWART_URL = process.env.STALWART_URL || 'http://stalwart:8080';
const STALWART_ADMIN_USER = process.env.STALWART_ADMIN_USER || 'admin';
const STALWART_ADMIN_PASSWORD = process.env.STALWART_ADMIN_PASSWORD || '';
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

// ─── Credential Encryption ───
//
// Der Schlüssel hängt bewusst NICHT mehr am JWT_SECRET. Am 01.09.2026 wurde das
// JWT_SECRET rotiert — vollkommen richtig, es war der öffentlich bekannte
// Default `homelab-dashboard-change-me` — und damit waren in derselben Sekunde
// **alle fünf gespeicherten Mail-Zugänge unlesbar**. Ein Auth-Geheimnis muss man
// jederzeit rotieren können, ohne Daten zu verlieren; zwei Aufgaben an einem
// Wert sind die eigentliche Ursache. Deshalb ein eigener `MAIL_CRYPT_KEY`.
//
// `MAIL_CRYPT_KEY_LEGACY` (komma-getrennt) nimmt alte Schlüssel auf: nach einer
// Rotation bleiben bestehende Datensätze damit lesbar, bis das
// Wartungsskript `scripts/mail-crypt-rotate.mjs` sie neu verschlüsselt hat.

function schluesselKandidaten() {
  // Ohne MAIL_CRYPT_KEY bleibt JWT_SECRET der Schlüssel — damit bestehende
  // Installationen nach einem Update nicht plötzlich nichts mehr entschlüsseln.
  const primaer = process.env.MAIL_CRYPT_KEY || process.env.JWT_SECRET;
  if (!primaer) {
    throw new Error('Weder MAIL_CRYPT_KEY noch JWT_SECRET gesetzt — beides fehlt zur Ver-/Entschlüsselung gespeicherter Mail-Zugangsdaten.');
  }
  const alt = (process.env.MAIL_CRYPT_KEY_LEGACY || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  // Duplikate raus, damit ein versehentlich doppelt eingetragener Schlüssel
  // nicht zweimal probiert wird.
  return [primaer, ...alt].filter((v, i, a) => a.indexOf(v) === i);
}

function abgeleiteterSchluessel(secret) {
  return crypto.createHash('sha256').update(secret).digest();
}

if (!process.env.MAIL_CRYPT_KEY && process.env.JWT_SECRET) {
  console.warn('[mail] MAIL_CRYPT_KEY ist nicht gesetzt — es wird auf JWT_SECRET zurückgefallen. Eine Rotation des JWT_SECRET macht dann alle gespeicherten Mail-Zugangsdaten unlesbar.');
}

export function encryptPassword(password) {
  // Verschlüsselt wird immer mit dem AKTUELLEN Schlüssel, nie mit einem Legacy.
  const key = abgeleiteterSchluessel(schluesselKandidaten()[0]);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

export function decryptPassword(encrypted) {
  const [ivHex, tagHex, data] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  let letzterFehler = null;
  for (const kandidat of schluesselKandidaten()) {
    try {
      const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, abgeleiteterSchluessel(kandidat), iv);
      decipher.setAuthTag(tag);
      let decrypted = decipher.update(data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err) {
      letzterFehler = err;
    }
  }
  // GCM erkennt den falschen Schlüssel an der Prüfsumme — die Meldung lautet
  // dann „unable to authenticate data" und klingt nach kaputten Daten. Deshalb
  // hier klarstellen, dass es fast immer der Schlüssel ist.
  throw new Error(`Mail-Zugangsdaten nicht entschlüsselbar (${schluesselKandidaten().length} Schlüssel probiert) — meist wurde MAIL_CRYPT_KEY bzw. JWT_SECRET rotiert. Alten Wert in MAIL_CRYPT_KEY_LEGACY eintragen und scripts/mail-crypt-rotate.mjs laufen lassen. Ursprung: ${letzterFehler?.message}`);
}

// Hash password for Stalwart using SHA-512 crypt.
// WICHTIG: Kein Shell-String mit interpoliertem Passwort (RCE-Gefahr). Das
// Python-Skript steht als einzelnes argv-Element, das Passwort kommt über
// stdin — es berührt niemals eine Shell.
function hashPassword(password) {
  try {
    const script = 'import crypt, sys; print(crypt.crypt(sys.stdin.read(), crypt.METHOD_SHA512))';
    const result = execFileSync('python3', ['-c', script], {
      input: password,
      encoding: 'utf8',
    });
    return result.trim();
  } catch (error) {
    throw new Error('Password hashing fehlgeschlagen');
  }
}

// ─── JMAP API ───

export async function getJmapSession(email, password) {
  // Extract username from email (Stalwart authenticates with username, not full email)
  const username = email.includes('@') ? email.split('@')[0] : email;
  const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
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

export async function createAccount(username, password, displayName, domain = 'mas0n1x.online') {
  // Ensure domain exists before creating account
  await ensureDomain(domain);
  // Hash password for Stalwart
  const hashedPassword = hashPassword(password);
  return adminRequest('POST', 'principal', {
    type: 'individual',
    name: username,
    secrets: [hashedPassword],
    description: displayName || username,
    emails: [`${username}@${domain}`],
    roles: ['user'],
  });
}

export async function deleteAccount(username) {
  return adminRequest('DELETE', `principal/${encodeURIComponent(username)}`);
}

export async function updateAccountPassword(username, password) {
  const hashedPassword = hashPassword(password);
  return adminRequest('PATCH', `principal/${encodeURIComponent(username)}`, [
    {
      action: 'set',
      field: 'secrets',
      value: [hashedPassword],
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
