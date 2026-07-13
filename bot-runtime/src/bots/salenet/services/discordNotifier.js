// SaleNet -> Discord-Notifier
// Schickt Embeds in konfigurierbare Channels bei Sales-Events.
// Alle Funktionen sind fire-and-forget (nicht-blockierend); Fehler werden geloggt aber nie geworfen.

const { EmbedBuilder } = require('discord.js');
const Settings = require('../models/Settings');
const { state } = require('../bot/state');

const safeSend = async (channelId, embed) => {
    if (!channelId) return;
    if (!state.client || state.status !== 'online') return;
    try {
        const channel = await state.client.channels.fetch(channelId);
        if (!channel || !channel.isTextBased()) return;
        await channel.send({ embeds: [embed] });
    } catch (err) {
        console.error('[NOTIFIER] send failed:', err.message);
    }
};

const notifyNewOrder = (order) => {
    const channelId = Settings.get('discord_notify_orders_channel_id');
    if (!channelId) return;
    const embed = new EmbedBuilder()
        .setColor(0x10B981)
        .setTitle('Neue Bestellung')
        .addFields(
            { name: 'Paket', value: String(order.package_name || '-'), inline: true },
            { name: 'Betrag', value: String(order.price || '-'), inline: true },
            { name: 'Zyklus', value: String(order.billing_cycle || '-'), inline: true },
            { name: 'Kunde', value: `${order.customer_name || '-'}\n${order.customer_email || '-'}` }
        )
        .setTimestamp()
        .setFooter({ text: `Order #${order.id || '?'}` });
    safeSend(channelId, embed);
};

const notifyNewContact = (contact) => {
    const channelId = Settings.get('discord_notify_contacts_channel_id');
    if (!channelId) return;
    const embed = new EmbedBuilder()
        .setColor(0x3B82F6)
        .setTitle('Neue Kontakt-Anfrage')
        .addFields(
            { name: 'Name', value: String(contact.name || '-'), inline: true },
            { name: 'Email', value: String(contact.email || '-'), inline: true },
            { name: 'Subject', value: String(contact.subject || '-') },
            { name: 'Nachricht', value: String(contact.message || '-').slice(0, 1024) }
        )
        .setTimestamp()
        .setFooter({ text: `Contact #${contact.id || '?'}` });
    safeSend(channelId, embed);
};

const notifyNewAffiliate = (aff) => {
    const channelId = Settings.get('discord_notify_affiliates_channel_id');
    if (!channelId) return;
    const embed = new EmbedBuilder()
        .setColor(0x8B5CF6)
        .setTitle('Neuer Affiliate-Antrag')
        .addFields(
            { name: 'Name', value: String(aff.name || '-'), inline: true },
            { name: 'Email', value: String(aff.email || '-'), inline: true },
            { name: 'Code', value: String(aff.code || '-'), inline: true },
            { name: 'Notes', value: String(aff.notes || '-').slice(0, 1024) }
        )
        .setTimestamp()
        .setFooter({ text: `Affiliate #${aff.id || '?'} - Status: ${aff.status || 'pending'}` });
    safeSend(channelId, embed);
};

const notifyIncident = (incident, type = 'created') => {
    const channelId = Settings.get('discord_notify_incidents_channel_id');
    if (!channelId) return;
    const color = type === 'resolved' ? 0x10B981 : (incident.severity === 'major' ? 0xDC2626 : 0xF59E0B);
    const title = type === 'resolved' ? 'Incident geloest' : `Neues Incident (${incident.severity || 'minor'})`;
    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .addFields(
            { name: 'Titel', value: String(incident.title || '-') },
            { name: 'Status', value: String(incident.status || '-'), inline: true },
            { name: 'Severity', value: String(incident.severity || '-'), inline: true }
        )
        .setTimestamp()
        .setFooter({ text: `Incident #${incident.id || '?'}` });
    if (incident.description) {
        embed.addFields({ name: 'Beschreibung', value: String(incident.description).slice(0, 1024) });
    }
    safeSend(channelId, embed);
};

const sendTestNotification = async (channelId) => {
    if (!channelId) throw new Error('channelId fehlt');
    if (!state.client || state.status !== 'online') throw new Error('Bot ist nicht online');
    const channel = await state.client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) throw new Error('Channel nicht erreichbar oder nicht textbasiert');
    const embed = new EmbedBuilder()
        .setColor(0xF97316)
        .setTitle('Testbenachrichtigung')
        .setDescription('Dieser Channel ist erfolgreich an SaleNet angebunden.')
        .setTimestamp();
    await channel.send({ embeds: [embed] });
};

module.exports = {
    notifyNewOrder,
    notifyNewContact,
    notifyNewAffiliate,
    notifyIncident,
    sendTestNotification
};
