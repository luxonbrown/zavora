/**
 * Customer account: profile, password, notification preferences, deletion.
 *
 * Every setting is persisted to the database — no client-side fixtures. The
 * payloads mirror what the account pages render so what the user saves is what
 * they get on the next load.
 */

const bcrypt = require('bcrypt');
const { queryOne, execute } = require('../database/pool');
const { HttpError } = require('../middleware/error');
const { publicUser, PUBLIC_USER_COLUMNS } = require('../middleware/auth');
const { isValidEmail, cleanString } = require('../lib/validate');

const BCRYPT_ROUNDS = 10;
const MAX_PASSWORD_LENGTH = 200;

const DEFAULT_PREFERENCES = {
  orderUpdates: true,
  backInStock: true,
  weeklyDrop: false,
  offers: false,
};

function parsePreferences(raw) {
  if (!raw) return { ...DEFAULT_PREFERENCES };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_PREFERENCES };
    // Only known keys survive; unknown keys are dropped, not persisted.
    return {
      orderUpdates: Boolean(parsed.orderUpdates ?? true),
      backInStock: Boolean(parsed.backInStock ?? true),
      weeklyDrop: Boolean(parsed.weeklyDrop ?? false),
      offers: Boolean(parsed.offers ?? false),
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

/** GET /api/account/profile — the signed-in user's editable details. */
async function getProfile(req, res) {
  const row = await queryOne(
    `SELECT ${PUBLIC_USER_COLUMNS}, email_preferences FROM users WHERE id = ? LIMIT 1`,
    [req.user.id]
  );
  if (!row) throw HttpError.notFound('Account not found');
  res.json({
    ok: true,
    user: publicUser(row),
    preferences: parsePreferences(row.email_preferences),
  });
}

/** PUT /api/account/profile — update name, email and phone. */
async function updateProfile(req, res) {
  const body = req.body || {};
  const firstName = cleanString(body.firstName, 80);
  const lastName = cleanString(body.lastName, 80);
  const phone = cleanString(body.phone, 40);

  if (!firstName) throw HttpError.badRequest('Enter your first name');
  if (!lastName) throw HttpError.badRequest('Enter your last name');

  let email = null;
  if (body.email !== undefined) {
    if (!isValidEmail(body.email)) throw HttpError.badRequest('Enter a valid email address');
    email = String(body.email).trim().toLowerCase();
    const taken = await queryOne('SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1', [
      email,
      req.user.id,
    ]);
    if (taken) throw HttpError.conflict('That email address is already in use');
  }

  await execute(
    'UPDATE users SET first_name = ?, last_name = ?, phone = ?, email = COALESCE(?, email) WHERE id = ?',
    [firstName, lastName, phone, email, req.user.id]
  );

  const row = await queryOne(`SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE id = ? LIMIT 1`, [req.user.id]);
  res.json({ ok: true, user: publicUser(row) });
}

/** POST /api/account/password — verify the current password before replacing it. */
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || !currentPassword) {
    throw HttpError.badRequest('Enter your current password');
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    throw HttpError.badRequest('Use at least 8 characters for the new password');
  }
  if (newPassword.length > MAX_PASSWORD_LENGTH) {
    throw HttpError.badRequest('Password is too long');
  }

  const row = await queryOne('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [req.user.id]);
  if (!row) throw HttpError.notFound('Account not found');
  const matches = await bcrypt.compare(currentPassword, row.password_hash);
  if (!matches) throw HttpError.unauthorized('Your current password is incorrect');

  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
  res.json({ ok: true });
}

/** GET /api/account/preferences */
async function getPreferences(req, res) {
  const row = await queryOne('SELECT email_preferences FROM users WHERE id = ? LIMIT 1', [req.user.id]);
  res.json({ ok: true, preferences: parsePreferences(row ? row.email_preferences : null) });
}

/** PUT /api/account/preferences — merge only the keys we persist. */
async function updatePreferences(req, res) {
  const body = req.body || {};
  const current = await getPreferencesInternal(req.user.id);
  const next = {
    orderUpdates: body.orderUpdates !== undefined ? Boolean(body.orderUpdates) : current.orderUpdates,
    backInStock: body.backInStock !== undefined ? Boolean(body.backInStock) : current.backInStock,
    weeklyDrop: body.weeklyDrop !== undefined ? Boolean(body.weeklyDrop) : current.weeklyDrop,
    offers: body.offers !== undefined ? Boolean(body.offers) : current.offers,
  };
  await execute('UPDATE users SET email_preferences = ? WHERE id = ?', [
    JSON.stringify(next),
    req.user.id,
  ]);
  res.json({ ok: true, preferences: next });
}

async function getPreferencesInternal(userId) {
  const row = await queryOne('SELECT email_preferences FROM users WHERE id = ? LIMIT 1', [userId]);
  return parsePreferences(row ? row.email_preferences : null);
}

/**
 * POST /api/account/delete — keep financial history, sever identity.
 * Orders keep their snapshots with user_id set to NULL via the FK; addresses,
 * wishlist, cart and the session are removed.
 */
async function deleteAccount(req, res) {
  const userId = req.user.id;
  await execute('DELETE FROM wishlist WHERE user_id = ?', [userId]);
  await execute('DELETE FROM addresses WHERE user_id = ?', [userId]);
  const carts = await queryOne('SELECT id FROM cart WHERE user_id = ? LIMIT 1', [userId]);
  if (carts) await execute('DELETE FROM cart_items WHERE cart_id = ?', [carts.id]);
  await execute('DELETE FROM cart WHERE user_id = ?', [userId]);
  await execute('UPDATE orders SET user_id = NULL WHERE user_id = ?', [userId]);
  await execute(
    "UPDATE users SET is_active = 0, email_preferences = NULL, first_name = '', last_name = '', phone = '', referral_code = NULL WHERE id = ?",
    [userId]
  );
  await new Promise((resolve, reject) =>
    req.session.destroy((err) => (err ? reject(err) : resolve()))
  );
  res.clearCookie('zavora.sid');
  res.json({ ok: true });
}

module.exports = { getProfile, updateProfile, changePassword, getPreferences, updatePreferences, deleteAccount };
