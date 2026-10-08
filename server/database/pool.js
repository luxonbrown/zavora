/**
 * Shared database pool — driver dispatcher.
 *
 * Default is the original MySQL pool below. When config.db.driver is
 * 'postgres' (DB_DRIVER=postgres or DATABASE_URL set), this module re-exports
 * server/database/postgres/pool.js, which exposes the SAME API
 * (getPool/query/queryOne/execute/txQuery/txExecute/withTransaction/ping/
 * closePool) via a pg-backed translation shim. No controller/route/lib import
 * changes: everything keeps requiring `../database/pool`.
 */

const config = require('../config');

if ((config.db.driver || 'mysql').toLowerCase() === 'postgres') {
  module.exports = require('./postgres/pool');
  return;
}

/**
 * Shared MySQL connection pool.
 *
 * One pool per process, created lazily on first use so that requiring this file
 * has no side effects (tests and the seed script both import it safely).
 */

const mysql = require('mysql2/promise');

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      waitForConnections: true,
      connectionLimit: config.db.connectionLimit,
      queueLimit: 0,
      // Keep DECIMAL as a string so money never silently loses cents by
      // round-tripping through an IEEE double. Callers parse explicitly.
      decimalNumbers: false,
      dateStrings: false,
      charset: 'utf8mb4_general_ci',
      timezone: 'Z',
    });
  }
  return pool;
}

/** Convenience: run a SELECT and get the rows back. */
async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

/** Convenience: run a SELECT expected to match at most one row. */
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length ? rows[0] : null;
}

/**
 * Run an INSERT/UPDATE/DELETE; returns the driver result header.
 */
async function execute(sql, params = []) {
  const [result] = await getPool().execute(sql, params);
  return result;
}

/**
 * Run a SELECT on a transaction connection and get plain rows back.
 *
 * WHY THIS EXISTS: a raw mysql2 connection resolves `query()` to
 * `[rows, fields]`, while the pool helpers above resolve to `rows`. Code that
 * mixes the two silently reads `undefined` — `const [{ n }] = conn.query(...)`
 * destructures the rows ARRAY as though it were a row object. That mistake has
 * silently disabled real logic twice in this codebase, so transaction code
 * should call `txQuery` instead of touching `conn.query` for reads.
 */
async function txQuery(conn, sql, params = []) {
  const [rows] = await conn.query(sql, params);
  return rows;
}

/**
 * Run an INSERT/UPDATE/DELETE on a transaction connection and return the header.
 * Counterpart to txQuery; same rationale.
 */
async function txExecute(conn, sql, params = []) {
  const [result] = await conn.execute(sql, params);
  return result;
}

/**
 * Run `fn` inside a transaction, committing on success and rolling back on any
 * thrown error. The connection is always released.
 */
async function withTransaction(fn) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // A rollback failure must not mask the original error.
    }
    throw err;
  } finally {
    conn.release();
  }
}

/** Cheap liveness probe used by /api/health. */
async function ping() {
  const conn = await getPool().getConnection();
  try {
    await conn.ping();
    return true;
  } finally {
    conn.release();
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
};
