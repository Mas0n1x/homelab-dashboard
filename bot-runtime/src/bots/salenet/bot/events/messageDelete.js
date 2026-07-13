const { EmbedBuilder } = require('discord.js');
const Settings = require('../../models/Settings');
const { logEvent } = require('../logger');

module.exports = async (message) => {
    if (message.partial) return; // Nicht im Cache, kein Inhalt
    if (message.author?.bot) return;

    logEvent('MESSAGE_DELETE', {
        message_id: message.id,
        channel_id: message.channelId,
        author_id: message.author?.id,
        author: message.author?.tag,
        content_preview: (message.content || '').slice(0, 200)
    });

    const logChannelId = Settings.get('discord_log_channel_id');
    if (!logChannelId || logChannelId === message.channelId) return;

    try {
        const ch = await message.guild?.channels.fetch(logChannelId);
        if (!ch || !ch.isTextBased()) return;

        const embed = new EmbedBuilder()
            .setColor(0xEF4444)
            .setTitle('Nachricht gelöscht')
            .setDescription(message.content?.slice(0, 1900) || '*(kein Text-Inhalt)*')
            .addFields(
                { name: 'Autor', value: message.author ? `<@${message.author.id}> (${message.author.tag})` : 'Unbekannt', inline: true },
                { name: 'Channel', value: `<#${message.channelId}>`, inline: true }
            )
            .setTimestamp();

        await ch.send({ embeds: [embed] });
    } catch (err) {
        console.error('[BOT] messageDelete log failed:', err.message);
    }
};
