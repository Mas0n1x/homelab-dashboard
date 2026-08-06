const { Events } = require('discord.js');
const Settings = require('../../models/Settings');
const guildMemberAdd = require('./guildMemberAdd');
const guildMemberRemove = require('./guildMemberRemove');
const messageDelete = require('./messageDelete');
const messageUpdate = require('./messageUpdate');
const messageCreate = require('./messageCreate');
const interactionCreate = require('./interactionCreate');

// Der Bot-Token wird mit dem PersoNet-Bot geteilt — dieselbe Discord-Application
// sitzt dadurch auch in fremden Guilds (z. B. „CC | Police Department"). Deren
// Events dürfen weder geloggt noch automoderiert werden: Die konfigurierten
// Channel-IDs gehören zur LawNet-Community, jeder Versuch endet in
// „The fetched channel does not belong to this manager's guild".
const guildIdOf = (arg) => arg?.guild?.id || arg?.guildId || null;

const onlyOwnGuild = (handler) => async (...args) => {
    const configured = Settings.get('discord_guild_id');
    const guildId = guildIdOf(args[0]) || guildIdOf(args[1]);
    // Ohne konfigurierte Guild bleibt das bisherige Verhalten erhalten.
    if (configured && guildId && guildId !== configured) return;
    return handler(...args);
};

const register = (client) => {
    client.on(Events.GuildMemberAdd, onlyOwnGuild(guildMemberAdd));
    client.on(Events.GuildMemberRemove, onlyOwnGuild(guildMemberRemove));
    client.on(Events.MessageDelete, onlyOwnGuild(messageDelete));
    client.on(Events.MessageUpdate, onlyOwnGuild(messageUpdate));
    client.on(Events.MessageCreate, onlyOwnGuild(messageCreate));
    client.on(Events.InteractionCreate, onlyOwnGuild(interactionCreate));
};

module.exports = { register };
