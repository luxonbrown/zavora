/**
 * Session-based auth.
 *
 * No JWT: identity lives in the express-session cookie, so there is nothing in
 * localStorage to steal via XSS. `attachUser` runs on every request and resolves
 * `req.session.userId` to a fresh user row (cheap, and it means a deactivated
 * or deleted account stops working immediately instead of persisting to the
 * cookie's expiry).
 */

const { queryOne, execute } = require('../database/pool');
const { HttpError } = require('./error');

const PUBLIC_USER_COLUMNS = `id, email, first_name, last_name, phone, role, is_active, created_at`;

/** Shape a user row for the API. Never includes password_hash. */
function publicUser(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    role: row.role,
    createdAt: row.created_at,
  };
}

/** Resolve the signed-in user, if any. Never throws for anonymous visitors. */
async function attachUser(req, res, next) {
  req.user = null;
  const userId = req.session && req.session.userId;
  if (!userId) return next();

  try {
    const row = await queryOne(
      `SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );
    // Inactive accounts are treated as anonymous from here on.
    if (row && row.is_active) {
      req.user = row;
      req.publicUser = publicUser(row);
    } else {
      delete req.session.userId;
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

/** Gate for routes that need a signed-in user. */
function requireAuth(req, res, next) {
  if (!req.user) return next(HttpError.unauthorized());
  return next();
}

/** Gate for admin-only routes. Admin is a role, never a separate identity. */
function requireAdmin(req, res, next) {
  if (!req.user) return next(HttpError.unauthorized());
  if (req.user.role !== 'admin') return next(HttpError.forbidden('Admin access required'));
  return next();
}

/** Record a successful sign-in (used by the auth controller). */
async function markLogin(userId) {
  await execute('UPDATE users SET last_login_at = NOW() WHERE id = ?', [userId]);
}

module.exports = { attachUser, requireAuth, requireAdmin, publicUser, PUBLIC_USER_COLUMNS, markLogin };
