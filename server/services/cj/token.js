/**
 * CJdropshipping access-token management.
 *
 * Two-stage auth:
 *   1. POST /authentication/getAccessToken  { apiKey }  ->  accessToken (~566 chars)
 *   2. every later call carries  `CJ-Access-Token: <accessToken>`
 *
 * The token is valid ~180 days, so it is cached in `store_settings` rather than
 * re-fetched per run — the token endpoint shares the same 1 req/s budget as the
 * rest of the API, and burning a request on every process start would slow every
 * sync. `store_settings` is never exposed by any endpoint, so the token cannot
 * leak to the browser.
 *
 * If the cached token is rejected (401) it is discarded once and the refresh
 * path is attempted before giving up, so a stale cache self-heals.
 */

const crypto = require('crypto');
const config = require('../../config');
const { queryOne, execute } = require('../../database/pool');

const KEYS = {
  access: 'cj.access_token',
  accessExpiry: 'cj.access_token_expiry',
  refresh: 'cj.refresh_token',
  refreshExpiry: 'cj.refresh_token_expiry',
  openId: 'cj.open_id',
};

/** In-process memo, so a burst of calls in one run reuses one token. */
let cached = null;
/** De-duplicates concurrent refreshes: many callers, one network call. */
let inFlight = null;

function configured() {
  return Boolean(config.cj.apiKey) && !config.cj.apiKey.startsWith('REPLACE_ME');
}

async function readSetting(key) {
  const row = await queryOne('SELECT setting_value FROM store_settings WHERE setting_key = ?', [key]);
  return row ? row.setting_value : null;
}

async function writeSetting(key, value) {
  if (value === null || value === undefined) {
    await execute('DELETE FROM store_settings WHERE setting_key = ?', [key]);
    return;
  }
  await execute(
    `INSERT INTO store_settings (setting_key, setting_value, setting_group)
     VALUES (?, ?, 'cj')
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), setting_group = 'cj'`,
    [key, String(value)]
  );
}

async function persist(token) {
  await Promise.all([
    writeSetting(KEYS.access, token.accessToken),
    writeSetting(KEYS.accessExpiry, token.accessTokenExpiryDate),
    writeSetting(KEYS.refresh, token.refreshToken),
    writeSetting(KEYS.refreshExpiry, token.refreshTokenExpiryDate),
    writeSetting(KEYS.openId, token.openId),
  ]);
  cached = token;
  return token;
}

/**
 * Drop the persisted token. DESTRUCTIVE: deletes the stored credential, so the
 * next call has to re-authorise and spend a request from the 1/sec budget.
 *
 * Deliberately not called `clearCache`, which sounds harmless. Tests must not
 * use this — it would wipe the real credential. Snapshot and restore the
 * `cj.*` settings rows instead, or use `invalidate()` for the memory memo only.
 */
async function forgetPersistedToken() {
  cached = null;
  await Promise.all(Object.values(KEYS).map((k) => writeSetting(k, null)));
}

/** The raw `cj.*` setting rows, so a caller can snapshot and restore them. */
async function readPersistedRows() {
  const { query } = require('../../database/pool');
  return query(
    "SELECT setting_key, setting_value FROM store_settings WHERE setting_group = 'cj'"
  );
}

/** Restore a snapshot taken with readPersistedRows. */
async function restorePersistedRows(rows) {
  const { execute } = require('../../database/pool');
  await Promise.all(Object.values(KEYS).map((k) => writeSetting(k, null)));
  for (const row of rows || []) {
    await execute(
      `INSERT INTO store_settings (setting_key, setting_value, setting_group)
       VALUES (?, ?, 'cj')
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [row.setting_key, row.setting_value]
    );
  }
  cached = null;
}

/** A token is usable if it exists and expires more than `skewMs` from now. */
function isFresh(token, skewMs = 120000) {
  if (!token?.accessToken || !token.accessTokenExpiryDate) return false;
  const expiry = new Date(token.accessTokenExpiryDate).getTime();
  if (Number.isNaN(expiry)) return false;
  return expiry - skewMs > Date.now();
}

async function requestToken(path, body) {
  const url = `${config.cj.baseUrl}${config.cj.apiPrefix}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.cj.requestTimeoutMs),
  });

  let json = null;
  try {
    json = await res.json();
  } catch {
    throw new Error(`CJ returned a non-JSON response (HTTP ${res.status})`);
  }

  if (!res.ok || json.result === false || json.code !== 200) {
    const err = new Error(`CJ auth failed (${res.status}): ${json.message || 'unknown error'}`);
    err.cjCode = json.code;
    err.status = res.status;
    throw err;
  }
  return json.data;
}

async function loadFromDb() {
  const [access, accessExpiry, refresh, refreshExpiry, openId] = await Promise.all([
    readSetting(KEYS.access),
    readSetting(KEYS.accessExpiry),
    readSetting(KEYS.refresh),
    readSetting(KEYS.refreshExpiry),
    readSetting(KEYS.openId),
  ]);
  if (!access) return null;
  return {
    accessToken: access,
    accessTokenExpiryDate: accessExpiry,
    refreshToken: refresh,
    refreshTokenExpiryDate: refreshExpiry,
    openId,
  };
}

/** Exchange the apiKey for a brand-new token pair. */
async function exchange() {
  if (!configured()) {
    const err = new Error(
      'CJ apiKey is not configured. Set cj.apiKey in server/config.js or CJ_API_KEY.'
    );
    err.status = 503;
    throw err;
  }
  const data = await requestToken(config.cj.auth.tokenPath, { apiKey: config.cj.apiKey });
  return persist(data);
}

/** Trade the refresh token for a fresh access token. */
async function refresh() {
  const current = cached || (await loadFromDb());
  if (!current?.refreshToken) return exchange();
  try {
    const data = await requestToken(config.cj.auth.refreshPath, {
      refreshToken: current.refreshToken,
    });
    return persist(data);
  } catch (err) {
    // A dead refresh token means full re-authorisation is the only route.
    if (err.cjCode === 1600003 || err.status === 401) return exchange();
    throw err;
  }
}

/**
 * Return a usable access token, obtaining one if needed.
 * Concurrent callers share a single in-flight request.
 */
async function getAccessToken() {
  if (isFresh(cached)) return cached.accessToken;

  if (!inFlight) {
    inFlight = (async () => {
      const stored = await loadFromDb();
      if (isFresh(stored)) return stored;
      return refresh();
    })().finally(() => {
      inFlight = null;
    });
  }

  const token = await inFlight;
  return token.accessToken;
}

/** Force the next call to re-authorise. Used after a 401. */
function invalidate() {
  cached = null;
  inFlight = null;
}

/** Non-secret status for the admin UI. */
async function status() {
  const token = cached || (await loadFromDb());
  return {
    configured: configured(),
    hasToken: Boolean(token?.accessToken),
    // Coerced to a string: straight from the CJ response this is a number, but
    // after a round trip through store_settings it is a string, and the admin UI
    // should not have to handle both.
    openId: token?.openId === undefined || token?.openId === null ? null : String(token.openId),
    expiresAt: token?.accessTokenExpiryDate ?? null,
    expired: token?.accessTokenExpiryDate
      ? new Date(token.accessTokenExpiryDate).getTime() <= Date.now()
      : null,
  };
}

/** Redacted fingerprint, safe to log. */
function fingerprint() {
  if (!cached?.accessToken) return null;
  return crypto.createHash('sha256').update(cached.accessToken).digest('hex').slice(0, 12);
}

module.exports = {
  getAccessToken,
  invalidate,
  status,
  forgetPersistedToken,
  readPersistedRows,
  restorePersistedRows,
  fingerprint,
  isFresh,
  KEYS,
};