const db = require('../config/db');
const Settings = require('../models/Settings');
const { auditFromReq } = require('../utils/auditLogger');

const GH_SETTING_KEYS = ['github_pat', 'github_org', 'github_webhook_secret'];

exports.getConfig = (req, res) => {
    try {
        const all = Settings.getAll();
        const cfg = {};
        for (const k of GH_SETTING_KEYS) cfg[k] = all[k] || '';
        // PAT nur masked zurückgeben
        if (cfg.github_pat) cfg.github_pat = cfg.github_pat.slice(0, 4) + '...' + cfg.github_pat.slice(-4);
        if (cfg.github_webhook_secret) cfg.github_webhook_secret_set = true;
        else cfg.github_webhook_secret_set = false;
        delete cfg.github_webhook_secret;
        res.json(cfg);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateConfig = (req, res) => {
    try {
        const updates = {};
        for (const k of GH_SETTING_KEYS) {
            if (k in req.body && req.body[k] !== '') updates[k] = String(req.body[k]);
        }
        if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Keine Felder' });
        Settings.setMultiple(updates);
        auditFromReq(req, 'GITHUB_CONFIG_UPDATE', { keys: Object.keys(updates) });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.listSubscriptions = (req, res) => {
    try {
        const rows = db.prepare(`SELECT * FROM github_subscriptions ORDER BY repo_full_name ASC`).all();
        const parsed = rows.map(r => ({ ...r, events: safeJson(r.events) }));
        res.json(parsed);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const safeJson = (s) => { try { return JSON.parse(s || '[]'); } catch { return []; } };

exports.createSubscription = (req, res) => {
    try {
        const { repo_full_name, channel_id, events } = req.body || {};
        if (!repo_full_name || !channel_id) return res.status(400).json({ error: 'repo_full_name + channel_id erforderlich' });
        const eventsArr = Array.isArray(events) ? events : [];
        const info = db.prepare(`INSERT INTO github_subscriptions (repo_full_name, channel_id, events) VALUES (?, ?, ?)`)
            .run(repo_full_name, channel_id, JSON.stringify(eventsArr));
        auditFromReq(req, 'GITHUB_SUB_CREATE', { id: info.lastInsertRowid, repo: repo_full_name });
        res.json({ success: true, id: info.lastInsertRowid });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.updateSubscription = (req, res) => {
    try {
        const { channel_id, events, is_active } = req.body || {};
        db.prepare(`UPDATE github_subscriptions SET
            channel_id = COALESCE(?, channel_id),
            events = COALESCE(?, events),
            is_active = COALESCE(?, is_active) WHERE id = ?`)
            .run(channel_id ?? null, events ? JSON.stringify(events) : null, is_active ?? null, req.params.id);
        auditFromReq(req, 'GITHUB_SUB_UPDATE', { id: Number(req.params.id) });
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.deleteSubscription = (req, res) => {
    try {
        db.prepare(`DELETE FROM github_subscriptions WHERE id = ?`).run(req.params.id);
        auditFromReq(req, 'GITHUB_SUB_DELETE', { id: Number(req.params.id) });
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Liefert die Webhook-URL (zum Anzeigen im Admin)
exports.webhookInfo = (req, res) => {
    const host = req.get('host');
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    res.json({
        url: `${proto}://${host}/api/webhooks/github`,
        content_type: 'application/json',
        signature_header: 'X-Hub-Signature-256',
        events_supported: ['push', 'pull_request', 'issues', 'release', 'star', 'fork']
    });
};
