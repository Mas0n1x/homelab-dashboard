const db = require('../config/db');

class Product {
    static create({ id, type, name, description, monthly_price, yearly_price, stripe_monthly_price_id, stripe_yearly_price_id, features, position, icon }) {
        const stmt = db.prepare(`
            INSERT INTO products (id, type, name, description, monthly_price, yearly_price, stripe_monthly_price_id, stripe_yearly_price_id, features, position, icon)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(id, type, name, description, monthly_price, yearly_price, stripe_monthly_price_id, stripe_yearly_price_id, features, position, icon || '');
        return { id, type, name, description, monthly_price, yearly_price, stripe_monthly_price_id, stripe_yearly_price_id, features, position, icon };
    }

    static findAll(activeOnly = false) {
        let query = 'SELECT * FROM products';
        if (activeOnly) {
            query += ' WHERE is_active = 1';
        }
        query += ' ORDER BY position ASC, created_at ASC';
        const stmt = db.prepare(query);
        return stmt.all();
    }

    static findById(id) {
        const stmt = db.prepare('SELECT * FROM products WHERE id = ?');
        return stmt.get(id);
    }

    static update(id, { name, description, monthly_price, yearly_price, stripe_monthly_price_id, stripe_yearly_price_id, features, position, icon }) {
        const stmt = db.prepare(`
            UPDATE products
            SET name = ?, description = ?, monthly_price = ?, yearly_price = ?,
                stripe_monthly_price_id = ?, stripe_yearly_price_id = ?, features = ?, position = ?, icon = ?
            WHERE id = ?
        `);
        return stmt.run(name, description, monthly_price, yearly_price, stripe_monthly_price_id, stripe_yearly_price_id, features, position, icon || '', id);
    }

    static delete(id) {
        const stmt = db.prepare('DELETE FROM products WHERE id = ?');
        return stmt.run(id);
    }

    static updatePosition(id, position) {
        const stmt = db.prepare('UPDATE products SET position = ? WHERE id = ?');
        return stmt.run(position, id);
    }

    static toggleActive(id) {
        const stmt = db.prepare('UPDATE products SET is_active = NOT is_active WHERE id = ?');
        return stmt.run(id);
    }

    static toggleFeatured(id) {
        const stmt = db.prepare('UPDATE products SET is_featured = NOT is_featured WHERE id = ?');
        return stmt.run(id);
    }

    static getByType(type, activeOnly = false) {
        let query = 'SELECT * FROM products WHERE type = ?';
        if (activeOnly) {
            query += ' AND is_active = 1';
        }
        query += ' ORDER BY position ASC';
        const stmt = db.prepare(query);
        return stmt.all(type);
    }
}

module.exports = Product;
