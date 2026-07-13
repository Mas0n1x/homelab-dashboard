const definitions = require('./definitions');

const registerForGuild = async (guild) => {
    try {
        await guild.commands.set(definitions);
        console.log(`[BOT] ${definitions.length} Slash-Commands für Guild ${guild.name} registriert`);
    } catch (err) {
        console.error('[BOT] Slash-Command-Registration fehlgeschlagen:', err.message);
    }
};

module.exports = { registerForGuild };
