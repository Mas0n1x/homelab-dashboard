const { Events } = require('discord.js');
const guildMemberAdd = require('./guildMemberAdd');
const guildMemberRemove = require('./guildMemberRemove');
const messageDelete = require('./messageDelete');
const messageUpdate = require('./messageUpdate');
const messageCreate = require('./messageCreate');
const interactionCreate = require('./interactionCreate');

const register = (client) => {
    client.on(Events.GuildMemberAdd, guildMemberAdd);
    client.on(Events.GuildMemberRemove, guildMemberRemove);
    client.on(Events.MessageDelete, messageDelete);
    client.on(Events.MessageUpdate, messageUpdate);
    client.on(Events.MessageCreate, messageCreate);
    client.on(Events.InteractionCreate, interactionCreate);
};

module.exports = { register };
