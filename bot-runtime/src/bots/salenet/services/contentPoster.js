// SaleNet -> Discord Content-Poster
// Postet kuratierte Inhalte (Regeln, Produkte, Links, Server-Status) in Discord-Channels.
// Regeln/Links/Titel kommen aus den Settings (im Admin pflegbar), Produkte aus der DB,
// der Server-Status ist eine sich selbst aktualisierende ("sticky") Nachricht.

const { EmbedBuilder } = require('discord.js');
const Settings = require('../models/Settings');
const Product = require('../models/Product');
const db = require('../config/db');
const { state } = require('../bot/state');

const PRIMARY = 0xF97316; // Brand-Orange
const SITE_URL_DEFAULT = 'https://lawnet.sale';

// Die globale Sanitize-Middleware escaped ' " ; \ im Body. Für die Discord-Ausgabe
// machen wir das wieder rückgängig, damit Apostrophe & Co. sauber dargestellt werden.
const clean = (s) => (s == null ? '' : String(s).replace(/\\(['";\\])/g, '$1'));

// Häufige HTML-Entities -> echte Zeichen (manche Produktnamen sind als Entities gepflegt).
const decodeEntities = (s) => clean(s)
    .replace(/&auml;/g, 'ä').replace(/&ouml;/g, 'ö').replace(/&uuml;/g, 'ü')
    .replace(/&Auml;/g, 'Ä').replace(/&Ouml;/g, 'Ö').replace(/&Uuml;/g, 'Ü')
    .replace(/&szlig;/g, 'ß').replace(/&euro;/g, '€')
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

const siteUrl = () => (Settings.get('site_url') || SITE_URL_DEFAULT).replace(/\/$/, '');

const fmtPrice = (n) => {
    if (n == null || n === '') return null;
    const num = Number(n);
    if (!Number.isFinite(num)) return null;
    return num.toFixed(2).replace('.', ',') + ' €';
};

// ---------------------------------------------------------------------------
// Embed-Builder
// ---------------------------------------------------------------------------

const buildRulesEmbed = () => {
    const title = decodeEntities(Settings.get('content_rules_title')) || '📜 Server-Regeln';
    const body = decodeEntities(Settings.get('content_rules_text'));
    const embed = new EmbedBuilder()
        .setColor(PRIMARY)
        .setTitle(title.slice(0, 256))
        .setDescription((body || '*Es wurden noch keine Regeln hinterlegt.*').slice(0, 4096))
        .setTimestamp()
        .setFooter({ text: 'LawNet' });
    return embed;
};

const TYPE_LABELS = {
    package: '📦 Pakete',
    module: '🧩 Module',
    addon: '➕ Add-ons',
    service: '🛠️ Services'
};

const buildProductsEmbeds = () => {
    const products = Product.findAll(true); // nur aktive
    if (!products.length) {
        return [new EmbedBuilder()
            .setColor(PRIMARY)
            .setTitle('🛒 Unsere Produkte')
            .setDescription('*Aktuell sind keine Produkte aktiv.*')
            .setTimestamp()];
    }

    // Nach Typ gruppieren (Reihenfolge wie in TYPE_LABELS, Rest hinten)
    const groups = {};
    for (const p of products) {
        const key = p.type || 'sonstige';
        (groups[key] = groups[key] || []).push(p);
    }
    const orderedTypes = [
        ...Object.keys(TYPE_LABELS).filter(t => groups[t]),
        ...Object.keys(groups).filter(t => !(t in TYPE_LABELS))
    ];

    const url = siteUrl();
    const embeds = [];
    for (const type of orderedTypes) {
        const list = groups[type].slice(0, 25); // Discord: max 25 Fields
        const label = TYPE_LABELS[type] || ('🔹 ' + type.charAt(0).toUpperCase() + type.slice(1));
        const embed = new EmbedBuilder()
            .setColor(PRIMARY)
            .setTitle(label)
            // Eindeutige URL je Typ: Discord fasst mehrere Embeds einer Nachricht
            // mit identischer URL sonst zu einem zusammen (nur das erste bliebe sichtbar).
            .setURL(`${url}/?cat=${encodeURIComponent(type)}#preise`);

        for (const p of list) {
            const monthly = fmtPrice(p.monthly_price);
            const yearly = fmtPrice(p.yearly_price);
            const priceLine = monthly
                ? `**${monthly}**/Monat` + (yearly ? ` · ${yearly}/Jahr` : '')
                : (yearly ? `**${yearly}**/Jahr` : '*Preis auf Anfrage*');
            const desc = decodeEntities(p.description).slice(0, 180);
            const icon = (p.icon && /\p{Emoji}/u.test(p.icon)) ? p.icon + ' ' : '';
            const value = `${desc ? desc + '\n' : ''}${priceLine}\n[Zum Shop](${url}/#preise)`;
            embed.addFields({ name: `${icon}${decodeEntities(p.name)}`.slice(0, 256), value: value.slice(0, 1024) });
        }
        embed.setTimestamp().setFooter({ text: 'LawNet — ' + url.replace(/^https?:\/\//, '') });
        embeds.push(embed);
    }
    return embeds.slice(0, 10); // Discord: max 10 Embeds pro Nachricht
};

// Parst die Links-Setting: eine Zeile je Link im Format
// "Label | https://url"  oder  "Label | https://url | optionale Beschreibung".
const parseLinks = () => {
    const raw = decodeEntities(Settings.get('content_links_text'));
    if (!raw.trim()) return [];
    return raw.split('\n').map(line => {
        if (!line.trim()) return null;
        const parts = line.split('|').map(s => s.trim());
        const [label, href, desc] = [parts[0], parts[1], parts.slice(2).join(' | ').trim()];
        if (!label || !/^https?:\/\//i.test(href || '')) return null;
        return { label, href, desc };
    }).filter(Boolean);
};

const buildLinksEmbed = () => {
    const title = decodeEntities(Settings.get('content_links_title')) || '🔗 Wichtige Links';
    const links = parseLinks();
    const embed = new EmbedBuilder()
        .setColor(PRIMARY)
        .setTitle(title.slice(0, 256))
        .setTimestamp()
        .setFooter({ text: 'LawNet — ' + siteUrl().replace(/^https?:\/\//, '') });

    if (!links.length) {
        embed.setDescription('*Es wurden noch keine Links hinterlegt.*');
        return embed;
    }
    // Schönere Darstellung: fett verlinktes Label, optional Beschreibung darunter,
    // Leerzeile zwischen den Einträgen.
    const desc = links.map(l => l.desc
        ? `**[${l.label}](${l.href})**\n${l.desc}`
        : `**[${l.label}](${l.href})**`
    ).join('\n\n');
    embed.setDescription(desc.slice(0, 4096));
    return embed;
};

const formatUptime = (secs) => {
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return `${Math.floor(secs)}s`;
};

// Server-Status = Health der SaleNet-Plattform (nicht der FiveM-Server).
const buildStatusEmbed = () => {
    const title = decodeEntities(Settings.get('content_status_title')) || '📡 SaleNet — Systemstatus';

    // DB-Check
    let dbOk = false;
    try { db.prepare('SELECT 1').get(); dbOk = true; } catch { dbOk = false; }

    const stripeOk = !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.trim());
    const webhookOk = !!(process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_WEBHOOK_SECRET.trim());
    const botOnline = state.status === 'online';

    // Offene Incidents (status_incidents ohne resolved_at)
    let openIncidents = [];
    try {
        openIncidents = db.prepare(
            `SELECT title, severity, status FROM status_incidents WHERE resolved_at IS NULL ORDER BY started_at DESC LIMIT 5`
        ).all();
    } catch { openIncidents = []; }

    const operational = dbOk && stripeOk && webhookOk && botOnline && openIncidents.length === 0;
    const hasMajor = openIncidents.some(i => i.severity === 'major');

    // Gesamtstatus als Ampel-Headline
    const headline = operational
        ? '🟢  **Alle Systeme betriebsbereit**'
        : hasMajor
            ? '🔴  **Größere Störung**'
            : '🟡  **Eingeschränkter Betrieb**';

    const embed = new EmbedBuilder()
        .setColor(operational ? 0x22C55E : (hasMajor ? 0xDC2626 : 0xF59E0B))
        .setTitle(title.slice(0, 256))
        .setDescription(`${headline}\n​`)
        .addFields(
            { name: '🌐 Website & API', value: dbOk ? '🟢 Betriebsbereit' : '🔴 Gestört', inline: true },
            { name: '💳 Zahlungen', value: stripeOk ? (webhookOk ? '🟢 Aktiv' : '🟡 Ohne Webhook') : '🔴 Deaktiviert', inline: true },
            { name: '🤖 Discord-Bot', value: botOnline ? '🟢 Online' : `🔴 ${state.status || 'Offline'}`, inline: true },
            { name: '🗄️ Datenbank', value: dbOk ? '🟢 Erreichbar' : '🔴 Fehler', inline: true },
            { name: '⏱️ Laufzeit', value: formatUptime(process.uptime()), inline: true },
            { name: '📊 Status-Seite', value: `[Öffnen](${siteUrl()}/status)`, inline: true }
        );

    if (openIncidents.length) {
        embed.addFields({
            name: '⚠️ Aktive Störungen',
            value: openIncidents.map(i => `• **${decodeEntities(i.title)}** — ${i.severity || 'minor'} · ${i.status || '-'}`).join('\n').slice(0, 1024)
        });
    }

    embed.setTimestamp().setFooter({ text: 'Aktualisiert automatisch alle 2 Minuten' });
    return embed;
};

// ---------------------------------------------------------------------------
// Posting
// ---------------------------------------------------------------------------

const fetchTextChannel = async (channelId) => {
    if (!channelId) throw new Error('Kein Channel ausgewählt');
    if (!state.client || state.status !== 'online') throw new Error('Bot ist nicht online');
    const channel = await state.client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) throw new Error('Channel nicht erreichbar oder nicht textbasiert');
    return channel;
};

const postRules = async (channelId) => {
    const ch = await fetchTextChannel(channelId || Settings.get('content_rules_channel_id'));
    await ch.send({ embeds: [buildRulesEmbed()] });
};

const postProducts = async (channelId) => {
    const ch = await fetchTextChannel(channelId || Settings.get('content_products_channel_id'));
    await ch.send({ embeds: buildProductsEmbeds() });
};

const postLinks = async (channelId) => {
    const ch = await fetchTextChannel(channelId || Settings.get('content_links_channel_id'));
    await ch.send({ embeds: [buildLinksEmbed()] });
};

// Sticky-Status: editiert die bestehende Nachricht, sonst wird eine neue erstellt
// und ihre ID in den Settings gemerkt. Gibt die Message-ID zurück.
const postOrUpdateStatus = async (channelId) => {
    const targetChannel = channelId || Settings.get('content_status_channel_id');
    const ch = await fetchTextChannel(targetChannel);
    const embed = buildStatusEmbed();
    const savedChannel = Settings.get('content_status_channel_id');
    const messageId = Settings.get('content_status_message_id');

    // Vorhandene Sticky-Message nur editieren, wenn sie im selben Channel liegt
    if (messageId && savedChannel === ch.id) {
        try {
            const msg = await ch.messages.fetch(messageId);
            await msg.edit({ embeds: [embed] });
            return messageId;
        } catch {
            // Message wurde gelöscht -> neu posten
        }
    }
    const sent = await ch.send({ embeds: [embed] });
    Settings.set('content_status_message_id', sent.id);
    return sent.id;
};

// Hintergrund-Worker: aktualisiert die Sticky-Status-Nachricht periodisch.
let _statusInterval = null;
const startStatusUpdater = () => {
    if (_statusInterval) return;
    const INTERVAL_MS = 120000; // 2 Minuten
    _statusInterval = setInterval(() => {
        try {
            if (Settings.get('content_status_auto') !== '1') return;
            if (!Settings.get('content_status_channel_id')) return;
            if (!state.client || state.status !== 'online') return;
            postOrUpdateStatus().catch(err => console.error('[CONTENT] status auto-update:', err.message));
        } catch (err) {
            console.error('[CONTENT] status updater:', err.message);
        }
    }, INTERVAL_MS);
    if (_statusInterval.unref) _statusInterval.unref();
};

module.exports = {
    buildRulesEmbed,
    buildProductsEmbeds,
    buildLinksEmbed,
    buildStatusEmbed,
    postRules,
    postProducts,
    postLinks,
    postOrUpdateStatus,
    startStatusUpdater
};
