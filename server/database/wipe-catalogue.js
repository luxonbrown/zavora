/**
 * Wipe the product catalogue while keeping customers and orders.
 *
 * Use this to hand the catalogue over entirely to CJdropshipping. Unlike
 * `db:schema`, it does NOT touch users, orders, addresses or the order
 * history — those are business records, not catalogue data.
 *
 * What gets removed:
 *   products          (cascades to product_images, product_variants,
 *                      product_supplier, reviews, wishlist, cart_items)
 *   categories        (rebuilt as the CJ three-level tree on the next sync)
 *
 * What survives, and why:
 *   order_items       `product_id` is ON DELETE SET NULL, and every line
 *                      snapshots name / variant / image / unit price, so order
 *                      history and invoices remain complete and correct even
 *                      though the product no longer exists.
 *   users, orders, addresses, payments, shipments, store_settings — untouched.
 *
 * Usage: node database/wipe-catalogue.js            (asks nothing, prints a plan)
 *        node database/wipe-catalogue.js --yes      (skips the confirmation)
 */

const readline = require('readline');
const { query, execute, closePool } = require('./pool');

async function counts() {
  const tables = [
    'products',
    'product_images',
    'product_variants',
    'product_supplier',
    'reviews',
    'wishlist',
    'categories',
    'order_items',
    'orders',
    'users',
  ];
  const out = {};
  for (const table of tables) {
    const rows = await query(`SELECT COUNT(*) AS n FROM \`${table}\``);
    out[table] = Number(rows[0].n);
  }
  return out;
}

async function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => rl.question(question, resolve));
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

async function main() {
  const before = await counts();
  const skipPrompt = process.argv.includes('--yes');

  console.log('Catalogue wipe plan\n');
  console.log('  WILL BE DELETED');
  for (const t of ['products', 'product_images', 'product_variants', 'product_supplier', 'reviews', 'wishlist', 'categories']) {
    console.log(`    ${String(before[t]).padStart(6)}  ${t}`);
  }
  console.log('\n  WILL BE KEPT');
  for (const t of ['users', 'orders', 'order_items']) {
    console.log(`    ${String(before[t]).padStart(6)}  ${t}`);
  }
  console.log(
    '\n  order_items keep their name/image/price snapshots, so order history stays intact\n' +
      '  even though the products themselves are removed.\n'
  );

  if (!skipPrompt) {
    const ok = await confirm('  Proceed? This cannot be undone. [y/N] ');
    if (!ok) {
      console.log('\n  Cancelled. Nothing was changed.');
      return;
    }
  }

  await execute('SET FOREIGN_KEY_CHECKS = 0');
  try {
    for (const table of ['product_images', 'product_variants', 'product_supplier', 'cart_items', 'wishlist', 'reviews', 'products', 'categories']) {
      await execute(`TRUNCATE TABLE \`${table}\``);
    }
  } finally {
    await execute('SET FOREIGN_KEY_CHECKS = 1');
  }

  const after = await counts();
  console.log('\n  Done.');
  console.log(`    products: ${before.products} -> ${after.products}`);
  console.log(`    categories: ${before.categories} -> ${after.categories}`);
  console.log(`    orders kept: ${after.orders}   order_items kept: ${after.order_items}`);

  const orphans = await query(
    'SELECT COUNT(*) AS n FROM order_items WHERE product_id IS NULL'
  );
  console.log(
    `\n  ${Number(orphans[0].n)} order line(s) now reference no product. ` +
      'Their snapshots are intact, so the dashboard and invoices still render correctly.'
  );
}

main()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('Wipe failed:', err.message);
    await closePool().catch(() => {});
    process.exit(1);
  });