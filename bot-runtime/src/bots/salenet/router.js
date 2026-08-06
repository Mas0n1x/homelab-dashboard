/*
 * Homelab Dashboard — Bot-Runtime (SaleNet-Bot)
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 *
 * Steuerungs-API des SaleNet-Support-Bots. 1:1 aus SaleNets adminRoutes
 * (/api/admin/bot/*) herausgelöst; Auth (Bearer) sitzt zentral in index.js.
 */
const express = require('express');
const botController = require('./controllers/botController');
const botModController = require('./controllers/botModController');
const botGithubController = require('./controllers/botGithubController');
const botContentController = require('./controllers/botContentController');
const bot = require('./bot');
const { state } = require('./bot/state');
const discordNotifier = require('./services/discordNotifier');
const githubNotifier = require('./services/githubNotifier');
const Product = require('./models/Product');
const Settings = require('./models/Settings');

function createSalenetRouter() {
  const router = express.Router();

  // Bot-Token setzen/prüfen (nur schreiben; wird pro Bot in den Settings gehalten)
  router.get('/token-status', (req, res) => res.json({ configured: !!Settings.get('discord_bot_token') }));
  router.post('/token', (req, res) => {
    const t = (req.body?.token || '').trim();
    if (!t) return res.status(400).json({ error: 'Token fehlt' });
    Settings.set('discord_bot_token', t);
    res.json({ success: true });
  });

  // Phase 1: Lifecycle / Status / Config
  router.get('/status', botController.getStatusInfo);
  router.get('/config', botController.getConfig);
  router.put('/config', botController.updateConfig);
  router.post('/config', botController.updateConfig); // Alias (Dashboard nutzt POST)
  router.post('/start', botController.start);
  router.post('/stop', botController.stop);
  router.post('/restart', botController.restart);
  router.get('/logs', botController.listLogs);
  router.get('/channels', botController.listChannels);
  router.get('/roles', botController.listRoles);
  router.post('/test-notify', botController.testNotify);

  // Phase 2: Moderation
  router.get('/mod-actions', botModController.listModActions);
  router.post('/mod/execute', botModController.executeMod);
  router.post('/mod/slowmode', botModController.setSlowmode);

  // Phase 2: Tickets
  router.get('/tickets', botModController.listTickets);
  router.get('/tickets/:id', botModController.getTicketTranscript);
  router.patch('/tickets/:id/close', botModController.forceCloseTicket);

  // Phase 3: AutoMod
  router.get('/automod', botModController.listAutomod);
  router.post('/automod', botModController.createAutomod);
  router.put('/automod/:id', botModController.updateAutomod);
  router.delete('/automod/:id', botModController.deleteAutomod);

  // Phase 3: GitHub
  router.get('/github/config', botGithubController.getConfig);
  router.put('/github/config', botGithubController.updateConfig);
  router.get('/github/subscriptions', botGithubController.listSubscriptions);
  router.post('/github/subscriptions', botGithubController.createSubscription);
  router.put('/github/subscriptions/:id', botGithubController.updateSubscription);
  router.delete('/github/subscriptions/:id', botGithubController.deleteSubscription);
  router.get('/github/webhook-info', botGithubController.webhookInfo);

  // Phase 4: Content-Poster
  router.get('/content/config', botContentController.getConfig);
  router.put('/content/config', botContentController.updateConfig);
  router.post('/content/post-rules', botContentController.postRules);
  router.post('/content/post-products', botContentController.postProducts);
  router.post('/content/post-links', botContentController.postLinks);
  router.post('/content/post-status', botContentController.postStatus);

  // ── Produkt-Sync: spiegelt SaleNets Produktliste in die lokale DB ──
  // Der Content-Poster liest Produkte aus der lokalen products-Tabelle; da die
  // echten Produkte in SaleNet liegen, holen wir sie per öffentlicher SaleNet-API.
  router.post('/sync-products', async (req, res) => {
    const url = process.env.SALENET_PRODUCTS_URL;
    if (!url) return res.status(503).json({ error: 'SALENET_PRODUCTS_URL nicht konfiguriert' });
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) return res.status(502).json({ error: `SaleNet-API Fehler: ${r.status}` });
      const list = await r.json();
      const products = Array.isArray(list) ? list : (list.products || []);
      let n = 0;
      for (const p of products) {
        try {
          const existing = Product.findById(p.id);
          const data = {
            id: p.id, type: p.type, name: p.name, description: p.description,
            monthly_price: p.monthly_price, yearly_price: p.yearly_price,
            stripe_monthly_price_id: p.stripe_monthly_price_id, stripe_yearly_price_id: p.stripe_yearly_price_id,
            features: p.features, position: p.position || 0, icon: p.icon || '',
          };
          if (existing) Product.update(p.id, data); else Product.create(data);
          n++;
        } catch { /* einzelnes Produkt überspringen */ }
      }
      res.json({ success: true, synced: n });
    } catch (e) {
      res.status(502).json({ error: 'Sync fehlgeschlagen: ' + e.message });
    }
  });

  // ── Business-Events aus SaleNet (Outbound-Webhook) ──
  // Ersetzt die früheren in-process Aufrufe (Order/Contact/Affiliate/Incident).
  router.post('/events', async (req, res) => {
    try {
      const { type, payload } = req.body || {};
      switch (type) {
        case 'order': await discordNotifier.notifyNewOrder(payload); break;
        case 'contact': await discordNotifier.notifyNewContact(payload); break;
        case 'affiliate': await discordNotifier.notifyNewAffiliate(payload); break;
        case 'incident': await discordNotifier.notifyIncident(payload, payload?.action || 'created'); break;
        default: return res.status(400).json({ error: 'Unbekannter Event-Typ' });
      }
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
}

// Normalisierter Status für die /bots-Übersicht (Form wie beim Portfolio-Bot)
function getSalenetStatus() {
  const connected = state.status === 'online';
  return {
    connected,
    guild: state.guild ? { id: state.guild.id, name: state.guild.name, icon: state.guild.iconURL?.() || null } : null,
    memberCount: state.guild?.memberCount || 0,
    uptime: state.startedAt ? Date.now() - state.startedAt : 0,
    ping: state.client?.ws?.ping ?? 0,
    username: state.client?.user?.tag || null,
    avatar: state.client?.user?.displayAvatarURL?.() || null,
    statusText: state.status,
    lastError: state.lastError || null,
  };
}

// Öffentlicher GitHub-Webhook-Handler (erwartet ROHEN Body → express.raw davor mounten)
const githubWebhookHandler = githubNotifier.webhookHandler;

module.exports = { createSalenetRouter, getSalenetStatus, githubWebhookHandler, initSalenet: bot.init };
