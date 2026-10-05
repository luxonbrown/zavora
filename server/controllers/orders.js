/**
 * Order reads and public tracking lookup.
 *
 * Two distinct access paths, deliberately kept apart:
 *   - listOrders / getOrder: requires a session and is scoped to req.user.id.
 *   - lookupTracking: public, requires order number AND the matching email.
 *     Both are required because an order number alone is guessable.
 */

const { query, queryOne } = require('../database/pool');
const { HttpError } = require('../middleware/error');
const { decimal } = require('../lib/money');
const { isValidEmail } = require('../lib/validate');

/** Load the lines for an order, plus its payment and shipment. */
async function decorateOrder(orderRow) {
  const items = await query(
    `SELECT name, variant_label, image_url, unit_price, quantity, line_total
       FROM order_items WHERE order_id = ? ORDER BY id ASC`,
    [orderRow.id]
  );

  const payment = await queryOne(
    `SELECT provider, method, status, amount, currency, card_last4
       FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1`,
    [orderRow.id]
  );

  const shipment = await queryOne(
    `SELECT carrier, tracking_number, status, shipped_at, delivered_at, estimated_delivery_at
       FROM shipments WHERE order_id = ? ORDER BY id DESC LIMIT 1`,
    [orderRow.id]
  );

  return {
    id: String(orderRow.id),
    orderNumber: orderRow.order_number,
    status: orderRow.status,
    paymentStatus: orderRow.payment_status,
    email: orderRow.email,
    shippingAddress: {
      firstName: orderRow.shipping_first_name,
      lastName: orderRow.shipping_last_name,
      phone: orderRow.shipping_phone,
      country: orderRow.shipping_country,
      state: orderRow.shipping_state,
      city: orderRow.shipping_city,
      address1: orderRow.shipping_address1,
      address2: orderRow.shipping_address2,
      postalCode: orderRow.shipping_postal_code,
    },
    shippingMethod: orderRow.shipping_method,
    subtotal: decimal(orderRow.subtotal),
    shippingAmount: decimal(orderRow.shipping_amount),
    taxAmount: decimal(orderRow.tax_amount),
    total: decimal(orderRow.total),
    currency: orderRow.currency,
    trackingNumber: orderRow.tracking_number,
    carrier: orderRow.carrier,
    estimatedDeliveryAt: orderRow.estimated_delivery_at,
    placedAt: orderRow.placed_at,
    items: items.map((i) => ({
      name: i.name,
      variantLabel: i.variant_label,
      image: i.image_url,
      unitPrice: decimal(i.unit_price),
      quantity: Number(i.quantity),
      lineTotal: decimal(i.line_total),
    })),
    payment: payment
      ? {
          provider: payment.provider,
          method: payment.method,
          status: payment.status,
          amount: decimal(payment.amount),
          cardLast4: payment.card_last4,
        }
      : null,
    shipment: shipment
      ? {
          carrier: shipment.carrier,
          trackingNumber: shipment.tracking_number,
          status: shipment.status,
          shippedAt: shipment.shipped_at,
          deliveredAt: shipment.delivered_at,
          estimatedDeliveryAt: shipment.estimated_delivery_at,
        }
      : null,
  };
}

/** GET /api/orders — the signed-in customer's order history. */
async function listOrders(req, res) {
  const rows = await query(
    `SELECT o.*,
            (SELECT oi.image_url FROM order_items oi
              WHERE oi.order_id = o.id ORDER BY oi.id ASC LIMIT 1) AS thumbnail,
            (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
       FROM orders o
      WHERE o.user_id = ?
      ORDER BY o.placed_at DESC, o.id DESC`,
    [req.user.id]
  );

  res.json({
    ok: true,
    items: rows.map((r) => ({
      id: String(r.id),
      orderNumber: r.order_number,
      status: r.status,
      paymentStatus: r.payment_status,
      total: decimal(r.total),
      currency: r.currency,
      itemCount: Number(r.item_count),
      thumbnail: r.thumbnail,
      trackingNumber: r.tracking_number,
      carrier: r.carrier,
      estimatedDeliveryAt: r.estimated_delivery_at,
      placedAt: r.placed_at,
    })),
  });
}

/** GET /api/orders/summary — counts and spend for the dashboard. */
async function summary(req, res) {
  const row = await queryOne(
    `SELECT COUNT(*) AS order_count,
            COALESCE(SUM(total), 0) AS lifetime_value,
            COALESCE(SUM(CASE WHEN status IN ('placed','payment_confirmed','processing','shipped','in_transit') THEN 1 ELSE 0 END), 0) AS active_count
       FROM orders WHERE user_id = ?`,
    [req.user.id]
  );

  const wishlistCount = await queryOne(
    'SELECT COUNT(*) AS n FROM wishlist WHERE user_id = ?',
    [req.user.id]
  );

  res.json({
    ok: true,
    summary: {
      orderCount: Number(row.order_count),
      activeOrderCount: Number(row.active_count),
      lifetimeValue: decimal(row.lifetime_value),
      wishlistCount: Number(wishlistCount.n),
    },
  });
}

/** GET /api/orders/:orderNumber — one order, scoped to the owner. */
async function getOrder(req, res) {
  const row = await queryOne('SELECT * FROM orders WHERE order_number = ? LIMIT 1', [
    String(req.params.orderNumber),
  ]);
  // Same response whether the order is missing or simply someone else's.
  if (!row || String(row.user_id || '') !== String(req.user.id)) {
    throw HttpError.notFound('Order not found');
  }
  res.json({ ok: true, order: await decorateOrder(row) });
}

/**
 * POST /api/orders/lookup — public tracking.
 * Requires orderNumber + email; a mismatch returns 404 so the endpoint reveals
 * nothing about whether an order number exists.
 */
async function lookupTracking(req, res) {
  const { orderNumber, email } = req.body || {};
  if (!orderNumber || !isValidEmail(email)) {
    throw HttpError.badRequest('Enter both your order number and email address');
  }

  const row = await queryOne(
    'SELECT * FROM orders WHERE order_number = ? AND LOWER(email) = ? LIMIT 1',
    [String(orderNumber).trim().toUpperCase(), String(email).trim().toLowerCase()]
  );
  if (!row) throw HttpError.notFound('No order matches those details');

  const order = await decorateOrder(row);
  // Public tracking never exposes the full address or email back to the browser.
  res.json({
    ok: true,
    order: {
      orderNumber: order.orderNumber,
      status: order.status,
      placedAt: order.placedAt,
      items: order.items,
      trackingNumber: order.trackingNumber,
      carrier: order.carrier,
      estimatedDeliveryAt: order.estimatedDeliveryAt,
      shipment: order.shipment,
      destination: {
        city: order.shippingAddress.city,
        country: order.shippingAddress.country,
      },
    },
  });
}

module.exports = { listOrders, summary, getOrder, lookupTracking, decorateOrder };
