const db = require('../config/db');
const Settings = require('../models/Settings');
const bot = require('../bot');
const { getStatus, state } = require('../bot/state');
const discordNotifier = require('../services/discordNotifier');
const { auditFromReq } = require('../utils/auditLogger');

// Liste der Bot-spezifischen Setting-Keys (alles, was im Admin-UI editierbar ist)
const BOT_SETTING_KEYS = [
    'discord_guild_id',
    'discord_welcome_channel_id',
    'discord_welcome_message',
    'discord_leave_channel_id',
    'discord_leave_message',
    'discord_log_channel_id',
    'discord_notify_orders_channel_id',
    'discord_notify_contacts_channel_id',
    'discord_notify_affiliates_channel_id',
    'discord_notify_incidents_channel_id',
    'discord_ticket_category_id',
    'discord_ticket_support_role_id'
];

exports.getStatusInfo = (req, res) => {
    try {
        const status = getStatus();
        const tokenConfigured = !!(process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_BOT_TOKEN.trim());
        res.json({ ...status, token_configured: tokenConfigured });
    } catch (err) {
        console.error('[bot/status]', err);
        res.status(500).json({ error: 'Status failed' });
    }
};

exports.getConfig = (req, res) => {
    try {
        const all = Settings.getAll();
        const cfg = {};
        for (const key of BOT_SETTING_KEYS) {
            cfg[key] = all[key] || '';
        }
        res.json(cfg);
    } catch (err) {
        console.error('[bot/config-get]', err);
        res.status(500).json({ error: 'Config-Read failed' });
    }
};

exports.updateConfig = (req, res) => {
    try {
        const updates = {};
        for (const key of BOT_SETTING_KEYS) {
            if (key in req.body) updates[key] = String(req.body[key] || '');
        }
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'Keine Felder im Body' });
        }
        Settings.setMultiple(updates);
        auditFromReq(req, 'BOT_CONFIG_UPDATE', { keys: Object.keys(updates) });
        res.json({ success: true });
    } catch (err) {
        console.error('[bot/config-put]', err);
        res.status(500).json({ error: 'Config-Update failed' });
    }
};

exports.start = async (req, res) => {
    try {
        const result = await bot.start();
        auditFromReq(req, 'BOT_START', result);
        res.json(result);
    } catch (err) {
        console.error('[bot/start]', err);
        res.status(500).json({ error: err.message });
    }
};

exports.stop = async (req, res) => {
    try {
        const result = await bot.stop();
        auditFromReq(req, 'BOT_STOP', result);
        res.json(result);
    } catch (err) {
        console.error('[bot/stop]', err);
        res.status(500).json({ error: err.message });
    }
};

exports.restart = async (req, res) => {
    try {
        const result = await bot.restart();
        auditFromReq(req, 'BOT_RESTART', result);
        res.json(result);
    } catch (err) {
        console.error('[bot/restart]', err);
        res.status(500).json({ error: err.message });
    }
};

exports.listLogs = (req, res) => {
    try {
        const eventType = req.query.event_type;
        let rows;
        if (eventType) {
            rows = db.prepare(`SELECT * FROM bot_logs WHERE event_type = ? ORDER BY created_at DESC LIMIT 200`).all(eventType);
        } else {
            rows = db.prepare(`SELECT * FROM bot_logs ORDER BY created_at DESC LIMIT 200`).all();
        }
        res.json(rows);
    } catch (err) {
        console.error('[bot/logs]', err);
        res.status(500).json({ error: 'Logs-Fetch failed' });
    }
};

// Listet Text-Channels des aktuellen Guild (für Channel-Picker im UI)
exports.listChannels = async (req, res) => {
    try {
        if (!state.client || state.status !== 'online' || !state.guild) {
            return res.status(503).json({ error: 'Bot ist nicht online' });
        }
        const channels = await state.guild.channels.fetch();
        const list = channels
            .filter(c => c && c.isTextBased && c.isTextBased() && !c.isThread())
            .map(c => ({ id: c.id, name: c.name, parent_id: c.parentId }))
            .sort((a, b) => a.name.localeCompare(b.name));
        res.json(list);
    } catch (err) {
        console.error('[bot/channels]', err);
        res.status(500).json({ error: err.message });
    }
};

exports.testNotify = async (req, res) => {
    try {
        const { channel_id } = req.body;
        if (!channel_id) return res.status(400).json({ error: 'channel_id erforderlich' });
        await discordNotifier.sendTestNotification(channel_id);
        auditFromReq(req, 'BOT_TEST_NOTIFY', { channel_id });
        res.json({ success: true });
    } catch (err) {
        console.error('[bot/test-notify]', err);
        res.status(400).json({ error: err.message });
    }
};
