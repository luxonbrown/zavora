/**
 * Applies server/database/schema.sql.
 *
 * The DDL is a multi-statement script, so this uses a dedicated connection with
 * `multipleStatements: true` rather than the shared pool. DDL is destructive by
 * design (it DROPs every ZAVORA table), which is why it is a separate script and
 * never part of server startup.
 *
 * Run with: npm run db:schema
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../config');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

async function main() {
  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');

  // Connect without a database so we can create it if it is missing.
  const bootstrap = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
  });

  const db = config.db.database;
  if (!/^[A-Za-z0-9_]+$/.test(db)) {
    throw new Error(`Refusing to use unsafe database name: ${db}`);
  }
  await bootstrap.query(
    `CREATE DATABASE IF NOT EXISTS \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await bootstrap.end();

  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: db,
    multipleStatements: true,
  });

  try {
    await conn.query(sql);
    const [tables] = await conn.query(
      'SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME',
      [db]
    );
    console.log(`Schema applied to \`${db}\` (${tables.length} tables):`);
    for (const { t } of tables) console.log(`  ${t}`);
  } finally {
    await conn.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Schema apply failed:', err.message);
    if (err.sql) console.error(`\nSQL:\n${String(err.sql).slice(0, 400)}`);
    process.exit(1);
  });
