/**
 * Admin insights: customers, payments, and store settings.
 *
 * Everything here is real data from MySQL. Settings edits go through a
 * whitelist — the `cj.*` integration secrets live in the same table, so it
 * must never be writable (or returned in full) from the admin UI.
 */

const { query, queryOne, execute } = require('../database/pool');
const { HttpError } = require('../middleware/error');
const { decimal } = require('../lib/money');

const EDITABLE_SETTINGS = new Set([
  'store.name',
  'store.currency',
  'store.locale',
  'pricing.default_margin_percent',
  'pricing.free_shipping_threshold',
  'pricing.standard_shipping_fee',
]);

const SECRET_KEY = /(token|secret|password|api[_-]?key)/i;

/** GET /api/admin/customers */
async function listCustomers(req, res) {
  const rows = await query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.is_active, u.created_at,
            COUNT(o.id) AS orders,
            COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total ELSE 0 END), 0) AS lifetime_value,
            MAX(o.placed_at) AS last_order_at
       FROM users u
       LEFT JOIN orders o ON o.user_id = u.id
      WHERE u.role = 'customer'
      GROUP BY u.id
      ORDER BY lifetime_value DESC, orders DESC
      LIMIT 200`
  );
  res.json({
    ok: true,
    items: rows.map((u) => ({
      id: String(u.id),
      email: u.email,
      name: `${u.first_name} ${u.last_name}`.trim() || '—',
      phone: u.phone,
      isActive: Boolean(u.is_active),
      orders: Number(u.orders),
      lifetimeValue: decimal(u.lifetime_value),
      lastOrderAt: u.last_order_at,
      createdAt: u.created_at,
    })),
  });
}

/** GET /api/admin/payments */
async function listPayments(req, res) {
  const rows = await query(
    `SELECT p.id, p.provider, p.method, p.status, p.amount, p.currency, p.card_last4,
            p.created_at, o.order_number, o.email
       FROM payments p
       JOIN orders o ON o.id = p.order_id
      ORDER BY p.id DESC
      LIMIT 100`
  );
  res.json({
    ok: true,
    items: rows.map((p) => ({
      id: String(p.id),
      provider: p.provider,
      method: p.method,
      status: p.status,
      amount: decimal(p.amount),
      currency: p.currency,
      cardLast4: p.card_last4,
      orderNumber: p.order_number,
      email: p.email,
      createdAt: p.created_at,
    })),
  });
}

/** GET /api/admin/settings — editable config plus redacted secrets. */
async function getSettings(req, res) {
  const rows = await query('SELECT setting_key, setting_value, setting_group FROM store_settings ORDER BY setting_group, setting_key');
  res.json({
    ok: true,
    settings: rows.map((r) => ({
      key: r.setting_key,
      group: r.setting_group,
      value: SECRET_KEY.test(r.setting_key) ? '********' : r.setting_value,
      editable: EDITABLE_SETTINGS.has(r.setting_key),
    })),
  });
}

/** PUT /api/admin/settings — whitelisted updates only. */
async function updateSettings(req, res) {
  const updates = req.body?.settings;
  if (!updates || typeof updates !== 'object') {
    throw HttpError.badRequest('Send { settings: { key: value } }');
  }
  const entries = Object.entries(updates);
  for (const [key, value] of entries) {
    if (!EDITABLE_SETTINGS.has(key)) {
      throw HttpError.badRequest(`"${key}" cannot be edited from the dashboard`);
    }
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw HttpError.badRequest(`"${key}" must be a string or number`);
    }
    await execute(
      'UPDATE store_settings SET setting_value = ? WHERE setting_key = ?',
      [String(value), key]
    );
  }
  res.json({ ok: true, updated: entries.map(([k]) => k) });
}

module.exports = { listCustomers, listPayments, getSettings, updateSettings };
