const { EmbedBuilder } = require('discord.js');
const Settings = require('../../models/Settings');
const { logEvent } = require('../logger');

module.exports = async (member) => {
    logEvent('GUILD_MEMBER_REMOVE', {
        user_id: member.id,
        username: member.user?.tag || 'unknown',
        guild_id: member.guild.id
    });

    const channelId = Settings.get('discord_leave_channel_id');
    if (!channelId) return;

    const template = Settings.get('discord_leave_message') || '{user} hat den Server verlassen.';
    const text = template
        .replace(/\{user\}/g, member.user?.username || 'Unknown')
        .replace(/\{user_tag\}/g, member.user?.tag || 'Unknown')
        .replace(/\{guild\}/g, member.guild.name)
        .replace(/\{member_count\}/g, member.guild.memberCount.toString());

    try {
        const channel = await member.guild.channels.fetch(channelId);
        if (!channel || !channel.isTextBased()) return;

        const embed = new EmbedBuilder()
            .setColor(0x6B7280)
            .setTitle('Member verlassen')
            .setDescription(text)
            .setThumbnail(member.user?.displayAvatarURL() || null)
            .setTimestamp()
            .setFooter({ text: `Mitglieder: ${member.guild.memberCount}` });

        await channel.send({ embeds: [embed] });
    } catch (err) {
        console.error('[BOT] leave send failed:', err.message);
    }
};
