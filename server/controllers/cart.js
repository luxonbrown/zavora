/**
 * Cart endpoints.
 *
 * A cart belongs to either a signed-in user (user_id) or an anonymous visitor
 * (session_key). The session key lives in the session cookie, so a guest cart
 * survives reloads without ever putting an identifier in localStorage.
 *
 * On sign-in a guest cart is merged into the user's cart; see mergeGuestCart.
 */

const { query, queryOne, execute, withTransaction } = require('../database/pool');
const { HttpError } = require('../middleware/error');
const { resolvePurchasables } = require('../lib/catalog');
const { toCents, centsToNumber } = require('../lib/money');
const config = require('../config');

const MAX_QTY_PER_LINE = 20;

/** Stable per-session guest key, created on demand. */
function guestKey(req) {
  if (!req.session.cartKey) {
    req.session.cartKey = `g_${require('crypto').randomBytes(16).toString('hex')}`;
  }
  return req.session.cartKey;
}

/** Find the cart id for this request, or null if there isn't one yet. */
async function findCartId(req) {
  if (req.user) {
    const row = await queryOne('SELECT id FROM cart WHERE user_id = ? LIMIT 1', [req.user.id]);
    return row ? row.id : null;
  }
  if (req.session.cartKey) {
    const row = await queryOne('SELECT id FROM cart WHERE session_key = ? LIMIT 1', [
      req.session.cartKey,
    ]);
    return row ? row.id : null;
  }
  return null;
}

/** Find or create the cart for this request. */
async function getOrCreateCartId(req) {
  const existing = await findCartId(req);
  if (existing) return existing;

  if (req.user) {
    const result = await execute('INSERT INTO cart (user_id) VALUES (?)', [req.user.id]);
    return result.insertId;
  }
  const key = guestKey(req);
  const result = await execute('INSERT INTO cart (session_key) VALUES (?)', [key]);
  return result.insertId;
}

/**
 * Load cart contents with live pricing and stock.
 * Prices always come from the catalogue, never from the stored snapshot.
 */
async function loadCart(req) {
  const cartId = await findCartId(req);
  if (!cartId) {
    return { id: null, items: [], subtotalCents: 0, itemCount: 0, issues: [] };
  }

  const rows = await query(
    `SELECT ci.id AS item_id, ci.quantity, ci.unit_price_snapshot,
            p.id AS product_id, p.slug, p.name, p.status, p.is_active,
            p.stock AS product_stock,
            (SELECT pi.url FROM product_images pi
               WHERE pi.product_id = p.id
               ORDER BY pi.is_primary DESC, pi.position ASC LIMIT 1) AS image_url,
            v.id AS variant_id, v.name AS variant_name, v.price AS variant_price,
            v.stock AS variant_stock
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       LEFT JOIN product_variants v ON v.id = ci.variant_id
      WHERE ci.cart_id = ?
      ORDER BY ci.id ASC`,
    [cartId]
  );

  const items = [];
  const issues = [];
  let subtotalCents = 0;
  let itemCount = 0;

  for (const row of rows) {
    const gone = row.status !== 'active' || !row.is_active;
    const availableStock = row.variant_id ? Number(row.variant_stock) : Number(row.product_stock);
    const quantity = Number(row.quantity);

    const unitCents = row.variant_price
      ? Math.round(Number(row.variant_price) * 100)
      : Math.round(Number(row.unit_price_snapshot) * 100);

    let problem = null;
    if (gone) problem = 'PRODUCT_UNAVAILABLE';
    else if (availableStock <= 0) problem = 'OUT_OF_STOCK';
    else if (quantity > availableStock) problem = 'INSUFFICIENT_STOCK';

    const lineTotal = unitCents * quantity;
    if (!problem) {
      subtotalCents += lineTotal;
      itemCount += quantity;
    } else {
      issues.push({
        itemId: String(row.item_id),
        productId: String(row.product_id),
        name: row.name,
        reason: problem,
        availableStock,
      });
    }

    items.push({
      id: String(row.item_id),
      productId: String(row.product_id),
      slug: row.slug,
      name: row.name,
      image: row.image_url,
      variantId: row.variant_id === null ? null : String(row.variant_id),
      variantName: row.variant_name,
      unitPrice: centsToNumber(unitCents),
      quantity,
      lineTotal: centsToNumber(lineTotal),
      availableStock,
      problem,
    });
  }

  return { id: cartId, items, subtotalCents, itemCount, issues };
}

/** GET /api/cart */
async function getCart(req, res) {
  const cart = await loadCart(req);
  res.json({ ok: true, ...cartResponse(cart) });
}

/** POST /api/cart/items — add a product (optionally a specific variant). */
async function addItem(req, res) {
  const { productId, variantId = null, quantity = 1 } = req.body || {};

  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) {
    throw HttpError.badRequest(`Quantity must be between 1 and ${MAX_QTY_PER_LINE}`);
  }

  const [resolved] = await resolvePurchasables([{ productId, variantId }]);
  if (!resolved.available) {
    throw HttpError.badRequest(
      resolved.reason === 'VARIANT_UNAVAILABLE' ? 'That option is unavailable' : 'Product unavailable'
    );
  }
  if (resolved.availableStock < qty) {
    throw HttpError.badRequest(
      resolved.availableStock === 0
        ? 'That option is out of stock'
        : `Only ${resolved.availableStock} left in stock`
    );
  }

  const cartId = await getOrCreateCartId(req);

  // The unique key folds a NULL variant to 0, so an existing line is found and
  // incremented instead of inserted twice.
  const existing = await queryOne(
    'SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ? AND variant_key = ? LIMIT 1',
    [cartId, resolved.product.id, variantId === null ? 0 : variantId]
  );

  const newQty = existing ? Number(existing.quantity) + qty : qty;
  if (newQty > MAX_QTY_PER_LINE) {
    throw HttpError.badRequest(`You can order at most ${MAX_QTY_PER_LINE} of this item`);
  }

  if (existing) {
    await execute('UPDATE cart_items SET quantity = ? WHERE id = ?', [newQty, existing.id]);
  } else {
    await execute(
      'INSERT INTO cart_items (cart_id, product_id, variant_id, quantity, unit_price_snapshot) VALUES (?, ?, ?, ?, ?)',
      [cartId, resolved.product.id, variantId, qty, resolved.unitCents / 100]
    );
  }

  const cart = await loadCart(req);
  res.status(201).json({ ok: true, ...cartResponse(cart) });
}

/** PATCH /api/cart/items/:itemId — set an exact quantity (0 removes). */
async function updateItem(req, res) {
  const quantity = Number((req.body || {}).quantity);
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_QTY_PER_LINE) {
    throw HttpError.badRequest(`Quantity must be between 0 and ${MAX_QTY_PER_LINE}`);
  }

  const cartId = await findCartId(req);
  if (!cartId) throw HttpError.notFound('Cart is empty');

  const item = await queryOne(
    'SELECT id, product_id, variant_id FROM cart_items WHERE id = ? AND cart_id = ? LIMIT 1',
    [req.params.itemId, cartId]
  );
  if (!item) throw HttpError.notFound('That item is not in your cart');

  if (quantity === 0) {
    await execute('DELETE FROM cart_items WHERE id = ?', [item.id]);
  } else {
    // Re-check stock before raising the quantity.
    const [resolved] = await resolvePurchasables([
      { productId: item.product_id, variantId: item.variant_id },
    ]);
    if (!resolved.available) throw HttpError.badRequest('Product unavailable');
    if (resolved.availableStock < quantity) {
      throw HttpError.badRequest(`Only ${resolved.availableStock} left in stock`);
    }
    await execute('UPDATE cart_items SET quantity = ? WHERE id = ?', [quantity, item.id]);
  }

  const cart = await loadCart(req);
  res.json({ ok: true, ...cartResponse(cart) });
}

/** DELETE /api/cart/items/:itemId */
async function removeItem(req, res) {
  const cartId = await findCartId(req);
  if (!cartId) throw HttpError.notFound('Cart is empty');
  const result = await execute('DELETE FROM cart_items WHERE id = ? AND cart_id = ?', [
    req.params.itemId,
    cartId,
  ]);
  if (result.affectedRows === 0) throw HttpError.notFound('That item is not in your cart');
  const cart = await loadCart(req);
  res.json({ ok: true, ...cartResponse(cart) });
}

/** DELETE /api/cart — empty it. */
async function clearCart(req, res) {
  const cartId = await findCartId(req);
  if (cartId) await execute('DELETE FROM cart_items WHERE cart_id = ?', [cartId]);
  res.json({ ok: true, cart: [] });
}

/** Uniform cart payload, including the free-shipping nudge. */
function cartResponse(cart) {
  const thresholdCents = toCents(config.pricing.freeShippingThreshold);
  return {
    cart: {
      items: cart.items,
      itemCount: cart.itemCount,
      subtotal: centsToNumber(cart.subtotalCents),
      issues: cart.issues,
      freeShippingThreshold: centsToNumber(thresholdCents),
      amountToFreeShipping: centsToNumber(Math.max(0, thresholdCents - cart.subtotalCents)),
    },
  };
}

/**
 * Fold a guest cart into the user's cart at sign-in.
 * Called from the auth controller so the basket survives logging in.
 */
async function mergeGuestCart(req, userId) {
  const key = req.session.cartKey;
  if (!key) return 0;

  const guest = await queryOne('SELECT id FROM cart WHERE session_key = ? LIMIT 1', [key]);
  if (!guest) return 0;

  const guestItems = await query(
    'SELECT product_id, variant_id, quantity FROM cart_items WHERE cart_id = ?',
    [guest.id]
  );

  if (guestItems.length) {
    await withTransaction(async (conn) => {
      const [userCart] = await conn.query('SELECT id FROM cart WHERE user_id = ? LIMIT 1', [userId]);
      const targetCartId = userCart.length
        ? userCart[0].id
        : (await conn.query('INSERT INTO cart (user_id) VALUES (?)', [userId]))[0].insertId;

      for (const item of guestItems) {
        await conn.execute(
          `INSERT INTO cart_items (cart_id, product_id, variant_id, quantity, unit_price_snapshot)
           SELECT ?, id, ?, ?, price FROM products WHERE id = ?
           ON DUPLICATE KEY UPDATE quantity = LEAST(quantity + VALUES(quantity), 20)`,
          [targetCartId, item.variant_id, item.quantity, item.product_id]
        );
      }
    });
  }

  await execute('DELETE FROM cart_items WHERE cart_id = ?', [guest.id]);
  await execute('DELETE FROM cart WHERE id = ?', [guest.id]);
  delete req.session.cartKey;
  return guestItems.length;
}

module.exports = { getCart, addItem, updateItem, removeItem, clearCart, mergeGuestCart, loadCart };
