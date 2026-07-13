const moderation = require('../features/moderation');
const tickets = require('../features/tickets');
const { logEvent } = require('../logger');

module.exports = async (interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            const name = interaction.commandName;
            logEvent('SLASH_COMMAND', { command: name, user: interaction.user.tag });

            switch (name) {
                case 'warn': return moderation.handleWarn(interaction);
                case 'kick': return moderation.handleKick(interaction);
                case 'ban': return moderation.handleBan(interaction);
                case 'slowmode': return moderation.handleSlowmode(interaction);
                case 'ticket-setup': return tickets.postSetupPanel(interaction);
                case 'ticket-close': return tickets.handleCloseCommand(interaction);
            }
        }

        if (interaction.isButton()) {
            const id = interaction.customId;
            if (id.startsWith('ticket:open:')) {
                return tickets.handleOpenButton(interaction);
            }
            if (id.startsWith('ticket:close:')) {
                return tickets.handleCloseButton(interaction);
            }
        }
    } catch (err) {
        console.error('[BOT] interactionCreate error:', err);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            interaction.reply({ content: 'Interner Fehler: ' + err.message, ephemeral: true }).catch(() => {});
        }
    }
};
