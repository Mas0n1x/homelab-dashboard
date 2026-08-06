const db = require('../config/db');
const { state } = require('../bot/state');
const moderation = require('../bot/features/moderation');
const tickets = require('../bot/features/tickets');
const { auditFromReq } = require('../utils/auditLogger');

// ===== MOD ACTIONS =====
exports.listModActions = (req, res) => {
    try {
        const action = req.query.action;
        let rows;
        if (action) {
            rows = db.prepare(`SELECT * FROM mod_actions WHERE action = ? ORDER BY created_at DESC LIMIT 200`).all(action);
        } else {
            rows = db.prepare(`SELECT * FROM mod_actions ORDER BY created_at DESC LIMIT 200`).all();
        }
        res.json(rows);
    } catch (err) {
        console.error('[bot/mod-actions]', err);
        res.status(500).json({ error: err.message });
    }
};

exports.executeMod = async (req, res) => {
    try {
        const { action, target_user_id, reason, delete_days } = req.body || {};
        if (!['warn', 'kick', 'ban'].includes(action)) return res.status(400).json({ error: 'Ungueltige Aktion' });
        if (!target_user_id) return res.status(400).json({ error: 'target_user_id erforderlich' });
        if (!reason) return res.status(400).json({ error: 'Grund erforderlich' });

        if (!state.guild || state.status !== 'online') {
            return res.status(503).json({ error: 'Bot ist nicht online' });
        }

        await moderation.remoteAction({
            action,
            guild: state.guild,
            target_user_id,
            moderator_user_id: state.client.user.id,
            reason,
            delete_days: delete_days || 0
        });

        auditFromReq(req, 'BOT_MOD_' + action.toUpperCase(), { target_user_id, reason });
        res.json({ success: true });
    } catch (err) {
        console.error('[bot/mod-exec]', err);
        res.status(400).json({ error: err.message });
    }
};

exports.setSlowmode = async (req, res) => {
    try {
        const { channel_id, seconds } = req.body || {};
        if (!channel_id || seconds == null) return res.status(400).json({ error: 'channel_id + seconds erforderlich' });
        const s = Math.max(0, Math.min(21600, parseInt(seconds, 10) || 0));
        if (!state.guild || state.status !== 'online') return res.status(503).json({ error: 'Bot ist nicht online' });

        const channel = await state.guild.channels.fetch(channel_id);
        if (!channel) return res.status(404).json({ error: 'Channel nicht gefunden' });
        // In der Runtime gibt es keine Session (Bearer-Auth) — req.session.userId
        // hätte hier eine Exception geworfen.
        await channel.setRateLimitPerUser(s, `Slowmode über das Dashboard (${req.session?.userId || 'Admin'})`);

        moderation.recordAction({
            action: 'slowmode',
            target: null,
            moderator: { id: 'dashboard', tag: 'Dashboard' },
            reason: `${s}s`,
            channelId: channel_id,
            metadata: { seconds: s }
        });
        auditFromReq(req, 'BOT_SLOWMODE', { channel_id, seconds: s });
        res.json({ success: true });
    } catch (err) {
        console.error('[bot/slowmode]', err);
        res.status(400).json({ error: err.message });
    }
};

// ===== TICKETS =====
exports.listTickets = (req, res) => {
    try {
        const status = req.query.status;
        let rows;
        if (status) {
            rows = db.prepare(`SELECT id, channel_id, user_id, username, category, status, created_at, closed_at, closed_by FROM tickets WHERE status = ? ORDER BY created_at DESC LIMIT 200`).all(status);
        } else {
            rows = db.prepare(`SELECT id, channel_id, user_id, username, category, status, created_at, closed_at, closed_by FROM tickets ORDER BY created_at DESC LIMIT 200`).all();
        }
        res.json(rows);
    } catch (err) {
        console.error('[bot/tickets]', err);
        res.status(500).json({ error: err.message });
    }
};

exports.getTicketTranscript = (req, res) => {
    try {
        const ticket = db.prepare(`SELECT * FROM tickets WHERE id = ?`).get(req.params.id);
        if (!ticket) return res.status(404).json({ error: 'Ticket nicht gefunden' });
        res.json(ticket);
    } catch (err) {
        console.error('[bot/ticket-transcript]', err);
        res.status(500).json({ error: err.message });
    }
};

exports.forceCloseTicket = async (req, res) => {
    try {
        const ticket = db.prepare(`SELECT * FROM tickets WHERE id = ? AND status = 'open'`).get(req.params.id);
        if (!ticket) return res.status(404).json({ error: 'Kein offenes Ticket' });
        if (!state.guild || state.status !== 'online') return res.status(503).json({ error: 'Bot ist nicht online' });

        const channel = await state.guild.channels.fetch(ticket.channel_id).catch(() => null);
        if (channel) {
            await tickets.closeTicketByChannel(channel, { tag: 'Dashboard' }, req.body?.reason || 'Forced via Dashboard');
        } else {
            db.prepare(`UPDATE tickets SET status='closed', closed_at = CURRENT_TIMESTAMP, closed_by='Dashboard' WHERE id = ?`).run(ticket.id);
        }
        auditFromReq(req, 'BOT_TICKET_CLOSE', { ticket_id: ticket.id });
        res.json({ success: true });
    } catch (err) {
        console.error('[bot/ticket-close]', err);
        res.status(400).json({ error: err.message });
    }
};

// ===== AUTOMOD =====
exports.listAutomod = (req, res) => {
    try {
        const rows = db.prepare(`SELECT * FROM automod_rules ORDER BY type, id`).all();
        res.json(rows);
    } catch (err) {
        console.error('[bot/automod-list]', err);
        res.status(500).json({ error: err.message });
    }
};

exports.createAutomod = (req, res) => {
    try {
        const { type, pattern, action } = req.body || {};
        if (!['word', 'spam', 'invite'].includes(type)) return res.status(400).json({ error: 'Ungueltiger Type' });
        if (!['delete', 'warn', 'delete_and_warn'].includes(action)) return res.status(400).json({ error: 'Ungueltige Action' });
        if (type === 'word' && !pattern) return res.status(400).json({ error: 'pattern für word erforderlich' });
        if (type === 'spam' && !pattern) return res.status(400).json({ error: 'pattern (Threshold) für spam erforderlich' });
        const info = db.prepare(`INSERT INTO automod_rules (type, pattern, action) VALUES (?, ?, ?)`).run(type, pattern || null, action);
        auditFromReq(req, 'AUTOMOD_CREATE', { id: info.lastInsertRowid, type, action });
        res.json({ success: true, id: info.lastInsertRowid });
    } catch (err) {
        console.error('[bot/automod-create]', err);
        res.status(400).json({ error: err.message });
    }
};

exports.updateAutomod = (req, res) => {
    try {
        const { pattern, action, is_active } = req.body || {};
        db.prepare(`UPDATE automod_rules SET pattern = COALESCE(?, pattern), action = COALESCE(?, action), is_active = COALESCE(?, is_active) WHERE id = ?`)
            .run(pattern ?? null, action ?? null, is_active ?? null, req.params.id);
        auditFromReq(req, 'AUTOMOD_UPDATE', { id: Number(req.params.id) });
        res.json({ success: true });
    } catch (err) {
        console.error('[bot/automod-update]', err);
        res.status(400).json({ error: err.message });
    }
};

exports.deleteAutomod = (req, res) => {
    try {
        db.prepare(`DELETE FROM automod_rules WHERE id = ?`).run(req.params.id);
        auditFromReq(req, 'AUTOMOD_DELETE', { id: Number(req.params.id) });
        res.json({ success: true });
    } catch (err) {
        console.error('[bot/automod-delete]', err);
        res.status(400).json({ error: err.message });
    }
};
