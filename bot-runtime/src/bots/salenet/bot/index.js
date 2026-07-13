const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');
const Settings = require('../models/Settings');
const { setStatus, state } = require('./state');
const { logEvent } = require('./logger');
const events = require('./events');

let connecting = false;

// Token pro Bot: aus den Settings (über die Dashboard-Oberfläche gesetzt) oder
// aus einem SaleNet-EIGENEN Env — NICHT aus dem gemeinsamen DISCORD_BOT_TOKEN,
// da im selben Prozess auch der Portfolio-Bot läuft.
const getToken = () =>
    (Settings.get('discord_bot_token') || process.env.SALENET_DISCORD_BOT_TOKEN || '').trim();

const buildClient = () => {
    return new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent
        ],
        partials: [Partials.Channel, Partials.Message]
    });
};

const renderTemplate = (tpl, vars) => {
    if (!tpl) return null;
    return tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
};

const sendToChannel = async (channelId, content) => {
    if (!state.client || state.status !== 'online' || !channelId) return false;
    try {
        const channel = await state.client.channels.fetch(channelId);
        if (!channel || !channel.isTextBased()) return false;
        await channel.send(content);
        return true;
    } catch (err) {
        console.error('[BOT] sendToChannel failed:', err.message);
        return false;
    }
};

const start = async () => {
    const token = getToken();
    if (!token) {
        setStatus('disabled', { lastError: 'Kein Bot-Token gesetzt (Settings: discord_bot_token)' });
        return { ok: false, reason: 'token_missing' };
    }
    if (state.status === 'online' || state.status === 'connecting' || connecting) {
        return { ok: true, reason: 'already_running' };
    }

    connecting = true;
    setStatus('connecting', { lastError: null });

    const client = buildClient();
    setStatus('connecting', { client });

    events.register(client);

    client.once(Events.ClientReady, async (c) => {
        try {
            const guildId = Settings.get('discord_guild_id');
            let guild = null;
            if (guildId) {
                try {
                    guild = await c.guilds.fetch(guildId);
                } catch (e) {
                    console.warn('[BOT] guildId in settings, but guild not reachable:', e.message);
                }
            } else if (c.guilds.cache.size === 1) {
                guild = c.guilds.cache.first();
                Settings.set('discord_guild_id', guild.id);
            }

            setStatus('online', {
                startedAt: Date.now(),
                lastError: null,
                guild
            });
            logEvent('BOT_READY', { user: c.user.tag, guild: guild?.name || null });
            console.log(`[BOT] Online als ${c.user.tag}${guild ? ' in ' + guild.name : ''}`);

            // Slash-Commands für den Guild registrieren
            if (guild) {
                try {
                    const { registerForGuild } = require('./commands/register');
                    await registerForGuild(guild);
                } catch (e) {
                    console.warn('[BOT] Slash-Command-Registration übersprungen:', e.message);
                }
            }
        } catch (err) {
            setStatus('error', { lastError: err.message });
        } finally {
            connecting = false;
        }
    });

    client.on(Events.Error, (err) => {
        console.error('[BOT] Error:', err.message);
        setStatus('error', { lastError: err.message });
        logEvent('BOT_ERROR', { message: err.message });
    });

    try {
        await client.login(token);
        return { ok: true };
    } catch (err) {
        connecting = false;
        setStatus('error', { lastError: err.message });
        logEvent('BOT_LOGIN_FAILED', { message: err.message });
        console.error('[BOT] Login failed:', err.message);
        return { ok: false, reason: 'login_failed', error: err.message };
    }
};

const stop = async () => {
    if (!state.client) {
        setStatus('offline');
        return { ok: true };
    }
    try {
        await state.client.destroy();
    } catch (err) {
        console.error('[BOT] destroy failed:', err.message);
    }
    setStatus('offline', { client: null, guild: null, startedAt: null });
    logEvent('BOT_STOPPED');
    return { ok: true };
};

const restart = async () => {
    await stop();
    return start();
};

// Initial start beim Server-Boot (silent wenn kein Token)
const init = () => {
    const token = getToken();
    if (!token) {
        setStatus('disabled', { lastError: 'Kein Token konfiguriert' });
        console.log('[BOT] SaleNet-Bot deaktiviert (kein Token in Settings/Env)');
        return;
    }
    start().catch(err => {
        console.error('[BOT] init failed:', err.message);
    });
};

module.exports = { start, stop, restart, init, sendToChannel, renderTemplate };
