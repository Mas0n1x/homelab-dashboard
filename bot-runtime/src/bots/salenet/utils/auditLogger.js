const db = require('../config/db');

const insertStmt = db.prepare(`
    INSERT INTO audit_logs (user_id, action, ip_address, details)
    VALUES (?, ?, ?, ?)
`);

/**
 * Schreibt einen Audit-Log-Eintrag in die DB.
 * @param {object} options
 * @param {number|null} options.userId - User-ID (oder null bei nicht eingeloggten Aktionen)
 * @param {string} options.action - Kurzer Action-Code, z.B. 'USER_LOGIN', 'PRODUCT_UPDATE'
 * @param {string} [options.ip] - Request-IP
 * @param {object|string} [options.details] - Frei wählbare Zusatzdaten (wird als JSON serialisiert)
 */
const audit = ({ userId = null, action, ip = null, details = null } = {}) => {
    try {
        const detailsStr = details == null
            ? null
            : (typeof details === 'string' ? details : JSON.stringify(details));
        insertStmt.run(userId, action, ip, detailsStr);
    } catch (err) {
        console.error('[AUDIT] Failed to write log:', err.message);
    }
};

/**
 * Express-Helper: zieht User/IP aus req und schreibt einen Audit-Eintrag.
 */
const auditFromReq = (req, action, details = null) => {
    audit({
        userId: req.session?.userId || null,
        action,
        ip: req.ip || req.headers['x-forwarded-for'] || null,
        details
    });
};

module.exports = { audit, auditFromReq };
