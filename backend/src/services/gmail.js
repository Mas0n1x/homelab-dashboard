/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Gmail-Adapter: Gmail spricht kein JMAP. Dieser Adapter nimmt dieselben
// JMAP-Methodenaufrufe entgegen wie das Frontend sie an Stalwart schickt und
// setzt sie auf IMAP (lesen/verwalten) und SMTP (senden) von Gmail um. So bleiben
// Oberfläche, Sammel-Eingang und Zähler unverändert — Anmeldung per App-Passwort.
import crypto from 'crypto';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';

export const GMAIL_ACCOUNT_ID = 'gmail';
const IDLE_MS = 90 * 1000;
const UPLOAD_TTL = 30 * 60 * 1000;

// ─── Verbindungs-Pool: eine IMAP-Verbindung je Konto (Gmail erlaubt nur ~15) ───

const pool = new Map();

function dropEntry(key, entry) {
  if (pool.get(key) !== entry) return;
  pool.delete(key);
  clearTimeout(entry.timer);
  entry.promise?.then(c => c.logout().catch(() => c.close())).catch(() => {});
}

async function getClient(email, password) {
  const key = email.toLowerCase();
  let entry = pool.get(key);
  if (entry && entry.password !== password) {
    dropEntry(key, entry);
    entry = null;
  }
  if (!entry) {
    entry = { password, promise: null, timer: null, allMail: undefined };
    pool.set(key, entry);
    const client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: { user: email, pass: password },
      logger: false,
    });
    const self = entry;
    client.on('error', () => dropEntry(key, self));
    client.on('close', () => dropEntry(key, self));
    entry.promise = client.connect().then(() => client).catch((err) => {
      if (pool.get(key) === self) pool.delete(key);
      throw err;
    });
  }
  const client = await entry.promise;
  clearTimeout(entry.timer);
  entry.timer = setTimeout(() => dropEntry(key, entry), IDLE_MS);
  return { client, entry };
}

function friendlyError(err) {
  if (err?.authenticationFailed || /AUTHENTICATIONFAILED|Invalid credentials|Application-specific/i.test(err?.response || err?.message || '')) {
    return new Error('Gmail-Anmeldung fehlgeschlagen — App-Passwort prüfen (2-Faktor muss aktiv und IMAP in Gmail eingeschaltet sein)');
  }
  return err instanceof Error ? err : new Error(String(err));
}

/** Prüft die Zugangsdaten (beim Hinzufügen des Kontos). */
export async function verify(email, password) {
  try {
    const { client } = await getClient(email, password);
    await client.list();
  } catch (err) {
    throw friendlyError(err);
  }
}

// ─── Ordner ───

const ROLE_BY_USE = {
  '\\Inbox': 'inbox',
  '\\Sent': 'sent',
  '\\Drafts': 'drafts',
  '\\Trash': 'trash',
  '\\Junk': 'junk',
  '\\Archive': 'archive',
  '\\Important': 'important',
};

async function listFolders(client, entry, withStatus) {
  const list = await client.list(withStatus ? { statusQuery: { messages: true, unseen: true } } : {});
  const out = [];
  for (const f of list) {
    if (f.flags?.has('\\Noselect') || f.flags?.has('\\NonExistent')) continue;
    if (f.specialUse === '\\All') {
      entry.allMail = f.path;
      continue; // „Alle Nachrichten" zeigt alles doppelt — nur für die Suche genutzt
    }
    if (f.specialUse === '\\Flagged') continue;
    const role = f.path === 'INBOX' ? 'inbox' : (ROLE_BY_USE[f.specialUse] || null);
    out.push({
      id: f.path,
      name: f.name,
      role,
      parentId: null,
      sortOrder: role === 'inbox' ? 0 : role ? 1 : 2,
      totalEmails: f.status?.messages || 0,
      unreadEmails: f.status?.unseen || 0,
      totalThreads: f.status?.messages || 0,
      unreadThreads: f.status?.unseen || 0,
      isSubscribed: true,
    });
  }
  return out;
}

// ─── Hilfen: IDs, Adressen, Flags ───

const encId = (path, uid) => `${uid}~${encodeURIComponent(path)}`;

function decId(id) {
  const i = String(id).indexOf('~');
  if (i < 1) throw new Error(`Ungültige Mail-ID: ${id}`);
  return { uid: parseInt(id.slice(0, i), 10), path: decodeURIComponent(id.slice(i + 1)) };
}

const mapAddrs = (list) => (list || [])
  .filter(a => a?.address)
  .map(a => ({ name: a.name || null, email: a.address }));

function keywordsOf(flags) {
  const k = {};
  if (flags?.has('\\Seen')) k.$seen = true;
  if (flags?.has('\\Flagged')) k.$flagged = true;
  if (flags?.has('\\Draft')) k.$draft = true;
  if (flags?.has('\\Answered')) k.$answered = true;
  return k;
}

function hasAttachmentIn(node) {
  if (!node) return false;
  if (node.disposition === 'attachment') return true;
  return (node.childNodes || []).some(hasAttachmentIn);
}

const iso = (d) => (d ? new Date(d).toISOString() : null);

function baseMessage(msg, path) {
  const env = msg.envelope || {};
  return {
    id: encId(path, msg.uid),
    blobId: encId(path, msg.uid),
    threadId: String(msg.threadId || msg.emailId || msg.uid),
    mailboxIds: { [path]: true },
    from: mapAddrs(env.from),
    to: mapAddrs(env.to),
    cc: mapAddrs(env.cc),
    bcc: mapAddrs(env.bcc),
    replyTo: mapAddrs(env.replyTo),
    subject: env.subject || '',
    receivedAt: iso(msg.internalDate),
    sentAt: iso(env.date) || iso(msg.internalDate),
    size: msg.size || 0,
    keywords: keywordsOf(msg.flags),
  };
}

// ─── Email/query ───

async function emailQuery(email, password, args) {
  const { client, entry } = await getClient(email, password);
  const filter = args.filter || {};
  const position = Math.max(0, args.position || 0);
  const limit = Math.min(200, Math.max(1, args.limit || 50));

  let path;
  let search;
  if (filter.text) {
    if (entry.allMail === undefined) await listFolders(client, entry, false);
    path = entry.allMail || 'INBOX';
    search = { gmraw: filter.text };
  } else {
    path = filter.inMailbox;
    search = { all: true };
  }
  if (!path) return { accountId: GMAIL_ACCOUNT_ID, ids: [], total: 0, position, queryState: '0', canCalculateChanges: false };

  const lock = await client.getMailboxLock(path, { readOnly: true });
  let uids;
  try {
    uids = (await client.search(search, { uid: true })) || [];
  } finally {
    lock.release();
  }
  uids.sort((a, b) => b - a);
  return {
    accountId: GMAIL_ACCOUNT_ID,
    ids: uids.slice(position, position + limit).map(u => encId(path, u)),
    total: uids.length,
    position,
    queryState: '0',
    canCalculateChanges: false,
  };
}

// ─── Email/get ───

async function previewOf(buffer) {
  try {
    const parsed = await simpleParser(buffer);
    return (parsed.text || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  } catch {
    return '';
  }
}

/** Ids nach Ordner gruppieren: { path: [uid, …] } */
function groupByPath(ids) {
  const groups = new Map();
  for (const id of ids) {
    const { uid, path } = decId(id);
    if (!groups.has(path)) groups.set(path, []);
    groups.get(path).push(uid);
  }
  return groups;
}

async function emailGetList(email, password, ids) {
  const { client } = await getClient(email, password);
  const found = new Map();
  for (const [path, uids] of groupByPath(ids)) {
    const lock = await client.getMailboxLock(path, { readOnly: true });
    try {
      const msgs = await client.fetchAll(uids.join(','), {
        uid: true,
        flags: true,
        envelope: true,
        internalDate: true,
        size: true,
        bodyStructure: true,
        threadId: true,
        source: { start: 0, maxLength: 6000 },
      }, { uid: true });
      for (const msg of msgs) {
        const m = baseMessage(msg, path);
        m.hasAttachment = hasAttachmentIn(msg.bodyStructure);
        m.preview = msg.source ? await previewOf(msg.source) : '';
        found.set(m.id, m);
      }
    } finally {
      lock.release();
    }
  }
  // Reihenfolge der Anfrage beibehalten
  return ids.map(id => found.get(id)).filter(Boolean);
}

/** Inline-Bilder (cid:) direkt als Data-URL einbetten, sonst bleiben sie leer. */
function inlineCids(html, attachments) {
  let out = html;
  for (const att of attachments) {
    if (!att.cid || !att.content || att.size > 5 * 1024 * 1024) continue;
    const uri = `data:${att.contentType};base64,${att.content.toString('base64')}`;
    out = out.split(`cid:${att.cid}`).join(uri);
  }
  return out;
}

async function loadParsed(email, password, id) {
  const { client } = await getClient(email, password);
  const { uid, path } = decId(id);
  const lock = await client.getMailboxLock(path, { readOnly: true });
  try {
    const msg = await client.fetchOne(String(uid), {
      uid: true, flags: true, envelope: true, internalDate: true, size: true, threadId: true, source: true,
    }, { uid: true });
    if (!msg) throw new Error('Mail nicht gefunden');
    const parsed = await simpleParser(msg.source);
    return { msg, parsed, path };
  } finally {
    lock.release();
  }
}

async function emailGetFull(email, password, ids) {
  const list = [];
  for (const id of ids) {
    try {
      const { msg, parsed, path } = await loadParsed(email, password, id);
      const m = baseMessage(msg, path);
      const attachments = parsed.attachments || [];
      const listed = attachments
        .map((a, i) => ({ a, i }))
        .filter(({ a }) => !(a.related && a.cid));
      m.hasAttachment = listed.length > 0;
      m.preview = (parsed.text || '').replace(/\s+/g, ' ').trim().slice(0, 200);
      const bodyValues = {};
      m.htmlBody = [];
      m.textBody = [];
      if (parsed.html) {
        bodyValues.h = { value: inlineCids(parsed.html, attachments), isEncodingProblem: false, isTruncated: false };
        m.htmlBody.push({ partId: 'h', blobId: m.id, type: 'text/html', size: parsed.html.length });
      }
      if (parsed.text) {
        bodyValues.t = { value: parsed.text, isEncodingProblem: false, isTruncated: false };
        m.textBody.push({ partId: 't', blobId: m.id, type: 'text/plain', size: parsed.text.length });
      }
      m.bodyValues = bodyValues;
      m.attachments = listed.map(({ a, i }) => ({
        partId: String(i),
        blobId: `${m.id}|${i}`,
        name: a.filename || null,
        type: a.contentType,
        size: a.size || 0,
        cid: a.cid || null,
      }));
      list.push(m);
    } catch {
      // nicht auffindbare Mail überspringen → landet in notFound
    }
  }
  return list;
}

/** Anhang einer Mail laden (Download-Route). blobId = "<mailId>|<index>". */
export async function downloadAttachment(email, password, blobId) {
  const sep = blobId.lastIndexOf('|');
  if (sep < 0) throw new Error('Ungültige Anhang-ID');
  const { parsed } = await loadParsed(email, password, blobId.slice(0, sep));
  const att = (parsed.attachments || [])[parseInt(blobId.slice(sep + 1), 10)];
  if (!att) throw new Error('Anhang nicht gefunden');
  return { buffer: att.content, contentType: att.contentType || 'application/octet-stream', name: att.filename };
}

// ─── Email/set (Flags, Verschieben) ───

const FLAG_BY_KEYWORD = { $seen: '\\Seen', $flagged: '\\Flagged', $answered: '\\Answered' };

async function emailUpdate(email, password, update) {
  const { client } = await getClient(email, password);
  const updated = {};
  const notUpdated = {};
  for (const [id, patch] of Object.entries(update || {})) {
    try {
      const { uid, path } = decId(id);
      const add = [];
      const remove = [];
      let target = null;
      for (const [key, value] of Object.entries(patch)) {
        if (key.startsWith('keywords/')) {
          const flag = FLAG_BY_KEYWORD[key.slice(9)];
          if (flag) (value ? add : remove).push(flag);
        } else if (key === 'mailboxIds') {
          target = Object.entries(value || {}).find(([, v]) => v)?.[0] || null;
        } else if (key.startsWith('mailboxIds/') && value) {
          target = key.slice(11);
        }
      }
      const lock = await client.getMailboxLock(path);
      try {
        if (add.length) await client.messageFlagsAdd(String(uid), add, { uid: true });
        if (remove.length) await client.messageFlagsRemove(String(uid), remove, { uid: true });
        if (target && target !== path) await client.messageMove(String(uid), target, { uid: true });
      } finally {
        lock.release();
      }
      updated[id] = null;
    } catch (err) {
      notUpdated[id] = { type: 'serverFail', description: err.message };
    }
  }
  return { accountId: GMAIL_ACCOUNT_ID, oldState: '0', newState: '1', updated, notUpdated };
}

// ─── Senden (SMTP) + Anhänge zwischenspeichern ───

const uploads = new Map();

export function storeUpload(buffer, contentType) {
  const now = Date.now();
  for (const [k, v] of uploads) if (now - v.at > UPLOAD_TTL) uploads.delete(k);
  const blobId = crypto.randomBytes(16).toString('hex');
  uploads.set(blobId, { buffer, type: contentType, at: now });
  return { accountId: GMAIL_ACCOUNT_ID, blobId, type: contentType, size: buffer.length };
}

async function sendDraft(email, password, draft, displayName) {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: email, pass: password },
  });
  const fmt = (list) => (list || []).map(a => (a.name ? { name: a.name, address: a.email } : a.email));
  const text = draft.bodyValues?.body?.value ?? '';

  let inReplyTo;
  if (typeof draft.inReplyTo === 'string' && draft.inReplyTo.includes('~')) {
    try {
      const { client } = await getClient(email, password);
      const { uid, path } = decId(draft.inReplyTo);
      const lock = await client.getMailboxLock(path, { readOnly: true });
      try {
        const msg = await client.fetchOne(String(uid), { envelope: true }, { uid: true });
        inReplyTo = msg?.envelope?.messageId;
      } finally {
        lock.release();
      }
    } catch { /* Antwort geht dann eben ohne Threading raus */ }
  }

  const attachments = (draft.attachments || []).map((a) => {
    const up = uploads.get(a.blobId);
    if (!up) throw new Error(`Anhang „${a.name}" ist abgelaufen — bitte erneut hochladen`);
    return { filename: a.name, content: up.buffer, contentType: a.type || up.type };
  });

  try {
    await transporter.sendMail({
      from: displayName ? { name: displayName, address: email } : email,
      to: fmt(draft.to),
      cc: fmt(draft.cc),
      subject: draft.subject,
      text,
      attachments,
      ...(inReplyTo ? { inReplyTo, references: inReplyTo } : {}),
    });
  } catch (err) {
    throw friendlyError(err);
  }
}

// ─── JMAP-Fassade ───

function resolveRefs(args, results) {
  const out = { ...args };
  for (const key of Object.keys(args)) {
    if (!key.startsWith('#')) continue;
    const ref = args[key];
    const prev = results.get(ref.resultOf);
    if (!prev) throw new Error(`Rückbezug auf ${ref.resultOf} nicht auflösbar`);
    let value = prev;
    for (const part of String(ref.path).split('/').filter(Boolean)) value = value?.[part];
    out[key.slice(1)] = value;
    delete out[key];
  }
  return out;
}

/**
 * Führt JMAP-Methodenaufrufe gegen Gmail aus. Unterstützt genau das, was das
 * Frontend braucht: Mailbox/get, Email/query, Email/get, Email/set (Flags,
 * Verschieben, Neu+Senden), Identity/get, EmailSubmission/set.
 */
export async function jmapShim(email, password, methodCalls, displayName) {
  const results = new Map();
  const responses = [];
  const created = new Map(); // Email/set create → Entwurf, der gleich gesendet wird
  const sendsLater = methodCalls.some(c => c[0] === 'EmailSubmission/set');

  for (const [name, rawArgs, callId] of methodCalls) {
    try {
      const args = resolveRefs(rawArgs || {}, results);
      let result;
      switch (name) {
        case 'Mailbox/get': {
          const { client, entry } = await getClient(email, password);
          result = { accountId: GMAIL_ACCOUNT_ID, state: '0', list: await listFolders(client, entry, true), notFound: [] };
          break;
        }
        case 'Email/query':
          result = await emailQuery(email, password, args);
          break;
        case 'Email/get': {
          const ids = args.ids || [];
          const detail = args.fetchHTMLBodyValues || (args.properties || []).includes('htmlBody');
          const list = detail ? await emailGetFull(email, password, ids) : await emailGetList(email, password, ids);
          const have = new Set(list.map(m => m.id));
          result = { accountId: GMAIL_ACCOUNT_ID, state: '0', list, notFound: ids.filter(i => !have.has(i)) };
          break;
        }
        case 'Email/set': {
          if (args.create) {
            if (!sendsLater) throw new Error('Entwürfe speichern wird für Gmail nicht unterstützt');
            const createdMap = {};
            for (const [cid, draft] of Object.entries(args.create)) {
              created.set(`#${cid}`, draft);
              createdMap[cid] = { id: `#${cid}` };
            }
            result = { accountId: GMAIL_ACCOUNT_ID, oldState: '0', newState: '1', created: createdMap };
          } else {
            result = await emailUpdate(email, password, args.update);
          }
          break;
        }
        case 'Identity/get':
          result = { accountId: GMAIL_ACCOUNT_ID, state: '0', list: [{ id: 'gmail', name: displayName || email, email }] };
          break;
        case 'EmailSubmission/set': {
          const createdSubs = {};
          const notCreated = {};
          for (const [cid, sub] of Object.entries(args.create || {})) {
            const draft = created.get(sub.emailId);
            if (!draft) {
              notCreated[cid] = { type: 'invalidProperties', description: 'Entwurf nicht gefunden' };
              continue;
            }
            await sendDraft(email, password, draft, displayName);
            createdSubs[cid] = { id: `sent-${Date.now()}` };
          }
          result = { accountId: GMAIL_ACCOUNT_ID, oldState: '0', newState: '1', created: createdSubs, notCreated };
          break;
        }
        default:
          throw new Error(`JMAP-Methode ${name} wird für Gmail nicht unterstützt`);
      }
      results.set(callId, result);
      responses.push([name, result, callId]);
    } catch (err) {
      const e = friendlyError(err);
      responses.push(['error', { type: 'serverFail', description: e.message }, callId]);
      // Frontend wertet bei Fehlern den ersten Fehlerrückgabewert aus → sofort abbrechen
      throw e;
    }
  }
  return { methodResponses: responses, sessionState: '0' };
}

/** Minimale Session-Antwort, damit /mail/session auch für Gmail-Konten antwortet. */
export function fakeSession(email) {
  return {
    username: email,
    accounts: { [GMAIL_ACCOUNT_ID]: { name: email, isPersonal: true } },
    primaryAccounts: { 'urn:ietf:params:jmap:mail': GMAIL_ACCOUNT_ID },
  };
}
