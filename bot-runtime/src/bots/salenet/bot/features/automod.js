const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../config/db');
const Settings = require('../../models/Settings');
const { recordAction } = require('./moderation');

// In-Memory Spam-Counter: userId -> [timestamps]
const spamTracker = new Map();
const SPAM_WINDOW_MS = 8000;
const INVITE_REGEX = /(discord\.gg\/|discordapp\.com\/invite\/|discord\.com\/invite\/)[a-z0-9-]+/i;

const getRules = () => {
    return db.prepare(`SELECT * FROM automod_rules WHERE is_active = 1`).all();
};

const logToChannel = async (guild, embed) => {
    const channelId = Settings.get('discord_log_channel_id');
    if (!channelId) return;
    try {
        const ch = await guild.channels.fetch(channelId);
        if (ch && ch.isTextBased()) await ch.send({ embeds: [embed] });
    } catch (err) {
        console.error('[AUTOMOD] log failed:', err.message);
    }
};

const memberCanBypass = (message) => {
    const m = message.member;
    if (!m) return false;
    return m.permissions.has(PermissionFlagsBits.ManageMessages);
};

const deleteAndWarn = async (message, rule, info) => {
    try { await message.delete(); } catch {}
    const action = rule.action || 'delete';
    const reason = `AutoMod: ${rule.type}${info ? ' (' + info + ')' : ''}`;

    if (action === 'delete_and_warn' || action === 'warn') {
        try { await message.author.send(`Deine Nachricht in **${message.guild.name}** wurde entfernt: ${reason}`); } catch {}
        recordAction({
            action: 'warn',
            target: { id: message.author.id, tag: message.author.tag },
            moderator: { id: message.client.user.id, tag: message.client.user.tag },
            reason
        });
    }

    const embed = new EmbedBuilder()
        .setColor(0xEF4444)
        .setTitle('AutoMod-Treffer')
        .addFields(
            { name: 'User', value: `<@${message.author.id}> (${message.author.tag})`, inline: true },
            { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
            { name: 'Regel', value: rule.type, inline: true },
            { name: 'Inhalt', value: (message.content || '*kein Text*').slice(0, 1000) }
        )
        .setTimestamp();
    await logToChannel(message.guild, embed);
};

const evaluate = async (message) => {
    if (memberCanBypass(message)) return;
    const rules = getRules();
    if (!rules.length) return;
    const content = (message.content || '').toLowerCase();

    // Word-Filter
    for (const r of rules.filter(r => r.type === 'word' && r.pattern)) {
        const needle = r.pattern.toLowerCase();
        if (content.includes(needle)) {
            return deleteAndWarn(message, r, `Begriff "${r.pattern}"`);
        }
    }

    // Invite-Filter
    if (rules.some(r => r.type === 'invite') && INVITE_REGEX.test(message.content || '')) {
        const r = rules.find(r => r.type === 'invite');
        return deleteAndWarn(message, r, 'Discord-Invite-Link');
    }

    // Spam-Filter (X Nachrichten in Y Sekunden)
    const spamRule = rules.find(r => r.type === 'spam');
    if (spamRule) {
        const threshold = parseInt(spamRule.pattern, 10) || 5;
        const now = Date.now();
        const arr = (spamTracker.get(message.author.id) || []).filter(ts => now - ts < SPAM_WINDOW_MS);
        arr.push(now);
        spamTracker.set(message.author.id, arr);
        if (arr.length >= threshold) {
            spamTracker.set(message.author.id, []);
            return deleteAndWarn(message, spamRule, `${arr.length} msg/${SPAM_WINDOW_MS / 1000}s`);
        }
    }
};

module.exports = { evaluate };
