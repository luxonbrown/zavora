/**
 * Auth endpoints. Session-cookie based; no JWT is issued.
 */

const bcrypt = require('bcrypt');
const { queryOne, execute } = require('../database/pool');
const { HttpError } = require('../middleware/error');
const { publicUser, PUBLIC_USER_COLUMNS, markLogin } = require('../middleware/auth');
const { isValidEmail } = require('../lib/validate');
const cart = require('./cart');

const BCRYPT_ROUNDS = 10;

// Generous ceiling to bound bcrypt cost against a brute-force attempt; also
// stops an attacker parking a 10 MB "password" in memory.
const MAX_PASSWORD_LENGTH = 200;

/** POST /api/auth/register */
async function register(req, res) {
  const { email, password, firstName = '', lastName = '', phone = '' } = req.body || {};

  if (!isValidEmail(email)) throw HttpError.badRequest('Enter a valid email address');
  if (typeof password !== 'string' || password.length < 8) {
    throw HttpError.badRequest('Password must be at least 8 characters');
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw HttpError.badRequest('Password is too long');
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const existing = await queryOne('SELECT id FROM users WHERE email = ? LIMIT 1', [
    normalizedEmail,
  ]);
  if (existing) throw HttpError.conflict('An account with that email already exists');

  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const result = await execute(
    'INSERT INTO users (email, password_hash, first_name, last_name, phone) VALUES (?, ?, ?, ?, ?)',
    [
      normalizedEmail,
      hash,
      String(firstName).slice(0, 80),
      String(lastName).slice(0, 80),
      String(phone).slice(0, 40),
    ]
  );

  // Establish the session so the client is signed in straight after registering.
  await new Promise((resolve, reject) =>
    req.session.regenerate((err) => (err ? reject(err) : resolve()))
  );
  req.session.userId = String(result.insertId);

  const user = await queryOne(`SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE id = ? LIMIT 1`, [
    result.insertId,
  ]);

  res.status(201).json({ ok: true, user: publicUser(user) });
}

/** POST /api/auth/login */
async function login(req, res) {
  const { email, password } = req.body || {};

  if (!isValidEmail(email) || typeof password !== 'string') {
    throw HttpError.badRequest('Email and password are required');
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const row = await queryOne(
    'SELECT id, password_hash, is_active FROM users WHERE email = ? LIMIT 1',
    [normalizedEmail]
  );

  // Always run a bcrypt comparison so a missing account and a wrong password
  // take the same time, which stops this endpoint being used to enumerate
  // registered emails.
  const hash = row ? row.password_hash : '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const passwordMatches = await bcrypt.compare(password, hash);

  if (!row || !passwordMatches) throw HttpError.unauthorized('Incorrect email or password');
  if (!row.is_active) throw HttpError.forbidden('This account has been disabled');

  // Rotate the session id on privilege change to prevent session fixation.
  await new Promise((resolve, reject) =>
    req.session.regenerate((err) => (err ? reject(err) : resolve()))
  );
  req.session.userId = String(row.id);
  await markLogin(row.id);

  // Preserve anything the visitor put in their cart before signing in.
  await cart.mergeGuestCart(req, row.id);

  const user = await queryOne(`SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE id = ? LIMIT 1`, [
    row.id,
  ]);

  res.json({ ok: true, user: publicUser(user) });
}

/** POST /api/auth/logout — clears the cookie session. */
async function logout(req, res) {
  await new Promise((resolve, reject) =>
    req.session.destroy((err) => (err ? reject(err) : resolve()))
  );
  res.clearCookie('zavora.sid');
  res.json({ ok: true });
}

/** GET /api/auth/me — the client bootstraps its session state from here. */
async function me(req, res) {
  if (!req.user) {
    res.json({ ok: true, user: null });
    return;
  }
  res.json({ ok: true, user: req.publicUser });
}

/**
 * POST /api/auth/forgot-password
 *
 * Always responds identically so the endpoint cannot be used to discover which
 * addresses are registered. A real deployment would enqueue a reset email here;
 * that mail transport is intentionally not wired up yet.
 */
async function forgotPassword(req, res) {
  const { email } = req.body || {};
  if (!isValidEmail(email)) throw HttpError.badRequest('Enter a valid email address');
  res.json({
    ok: true,
    message: 'If an account exists for that address, a reset link is on its way.',
  });
}

module.exports = { register, login, logout, me, forgotPassword };
