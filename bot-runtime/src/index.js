/*
 * Homelab Dashboard — Bot-Runtime
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 *
 * Zentraler Bot-Host: betreibt die ausgelagerten Discord-Bots (Portfolio,
 * SaleNet) in einem eigenen Prozess/Container und stellt eine Bearer-
 * gesicherte Steuerungs-API bereit, die das Dashboard-Backend proxyt.
 */
const express = require('express');
const { initDb, dbGet, dbAll, dbRun } = require('./db');
const DiscordBot = require('./bots/portfolio/DiscordBot');
const { createPortfolioRouter, createGithubWebhookHandler } = require('./bots/portfolio/router');
const {
  createSalenetRouter, getSalenetStatus, githubWebhookHandler: salenetGithubWebhook, initSalenet,
} = require('./bots/salenet/router');

const PORT = process.env.PORT || 3200;
const TOKEN = process.env.BOT_RUNTIME_TOKEN || '';
if (!TOKEN) {
  console.warn('[WARN] BOT_RUNTIME_TOKEN ist nicht gesetzt — die Steuerungs-API ist ungeschützt. Bitte in der .env setzen.');
}

// ── DB + Bots initialisieren ─────────────────────────────────────────
initDb();
const portfolioBot = new DiscordBot({ dbGet, dbAll, dbRun });

// Registry aller gehosteten Bots (für /bots-Übersicht)
const registry = [
  {
    id: 'portfolio',
    name: 'Portfolio-Bot',
    description: 'Mas0n1x Development — Community, Tickets, Moderation, GitHub, „Meine Server", /minecraft.',
    status: () => portfolioBot.getStatus(),
  },
  {
    id: 'salenet',
    name: 'SaleNet-Support-Bot',
    description: 'LawNet Sales — Support-Tickets, Moderation, Auto-Mod, GitHub, Sales-Benachrichtigungen, Systemstatus.',
    status: () => getSalenetStatus(),
  },
];

const app = express();

// ── Öffentliche Webhooks (kein Bearer — HMAC-signiert) ─────────────────
// SaleNet-GitHub-Webhook braucht den ROHEN Body → express.raw VOR dem globalen
// JSON-Parser mounten, sonst wäre req.body bereits geparst.
app.post('/salenet/webhook/github', express.raw({ type: '*/*', limit: '5mb' }), salenetGithubWebhook);

// Globaler JSON-Parser (behält rawBody für den Portfolio-Webhook)
app.use(express.json({ limit: '5mb', verify: (req, _res, buf) => { req.rawBody = buf; } }));

// ── Health (öffentlich) ───────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', bots: registry.map(r => r.id), timestamp: new Date().toISOString() });
});

// Portfolio-GitHub-Webhook (nutzt geparstes JSON + rawBody)
app.post('/portfolio/webhook/github', createGithubWebhookHandler(portfolioBot));

// ── Bearer-Auth für alles Weitere ──────────────────────────────────────
app.use((req, res, next) => {
  if (!TOKEN) return next(); // nur wenn bewusst offen gelassen (dev)
  const auth = req.headers.authorization || '';
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (provided && provided === TOKEN) return next();
  return res.status(401).json({ error: 'Nicht autorisiert' });
});

// ── Übersicht aller Bots (Status) ──────────────────────────────────────
app.get('/bots', (req, res) => {
  const bots = registry.map(entry => {
    let status = null;
    try { status = entry.status(); } catch { status = { connected: false }; }
    return { id: entry.id, name: entry.name, description: entry.description, status };
  });
  res.json({ bots });
});

// ── Steuerungs-Router je Bot ────────────────────────────────────────────
app.use('/portfolio', createPortfolioRouter(portfolioBot));
app.use('/salenet', createSalenetRouter());

// ── Start ───────────────────────────────────────────────────────────────
async function boot() {
  // Portfolio-Bot: Autostart, sofern in der Config aktiviert und Token vorhanden
  const enabled = portfolioBot.getConfig('bot_enabled');
  const hasToken = !!(process.env.DISCORD_BOT_TOKEN || portfolioBot.getConfig('bot_token'));
  if (enabled === 'true' && hasToken) {
    portfolioBot.start().catch(e => console.error('Portfolio-Bot Autostart fehlgeschlagen:', e.message));
  }

  // SaleNet-Bot: eigener Autostart (startet still, wenn kein Token gesetzt ist)
  try { initSalenet(); } catch (e) { console.error('SaleNet-Bot Init fehlgeschlagen:', e.message); }

  app.listen(PORT, () => {
    console.log(`Bot-Runtime läuft auf http://localhost:${PORT}`);
  });
}

boot();

// Sauberes Herunterfahren
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    try { await portfolioBot.stop(); } catch { /* egal */ }
    process.exit(0);
  });
}
