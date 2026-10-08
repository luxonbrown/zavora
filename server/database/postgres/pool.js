/**
 * ZAVORA — PostgreSQL pool (external database).
 *
 * Exposes the SAME interface as server/database/pool.js (MySQL):
 *   getPool, query, queryOne, execute, txQuery, txExecute,
 *   withTransaction, ping, closePool
 *
 * so every controller / lib / service works unchanged when
 * DB_DRIVER=postgres (or DATABASE_URL is set).
 *
 * What the shim translates at runtime:
 *   1. `?` placeholders -> $1, $2, ... (quote-aware, so '?' in string
 *      literals is untouched).
 *   2. Backticks `name` -> stripped (Postgres uses unquoted lowercase ids).
 *   3. `SET FOREIGN_KEY_CHECKS = 0|1` -> no-op (seed/TRUNCATE helper).
 *   4. `TRUNCATE TABLE x` -> `TRUNCATE TABLE x RESTART IDENTITY CASCADE`.
 *   5. `ON DUPLICATE KEY UPDATE a = VALUES(a)` ->
 *      `ON CONFLICT (<keys>) DO UPDATE SET a = EXCLUDED.a`
 *      Conflict targets are resolved per table (store_settings,
 *      product_variants, cart_items). Unknown tables fail loudly rather than
 *      silently doing the wrong upsert.
 *   6. Plain INSERTs get `RETURNING id` appended so execute() can return
 *      { insertId } like mysql2 does. UPDATE/DELETE return { affectedRows }
 *      from pg's rowCount.
 *
 * NUMERIC columns come back as strings from pg by default — identical to
 * mysql2 with decimalNumbers:false — so server/lib/money.js is untouched.
 */

const { Pool } = require('pg');
const config = require('../../config');

let pool = null;

function buildPoolConfig() {
  // External hosted DB wins when DATABASE_URL is set
  // (Neon / Supabase / Railway / Render all provide one).
  if (config.db.connectionString) {
    const sslRequired =
      config.db.ssl ||
      /sslmode=require/i.test(config.db.connectionString) ||
      /(neon\.tech|supabase\.co|render\.com)/i.test(config.db.connectionString);
    return {
      connectionString: config.db.connectionString,
      max: config.db.connectionLimit || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ...(sslRequired ? { ssl: { rejectUnauthorized: false } } : {}),
    };
  }
  const sslRequired = Boolean(config.db.ssl);
  return {
    host: config.db.host,
    port: config.db.port === 3306 ? 5432 : config.db.port, // 3306 is the MySQL default; PG listens on 5432
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    max: config.db.connectionLimit || 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ...(sslRequired ? { ssl: { rejectUnauthorized: false } } : {}),
  };
}

function getPool() {
  if (!pool) pool = new Pool(buildPoolConfig());
  return pool;
}

/** Replace `?` with $n, skipping single/double-quoted literals. */
function dollarPlaceholders(sql) {
  let out = '';
  let n = 0;
  let quote = null;
  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    if (quote) {
      out += ch;
      if (ch === quote && sql[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === '?') {
      n += 1;
      out += `$${n}`;
      continue;
    }
    out += ch;
  }
  return out;
}

/**
 * Map each known upsert table to its Postgres conflict target.
 * Must match the UNIQUE constraints in postgres/schema.sql.
 */
function conflictTarget(sql) {
  if (/into\s+store_settings/i.test(sql)) return '(setting_key)';
  if (/into\s+product_variants/i.test(sql)) return '(product_id, name)';
  if (/into\s+cart_items/i.test(sql)) return '(cart_id, product_id, variant_key)';
  if (/into\s+product_supplier/i.test(sql)) return '(product_id, supplier)';
  if (/into\s+categories/i.test(sql)) return '(slug)';
  if (/into\s+products/i.test(sql)) return '(slug)';
  return null;
}

function translateSql(rawSql) {
  let sql = String(rawSql);

  // 1. Backticks are MySQL quoting; Postgres identifiers here are lowercase.
  if (sql.includes('`')) sql = sql.replace(/`/g, '');

  const trimmed = sql.trim().toUpperCase();

  // 2. MySQL FK toggle has no PG equivalent; TRUNCATE ... CASCADE covers it.
  if (/^SET\s+FOREIGN_KEY_CHECKS\s*=\s*[01]\s*;?\s*$/i.test(sql.trim())) {
    return { sql: 'SELECT 1', noop: true };
  }
  if (/^SET\s+NAMES\s+/i.test(sql.trim())) {
    return { sql: 'SELECT 1', noop: true };
  }

  // 3. TRUNCATE needs identity reset + cascade on PG to mirror a fresh seed.
  sql = sql.replace(
    /TRUNCATE\s+TABLE\s+([A-Za-z0-9_"]+)/gi,
    'TRUNCATE TABLE $1 RESTART IDENTITY CASCADE'
  );

  // 4. ON DUPLICATE KEY UPDATE -> ON CONFLICT ... DO UPDATE SET ... = EXCLUDED...
  if (/ON\s+DUPLICATE\s+KEY\s+UPDATE/i.test(sql)) {
    // VALUES(col) -> EXCLUDED.col (MySQL function -> PG pseudo-table).
    sql = sql.replace(/VALUES\s*\(\s*([A-Za-z0-9_"]+)\s*\)/gi, 'EXCLUDED.$1');
    const target = conflictTarget(sql);
    if (!target) {
      throw new Error(
        `postgres shim: ON DUPLICATE KEY UPDATE for unknown table — add a conflict target in postgres/pool.js. SQL: ${rawSql.slice(0, 160)}`
      );
    }
    sql = sql.replace(/ON\s+DUPLICATE\s+KEY\s+UPDATE/i, `ON CONFLICT ${target} DO UPDATE SET`);
  }

  // 5. ? -> $n (after the rewrites above so injected EXCLUDED cols are safe).
  sql = dollarPlaceholders(sql);

  // 6. Plain INSERTs need RETURNING id so execute() can report insertId.
  if (/^\s*INSERT\s+/i.test(sql) && !/RETURNING\s+/i.test(sql)) {
    sql += ' RETURNING id';
  }

  return { sql, noop: false };
}

/** Run SQL through pg, returning the raw pg result. */
async function rawQuery(sql, params = [], client = null) {
  const { sql: text, noop } = translateSql(sql);
  if (noop) return { rows: [], rowCount: 0, fields: [] };
  const executor = client || getPool();
  return executor.query(text, params);
}

/** SELECT -> rows array (mirrors mysql pool.query). */
async function query(sql, params = [], client = null) {
  const res = await rawQuery(sql, params, client);
  return res.rows;
}

/** SELECT expecting at most one row. */
async function queryOne(sql, params = [], client = null) {
  const rows = await query(sql, params, client);
  return rows.length ? rows[0] : null;
}

/**
 * INSERT/UPDATE/DELETE -> { insertId, affectedRows } (mirrors mysql execute).
 * For SELECT via execute (rare), falls back to returning rows like mysql2.
 */
async function execute(sql, params = [], client = null) {
  const res = await rawQuery(sql, params, client);
  if (/^\s*SELECT\s+/i.test(sql.trim().replace(/`/g, ''))) return res.rows;
  const insertId =
    res.rows && res.rows[0] && res.rows[0].id !== undefined ? Number(res.rows[0].id) : undefined;
  return {
    insertId,
    affectedRows: typeof res.rowCount === 'number' ? res.rowCount : 0,
    rowCount: res.rowCount,
  };
}

/** Transaction helpers operating on a pg client (mirror mysql tx helpers). */
async function txQuery(conn, sql, params = []) {
  const res = await rawQuery(sql, params, conn);
  return res.rows;
}

async function txExecute(conn, sql, params = []) {
  const res = await rawQuery(sql, params, conn);
  if (/^\s*SELECT\s+/i.test(sql.trim().replace(/`/g, ''))) return res.rows;
  const insertId =
    res.rows && res.rows[0] && res.rows[0].id !== undefined ? Number(res.rows[0].id) : undefined;
  return { insertId, affectedRows: res.rowCount ?? 0, rowCount: res.rowCount };
}

/**
 * Wrap a pg client so transaction callbacks can keep using the mysql2
 * connection shape:
 *   conn.query(sql, params)   -> [rows, fields]
 *   conn.execute(sql, params) -> [header, fields]  (or [rows, fields] for SELECT)
 */
function wrapTxClient(client) {
  return {
    query: async (sql, params = []) => {
      const res = await rawQuery(sql, params, client);
      return [res.rows, []];
    },
    execute: async (sql, params = []) => {
      const res = await rawQuery(sql, params, client);
      if (/^\s*SELECT\s+/i.test(String(sql).trim().replace(/`/g, ''))) return [res.rows, []];
      const insertId =
        res.rows && res.rows[0] && res.rows[0].id !== undefined
          ? Number(res.rows[0].id)
          : undefined;
      return [{ insertId, affectedRows: res.rowCount ?? 0, rowCount: res.rowCount }, []];
    },
    // Exposed for code that explicitly wants pg semantics.
    __pgClient: client,
  };
}

async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(wrapTxClient(client));
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // A rollback failure must not mask the original error.
    }
    throw err;
  } finally {
    client.release();
  }
}

async function ping() {
  const client = await getPool().connect();
  try {
    await client.query('SELECT 1');
    return true;
  } finally {
    client.release();
  }
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  getPool,
  query,
  queryOne,
  execute,
  txQuery,
  txExecute,
  withTransaction,
  ping,
  closePool,
  // Exported for diagnostics / unit checks.
  _translateSql: (s) => translateSql(s).sql,
};
