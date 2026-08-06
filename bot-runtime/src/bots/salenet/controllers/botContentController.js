// SaleNet -> Admin-Endpunkte für den Discord Content-Poster
// Verwaltet Konfiguration (Regeln/Links/Titel/Channels) und loest das Posten aus.

const Settings = require('../models/Settings');
const contentPoster = require('../services/contentPoster');
const { auditFromReq } = require('../utils/auditLogger');

// Alle im Admin-UI editierbaren Content-Setting-Keys
const CONTENT_SETTING_KEYS = [
    'content_rules_title',
    'content_rules_text',
    'content_rules_channel_id',
    'content_products_channel_id',
    'content_links_title',
    'content_links_text',
    'content_links_channel_id',
    'content_status_title',
    'content_status_channel_id',
    'content_status_auto'
];

// Sinnvolle Vorbelegung beim allerersten Aufruf (leere Settings)
const DEFAULTS = {
    content_rules_title: '📜 Server-Regeln',
    content_links_title: '🔗 Wichtige Links',
    content_status_title: '📡 SaleNet — Systemstatus',
    content_links_text: [
        '🌐 Website | https://lawnet.sale',
        '🛒 Shop & Preise | https://lawnet.sale/#preise',
        '📊 Live-Status | https://lawnet.sale/status',
        '💬 Discord | https://discord.gg/mM9szM84qt'
    ].join('\n')
};

exports.getConfig = (req, res) => {
    try {
        const all = Settings.getAll();
        const cfg = {};
        for (const key of CONTENT_SETTING_KEYS) {
            cfg[key] = (all[key] != null && all[key] !== '') ? all[key] : (DEFAULTS[key] || '');
        }
        // content_status_auto als 0/1-String normalisieren
        cfg.content_status_auto = all.content_status_auto === '1' ? '1' : '0';
        cfg.content_status_message_id = all.content_status_message_id || '';
        res.json(cfg);
    } catch (err) {
        console.error('[bot/content-config-get]', err);
        res.status(500).json({ error: 'Config-Read failed' });
    }
};

exports.updateConfig = (req, res) => {
    try {
        const updates = {};
        for (const key of CONTENT_SETTING_KEYS) {
            if (key in req.body) updates[key] = String(req.body[key] == null ? '' : req.body[key]);
        }
        if ('content_status_auto' in updates) {
            updates.content_status_auto = (updates.content_status_auto === '1' || updates.content_status_auto === 'true') ? '1' : '0';
        }
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'Keine Felder im Body' });
        }
        Settings.setMultiple(updates);
        auditFromReq(req, 'BOT_CONTENT_CONFIG_UPDATE', { keys: Object.keys(updates) });
        res.json({ success: true });
    } catch (err) {
        console.error('[bot/content-config-put]', err);
        res.status(500).json({ error: 'Config-Update failed' });
    }
};

// Generischer Post-Handler-Builder
const makePoster = (fn, auditAction) => async (req, res) => {
    try {
        const channelId = req.body && req.body.channel_id ? String(req.body.channel_id) : null;
        const result = await fn(channelId);
        auditFromReq(req, auditAction, { channel_id: channelId || 'default' });
        res.json({ success: true, message_id: result || null });
    } catch (err) {
        console.error(`[${auditAction}]`, err.message);
        res.status(400).json({ error: err.message });
    }
};

exports.postRules = makePoster(contentPoster.postRules, 'BOT_CONTENT_POST_RULES');
exports.postProducts = makePoster(contentPoster.postProducts, 'BOT_CONTENT_POST_PRODUCTS');
exports.postLinks = makePoster(contentPoster.postLinks, 'BOT_CONTENT_POST_LINKS');
exports.postStatus = makePoster(contentPoster.postOrUpdateStatus, 'BOT_CONTENT_POST_STATUS');
