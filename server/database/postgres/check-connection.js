/**
 * Verify the EXTERNAL PostgreSQL database is reachable and ZAVORA-ready.
 *
 * Checks:
 *   1. TCP + auth + DATABASE_URL (.. or discrete PG vars) connect.
 *   2. Server version.
 *   3. Whether the 17 ZAVORA tables exist (warns if schema not yet applied).
 *
 * Run with: npm run db:pg:check
 */

const { getPool, closePool } = require('./pool');
const config = require('../../config');

const EXPECTED = [
  'users',
  'categories',
  'products',
  'product_supplier',
  'product_images',
  'product_variants',
  'addresses',
  'cart',
  'cart_items',
  'orders',
  'order_items',
  'payments',
  'shipments',
  'reviews',
  'wishlist',
  'cj_sync_logs',
  'store_settings',
];

async function main() {
  if (config.db.driver !== 'postgres') {
    console.warn(`[warn] DB_DRIVER='${config.db.driver}' (expected 'postgres').`);
  }
  const redacted = config.db.connectionString
    ? config.db.connectionString.replace(/:\/\/([^:]+):[^@]+@/, '://$1:****@')
    : `${config.db.user}@${config.db.host}:${config.db.port}/${config.db.database}`;
  console.log(`[pg] connecting to ${redacted} ...`);

  const pool = getPool();
  const version = await pool.query('SELECT version() AS v');
  console.log(`[pg] reachable: ${version.rows[0].v.split(' ').slice(0, 2).join(' ')}`);

  const tables = await pool.query(
    `SELECT tablename AS t FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );
  const have = new Set(tables.rows.map((r) => r.t));
  const missing = EXPECTED.filter((t) => !have.has(t));

  console.log(`[pg] public tables: ${tables.rows.length}`);
  if (!missing.length) {
    console.log('[pg] OK — all 17 ZAVORA tables present.');
  } else {
    console.log(`[pg] MISSING ${missing.length} table(s): ${missing.join(', ')}`);
    console.log('[pg] Run: npm run db:pg:schema  (then npm run db:pg:seed for demo data)');
    process.exitCode = 2;
  }
}

main()
  .then(() => closePool())
  .catch(async (err) => {
    console.error('[pg] connection FAILED:', err.message);
    if (/self signed|certificate|SSL/i.test(err.message)) {
      console.error('[pg] hint: hosted providers require SSL — the pool enables it automatically for DATABASE_URL with sslmode=require.');
    }
    if (/password authentication|role .* does not exist/i.test(err.message)) {
      console.error('[pg] hint: check the user/password (or full DATABASE_URL) in your env.');
    }
    if (/ENOTFOUND|EAI_AGAIN|timeout/i.test(err.message)) {
      console.error('[pg] hint: check the hostname/port and that your IP is allow-listed.');
    }
    await closePool().catch(() => {});
    process.exit(1);
  });
