/**
 * Archive products that cannot be sold because CJ supplied no usable price.
 * One-off cleanup for catalogues imported before the importable-price rule.
 * Usage: node database/archive-unpriceable.js
 */
const { withTransaction, query, closePool } = require('./pool');

async function main() {
  const before = await query(
    'SELECT COUNT(*) AS n FROM products WHERE is_active = 1 AND price <= 0'
  );

  const affected = await withTransaction(async (conn) => {
    // Archived, not deleted: order history references these products.
    const [res] = await conn.query(
      "UPDATE products SET is_active = 0, status = 'archived' WHERE is_active = 1 AND price <= 0"
    );
    // Nobody should be able to check out a free line.
    await conn.query(
      'DELETE ci FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE p.price <= 0'
    );
    return res.affectedRows;
  });

  const after = await query(
    'SELECT COUNT(*) AS n FROM products WHERE is_active = 1 AND price <= 0'
  );
  const live = await query(
    'SELECT MIN(price) AS lo, MAX(price) AS hi, COUNT(*) AS n FROM products WHERE is_active = 1'
  );

  console.log(`archived unpriceable products : ${affected}`);
  console.log(`zero-price still on sale       : ${before[0].n} -> ${after[0].n}`);
  console.log(`live catalogue                 : ${live[0].n} products, $${live[0].lo} - $${live[0].hi}`);
}

main()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error(err.message);
    await closePool();
    process.exit(1);
  });