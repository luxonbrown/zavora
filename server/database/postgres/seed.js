/**
 * ZAVORA seed script — PostgreSQL (external database).
 *
 * Same demo data as server/database/seed.js (MySQL), applied through
 * server/database/postgres/pool.js, whose shim translates `?` -> $n,
 * backticks, and RETURNING id, so the INSERT code below is unchanged.
 *
 * Wipe uses TRUNCATE ... RESTART IDENTITY CASCADE (Postgres equivalent of
 * MySQL's SET FOREIGN_KEY_CHECKS=0 + TRUNCATE).
 *
 * Run with: npm run db:pg:seed  (requires DB_DRIVER=postgres + DATABASE_URL)
 *
 * Money note: NUMERIC columns come back from pg as strings (like mysql2 with
 * decimalNumbers:false), and they go in as strings here too. Every arithmetic
 * step is done in integer cents and only converted for display, so no rounding
 * error can accumulate.
 */

const bcrypt = require('bcrypt');
const { withTransaction, closePool } = require('./pool');
const {
  categories,
  products,
  users,
  addresses,
  reviews,
  orders,
  settings,
} = require('../seed-data');

const BCRYPT_ROUNDS = 10;

/** USD cents, integer, so subtotal/tax/total math is exact. */
const toCents = (amount) => Math.round(Number(amount) * 100);
const fromCents = (cents) => (cents / 100).toFixed(2);

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10, 0, 0, 0);
  return d;
};

/** Free shipping over the configured threshold, else the standard fee. */
const shippingCostFor = (subtotalCents) =>
  subtotalCents >= toCents(150) ? 0 : toCents(6.95);

async function seed() {
  await withTransaction(async (conn) => {
    // ---- wipe (Postgres: single CASCADE truncate, identities restarted) ----
    await conn.query(
      `TRUNCATE TABLE
        shipments, payments, order_items, orders, reviews, wishlist,
        cart_items, cart, addresses, product_images, product_variants,
        product_supplier, products, categories, users,
        store_settings, cj_sync_logs
       RESTART IDENTITY CASCADE`
    );

    // ---- settings ---------------------------------------------------------
    for (const [key, value, group] of settings) {
      await conn.execute(
        'INSERT INTO store_settings (setting_key, setting_value, setting_group) VALUES (?, ?, ?)',
        [key, value, group]
      );
    }

    // ---- categories -------------------------------------------------------
    const categoryIds = {};
    for (const cat of categories) {
      const [res] = await conn.execute(
        'INSERT INTO categories (name, slug, tagline, position, is_active) VALUES (?, ?, ?, ?, 1)',
        [cat.name, cat.slug, cat.tagline, cat.position]
      );
      categoryIds[cat.slug] = res.insertId;
    }

    // ---- products ---------------------------------------------------------
    const productIds = {};
    const variantIds = {};
    for (const p of products) {
      const [res] = await conn.execute(
        `INSERT INTO products
           (category_id, name, slug, sku, brand, short_description, description,
            price, compare_at_price, rating, review_count, stock,
            badge, specifications, status, is_active, published_at)
         VALUES (?, ?, ?, ?, 'ZAVORA', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?)`,
        [
          categoryIds[p.category],
          p.name,
          p.slug,
          p.sku,
          p.shortDescription,
          p.description,
          fromCents(toCents(p.price)),
          p.compareAtPrice === null ? null : fromCents(toCents(p.compareAtPrice)),
          p.rating.toFixed(2),
          p.reviewCount,
          p.stock,
          p.badge ?? null,
          // JSON array of [label, value] pairs for the specifications tab.
          JSON.stringify(p.specifications ?? []),
          daysAgo(45),
        ]
      );
      const pid = res.insertId;
      productIds[p.slug] = pid;

      // images
      for (let i = 0; i < p.images.length; i += 1) {
        await conn.execute(
          'INSERT INTO product_images (product_id, url, alt, position, is_primary) VALUES (?, ?, ?, ?, ?)',
          [pid, p.images[i], `${p.name} view ${i + 1}`, i, i === 0 ? 1 : 0]
        );
      }

      // variants + the colour swatch hexes that feed the UI colour picker
      for (let i = 0; i < p.variants.length; i += 1) {
        const v = p.variants[i];
        const hex = (p.colors.find((c) => c.name === v.name) || {}).value || null;
        const [vres] = await conn.execute(
          `INSERT INTO product_variants
             (product_id, name, option_type, option_value, sku, price, stock, position)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pid,
            v.name,
            v.type || null,
            hex,
            `${p.sku}-${String(i + 1).padStart(2, '0')}`,
            v.price === null || v.price === undefined
              ? null
              : fromCents(toCents(v.price)),
            v.stock,
            i,
          ]
        );
        variantIds[`${p.slug}::${v.name}`] = vres.insertId;
      }

      // supplier data — admin-only table, never joined into public responses.
      // `variants_synced_at` is set because these curated products get their
      // variants from the seed data below, not from a CJ fetch. Leaving it NULL
      // would make the sync queue try to enrich them on every run and fail
      // forever, since their supplier ids are placeholders rather than real CJ
      // product ids.
      await conn.execute(
        `INSERT INTO product_supplier
           (product_id, supplier, supplier_product_id, supplier_sku, supplier_name,
            supplier_url, cost_price, shipping_cost, supplier_stock, last_synced_at, variants_synced_at)
         VALUES (?, 'cj', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pid,
          p.supplier.productId,
          p.supplier.sku,
          p.name,
          `https://cjdropshipping.com/product/${p.supplier.productId}`,
          fromCents(toCents(p.supplier.costPrice)),
          fromCents(toCents(p.supplier.shippingCost)),
          p.supplier.supplierStock,
          daysAgo(3),
          daysAgo(3),
        ]
      );
    }

    // ---- users ------------------------------------------------------------
    const userIds = {};
    for (const u of users) {
      const hash = await bcrypt.hash(u.password, BCRYPT_ROUNDS);
      const [res] = await conn.execute(
        `INSERT INTO users
           (email, password_hash, first_name, last_name, phone, role, is_active, email_verified_at, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [u.email, hash, u.firstName, u.lastName, u.phone, u.role, daysAgo(40), daysAgo(1)]
      );
      userIds[u.email] = res.insertId;
    }

    // ---- addresses --------------------------------------------------------
    for (const a of addresses) {
      await conn.execute(
        `INSERT INTO addresses
           (user_id, label, first_name, last_name, phone, country, state, city,
            address1, address2, postal_code, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userIds[a.email],
          a.label,
          a.firstName,
          a.lastName,
          a.phone,
          a.country,
          a.state,
          a.city,
          a.address1,
          a.address2,
          a.postalCode,
          a.isDefault,
        ]
      );
    }

    // ---- reviews ----------------------------------------------------------
    for (const r of reviews) {
      await conn.execute(
        `INSERT INTO reviews
           (product_id, rating, title, body, author_name, country, is_verified, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          productIds[r.slug],
          r.rating,
          r.title,
          r.body,
          r.authorName,
          r.country,
          r.isVerified,
          daysAgo(Math.floor(Math.random() * 30) + 2),
        ]
      );
    }

    // ---- orders, payments, shipments --------------------------------------
    const productImageBySlug = {};
    for (const p of products) productImageBySlug[p.slug] = p.images[0];

    for (const o of orders) {
      let subtotalCents = 0;
      const lineValues = o.lines.map((line) => {
        const product = products.find((x) => x.slug === line.slug);
        const unit = toCents(product.price);
        const lineTotal = unit * line.quantity;
        subtotalCents += lineTotal;
        return { ...line, product, unit, lineTotal };
      });

      let supplierCostCents = 0;
      let supplierShippingCents = 0;
      for (const line of lineValues) {
        supplierCostCents += toCents(line.product.supplier.costPrice) * line.quantity;
        supplierShippingCents += toCents(line.product.supplier.shippingCost) * line.quantity;
      }
      const paymentFeeCents = Math.round(subtotalCents * 0.029) + 30;

      const shippingCents = shippingCostFor(subtotalCents);
      const taxCents = 0;
      const totalCents = subtotalCents + shippingCents + taxCents;
      const placedAt = daysAgo(o.daysAgo);
      const eta = daysAgo(o.daysAgo - o.deliveryInDays);

      const [ores] = await conn.execute(
        `INSERT INTO orders
           (order_number, user_id, email, status, payment_status,
            shipping_first_name, shipping_last_name, shipping_phone, shipping_country,
            shipping_state, shipping_city, shipping_address1, shipping_address2,
            shipping_postal_code, shipping_method,
            subtotal, shipping_amount, tax_amount, tax_rate, total, currency,
            supplier_cost_total, shipping_cost_total, payment_fee,
            tracking_number, carrier, estimated_delivery_at, placed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'USD', ?, ?, ?, ?, ?, ?, ?)`,
        [
          o.orderNumber,
          o.email ? userIds[o.email] : null,
          o.email,
          o.status,
          o.paymentStatus,
          o.address.firstName,
          o.address.lastName,
          o.address.phone,
          o.address.country,
          o.address.state,
          o.address.city,
          o.address.address1,
          o.address.address2,
          o.address.postalCode,
          o.shippingMethod,
          fromCents(subtotalCents),
          fromCents(shippingCents),
          fromCents(taxCents),
          fromCents(totalCents),
          fromCents(supplierCostCents),
          fromCents(supplierShippingCents),
          fromCents(paymentFeeCents),
          o.trackingNumber,
          o.carrier,
          eta,
          placedAt,
        ]
      );
      const orderId = ores.insertId;

      for (const line of lineValues) {
        await conn.execute(
           `INSERT INTO order_items
              (order_id, product_id, variant_id, name, variant_label, image_url,
               unit_price, quantity, line_total,
               unit_supplier_cost, shipping_cost, payment_fee)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            productIds[line.slug],
            line.variant ? variantIds[`${line.slug}::${line.variant}`] : null,
            line.product.name,
            line.variant || '',
            productImageBySlug[line.slug],
            fromCents(line.unit),
            line.quantity,
            fromCents(line.lineTotal),
            line.product.supplier.costPrice.toFixed(2),
            fromCents(toCents(line.product.supplier.shippingCost) * line.quantity),
            fromCents(Math.round((paymentFeeCents * line.lineTotal) / (subtotalCents || 1))),
          ]
        );
      }

      await conn.execute(
        `INSERT INTO payments
           (order_id, provider, method, status, amount, currency, card_last4, created_at)
         VALUES (?, 'mock', 'card', 'captured', ?, 'USD', '4242', ?)`,
        [orderId, fromCents(totalCents), placedAt]
      );

      if (o.trackingNumber) {
        await conn.execute(
          `INSERT INTO shipments
             (order_id, carrier, tracking_number, status, shipped_at, delivered_at, estimated_delivery_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            o.carrier,
            o.trackingNumber,
            o.status === 'delivered' ? 'delivered' : 'in_transit',
            new Date(placedAt.getTime() + 2 * 86400000),
            o.status === 'delivered' ? eta : null,
            eta,
          ]
        );
      }
    }

    // ---- wishlist ---------------------------------------------------------
    for (const slug of [
      'meridian-automatic-watch',
      'onyx-sunglasses',
      'solstice-leather-tote',
      'halo-skincare-ritual-set',
    ]) {
      await conn.execute(
        'INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)',
        [userIds['demo@zavora.com'], productIds[slug]]
      );
    }
  });

  const counts = await withTransaction(async (conn) => {
    const tables = [
      'categories',
      'products',
      'product_variants',
      'product_images',
      'product_supplier',
      'users',
      'addresses',
      'reviews',
      'orders',
      'order_items',
      'payments',
      'shipments',
      'wishlist',
      'store_settings',
    ];
    const out = {};
    for (const t of tables) {
      // NOTE: no backticks — the pg shim strips them anyway, but PG-native
      // SQL avoids them entirely. Table name is from a hardcoded allowlist.
      const [rows] = await conn.query(`SELECT COUNT(*) AS n FROM ${t}`);
      out[t] = Number(rows[0].n);
    }
    return out;
  });

  console.log('Seed complete:');
  for (const [table, n] of Object.entries(counts)) {
    console.log(`  ${String(n).padStart(3)}  ${table}`);
  }
  console.log('\nDemo logins:');
  console.log('  customer  demo@zavora.com    / zavora1234');
  console.log('  admin     admin@zavora.com   / zavora-admin-2026');
}

seed()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('Seed failed:', err.message);
    console.error(err.sql ? `\nSQL: ${err.sql}` : '');
    await closePool().catch(() => {});
    process.exit(1);
  });
