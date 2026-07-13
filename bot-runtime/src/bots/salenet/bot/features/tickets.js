const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    PermissionFlagsBits, ChannelType
} = require('discord.js');
const db = require('../../config/db');
const Settings = require('../../models/Settings');

const CATEGORIES = [
    { id: 'support', label: 'Support', emoji: '🛠️' },
    { id: 'billing', label: 'Abrechnung', emoji: '💳' },
    { id: 'bug', label: 'Bug-Report', emoji: '🐛' },
    { id: 'other', label: 'Sonstiges', emoji: '💬' }
];

const insertTicket = db.prepare(`
    INSERT INTO tickets (channel_id, user_id, username, category, status)
    VALUES (?, ?, ?, ?, 'open')
`);
const closeTicket = db.prepare(`
    UPDATE tickets SET status = 'closed', closed_at = CURRENT_TIMESTAMP, closed_by = ?, transcript = ? WHERE channel_id = ?
`);
const getOpenTicketByChannel = db.prepare(`SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'`);

// /ticket-setup: postet die Panel-Message mit Open-Buttons
const postSetupPanel = async (interaction) => {
    const embed = new EmbedBuilder()
        .setColor(0xF97316)
        .setTitle('Support-Tickets')
        .setDescription('Klicke unten auf eine Kategorie um ein privates Ticket zu eröffnen. Nur du und das Support-Team können es sehen.');

    const row = new ActionRowBuilder().addComponents(
        CATEGORIES.map(c => new ButtonBuilder()
            .setCustomId(`ticket:open:${c.id}`)
            .setLabel(c.label)
            .setEmoji(c.emoji)
            .setStyle(ButtonStyle.Primary))
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: 'Panel wurde gepostet.', ephemeral: true });
};

// Button-Klick: erstellt Ticket-Channel
const handleOpenButton = async (interaction) => {
    const categoryId = interaction.customId.split(':')[2];
    const meta = CATEGORIES.find(c => c.id === categoryId) || CATEGORIES[0];

    // Existiert schon ein offenes Ticket dieses Users?
    const existing = db.prepare(`SELECT channel_id FROM tickets WHERE user_id = ? AND status = 'open'`).get(interaction.user.id);
    if (existing) {
        const ch = await interaction.guild.channels.fetch(existing.channel_id).catch(() => null);
        if (ch) {
            return interaction.reply({ content: `Du hast bereits ein offenes Ticket: <#${ch.id}>`, ephemeral: true });
        }
    }

    await interaction.deferReply({ ephemeral: true });

    const parentId = Settings.get('discord_ticket_category_id') || null;
    const supportRoleId = Settings.get('discord_ticket_support_role_id') || null;

    const overwrites = [
        { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory] }
    ];
    if (supportRoleId) {
        overwrites.push({
            id: supportRoleId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages]
        });
    }

    const channel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}-${categoryId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 90),
        type: ChannelType.GuildText,
        parent: parentId || undefined,
        permissionOverwrites: overwrites,
        topic: `Ticket von ${interaction.user.tag} - Kategorie: ${meta.label}`
    }).catch(err => { throw err; });

    insertTicket.run(channel.id, interaction.user.id, interaction.user.tag, categoryId);

    const welcomeEmbed = new EmbedBuilder()
        .setColor(0xF97316)
        .setTitle(`${meta.emoji} ${meta.label}-Ticket`)
        .setDescription(`Hi <@${interaction.user.id}>, schildere bitte dein Anliegen. Das Team meldet sich gleich.\n\nUm das Ticket zu schließen: \`/ticket-close [reason]\` oder Button unten.`)
        .setTimestamp();
    const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ticket:close:${channel.id}`).setLabel('Ticket schließen').setEmoji('🔒').setStyle(ButtonStyle.Danger)
    );
    await channel.send({ content: supportRoleId ? `<@&${supportRoleId}>` : '', embeds: [welcomeEmbed], components: [closeRow] });

    await interaction.editReply({ content: `Ticket erstellt: <#${channel.id}>` });
};

// /ticket-close oder Button: Transcript speichern + Channel löschen
const closeTicketByChannel = async (channel, closer, reason = null) => {
    const ticket = getOpenTicketByChannel.get(channel.id);
    if (!ticket) return { ok: false, reason: 'Kein offenes Ticket in diesem Channel' };

    // Transcript einsammeln (letzte 100 Nachrichten reichen i.d.R.)
    let transcript = '';
    try {
        const messages = await channel.messages.fetch({ limit: 100 });
        const arr = Array.from(messages.values()).reverse();
        transcript = arr.map(m => `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content}`).join('\n');
    } catch (err) {
        transcript = '(Transcript-Fetch fehlgeschlagen: ' + err.message + ')';
    }
    if (reason) transcript += `\n\n--- Geschlossen wegen: ${reason}`;

    closeTicket.run(closer?.tag || 'system', transcript, channel.id);

    try {
        await channel.send({ content: 'Ticket wird in 5 Sekunden geschlossen...' });
        setTimeout(() => channel.delete().catch(() => {}), 5000);
    } catch {}
    return { ok: true, ticket_id: ticket.id };
};

const handleCloseCommand = async (interaction) => {
    const reason = interaction.options.getString('reason');
    const result = await closeTicketByChannel(interaction.channel, interaction.user, reason);
    if (!result.ok) return interaction.reply({ content: result.reason, ephemeral: true });
    await interaction.reply({ content: 'Ticket wird geschlossen.' });
};

const handleCloseButton = async (interaction) => {
    const result = await closeTicketByChannel(interaction.channel, interaction.user);
    if (!result.ok) return interaction.reply({ content: result.reason, ephemeral: true });
    await interaction.reply({ content: 'Ticket wird geschlossen.' });
};

module.exports = { postSetupPanel, handleOpenButton, handleCloseCommand, handleCloseButton, closeTicketByChannel, CATEGORIES };
