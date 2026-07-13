const db = require('../../config/db');
const Settings = require('../../models/Settings');
const { EmbedBuilder } = require('discord.js');

const insertAction = db.prepare(`
    INSERT INTO mod_actions (action, target_user_id, target_username, moderator_user_id, moderator_username, reason, channel_id, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const recordAction = ({ action, target, moderator, reason = null, channelId = null, metadata = null }) => {
    try {
        insertAction.run(
            action,
            target?.id || null,
            target?.tag || null,
            moderator?.id || null,
            moderator?.tag || null,
            reason,
            channelId,
            metadata == null ? null : JSON.stringify(metadata)
        );
    } catch (err) {
        console.error('[MOD] recordAction failed:', err.message);
    }
};

const postToLogChannel = async (guild, embed) => {
    const logChannelId = Settings.get('discord_log_channel_id');
    if (!logChannelId) return;
    try {
        const ch = await guild.channels.fetch(logChannelId);
        if (ch && ch.isTextBased()) await ch.send({ embeds: [embed] });
    } catch (err) {
        console.error('[MOD] log post failed:', err.message);
    }
};

const COLORS = { warn: 0xF59E0B, kick: 0xF97316, ban: 0xEF4444, slowmode: 0x3B82F6 };

const handleWarn = async (interaction) => {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    if (user.bot) return interaction.reply({ content: 'Bots können nicht verwarnt werden.', ephemeral: true });

    recordAction({ action: 'warn', target: user, moderator: interaction.user, reason });

    try {
        await user.send(`Du wurdest auf **${interaction.guild.name}** verwarnt.\nGrund: ${reason}`);
    } catch { /* DM closed */ }

    const embed = new EmbedBuilder()
        .setColor(COLORS.warn)
        .setTitle('User verwarnt')
        .addFields(
            { name: 'User', value: `<@${user.id}> (${user.tag})`, inline: true },
            { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Grund', value: reason }
        )
        .setTimestamp();

    await postToLogChannel(interaction.guild, embed);
    await interaction.reply({ embeds: [embed], ephemeral: false });
};

const handleKick = async (interaction) => {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: 'User nicht auf dem Server.', ephemeral: true });
    if (!member.kickable) return interaction.reply({ content: 'Kann diesen User nicht kicken (zu hohe Rolle?)', ephemeral: true });

    try {
        await user.send(`Du wurdest von **${interaction.guild.name}** gekickt.\nGrund: ${reason}`);
    } catch {}
    await member.kick(reason);
    recordAction({ action: 'kick', target: user, moderator: interaction.user, reason });

    const embed = new EmbedBuilder()
        .setColor(COLORS.kick)
        .setTitle('User gekickt')
        .addFields(
            { name: 'User', value: `<@${user.id}> (${user.tag})`, inline: true },
            { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Grund', value: reason }
        )
        .setTimestamp();
    await postToLogChannel(interaction.guild, embed);
    await interaction.reply({ embeds: [embed] });
};

const handleBan = async (interaction) => {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    const deleteDays = interaction.options.getInteger('delete_days') || 0;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (member && !member.bannable) {
        return interaction.reply({ content: 'Kann diesen User nicht bannen (zu hohe Rolle?).', ephemeral: true });
    }

    try {
        await user.send(`Du wurdest von **${interaction.guild.name}** gebannt.\nGrund: ${reason}`);
    } catch {}
    await interaction.guild.bans.create(user.id, { reason, deleteMessageSeconds: deleteDays * 86400 });
    recordAction({ action: 'ban', target: user, moderator: interaction.user, reason, metadata: { delete_days: deleteDays } });

    const embed = new EmbedBuilder()
        .setColor(COLORS.ban)
        .setTitle('User gebannt')
        .addFields(
            { name: 'User', value: `<@${user.id}> (${user.tag})`, inline: true },
            { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Grund', value: reason },
            { name: 'Lösche letzte', value: deleteDays + ' Tage', inline: true }
        )
        .setTimestamp();
    await postToLogChannel(interaction.guild, embed);
    await interaction.reply({ embeds: [embed] });
};

const handleSlowmode = async (interaction) => {
    const seconds = interaction.options.getInteger('seconds', true);
    try {
        await interaction.channel.setRateLimitPerUser(seconds, `Slowmode by ${interaction.user.tag}`);
    } catch (err) {
        return interaction.reply({ content: 'Konnte Slowmode nicht setzen: ' + err.message, ephemeral: true });
    }
    recordAction({
        action: 'slowmode',
        target: null,
        moderator: interaction.user,
        reason: `${seconds}s`,
        channelId: interaction.channelId,
        metadata: { seconds }
    });
    const embed = new EmbedBuilder()
        .setColor(COLORS.slowmode)
        .setTitle('Slowmode gesetzt')
        .addFields(
            { name: 'Channel', value: `<#${interaction.channelId}>`, inline: true },
            { name: 'Cooldown', value: seconds === 0 ? 'aus' : `${seconds}s`, inline: true },
            { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true }
        )
        .setTimestamp();
    await postToLogChannel(interaction.guild, embed);
    await interaction.reply({ embeds: [embed] });
};

const remoteAction = async ({ action, guild, target_user_id, moderator_user_id, reason, delete_days = 0 }) => {
    if (!guild) throw new Error('Guild nicht verfügbar');
    const target = await guild.client.users.fetch(target_user_id).catch(() => null);
    if (!target) throw new Error('User nicht gefunden');
    const moderator = await guild.client.users.fetch(moderator_user_id).catch(() => null);
    const member = await guild.members.fetch(target_user_id).catch(() => null);

    if (action === 'warn') {
        try { await target.send(`Du wurdest auf **${guild.name}** verwarnt.\nGrund: ${reason}`); } catch {}
    } else if (action === 'kick') {
        if (!member) throw new Error('User nicht auf Server');
        if (!member.kickable) throw new Error('User nicht kickbar');
        try { await target.send(`Du wurdest von **${guild.name}** gekickt.\nGrund: ${reason}`); } catch {}
        await member.kick(reason);
    } else if (action === 'ban') {
        if (member && !member.bannable) throw new Error('User nicht bannbar');
        try { await target.send(`Du wurdest von **${guild.name}** gebannt.\nGrund: ${reason}`); } catch {}
        await guild.bans.create(target_user_id, { reason, deleteMessageSeconds: delete_days * 86400 });
    } else {
        throw new Error('Unbekannte Aktion: ' + action);
    }

    recordAction({ action, target, moderator, reason, metadata: action === 'ban' ? { delete_days } : null });

    const embed = new EmbedBuilder()
        .setColor(COLORS[action])
        .setTitle(`User ${action} (via Dashboard)`)
        .addFields(
            { name: 'User', value: `<@${target.id}> (${target.tag})`, inline: true },
            { name: 'Moderator', value: moderator ? `<@${moderator.id}>` : 'Dashboard', inline: true },
            { name: 'Grund', value: reason || '-' }
        )
        .setTimestamp();
    await postToLogChannel(guild, embed);
};

module.exports = { handleWarn, handleKick, handleBan, handleSlowmode, remoteAction, recordAction };
