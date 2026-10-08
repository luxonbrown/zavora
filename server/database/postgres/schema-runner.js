/**
 * Applies server/database/postgres/schema.sql to the EXTERNAL PostgreSQL DB.
 *
 * Unlike the MySQL runner, this does NOT create the database itself: managed
 * providers (Neon / Supabase / Railway / Render) provision the database and
 * hand you a DATABASE_URL. This script connects to that database and runs the
 * DDL (destructive: it DROPs every ZAVORA table).
 *
 * Run with: npm run db:pg:schema
 * Requires: DB_DRIVER=postgres + DATABASE_URL (or discrete PG* env, see README).
 */

const fs = require('fs');
const path = require('path');
const { getPool, closePool } = require('./pool');
const config = require('../../config');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

async function main() {
  if (config.db.driver !== 'postgres') {
    console.warn(
      `[warn] DB_DRIVER is '${config.db.driver}', expected 'postgres'. ` +
        `Set DB_DRIVER=postgres (and DATABASE_URL) to target the external PG database.`
    );
  }
  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const pool = getPool();
  const describe = config.db.connectionString
    ? config.db.connectionString.replace(/:\/\/([^:]+):[^@]+@/, '://$1:****@')
    : `${config.db.host}:${config.db.port}/${config.db.database}`;

  console.log(`[pg] applying schema to ${describe}`);
  // pg supports multi-statement simple-query protocol when no params are given.
  await pool.query(sql);

  const { rows } = await pool.query(
    `SELECT tablename AS t FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );
  console.log(`[pg] schema applied (${rows.length} tables):`);
  for (const { t } of rows) console.log(`  ${t}`);
}

main()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('[pg] schema apply failed:', err.message);
    if (err.position) console.error(`  at character ${err.position}`);
    await closePool().catch(() => {});
    process.exit(1);
  });
