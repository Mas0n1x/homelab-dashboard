const { EmbedBuilder } = require('discord.js');
const crypto = require('crypto');
const db = require('../config/db');
const Settings = require('../models/Settings');
const { state } = require('../bot/state');

const COLORS = {
    push: 0x10B981,
    pull_request: 0x6366F1,
    issues: 0xF59E0B,
    release: 0xF97316,
    star: 0xEAB308,
    fork: 0x8B5CF6
};

// HMAC-SHA256 Signaturprüfung (GitHub-Webhook-Standard)
const verifySignature = (rawBody, signatureHeader, secret) => {
    if (!signatureHeader || !secret) return false;
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(signatureHeader, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) return false;
    try { return crypto.timingSafeEqual(a, b); } catch { return false; }
};

const buildEmbed = (eventType, payload) => {
    const repo = payload.repository?.full_name || 'unknown';
    const repoUrl = payload.repository?.html_url || null;
    const actor = payload.sender?.login || 'unknown';
    const actorUrl = payload.sender?.html_url || null;

    const embed = new EmbedBuilder()
        .setColor(COLORS[eventType] || 0x6B7280)
        .setURL(repoUrl)
        .setTimestamp()
        .setFooter({ text: repo });

    if (eventType === 'push') {
        const branch = (payload.ref || '').replace('refs/heads/', '');
        const commits = payload.commits || [];
        embed.setTitle(`[${repo}] ${commits.length} neue Commit(s) auf ${branch}`);
        embed.setDescription(
            commits.slice(0, 10).map(c => `\`${c.id.slice(0, 7)}\` ${c.message.split('\n')[0]} — *${c.author.name}*`).join('\n') || '*Keine Commits*'
        );
        embed.setAuthor({ name: actor, url: actorUrl });
    } else if (eventType === 'pull_request') {
        const pr = payload.pull_request;
        embed.setTitle(`[${repo}] PR ${payload.action}: #${pr.number} ${pr.title}`);
        embed.setURL(pr.html_url);
        embed.setDescription((pr.body || '').slice(0, 1024));
        embed.setAuthor({ name: pr.user.login, url: pr.user.html_url });
    } else if (eventType === 'issues') {
        const issue = payload.issue;
        embed.setTitle(`[${repo}] Issue ${payload.action}: #${issue.number} ${issue.title}`);
        embed.setURL(issue.html_url);
        embed.setDescription((issue.body || '').slice(0, 1024));
        embed.setAuthor({ name: issue.user.login, url: issue.user.html_url });
    } else if (eventType === 'release') {
        const rel = payload.release;
        embed.setTitle(`[${repo}] Release ${payload.action}: ${rel.name || rel.tag_name}`);
        embed.setURL(rel.html_url);
        embed.setDescription((rel.body || '').slice(0, 1024));
    } else if (eventType === 'star' || eventType === 'fork') {
        embed.setTitle(`[${repo}] ${eventType === 'star' ? '⭐ neuer Star' : '🍴 neuer Fork'} von ${actor}`);
    } else {
        embed.setTitle(`[${repo}] Event: ${eventType}`);
    }
    return embed;
};

const dispatch = async (eventType, payload) => {
    if (!state.client || state.status !== 'online') return;
    const repo = payload.repository?.full_name;
    if (!repo) return;

    const subs = db.prepare(`SELECT * FROM github_subscriptions WHERE repo_full_name = ? AND is_active = 1`).all(repo);
    if (!subs.length) return;

    const embed = buildEmbed(eventType, payload);

    for (const s of subs) {
        let events;
        try { events = JSON.parse(s.events || '[]'); } catch { events = []; }
        if (events.length && !events.includes(eventType)) continue;
        try {
            const ch = await state.client.channels.fetch(s.channel_id);
            if (ch && ch.isTextBased()) await ch.send({ embeds: [embed] });
        } catch (err) {
            console.error('[GH] dispatch failed for sub', s.id, err.message);
        }
    }
};

const webhookHandler = async (req, res) => {
    try {
        const secret = Settings.get('github_webhook_secret') || '';
        const signature = req.headers['x-hub-signature-256'];
        const event = req.headers['x-github-event'];

        if (!secret || !secret.trim()) {
            return res.status(503).json({ error: 'github_webhook_secret nicht konfiguriert' });
        }

        // Raw-Body wird vom mountenden Middleware geliefert (express.raw)
        if (!verifySignature(req.body, signature, secret)) {
            return res.status(401).json({ error: 'Signatur ungueltig' });
        }

        let payload;
        try { payload = JSON.parse(req.body.toString('utf8')); }
        catch { return res.status(400).json({ error: 'Body ist kein JSON' }); }

        if (event === 'ping') return res.json({ pong: true });

        await dispatch(event, payload);
        res.json({ delivered: true });
    } catch (err) {
        console.error('[GH-webhook]', err);
        res.status(500).json({ error: err.message });
    }
};

module.exports = { webhookHandler, verifySignature, dispatch };
