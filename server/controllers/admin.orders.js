/**
 * Admin order management.
 *
 * Every route here sits behind `requireAdmin`. These endpoints can change the
 * status of a customer's order, so all transitions go through the state machine
 * in lib/orderStatus.js rather than writing the column directly.
 *
 * Cancellation is the only destructive path, so it restores stock and refunds in
 * one transaction — a cancelled order that still shows inventory as sold, or a
 * refund that never lands, are both unrecoverable from the admin UI.
 */

const { query, queryOne, execute, withTransaction, txQuery, txExecute } = require('../database/pool');
const { HttpError } = require('../middleware/error');
const { decimal } = require('../lib/money');
const { cleanString, normalizeCountry } = require('../lib/validate');
const {
  assertTransition,
  allowedNext,
  isOpen,
  isClosed,
  REQUIRES_TRACKING,
  REFUNDABLE_PAYMENT,
  TransitionError,
} = require('../lib/orderStatus');

/** Query params shared by the list endpoint. */
function listFilters(query_) {
  const { status, paymentStatus, q, from, to, page = 1, pageSize = 25 } = query_;

  const where = [];
  const args = [];

  if (status) {
    const wanted = String(status).split(',').map((s) => s.trim()).filter(Boolean);
    where.push(`o.status IN (${wanted.map(() => '?').join(',')})`);
    args.push(...wanted);
  }
  if (paymentStatus) {
    const wanted = String(paymentStatus).split(',').map((s) => s.trim()).filter(Boolean);
    where.push(`o.payment_status IN (${wanted.map(() => '?').join(',')})`);
    args.push(...wanted);
  }
  if (q) {
    // Matches the order number or the customer's email, both admin-legitimate.
    where.push('(o.order_number LIKE ? OR o.email LIKE ?)');
    const like = `%${String(q).trim()}%`;
    args.push(like, like);
  }
  if (from) {
    where.push('o.placed_at >= ?');
    args.push(String(from));
  }
  if (to) {
    where.push('o.placed_at <= ?');
    args.push(String(to));
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    args,
    page: Math.max(1, Number(page) || 1),
    pageSize: Math.min(Math.max(1, Number(pageSize) || 25), 100),
  };
}

/** GET /api/admin/orders */
async function listOrders(req, res) {
  const { whereSql, args, page, pageSize } = listFilters(req.query);

  const countRow = await queryOne(
    `SELECT COUNT(*) AS total FROM orders o ${whereSql}`,
    args
  );
  const total = Number(countRow.total);

  const rows = await query(
    `SELECT o.id, o.order_number, o.status, o.payment_status, o.email,
            o.total, o.currency, o.shipping_country, o.shipping_method,
            o.tracking_number, o.carrier, o.estimated_delivery_at, o.placed_at,
            (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
            (SELECT oi.image_url FROM order_items oi
              WHERE oi.order_id = o.id ORDER BY oi.id ASC LIMIT 1) AS thumbnail
       FROM orders o
       ${whereSql}
       ORDER BY o.placed_at DESC, o.id DESC
       LIMIT ? OFFSET ?`,
    [...args, pageSize, (page - 1) * pageSize]
  );

  res.json({
    ok: true,
    items: rows.map((r) => ({
      id: String(r.id),
      orderNumber: r.order_number,
      status: r.status,
      paymentStatus: r.payment_status,
      email: r.email,
      total: decimal(r.total),
      currency: r.currency,
      itemCount: Number(r.item_count),
      thumbnail: r.thumbnail,
      destination: `${r.shipping_city || ''}, ${r.shipping_country || ''}`.trim(),
      shippingMethod: r.shipping_method,
      trackingNumber: r.tracking_number,
      carrier: r.carrier,
      estimatedDeliveryAt: r.estimated_delivery_at,
      placedAt: r.placed_at,
      isOpen: isOpen(r.status),
      // The admin UI renders these as the available actions.
      allowedNext: allowedNext(r.status),
    })),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

/** GET /api/admin/orders/:orderNumber — full order plus fulfilment state. */
async function getOrder(req, res) {
  const row = await queryOne('SELECT * FROM orders WHERE order_number = ? LIMIT 1', [
    String(req.params.orderNumber),
  ]);
  if (!row) throw HttpError.notFound('Order not found');

  // Reuse the customer-facing decorator so admin and storefront can never
  // disagree about what an order contains.
  const orders = require('./orders');
  const order = await orders.decorateOrder(row);

  const history = await query(
    'SELECT status, tracking_number, carrier, shipped_at, delivered_at, created_at FROM shipments WHERE order_id = ? ORDER BY id ASC',
    [row.id]
  );

  res.json({
    ok: true,
    order: {
      ...order,
      allowedNext: allowedNext(row.status),
      isOpen: isOpen(row.status),
      shipments: history.map((h) => ({
        status: h.status,
        trackingNumber: h.tracking_number,
        carrier: h.carrier,
        shippedAt: h.shipped_at,
        deliveredAt: h.delivered_at,
        createdAt: h.created_at,
      })),
    },
  });
}

/**
 * PATCH /api/admin/orders/:orderNumber/status
 * Body: { status, carrier?, trackingNumber?, estimatedDeliveryAt?, note? }
 */
async function updateStatus(req, res) {
  const { status, carrier, trackingNumber, estimatedDeliveryAt, note } = req.body || {};
  const nextStatus = cleanString(status, 40);
  if (!nextStatus) throw HttpError.badRequest('A target status is required');

  const row = await queryOne('SELECT * FROM orders WHERE order_number = ? LIMIT 1', [
    String(req.params.orderNumber),
  ]);
  if (!row) throw HttpError.notFound('Order not found');

  try {
    assertTransition(row.status, nextStatus);
  } catch (err) {
    if (err instanceof TransitionError) throw HttpError.conflict(err.message);
    throw err;
  }

  const carrierName = cleanString(carrier, 60) || row.carrier;
  const tracking = cleanString(trackingNumber, 80) || row.tracking_number;
  const eta = estimatedDeliveryAt || row.estimated_delivery_at;

  // A shipped order with no tracking number is untrackable for the customer, so
  // require one rather than silently producing a dead-end status.
  if (REQUIRES_TRACKING.has(nextStatus) && !tracking) {
    throw HttpError.badRequest(
      `A tracking number is required to mark an order as ${nextStatus}`
    );
  }

  await withTransaction(async (conn) => {
    await txExecute(
      conn,
      'UPDATE orders SET status = ?, carrier = ?, tracking_number = ?, estimated_delivery_at = ? WHERE id = ?',
      [nextStatus, carrierName, tracking, eta, row.id]
    );

    // Keep the shipment table in step so the public tracking page agrees.
    const existing = await txQuery(conn, 'SELECT id FROM shipments WHERE order_id = ? LIMIT 1', [row.id]);
    if (existing.length) {
      await txExecute(
        conn,
        `UPDATE shipments
            SET status = ?,
                carrier = ?,
                tracking_number = ?,
                shipped_at = CASE WHEN ? IN ('shipped','in_transit') AND shipped_at IS NULL THEN NOW() ELSE shipped_at END,
                delivered_at = CASE WHEN ? = 'delivered' THEN COALESCE(delivered_at, NOW()) ELSE delivered_at END,
                estimated_delivery_at = ?
          WHERE id = ?`,
        [
          nextStatus === 'delivered' ? 'delivered' : nextStatus === 'in_transit' ? 'in_transit' : 'label_created',
          carrierName,
          tracking,
          nextStatus,
          nextStatus,
          eta,
          existing[0].id,
        ]
      );
    } else if (tracking) {
      await txExecute(
        conn,
        `INSERT INTO shipments (order_id, carrier, tracking_number, status, shipped_at, delivered_at, estimated_delivery_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          carrierName || 'Unknown',
          tracking,
          nextStatus === 'delivered' ? 'delivered' : nextStatus === 'in_transit' ? 'in_transit' : 'label_created',
          nextStatus === 'shipped' || nextStatus === 'in_transit' ? new Date() : null,
          nextStatus === 'delivered' ? new Date() : null,
          eta,
        ]
      );
    }
  });

  if (note) {
    // Kept deliberately lightweight: there is no admin notes table yet, so the
    // note is logged rather than silently dropped.
    console.log(`[admin] order ${row.order_number} -> ${nextStatus}: ${cleanString(note, 300)}`);
  }

  const updated = await queryOne('SELECT * FROM orders WHERE id = ? LIMIT 1', [row.id]);
  const orders = require('./orders');
  res.json({
    ok: true,
    order: { ...(await orders.decorateOrder(updated)), allowedNext: allowedNext(nextStatus) },
  });
}

/**
 * POST /api/admin/orders/:orderNumber/cancel
 * Body: { reason?, refund? }
 *
 * Restores stock and, if the payment was captured, marks it refunded — in the
 * same transaction as the status change, so it cannot half-apply.
 */
async function cancelOrder(req, res) {
  const { reason, refund = true } = req.body || {};
  const row = await queryOne('SELECT * FROM orders WHERE order_number = ? LIMIT 1', [
    String(req.params.orderNumber),
  ]);
  if (!row) throw HttpError.notFound('Order not found');

  try {
    assertTransition(row.status, 'cancelled');
  } catch (err) {
    if (err instanceof TransitionError) throw HttpError.conflict(err.message);
    throw err;
  }

  const result = await withTransaction(async (conn) => {
    // txQuery/txExecute, NOT conn.query: a raw connection resolves to
    // [rows, fields]. Reading it as rows made the restock loop iterate the tuple
    // itself, so cancellation silently restored nothing while still reporting
    // success.
    const items = await txQuery(
      conn,
      'SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = ?',
      [row.id]
    );

    // Put the inventory back, so a cancelled order stops suppressing stock.
    for (const item of items) {
      if (item.variant_id) {
        await txExecute(conn, 'UPDATE product_variants SET stock = stock + ? WHERE id = ?', [
          item.quantity,
          item.variant_id,
        ]);
      } else if (item.product_id) {
        await txExecute(conn, 'UPDATE products SET stock = stock + ? WHERE id = ?', [
          item.quantity,
          item.product_id,
        ]);
      }
    }

    await txExecute(conn, "UPDATE orders SET status = 'cancelled' WHERE id = ?", [row.id]);
    await txExecute(conn, "UPDATE shipments SET status = 'exception' WHERE order_id = ?", [row.id]);

    let refunded = false;
    const payment = await txQuery(
      conn,
      'SELECT id, status FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1',
      [row.id]
    );
    if (refund && payment.length && REFUNDABLE_PAYMENT.includes(payment[0].status)) {
      await txExecute(conn, "UPDATE payments SET status = 'refunded' WHERE id = ?", [payment[0].id]);
      await txExecute(conn, "UPDATE orders SET payment_status = 'refunded' WHERE id = ?", [row.id]);
      refunded = true;
    }

    return { restoredLines: items.length, refunded };
  });

  console.log(
    `[admin] order ${row.order_number} cancelled: ${result.restoredLines} line(s) restocked` +
      `${result.refunded ? ', payment refunded' : ''}${reason ? ` — ${cleanString(reason, 300)}` : ''}`
  );

  res.json({
    ok: true,
    cancelled: true,
    restockedLines: result.restoredLines,
    refunded: result.refunded,
  });
}

/** GET /api/admin/orders/statuses — the lifecycle, for UI pickers. */
async function statusOptions(req, res) {
  const lifecycle = require('../lib/orderStatus');
  const ship = require('../lib/shipping');

  res.json({
    ok: true,
    statuses: Object.keys(lifecycle.TRANSITIONS).map((s) => ({
      status: s,
      next: lifecycle.TRANSITIONS[s],
      isOpen: lifecycle.isOpen(s),
      requiresTracking: REQUIRES_TRACKING.has(s),
    })),
    shippingCountries: Object.keys(ship.ZONES),
    blockedCountries: ['RU', 'BY', 'KP', 'IR', 'SY', 'CU'],
  });
}

module.exports = { listOrders, getOrder, updateStatus, cancelOrder, statusOptions };
