/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import Database from 'better-sqlite3';

const DB_PATH = process.env.SALENET_DB_PATH || '/host/srv/SaleNet/data/database.db';

function withDb(fn, fallback) {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
    return fn(db);
  } catch (e) {
    return typeof fallback === 'function' ? fallback(e) : fallback;
  } finally {
    if (db) try { db.close(); } catch { /* ignore */ }
  }
}

export function getSummary() {
  return withDb(db => {
    const pendingOrders = db.prepare("SELECT COUNT(*) c FROM orders WHERE status = 'pending'").get().c;
    const newContacts = db.prepare("SELECT COUNT(*) c FROM contact_submissions WHERE status = 'new'").get().c;
    const totalOrders = db.prepare("SELECT COUNT(*) c FROM orders").get().c;
    return { pendingOrders, newContacts, totalOrders, ok: true };
  }, e => ({ ok: false, error: e.message }));
}

export function getRecent() {
  return withDb(db => {
    const orders = db.prepare(
      "SELECT id, package_name, price, billing_cycle, customer_name, customer_email, status, created_at FROM orders ORDER BY datetime(created_at) DESC LIMIT 15"
    ).all();
    const contacts = db.prepare(
      "SELECT id, name, email, subject, message, status, created_at FROM contact_submissions ORDER BY datetime(created_at) DESC LIMIT 15"
    ).all();
    return { orders, contacts, ok: true };
  }, e => ({ ok: false, error: e.message, orders: [], contacts: [] }));
}
