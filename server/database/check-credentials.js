/**
 * Confirms which passwords actually authenticate, so a login failure can be
 * attributed to the credentials rather than guessed at.
 * Usage: node database/check-credentials.js
 */
const bcrypt = require('bcrypt');
const { queryOne, query, closePool } = require('./pool');

const CANDIDATES = [
  'zavora-admin-2026',
  'zavora1234',
  'admin1234',
  'Zavora-admin-2026',
  'zavora-admin-2025',
  'zavora-admin-2024',
];

(async () => {
  const rows = await query('SELECT id, email, role, is_active, password_hash FROM users ORDER BY id LIMIT 5');

  for (const u of rows) {
    console.log(`\n${u.email}  (role=${u.role}, active=${u.is_active})`);
    for (const candidate of CANDIDATES) {
      let ok = false;
      try {
        ok = await bcrypt.compare(candidate, u.password_hash);
      } catch {
        ok = false;
      }
      if (ok) console.log(`   MATCHES: "${candidate}"`);
    }
    const anyMatch = [];
    for (const candidate of CANDIDATES) {
      // eslint-disable-next-line no-await-in-loop
      if (await bcrypt.compare(candidate, u.password_hash)) anyMatch.push(candidate);
    }
    if (anyMatch.length === 0) console.log('   (none of the candidate passwords match)');
  }

  await closePool();
})().catch(async (err) => {
  console.error(err);
  await closePool();
  process.exit(1);
});