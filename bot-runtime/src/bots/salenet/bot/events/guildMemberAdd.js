const { EmbedBuilder } = require('discord.js');
const Settings = require('../../models/Settings');
const { logEvent } = require('../logger');

module.exports = async (member) => {
    logEvent('GUILD_MEMBER_ADD', {
        user_id: member.id,
        username: member.user.tag,
        guild_id: member.guild.id
    });

    const channelId = Settings.get('discord_welcome_channel_id');
    if (!channelId) return;

    const template = Settings.get('discord_welcome_message') || 'Willkommen {user_mention} auf **{guild}**!';
    const text = template
        .replace(/\{user_mention\}/g, `<@${member.id}>`)
        .replace(/\{user\}/g, member.user.username)
        .replace(/\{guild\}/g, member.guild.name)
        .replace(/\{member_count\}/g, member.guild.memberCount.toString());

    try {
        const channel = await member.guild.channels.fetch(channelId);
        if (!channel || !channel.isTextBased()) return;

        const embed = new EmbedBuilder()
            .setColor(0xF97316)
            .setTitle('Neuer Member')
            .setDescription(text)
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp()
            .setFooter({ text: `Mitglieder: ${member.guild.memberCount}` });

        await channel.send({ embeds: [embed] });
    } catch (err) {
        console.error('[BOT] welcome send failed:', err.message);
    }
};
