const db = require('../config/db');

const insertStmt = db.prepare(`INSERT INTO bot_logs (event_type, payload) VALUES (?, ?)`);

const logEvent = (eventType, payload = null) => {
    try {
        const str = payload == null ? null : (typeof payload === 'string' ? payload : JSON.stringify(payload));
        insertStmt.run(eventType, str);
    } catch (err) {
        console.error('[BOT-LOG] Failed:', err.message);
    }
};

module.exports = { logEvent };
