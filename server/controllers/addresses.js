/**
 * Address book. Every route requires a signed-in user; addresses are always
 * scoped by user_id so one account can never read or edit another's book.
 */

const {
  query,
  queryOne,
  withTransaction,
  txQuery,
  txExecute,
} = require('../database/pool');
const { HttpError } = require('../middleware/error');
const { normalizeCountry, cleanString } = require('../lib/validate');

function mapAddress(row) {
  return {
    id: String(row.id),
    label: row.label,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    country: row.country,
    state: row.state,
    city: row.city,
    address1: row.address1,
    address2: row.address2,
    postalCode: row.postal_code,
    isDefault: Boolean(row.is_default),
  };
}

/** Validate and normalize an address payload. Throws 400 with field details. */
function readAddressBody(body) {
  const a = {
    label: cleanString(body.label, 60) || 'Home',
    firstName: cleanString(body.firstName, 80),
    lastName: cleanString(body.lastName, 80),
    phone: cleanString(body.phone, 40),
    country: normalizeCountry(body.country),
    state: cleanString(body.state, 120),
    city: cleanString(body.city, 120),
    address1: cleanString(body.address1, 190),
    address2: cleanString(body.address2, 190),
    postalCode: cleanString(body.postalCode, 24),
  };

  const missing = [];
  if (!a.firstName) missing.push('firstName');
  if (!a.lastName) missing.push('lastName');
  if (!a.country) missing.push('country');
  if (!a.city) missing.push('city');
  if (!a.address1) missing.push('address1');
  if (!a.postalCode) missing.push('postalCode');

  if (missing.length) {
    throw HttpError.badRequest('Please complete the required fields', { missing });
  }

  return a;
}

/** GET /api/addresses */
async function list(req, res) {
  const rows = await query(
    'SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC',
    [req.user.id]
  );
  res.json({ ok: true, items: rows.map(mapAddress) });
}

/** POST /api/addresses */
async function create(req, res) {
  const a = readAddressBody(req.body || {});

  const created = await withTransaction(async (conn) => {
    // The first address a customer saves is their default automatically.
    // txQuery, not conn.query: the latter resolves to [rows, fields], so
    // destructuring the count straight out of it yields undefined and the
    // "first address" rule silently never fires.
    const existing = await txQuery(
      conn,
      'SELECT COUNT(*) AS n FROM addresses WHERE user_id = ?',
      [req.user.id]
    );
    const isDefault = Number(existing[0].n) === 0 ? 1 : req.body.isDefault ? 1 : 0;

    if (isDefault) {
      await conn.query('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [req.user.id]);
    }

    const [res2] = await conn.execute(
      `INSERT INTO addresses
         (user_id, label, first_name, last_name, phone, country, state, city,
          address1, address2, postal_code, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        a.label,
        a.firstName,
        a.lastName,
        a.phone,
        a.country,
        a.state,
        a.city,
        a.address1,
        a.address2,
        a.postalCode,
        isDefault,
      ]
    );
    return res2.insertId;
  });

  const row = await queryOne('SELECT * FROM addresses WHERE id = ? LIMIT 1', [created]);
  res.status(201).json({ ok: true, address: mapAddress(row) });
}

/** PATCH /api/addresses/:id */
async function update(req, res) {
  const existing = await queryOne('SELECT * FROM addresses WHERE id = ? AND user_id = ? LIMIT 1', [
    req.params.id,
    req.user.id,
  ]);
  if (!existing) throw HttpError.notFound('Address not found');

  const a = readAddressBody({ ...mapAddress(existing), ...req.body });

  await withTransaction(async (conn) => {
    if (req.body.isDefault) {
      await conn.query('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [req.user.id]);
    }
    await conn.execute(
      `UPDATE addresses SET
         label = ?, first_name = ?, last_name = ?, phone = ?, country = ?, state = ?,
         city = ?, address1 = ?, address2 = ?, postal_code = ?, is_default = ?
       WHERE id = ? AND user_id = ?`,
      [
        a.label,
        a.firstName,
        a.lastName,
        a.phone,
        a.country,
        a.state,
        a.city,
        a.address1,
        a.address2,
        a.postalCode,
        req.body.isDefault ? 1 : existing.is_default,
        req.params.id,
        req.user.id,
      ]
    );
  });

  const row = await queryOne('SELECT * FROM addresses WHERE id = ? LIMIT 1', [req.params.id]);
  res.json({ ok: true, address: mapAddress(row) });
}

/** POST /api/addresses/:id/default */
async function makeDefault(req, res) {
  const existing = await queryOne('SELECT id FROM addresses WHERE id = ? AND user_id = ? LIMIT 1', [
    req.params.id,
    req.user.id,
  ]);
  if (!existing) throw HttpError.notFound('Address not found');

  await withTransaction(async (conn) => {
    await conn.query('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [req.user.id]);
    await conn.query('UPDATE addresses SET is_default = 1 WHERE id = ?', [req.params.id]);
  });

  res.json({ ok: true });
}

/** DELETE /api/addresses/:id */
async function remove(req, res) {
  const existing = await queryOne(
    'SELECT id, is_default FROM addresses WHERE id = ? AND user_id = ? LIMIT 1',
    [req.params.id, req.user.id]
  );
  if (!existing) throw HttpError.notFound('Address not found');

  await withTransaction(async (conn) => {
    await conn.query('DELETE FROM addresses WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);

    // Deleting the default must not leave the customer with no default at all,
    // or checkout has nothing to pre-select. Promote the most recent remaining
    // address. Done as two plain statements rather than a correlated subquery
    // inside UPDATE, which MariaDB will not evaluate against the same table.
// Deleting the default must not leave the customer with no default at all,
    // or checkout has nothing to pre-select. Promote the most recent remaining
    // address. Reads go through txQuery so the rows/tuple difference between a
    // raw connection and the pool helpers cannot bite here.
    if (existing.is_default) {
      const countRows = await txQuery(
        conn,
        'SELECT COUNT(*) AS n FROM addresses WHERE user_id = ? AND is_default = 1',
        [req.user.id]
      );
      if (Number(countRows[0].n) === 0) {
        const nextRows = await txQuery(
          conn,
          'SELECT id FROM addresses WHERE user_id = ? ORDER BY id DESC LIMIT 1',
          [req.user.id]
        );
        if (nextRows.length) {
          await txExecute(conn, 'UPDATE addresses SET is_default = 1 WHERE id = ?', [
            nextRows[0].id,
          ]);
        }
      }
    }
  });

  res.json({ ok: true });
}

module.exports = { list, create, update, makeDefault, remove };
