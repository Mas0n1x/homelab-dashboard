const { EmbedBuilder } = require('discord.js');
const Settings = require('../../models/Settings');
const { logEvent } = require('../logger');

module.exports = async (oldMessage, newMessage) => {
    if (newMessage.partial || oldMessage.partial) return;
    if (newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return; // Embed-Update etc.

    logEvent('MESSAGE_UPDATE', {
        message_id: newMessage.id,
        channel_id: newMessage.channelId,
        author_id: newMessage.author?.id,
        author: newMessage.author?.tag
    });

    const logChannelId = Settings.get('discord_log_channel_id');
    if (!logChannelId || logChannelId === newMessage.channelId) return;

    try {
        const ch = await newMessage.guild?.channels.fetch(logChannelId);
        if (!ch || !ch.isTextBased()) return;

        const embed = new EmbedBuilder()
            .setColor(0xF59E0B)
            .setTitle('Nachricht editiert')
            .addFields(
                { name: 'Autor', value: `<@${newMessage.author.id}> (${newMessage.author.tag})`, inline: true },
                { name: 'Channel', value: `<#${newMessage.channelId}>`, inline: true },
                { name: 'Vorher', value: (oldMessage.content || '*leer*').slice(0, 1000) },
                { name: 'Nachher', value: (newMessage.content || '*leer*').slice(0, 1000) }
            )
            .setURL(newMessage.url)
            .setTimestamp();

        await ch.send({ embeds: [embed] });
    } catch (err) {
        console.error('[BOT] messageUpdate log failed:', err.message);
    }
};
