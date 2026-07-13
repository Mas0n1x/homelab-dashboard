const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const commands = [
    new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Verwarnt einen User')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(o => o.setName('user').setDescription('Ziel-User').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Grund').setRequired(true)),

    new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kickt einen User')
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .addUserOption(o => o.setName('user').setDescription('Ziel-User').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Grund').setRequired(true)),

    new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bannt einen User')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(o => o.setName('user').setDescription('Ziel-User').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Grund').setRequired(true))
        .addIntegerOption(o => o.setName('delete_days').setDescription('Nachrichten der letzten N Tage löschen (0-7)').setMinValue(0).setMaxValue(7)),

    new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Setzt Slowmode-Cooldown im aktuellen Channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addIntegerOption(o => o.setName('seconds').setDescription('Sekunden zwischen Nachrichten (0 = aus, max 21600)').setRequired(true).setMinValue(0).setMaxValue(21600)),

    new SlashCommandBuilder()
        .setName('ticket-setup')
        .setDescription('Postet einen Ticket-Open-Button in diesem Channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('ticket-close')
        .setDescription('Schließt dieses Ticket-Channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addStringOption(o => o.setName('reason').setDescription('Grund'))
];

module.exports = commands.map(c => c.toJSON());
