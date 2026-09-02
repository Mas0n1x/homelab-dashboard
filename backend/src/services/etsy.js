/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import crypto from 'crypto';
import { getDb } from './database.js';
import { encryptPassword, decryptPassword } from './mail.js';

/**
 * Anbindung an Etsy (Open API v3) für den Shop PrintOasis3D.
 *
 * Etsy verlangt OAuth 2.0 mit PKCE und eine eigene App-Registrierung — es gibt
 * keinen einfachen API-Schlüssel. Der Ablauf läuft deshalb einmal über den
 * Browser; danach hält sich die Anbindung mit dem Auffrisch-Token selbst am
 * Leben (Zugriffs-Token 1 Stunde, Auffrisch-Token 90 Tage).
 */

const API = 'https://api.etsy.com/v3/application';
const TOKEN_URL = 'https://api.etsy.com/v3/public/oauth/token';
const CONNECT_URL = 'https://www.etsy.com/oauth/connect';

// Lesend genügt — das Dashboard soll Bestellungen anzeigen, nicht verändern.
const SCOPES = ['transactions_r', 'shops_r'];

// Der laufende Anmeldevorgang wird kurz in den Einstellungen geparkt.
const FLOW_TTL_MS = 10 * 60 * 1000;

const KEYSTRING = process.env.ETSY_KEYSTRING || '';
const SHARED_SECRET = process.env.ETSY_SHARED_SECRET || '';
// Muss in der Etsy-App exakt so eingetragen sein.
const REDIRECT_URI = process.env.ETSY_REDIRECT_URI || '';

/** Etsy erwartet Schlüssel UND Geheimnis mit Doppelpunkt getrennt in einem Kopf. */
function apiKeyHeader() {
  return SHARED_SECRET ? `${KEYSTRING}:${SHARED_SECRET}` : KEYSTRING;
}

export function istKonfiguriert() {
  return !!(KEYSTRING && SHARED_SECRET && REDIRECT_URI);
}

// ─── Ablage ───

function lese(key) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row?.value ?? null;
}

function schreibe(key, value) {
  getDb().prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value);
}

function loesche(key) {
  getDb().prepare('DELETE FROM settings WHERE key = ?').run(key);
}

function ladeTokens() {
  const roh = lese('etsy_tokens');
  if (!roh) return null;
  try {
    const daten = JSON.parse(roh);
    return {
      accessToken: decryptPassword(daten.a),
      refreshToken: decryptPassword(daten.r),
      expiresAt: daten.e,
      shopId: daten.s || null,
      shopName: daten.n || null,
    };
  } catch {
    // Unlesbar (z. B. nach einer Schlüssel-Rotation) — wie „nicht verbunden"
    // behandeln statt den ganzen Endpunkt scheitern zu lassen.
    return null;
  }
}

function speichereTokens(t) {
  schreibe('etsy_tokens', JSON.stringify({
    a: encryptPassword(t.accessToken),
    r: encryptPassword(t.refreshToken),
    e: t.expiresAt,
    s: t.shopId || null,
    n: t.shopName || null,
  }));
}

export function trennen() {
  loesche('etsy_tokens');
  loesche('etsy_flow');
}

// ─── PKCE ───

const base64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * Startet den Anmeldevorgang und liefert die Adresse, die im Browser geöffnet
 * werden muss. Prüfer und Zustandswert werden serverseitig geparkt — der
 * Zustandswert ist das, was den Rückruf später als echt ausweist.
 */
export function starteAnmeldung() {
  if (!istKonfiguriert()) {
    throw new Error('Etsy ist nicht eingerichtet (ETSY_KEYSTRING, ETSY_SHARED_SECRET, ETSY_REDIRECT_URI).');
  }

  const verifier = base64url(crypto.randomBytes(48));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  const state = base64url(crypto.randomBytes(24));

  schreibe('etsy_flow', JSON.stringify({ verifier, state, at: Date.now() }));

  // Wichtig: `URLSearchParams` kodiert das Leerzeichen zwischen den Scopes als
  // `+`, und Etsys OAuth-Server liest `+` NICHT als Leerzeichen zurück — die
  // Folge ist eine Fehlerseite auf etsy.com („invalid scope"). Deshalb den
  // Query-String selbst bauen und Leerzeichen als %20 kodieren.
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: KEYSTRING,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES.join(' '),
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString().replace(/\+/g, '%20');

  return { url: `${CONNECT_URL}?${query}` };
}

/** Rückruf von Etsy: Code gegen Tokens tauschen. */
export async function schliesseAnmeldungAb(code, state) {
  const roh = lese('etsy_flow');
  if (!roh) throw new Error('Kein laufender Anmeldevorgang — bitte neu starten.');

  const flow = JSON.parse(roh);
  if (Date.now() - flow.at > FLOW_TTL_MS) {
    loesche('etsy_flow');
    throw new Error('Der Anmeldevorgang ist abgelaufen — bitte neu starten.');
  }
  // Der Zustandswert schützt davor, dass ein fremder Rückruf eine Verbindung
  // in dieses Dashboard einhängt.
  if (!state || state !== flow.state) throw new Error('Zustandswert stimmt nicht — Anfrage verworfen.');

  const antwort = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: KEYSTRING,
      redirect_uri: REDIRECT_URI,
      code,
      code_verifier: flow.verifier,
    }),
    signal: AbortSignal.timeout(15000),
  });

  loesche('etsy_flow');

  if (!antwort.ok) {
    const text = await antwort.text().catch(() => '');
    throw new Error(`Etsy lehnte den Tausch ab (${antwort.status}): ${text.slice(0, 200)}`);
  }

  const daten = await antwort.json();
  const tokens = {
    accessToken: daten.access_token,
    refreshToken: daten.refresh_token,
    expiresAt: Date.now() + (daten.expires_in || 3600) * 1000,
  };

  const shop = await ermittleShop(tokens.accessToken).catch(() => null);
  tokens.shopId = shop?.shop_id || null;
  tokens.shopName = shop?.shop_name || null;

  speichereTokens(tokens);
  return { shopId: tokens.shopId, shopName: tokens.shopName };
}

/**
 * Gültiges Zugriffs-Token besorgen, bei Bedarf auffrischen.
 *
 * Eine Minute Vorlauf, damit ein Token nicht mitten in der Anfrage abläuft.
 */
async function holeGueltigesToken() {
  const tokens = ladeTokens();
  if (!tokens) return null;
  if (Date.now() < tokens.expiresAt - 60000) return tokens;

  const antwort = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: KEYSTRING,
      refresh_token: tokens.refreshToken,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!antwort.ok) {
    // Nach 90 Tagen ohne Nutzung ist das Auffrisch-Token endgültig weg. Dann
    // die Verbindung sauber lösen, statt es bei jedem Aufruf erneut zu probieren.
    if (antwort.status === 400 || antwort.status === 401) trennen();
    throw new Error(`Etsy-Token konnte nicht aufgefrischt werden (${antwort.status})`);
  }

  const daten = await antwort.json();
  const neu = {
    accessToken: daten.access_token,
    refreshToken: daten.refresh_token || tokens.refreshToken,
    expiresAt: Date.now() + (daten.expires_in || 3600) * 1000,
    shopId: tokens.shopId,
    shopName: tokens.shopName,
  };
  speichereTokens(neu);
  return neu;
}

async function etsyGet(pfad, accessToken) {
  const antwort = await fetch(`${API}${pfad}`, {
    headers: {
      'x-api-key': apiKeyHeader(),
      Authorization: `Bearer ${accessToken}`,
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!antwort.ok) {
    const text = await antwort.text().catch(() => '');
    throw new Error(`Etsy ${antwort.status}: ${text.slice(0, 200)}`);
  }
  return antwort.json();
}

/**
 * Shop des angemeldeten Kontos.
 *
 * Die Benutzer-Kennung steckt im Zugriffs-Token vor dem Punkt — Etsy baut es
 * als `<user_id>.<token>` auf. Das erspart einen zusätzlichen Aufruf.
 */
async function ermittleShop(accessToken) {
  const userId = String(accessToken).split('.')[0];
  if (!userId) throw new Error('Benutzer-Kennung nicht aus dem Token lesbar');
  const daten = await etsyGet(`/users/${userId}/shops`, accessToken);
  // Je nach Konto kommt ein einzelner Shop oder eine Ergebnisliste zurück.
  if (Array.isArray(daten?.results)) return daten.results[0] || null;
  return daten?.shop_id ? daten : null;
}

// Etsy-Antworten kurz behalten — die Kachel fragt regelmäßig, und Etsy
// begrenzt die Aufrufe pro Tag.
let bestellCache = null;
const BESTELL_TTL = 5 * 60 * 1000;

/**
 * Offene Bestellungen: bezahlt, aber noch nicht verschickt — genau das, was
 * noch Arbeit bedeutet. Dazu die Umsätze der letzten 30 Tage.
 */
export async function holeBestellungen({ force = false } = {}) {
  if (!force && bestellCache && Date.now() - bestellCache.at < BESTELL_TTL) {
    return bestellCache.daten;
  }

  const tokens = await holeGueltigesToken();
  if (!tokens) return { connected: false };

  let shopId = tokens.shopId;
  if (!shopId) {
    const shop = await ermittleShop(tokens.accessToken);
    if (!shop) throw new Error('Kein Shop zu diesem Etsy-Konto gefunden');
    shopId = shop.shop_id;
    speichereTokens({ ...tokens, shopId, shopName: shop.shop_name });
  }

  const offen = await etsyGet(
    `/shops/${shopId}/receipts?was_paid=true&was_shipped=false&limit=25&sort_on=created&sort_order=desc`,
    tokens.accessToken,
  );

  const seit30 = Math.floor((Date.now() - 30 * 86400000) / 1000);
  const letzte = await etsyGet(
    `/shops/${shopId}/receipts?was_paid=true&min_created=${seit30}&limit=100`,
    tokens.accessToken,
  ).catch(() => ({ results: [] }));

  const bestellungen = (offen.results || []).map(r => ({
    receiptId: r.receipt_id,
    buyer: r.name || r.buyer_email || 'Unbekannt',
    total: Number(r.grandtotal?.amount ?? 0) / Number(r.grandtotal?.divisor || 100),
    currency: r.grandtotal?.currency_code || 'EUR',
    createdAt: r.create_timestamp ? new Date(r.create_timestamp * 1000).toISOString() : null,
    itemCount: (r.transactions || []).reduce((s, t) => s + (t.quantity || 1), 0),
    isShipped: !!r.is_shipped,
    country: r.country_iso || null,
  }));

  const umsatz30 = (letzte.results || []).reduce(
    (s, r) => s + Number(r.grandtotal?.amount ?? 0) / Number(r.grandtotal?.divisor || 100), 0,
  );

  const daten = {
    connected: true,
    shopId,
    shopName: tokens.shopName || null,
    openCount: offen.count ?? bestellungen.length,
    orders: bestellungen,
    revenue30d: parseFloat(umsatz30.toFixed(2)),
    orders30d: (letzte.results || []).length,
    currency: bestellungen[0]?.currency || 'EUR',
    fetchedAt: new Date().toISOString(),
  };

  bestellCache = { daten, at: Date.now() };
  return daten;
}

/** Zustand für die Einstellungen: eingerichtet? verbunden? welcher Shop? */
export function holeStatus() {
  const tokens = ladeTokens();
  return {
    configured: istKonfiguriert(),
    connected: !!tokens,
    shopId: tokens?.shopId || null,
    shopName: tokens?.shopName || null,
    redirectUri: REDIRECT_URI || null,
    scopes: SCOPES,
  };
}
