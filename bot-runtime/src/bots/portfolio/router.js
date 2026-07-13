/*
 * Homelab Dashboard — Bot-Runtime
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 *
 * Steuerungs-API für den Portfolio-Bot. 1:1 aus dem Portfolio-Backend
 * herausgelöst (vormals /api/admin/discord/* in mas0n1x-portfolio).
 * Die Auth (Bearer) sitzt zentral in index.js, hier keine requireAuth-Prüfung.
 */
const express = require('express');
const crypto = require('crypto');

// Default-Konfiguration für "Zurücksetzen" (verbatim aus dem Portfolio übernommen).
const RESET_DEFAULTS = {
  msg_welcome: JSON.stringify({
    title: 'Willkommen!',
    description: 'Willkommen auf dem **Mas0n1x Development** Server, {user}!\nWir freuen uns, dich in unserer Community begrüssen zu dürfen.\nHier findest du professionellen Support, kannst Projekte anfragen und dich mit anderen Entwicklern austauschen.',
    color: '#00ff88',
    footer: 'Du bist unser {memberCount}. Mitglied!'
  }),
  msg_leave: JSON.stringify({
    title: 'Auf Wiedersehen!',
    description: '**{username}** hat den Server verlassen.\nWir bedanken uns für die gemeinsame Zeit und wünschen alles Gute.',
    color: '#ff4444'
  }),
  msg_rules: JSON.stringify({
    title: '📜 Serverregeln',
    color: '#ff4444',
    footer: 'Reagiere mit ✅ um die Regeln zu akzeptieren und Zugang zum Server zu erhalten!',
    sections: [
      { title: '§1 Allgemeines', rules: [
        'Dieser Server dient als offizielle Plattform für Support, Projektanfragen und den Austausch rund um Softwareentwicklung.',
        'Es gelten die offiziellen Discord Nutzungsbedingungen sowie die Discord Community-Richtlinien.',
        'Unwissenheit über die Regeln schützt nicht vor Konsequenzen.',
        'Jeder Nutzer ist für sein eigenes Verhalten auf diesem Server verantwortlich.',
        'Das Serverteam behält sich das Recht vor, Regeln jederzeit anzupassen.'
      ]},
      { title: '§2 Verhalten & Respekt', rules: [
        'Behandle alle Mitglieder respektvoll – kein Mobbing, keine Diskriminierung, kein Hass.',
        'Provokationen, Beleidigungen oder absichtliche Störungen sind verboten.',
        'Diskriminierende oder beleidigende Inhalte werden nicht toleriert.',
        'Toxisches Verhalten, Trolling oder passiv-aggressives Auftreten ist unerwünscht.',
        'Respektiere die Meinungen anderer, auch wenn du anderer Ansicht bist.'
      ]},
      { title: '§3 Sprache & Inhalte', rules: [
        'Inhalte müssen jugendfreundlich und gesetzeskonform sein.',
        'Kein NSFW-/18+ Material, keine extremistischen oder illegalen Inhalte.',
        'Werbung oder Spam sind nur mit ausdrücklicher Erlaubnis der Serverleitung erlaubt.',
        'Keine Kettenbriefe, Pyramid-Schemes oder dubiose Angebote.',
        'Die Serversprache ist Deutsch und Englisch.'
      ]},
      { title: '§4 Sicherheit & Datenschutz', rules: [
        'Veröffentliche keine privaten Daten (eigene oder fremde) ohne Einverständnis.',
        'Betrug, Phishing oder das Teilen schadhafter Dateien ist strengstens untersagt.',
        'Screenshots oder Aufnahmen von privaten Gesprächen dürfen nur mit Erlaubnis geteilt werden.',
        'Teile niemals Passwörter, API-Keys oder andere sensible Daten in öffentlichen Kanälen.',
        'Melde verdächtige Accounts oder Nachrichten sofort dem Serverteam.'
      ]},
      { title: '§5 Kanäle & Themen', rules: [
        'Nutze die Kanäle nur für ihren vorgesehenen Zweck.',
        'Achte auf die Kanalbeschreibungen und halte dich an vorgegebene Themen.',
        'Spam, Flooding oder unnötiges Pingen anderer Nutzer ist zu unterlassen.',
        'Vermeide Off-Topic Diskussionen – nutze dafür den passenden Kanal.',
        'Keine übermäßige Verwendung von Caps-Lock, Emojis oder Stickern.'
      ]},
      { title: '§6 Support & Projekte', rules: [
        'Beschreibe dein Anliegen im Ticket so genau wie möglich, damit wir dir schnell helfen können.',
        'Hab Geduld – unser Team bearbeitet Anfragen so schnell wie möglich.',
        'Spam in DMs an Teammitglieder ist verboten. Nutze das Ticketsystem.',
        'Öffne pro Anliegen nur ein Ticket. Doppelte Tickets werden geschlossen.',
        'Lies dir die FAQ und bestehende Informationen durch, bevor du ein Ticket erstellst.',
        'Bezahlte Projekte unterliegen separaten Vereinbarungen und AGB.'
      ]},
      { title: '§7 Geistiges Eigentum', rules: [
        'Respektiere das geistige Eigentum anderer – kein Kopieren oder Weitergeben fremder Arbeiten.',
        'Teile keinen Code, Designs oder Dateien, die du nicht besitzt oder weitergeben darfst.',
        'Von uns erstellte Projekte unterliegen unseren Lizenzbedingungen.',
        'Bei Open-Source-Projekten sind die jeweiligen Lizenzen zu beachten.'
      ]},
      { title: '§8 Voice-Kanäle', rules: [
        'Kein Soundboard-Spam, Stimmverzerrer-Missbrauch oder absichtliche Störgeräusche.',
        'Respektiere laufende Gespräche und frag bevor du mitmachst.',
        'Streame keine urheberrechtlich geschützten Inhalte.'
      ]},
      { title: '§9 Team & Entscheidungen', rules: [
        'Den Anweisungen des Serverteams ist Folge zu leisten.',
        'Entscheidungen des Teams sind bindend und nicht öffentlich zu diskutieren.',
        'Bei Problemen kann jederzeit ein Teammitglied per Ticket kontaktiert werden.',
        'Impersonation von Teammitgliedern oder anderen Nutzern ist verboten.'
      ]},
      { title: '§10 Sanktionen', rules: [
        'Regelverstöße können zu Verwarnungen, Mutes, Kicks oder permanenten Bans führen.',
        'Die Art der Sanktion liegt im Ermessen des Serverteams.',
        'Wiederholte Verstöße führen zu einer dauerhaften Entfernung vom Server.',
        'Umgehung von Sanktionen (z.B. mit Alt-Accounts) führt zu einem permanenten Ban.',
        'Falsche Anschuldigungen gegenüber anderen Nutzern oder dem Team werden ebenfalls sanktioniert.'
      ]}
    ]
  }),
  msg_social: JSON.stringify({
    title: '🌐 Social Media & Kontakt',
    description: 'Hier findest du alle wichtigen Links, um mit mir in Kontakt zu treten oder meine Arbeit zu verfolgen.',
    links: [
      { emoji: '💬', name: 'Discord', url: 'https://discord.com/users/388425445793857559', description: 'Direkter Kontakt via Discord' },
      { emoji: '🐙', name: 'GitHub', url: 'https://github.com/Mas0n1x', description: 'Open-Source Projekte & Code' },
      { emoji: '📧', name: 'E-Mail', url: 'mailto:support@mas0n1x.online', description: 'Geschäftliche Anfragen per E-Mail' },
      { emoji: '🌍', name: 'Portfolio', url: 'https://mas0n1x.dev', description: 'Mein Portfolio mit allen Projekten' },
    ]
  }),
  msg_products: JSON.stringify([
    { emoji: '💻', name: 'Web-Entwicklung', price: 'ab 499€', color: '#00ff88', description: 'Moderne, responsive Websites und Web-Applikationen mit aktuellen Technologien und Best Practices. Von einfachen Landing Pages bis zu komplexen Web-Applikationen mit Admin-Dashboards und Kundenportalen.', features: '➜ Responsive Design für alle Geräte\n➜ SEO-Optimierung & Performance\n➜ Moderne Frameworks & sauberer Code\n➜ Admin-Dashboards & CMS-Integration' },
    { emoji: '📱', name: 'App-Entwicklung', price: 'ab 799€', color: '#00d4ff', description: 'Native und Cross-Platform Apps mit intuitiver User Experience. Individuell entwickelte Anwendungen für Desktop und Mobile, zugeschnitten auf deine Bedürfnisse.', features: '➜ Cross-Platform Kompatibilität\n➜ Intuitive Benutzeroberfläche\n➜ Offline-Funktionalität\n➜ Push-Benachrichtigungen & Updates' },
    { emoji: '🤖', name: 'Discord Bots', price: 'ab 199€', color: '#a855f7', description: 'Maßgeschneiderte Discord Bot Entwicklung für Moderation, Unterhaltung und Verwaltung. Von einfachen Utility-Bots bis zu komplexen Systemen mit Datenbank-Anbindung.', features: '➜ Moderation & Auto-Moderation\n➜ Ticket- & Supportsysteme\n➜ Custom Commands & Interaktionen\n➜ Dashboard & Web-Interface' },
    { emoji: '⚙️', name: 'Backend-Systeme', price: 'ab 599€', color: '#ffaa00', description: 'Skalierbare APIs, Datenbanken und Server-Infrastruktur. Robuste Backend-Lösungen die zuverlässig und performant arbeiten.', features: '➜ REST & GraphQL APIs\n➜ Datenbank-Design & Optimierung\n➜ Docker & Server-Setup\n➜ Monitoring & Wartung' },
    { emoji: '🎨', name: 'Frontend-Systeme', price: 'ab 399€', color: '#00ff88', description: 'Interaktive Benutzeroberflächen mit modernen Frameworks und sauberem Code. Pixel-perfektes Design mit flüssigen Animationen und optimaler User Experience.', features: '➜ Moderne UI/UX Design\n➜ Animationen & Micro-Interactions\n➜ Barrierefreiheit & Accessibility\n➜ Performance-Optimierung' },
  ]),
  ticket_categories: JSON.stringify([
    { name: 'Allgemeine Frage', emoji: '❓', description: 'Allgemeine Fragen zum Server oder zu Services' },
    { name: 'Projektanfrage', emoji: '📩', description: 'Neue Projektanfrage oder Auftragsarbeit' },
    { name: 'Tech-Support', emoji: '🔧', description: 'Technische Hilfe bei bestehendem Projekt' },
    { name: 'Bug-Report', emoji: '🐛', description: 'Fehler in einem bestehenden Projekt melden' },
  ]),
  ticket_welcome_msg: 'Beschreibe dein Anliegen so detailliert wie möglich.\nEin Teammitglied wird sich so schnell wie möglich bei dir melden.',
  rules_reaction_emoji: '✅',
  welcome_enabled: 'true',
  leave_enabled: 'true',
  modlog_enabled: 'true',
};

// GitHub-API-Helfer (verbatimes Verhalten aus dem Portfolio)
const GH_HEADERS = (token) => ({ 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Mas0n1x-Portfolio' });

async function setupHooksForRepos(bot, token, repos, res) {
  const webhookUrl = bot.getConfig('github_webhook_url') || process.env.PORTFOLIO_WEBHOOK_URL || '';
  const secret = bot.getConfig('github_webhook_secret') || '';
  const results = { added: [], skipped: [], failed: [] };
  for (const repo of repos) {
    try {
      const hooksRes = await fetch(`https://api.github.com/repos/${repo.full_name}/hooks`, { headers: GH_HEADERS(token) });
      if (hooksRes.ok) {
        const hooks = await hooksRes.json();
        if (hooks.some(h => h.config?.url === webhookUrl)) { results.skipped.push(repo.full_name); continue; }
      }
      const createRes = await fetch(`https://api.github.com/repos/${repo.full_name}/hooks`, {
        method: 'POST',
        headers: { ...GH_HEADERS(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'web', active: true,
          events: ['push', 'release', 'issues', 'pull_request'],
          config: { url: webhookUrl, content_type: 'json', secret: secret || undefined, insecure_ssl: '0' }
        })
      });
      if (createRes.ok || createRes.status === 201) results.added.push(repo.full_name);
      else { const err = await createRes.json().catch(() => ({})); results.failed.push({ repo: repo.full_name, error: err.message || createRes.statusText }); }
    } catch (e) {
      results.failed.push({ repo: repo.full_name, error: e.message });
    }
  }
  return results;
}

/**
 * @param {import('./DiscordBot.js')} bot – Instanz des Portfolio-Bots
 */
function createPortfolioRouter(bot) {
  const router = express.Router();

  // ── Config ────────────────────────────────────────────────────────
  router.get('/config', (req, res) => {
    try {
      const config = bot.getAllConfig();
      delete config.bot_token;
      delete config.homelab_password;
      config.has_token = !!(process.env.DISCORD_BOT_TOKEN || bot.getConfig('bot_token'));
      config.has_homelab_password = !!(process.env.HOMELAB_PASSWORD || bot.getConfig('homelab_password'));
      res.json(config);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/reset-defaults', (req, res) => {
    try { bot.saveAllConfig(RESET_DEFAULTS); res.json({ success: true }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/config', (req, res) => {
    try {
      const config = { ...req.body };
      if (config.bot_token) { bot.setConfig('bot_token', config.bot_token); delete config.bot_token; }
      if (config.homelab_password === '' || config.homelab_password === undefined) delete config.homelab_password;
      bot.saveAllConfig(config);

      const serversKeys = ['channel_servers', 'servers_refresh_seconds', 'servers_autorefresh_enabled', 'homelab_api_url', 'homelab_user', 'homelab_password'];
      if (serversKeys.some(k => k in config) && bot.isConnected) { bot._homelabToken = null; bot._startServersRefresh(); }

      const mcKeys = ['mc_server_ip', 'mc_map_url', 'mc_refresh_seconds', 'mc_autorefresh_enabled'];
      if (mcKeys.some(k => k in config) && bot.isConnected) bot._startMinecraftRefresh();

      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Lifecycle / Status ──────────────────────────────────────────────
  router.get('/status', (req, res) => {
    try { res.json(bot.getStatus()); } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/connect', async (req, res) => {
    try { await bot.start(); bot.setConfig('bot_enabled', 'true'); res.json({ success: true, status: bot.getStatus() }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/disconnect', async (req, res) => {
    try { await bot.stop(); bot.setConfig('bot_enabled', 'false'); res.json({ success: true }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Content senden ──────────────────────────────────────────────────
  router.post('/send-welcome-test', async (req, res) => {
    try {
      const channelId = req.body.channelId || bot.getConfig('channel_welcome');
      if (!channelId) return res.status(400).json({ error: 'Kein Channel konfiguriert' });
      const messageId = await bot.sendWelcomeTest(channelId);
      res.json({ success: true, messageId });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/send-products', async (req, res) => {
    try {
      const channelId = req.body.channelId || bot.getConfig('channel_products');
      if (!channelId) return res.status(400).json({ error: 'Kein Channel konfiguriert' });
      const messageIds = await bot.sendProductEmbeds(channelId);
      res.json({ success: true, messageIds });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/send-active-projects', async (req, res) => {
    try {
      const channelId = req.body.channelId || bot.getConfig('channel_projects');
      if (!channelId) return res.status(400).json({ error: 'Kein Channel konfiguriert' });
      const messageIds = await bot.sendActiveProjectsEmbed(channelId);
      res.json({ success: true, messageIds });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/send-servers', async (req, res) => {
    try {
      const channelId = req.body.channelId || bot.getConfig('channel_servers');
      if (!channelId) return res.status(400).json({ error: 'Kein Channel konfiguriert' });
      const messageIds = await bot.sendServersEmbed(channelId);
      res.json({ success: true, messageIds });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/servers-test', async (req, res) => {
    try { const servers = await bot.fetchHomelabServers(); res.json({ success: true, count: servers.length, servers }); }
    catch (e) { res.status(502).json({ success: false, error: e.message }); }
  });

  router.post('/send-social', async (req, res) => {
    try {
      const channelId = req.body.channelId || bot.getConfig('channel_social');
      if (!channelId) return res.status(400).json({ error: 'Kein Channel konfiguriert' });
      const messageId = await bot.sendSocialEmbed(channelId);
      res.json({ success: true, messageId });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/send-rules', async (req, res) => {
    try {
      const channelId = req.body.channelId || bot.getConfig('channel_rules');
      if (!channelId) return res.status(400).json({ error: 'Kein Channel konfiguriert' });
      const messageId = await bot.sendRulesEmbed(channelId);
      res.json({ success: true, messageId });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/send-ticket-panel', async (req, res) => {
    try {
      const channelId = req.body.channelId;
      if (!channelId) return res.status(400).json({ error: 'Kein Channel angegeben' });
      const messageId = await bot.createTicketPanel(channelId);
      res.json({ success: true, messageId });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Logs ─────────────────────────────────────────────────────────────
  router.get('/logs', (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;
      const type = req.query.type || null;
      res.json(bot.getLogs(limit, offset, type));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.delete('/logs', (req, res) => {
    try { bot.clearLogs(); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── GitHub-Webhooks einrichten ─────────────────────────────────────────
  router.post('/github-setup-all', async (req, res) => {
    try {
      let { token } = req.body;
      token = process.env.GITHUB_TOKEN || (token && token.trim());
      if (!token) return res.status(400).json({ error: 'Kein GITHUB_TOKEN in der .env und kein Token angegeben' });

      let allRepos = [], page = 1;
      while (true) {
        const repoRes = await fetch(`https://api.github.com/user/repos?per_page=100&page=${page}&affiliation=owner`, { headers: GH_HEADERS(token) });
        if (!repoRes.ok) {
          const err = await repoRes.json().catch(() => ({}));
          const gs = (repoRes.status === 401 || repoRes.status === 403) ? 502 : repoRes.status;
          return res.status(gs).json({ error: `GitHub API Fehler: ${err.message || repoRes.statusText}` });
        }
        const repos = await repoRes.json();
        if (repos.length === 0) break;
        allRepos = allRepos.concat(repos); page++;
      }

      const results = await setupHooksForRepos(bot, token, allRepos, res);
      bot.setConfig('github_token', token);
      res.json({ success: true, total: allRepos.length, ...results });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/github-setup-orgs', async (req, res) => {
    try {
      const { token, orgs } = req.body;
      if (!token) return res.status(400).json({ error: 'GitHub Token fehlt' });
      if (!orgs || !Array.isArray(orgs) || orgs.length === 0) return res.status(400).json({ error: 'Keine Organisationen angegeben' });

      let allRepos = [];
      for (const org of orgs) {
        let page = 1;
        while (true) {
          const repoRes = await fetch(`https://api.github.com/orgs/${encodeURIComponent(org)}/repos?per_page=100&page=${page}`, { headers: GH_HEADERS(token) });
          if (!repoRes.ok) {
            const err = await repoRes.json().catch(() => ({}));
            const gs2 = (repoRes.status === 401 || repoRes.status === 403) ? 502 : repoRes.status;
            return res.status(gs2).json({ error: `GitHub API Fehler für ${org}: ${err.message || repoRes.statusText}` });
          }
          const repos = await repoRes.json();
          if (repos.length === 0) break;
          allRepos = allRepos.concat(repos); page++;
        }
      }

      const results = await setupHooksForRepos(bot, token, allRepos, res);
      bot.setConfig('github_token', token);
      bot.setConfig('github_orgs', JSON.stringify(orgs));
      res.json({ success: true, total: allRepos.length, orgCount: orgs.length, ...results });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/github-repos', async (req, res) => {
    try {
      const token = bot.getConfig('github_token');
      if (!token) return res.status(400).json({ error: 'GitHub Token fehlt – bitte zuerst GitHub einrichten.' });

      let allRepos = [], page = 1;
      while (true) {
        const r = await fetch(`https://api.github.com/user/repos?per_page=100&page=${page}&affiliation=owner`, { headers: GH_HEADERS(token) });
        if (!r.ok) { const err = await r.json().catch(() => ({})); return res.status(r.status).json({ error: `GitHub API Fehler: ${err.message || r.statusText}` }); }
        const repos = await r.json();
        if (repos.length === 0) break;
        allRepos = allRepos.concat(repos); page++;
      }

      const orgs = (() => { try { return JSON.parse(bot.getConfig('github_orgs') || '[]'); } catch { return []; } })();
      for (const org of orgs) {
        let p = 1;
        while (true) {
          const r = await fetch(`https://api.github.com/orgs/${encodeURIComponent(org)}/repos?per_page=100&page=${p}`, { headers: GH_HEADERS(token) });
          if (!r.ok) break;
          const repos = await r.json();
          if (!Array.isArray(repos) || repos.length === 0) break;
          allRepos = allRepos.concat(repos); p++;
        }
      }

      const selected = (() => { try { return JSON.parse(bot.getConfig('github_repos')); } catch { return null; } })();
      const selectAll = !Array.isArray(selected);
      const seen = new Set(), list = [];
      for (const repo of allRepos) {
        if (seen.has(repo.full_name)) continue;
        seen.add(repo.full_name);
        list.push({ full_name: repo.full_name, name: repo.name, private: !!repo.private, archived: !!repo.archived, selected: selectAll ? true : selected.includes(repo.full_name) });
      }
      list.sort((a, b) => a.full_name.localeCompare(b.full_name));
      res.json({ repos: list, selectAll, total: list.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Business-Events aus dem Portfolio (Outbound-Webhook des Portfolios) ──
  // Ersetzt die früheren in-process Hooks (neue Anfrage / Bewertung / Nachricht).
  router.post('/events', async (req, res) => {
    try {
      const { type } = req.body || {};
      if (type === 'request') {
        await bot.sendRequestNotification(req.body.request || {}, req.body.customer || {});
      } else if (type === 'alert') {
        await bot.sendAlert(req.body.title, req.body.description);
      } else {
        return res.status(400).json({ error: 'Unbekannter Event-Typ' });
      }
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
}

// ── Öffentlicher GitHub-Webhook-Handler (kein Bearer, HMAC-signiert) ──
function createGithubWebhookHandler(bot) {
  return (req, res) => {
    try {
      const secret = bot.getConfig('github_webhook_secret') || process.env.GITHUB_WEBHOOK_SECRET;
      if (!secret || !req.rawBody) return res.status(401).json({ error: 'Webhook nicht konfiguriert' });

      const signature = req.headers['x-hub-signature-256'];
      if (!signature) return res.status(401).json({ error: 'Missing signature' });

      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(req.rawBody);
      const expected = 'sha256=' + hmac.digest('hex');
      const sigBuf = Buffer.from(signature), expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const event = req.headers['x-github-event'];
      const payload = req.body;
      if (!event || !payload) return res.status(400).json({ error: 'Invalid webhook payload' });

      bot.sendGitHubNotification(payload, event);
      res.status(200).json({ received: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  };
}

module.exports = { createPortfolioRouter, createGithubWebhookHandler };
