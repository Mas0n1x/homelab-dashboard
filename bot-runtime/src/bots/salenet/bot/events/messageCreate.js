const automod = require('../features/automod');

module.exports = async (message) => {
    if (message.author?.bot) return;
    if (!message.guild) return;
    try {
        await automod.evaluate(message);
    } catch (err) {
        console.error('[BOT] automod evaluation failed:', err.message);
    }
};
