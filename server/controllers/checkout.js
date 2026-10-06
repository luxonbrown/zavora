/**
 * Checkout: shipping quote and order placement.
 *
 * The server is the sole pricing authority. The client may suggest a method and
 * a tip, but subtotal, shipping and tax are recomputed here from database prices
 * inside a transaction, and stock is decremented conditionally (`stock >= ?`)
 * so two simultaneous checkouts cannot oversell the same unit.
 *
 * Nothing in this file trusts a client-supplied price, total or stock level.
 */

const crypto = require('crypto');
const { queryOne, txQuery, withTransaction } = require('../database/pool');
const { HttpError } = require('../middleware/error');
const { resolvePurchasables, decrementStock } = require('../lib/catalog');
const { toCents, fromCents, centsToNumber, applyPercent } = require('../lib/money');
const { isValidEmail, normalizeCountry, cleanString } = require('../lib/validate');
const shipping = require('../lib/shipping');
const config = require('../config');
const cartController = require('./cart');

/** Human order number: ZV-XXXXXX-NNN. */
function makeOrderNumber() {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let block = '';
  for (let i = 0; i < 6; i += 1) {
    block += alphabet[crypto.randomInt(alphabet.length)];
  }
  return `ZV-${block}-${crypto.randomInt(100, 999)}`;
}

/** Re-price the cart from the database. Shared by quote and placeOrder. */
async function priceCart(req) {
  const cart = await cartController.loadCart(req);
  if (!cart.items.length) throw HttpError.badRequest('Your cart is empty', { code: 'EMPTY_CART' });
  if (cart.issues.length) {
    throw HttpError.conflict('Some items need attention before checkout', {
      code: 'CART_UNAVAILABLE',
      issues: cart.issues,
    });
  }
  return cart;
}

/** GET /api/checkout/shipping-methods */
async function shippingMethods(req, res) {
  res.json({ ok: true, methods: shipping.listMethods() });
}

/**
 * POST /api/checkout/quote
 *
 * Body: { shippingMethod?, country? }
 * Returns authoritative totals. Client-sent totals are ignored entirely.
 */
async function quote(req, res) {
  const cart = await priceCart(req);
  const { shippingMethod = 'standard', country } = req.body || {};
  const countryCode = normalizeCountry(country) || null;

  if (shipping.isBlocked(countryCode)) {
    throw HttpError.badRequest('We do not currently ship to that destination');
  }

  const rate = shipping.quoteShipping({
    subtotalCents: cart.subtotalCents,
    methodId: shippingMethod,
    country: countryCode,
  });
  if (!rate) throw HttpError.badRequest('Choose a valid shipping method');

  const taxCents = applyPercent(cart.subtotalCents, config.pricing.taxRatePercent);
  const totalCents = cart.subtotalCents + rate.amountCents + taxCents;

  res.json({
    ok: true,
    quote: {
      items: cart.items,
      itemCount: cart.itemCount,
      subtotal: centsToNumber(cart.subtotalCents),
      shippingAmount: centsToNumber(rate.amountCents),
      shippingMethod: rate.method,
      shippingLabel: rate.label,
      shippingZone: rate.zone,
      freeShippingApplied: rate.freeApplied,
      freeShippingThreshold: centsToNumber(rate.freeThresholdCents),
      amountToFreeShipping: centsToNumber(rate.amountToFreeShippingCents),
      estimatedDeliveryAt: rate.estimatedDeliveryAt,
      taxAmount: centsToNumber(taxCents),
      taxRate: config.pricing.taxRatePercent / 100,
      total: centsToNumber(totalCents),
      currency: 'USD',
      // Echoed so the client can detect a stale quote.
      quoteToken: crypto
        .createHash('sha256')
        .update(`${cart.items.map((i) => `${i.productId}:${i.variantId || 0}:${i.quantity}`).join('|')}|${totalCents}`)
        .digest('hex')
        .slice(0, 16),
    },
  });
}

/**
 * POST /api/checkout/place-order
 *
 * Body: { email, shippingAddress, shippingMethod, payment: { method, cardNumber, ... } }
 *
 * In a transaction: re-price, decrement stock, write the order, its lines, the
 * payment record, then clear the cart. Stock decrement is conditional, so a
 * concurrent order that already took the last unit causes a rollback rather
 * than an oversell.
 */
async function placeOrder(req, res) {
  const body = req.body || {};
  const { email, shippingAddress = {}, shippingMethod = 'standard', payment = {} } = body;

  if (!isValidEmail(email)) throw HttpError.badRequest('Enter a valid email address');

  const addr = {
    firstName: cleanString(shippingAddress.firstName, 80),
    lastName: cleanString(shippingAddress.lastName, 80),
    phone: cleanString(shippingAddress.phone, 40),
    country: normalizeCountry(shippingAddress.country),
    state: cleanString(shippingAddress.state, 120),
    city: cleanString(shippingAddress.city, 120),
    address1: cleanString(shippingAddress.address1, 190),
    address2: cleanString(shippingAddress.address2, 190),
    postalCode: cleanString(shippingAddress.postalCode, 24),
  };

  // Only these are mandatory. `phone`, `state` and especially `address2` are
  // legitimately blank — "address2" is the optional second line of an address
  // ("Apt 4B"), so treating it as required would reject most real orders.
  const REQUIRED_ADDRESS_FIELDS = [
    'firstName',
    'lastName',
    'country',
    'city',
    'address1',
    'postalCode',
  ];
  const missing = REQUIRED_ADDRESS_FIELDS.filter((field) => !addr[field]);
  if (missing.length) throw HttpError.badRequest('Please complete the shipping address', { missing });

  if (shipping.isBlocked(addr.country)) {
    throw HttpError.badRequest('We do not currently ship to that destination');
  }

  const rate = shipping.quoteShipping({
    subtotalCents: 0, // placeholder; recomputed against the real cart below
    methodId: shippingMethod,
    country: addr.country,
  });
  if (!rate) throw HttpError.badRequest('Choose a valid shipping method');
  const method = shipping.METHODS[shippingMethod];

  // ---- validate payment before touching stock --------------------------
  const digits = String(payment.cardNumber || '').replace(/[\s-]/g, '');
  if (!/^\d{13,19}$/.test(digits)) throw HttpError.badRequest('Enter a valid card number');
  if (!/^\d{3,4}$/.test(String(payment.cvc || ''))) throw HttpError.badRequest('Enter a valid security code');
  const expiry = String(payment.expiry || '').match(/^(\d{2})\s*\/\s*(\d{2})$/);
  if (!expiry) throw HttpError.badRequest('Enter a valid expiry date as MM/YY');
  const expMonth = Number(expiry[1]);
  const expYear = 2000 + Number(expiry[2]);
  if (expMonth < 1 || expMonth > 12) throw HttpError.badRequest('Enter a valid expiry month');
  const now = new Date();
  if (expYear < now.getFullYear() || (expYear === now.getFullYear() && expMonth < now.getMonth() + 1)) {
    throw HttpError.badRequest('That card has expired');
  }

  const cart = await priceCart(req);

  // Deliberate test hook: a card ending 0002 is declined, mirroring the mock
  // client. Remove when a real payment provider is wired up.
  if (digits.endsWith('0002')) {
    throw HttpError.badRequest('Your card was declined', { code: 'PAYMENT_DECLINED' });
  }

  // Re-quote against the real cart subtotal: free-shipping eligibility depends on
  // it, so the placeholder quote above cannot be reused here.
  const finalRate = shipping.quoteShipping({
    subtotalCents: cart.subtotalCents,
    methodId: shippingMethod,
    country: addr.country,
  });
  const shippingCents = finalRate.amountCents;
  const taxCents = applyPercent(cart.subtotalCents, config.pricing.taxRatePercent);
  const totalCents = cart.subtotalCents + shippingCents + taxCents;

  const orderNumber = makeOrderNumber();
  const eta = finalRate.estimatedDeliveryAt;

  // Mock payment processing fee on the full customer total.
  const paymentFeeCents =
    Math.round((totalCents * config.pricing.paymentFeePercent) / 100) +
    Math.round(config.pricing.paymentFeeFixed * 100);

  const orderId = await withTransaction(async (conn) => {
    // Re-resolve inside the transaction against live rows. `quantity` must be
    // carried on the line, because resolvePurchasables echoes its input object
    // back as `line` and the stock decrement below reads the quantity from it.
    const lines = await Promise.all(
      cart.items.map(async (item) => {
        const [r] = await resolvePurchasables([
          { productId: item.productId, variantId: item.variantId, quantity: item.quantity },
        ]);
        return r;
      })
    );

    // Snapshot supplier cost/shipping per line INSIDE the transaction so the
    // order keeps the cost structure that was live at purchase time.
    const supplierByProduct = new Map();
    for (const line of lines) {
      const [row] = await txQuery(
        conn,
        `SELECT cost_price, shipping_cost FROM product_supplier
          WHERE product_id = ? AND supplier = 'cj' LIMIT 1`,
        [line.product.id]
      );
      supplierByProduct.set(String(line.product.id), row || null);
    }

    for (const line of lines) {
      if (!line.available) {
        throw HttpError.conflict(
          `${line.line.productId} is no longer available`,
          { code: line.reason }
        );
      }
      if (line.availableStock < line.line.quantity) {
        throw HttpError.conflict(
          `Only ${line.availableStock} of ${line.product.name} left in stock`,
          { code: 'INSUFFICIENT_STOCK', availableStock: line.availableStock }
        );
      }

      const decremented = await decrementStock({
        productId: line.product.id,
        variantId: line.variant ? line.variant.id : null,
        quantity: line.line.quantity,
        conn,
      });
      if (!decremented) {
        throw HttpError.conflict(`${line.product.name} just sold out`, { code: 'OUT_OF_STOCK' });
      }
    }

    // Historical snapshot of the supplier side of this order.
    let supplierCostCents = 0;
    let supplierShippingCents = 0;
    for (const line of lines) {
      const s = supplierByProduct.get(String(line.product.id));
      if (!s) continue;
      supplierCostCents += Math.round(Number(s.cost_price) * 100) * line.line.quantity;
      supplierShippingCents += Math.round(Number(s.shipping_cost) * 100) * line.line.quantity;
    }

    const [ins] = await conn.execute(
      `INSERT INTO orders
         (order_number, user_id, email, status, payment_status,
          shipping_first_name, shipping_last_name, shipping_phone, shipping_country,
          shipping_state, shipping_city, shipping_address1, shipping_address2,
          shipping_postal_code, shipping_method,
          subtotal, shipping_amount, tax_amount, tax_rate, total, currency,
          supplier_cost_total, shipping_cost_total, payment_fee,
          estimated_delivery_at)
       VALUES (?, ?, ?, 'payment_confirmed', 'paid', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?)`,
      [
        orderNumber,
        req.user ? req.user.id : null,
        String(email).trim().toLowerCase(),
        addr.firstName,
        addr.lastName,
        addr.phone,
        addr.country,
        addr.state,
        addr.city,
        addr.address1,
        addr.address2,
        addr.postalCode,
        method.id,
        fromCents(cart.subtotalCents),
        fromCents(shippingCents),
        fromCents(taxCents),
        (config.pricing.taxRatePercent / 100).toFixed(4),
        fromCents(totalCents),
        fromCents(supplierCostCents),
        fromCents(supplierShippingCents),
        fromCents(paymentFeeCents),
        eta,
      ]
    );
    const newOrderId = ins.insertId;

    for (const line of lines) {
      const s = supplierByProduct.get(String(line.product.id));
      const unitCost = s ? Number(s.cost_price) : 0;
      const unitShip = s ? Number(s.shipping_cost) : 0;
      const lineTotalCents = line.unitCents * line.line.quantity;
      const linePaymentFeeCents =
        totalCents > 0 ? Math.round((paymentFeeCents * lineTotalCents) / totalCents) : 0;
      await conn.execute(
        `INSERT INTO order_items
           (order_id, product_id, variant_id, name, variant_label, image_url,
            unit_price, quantity, line_total,
            unit_supplier_cost, shipping_cost, payment_fee)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newOrderId,
          line.product.id,
          line.variant ? line.variant.id : null,
          line.product.name,
          line.variant ? line.variant.name : '',
          line.product.image || '',
          fromCents(line.unitCents),
          line.line.quantity,
          fromCents(lineTotalCents),
          unitCost.toFixed(2),
          (unitShip * line.line.quantity).toFixed(2),
          fromCents(linePaymentFeeCents),
        ]
      );
    }

    await conn.execute(
      `INSERT INTO payments (order_id, provider, method, status, amount, currency, card_last4)
       VALUES (?, 'mock', 'card', 'captured', ?, 'USD', ?)`,
      [newOrderId, fromCents(totalCents), digits.slice(-4)]
    );

    // Empty the cart now that the order exists.
    if (cart.id) await conn.execute('DELETE FROM cart_items WHERE cart_id = ?', [cart.id]);

    return newOrderId;
  });

  const orderRow = await queryOne('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]);
  const orders = require('./orders');
  res.status(201).json({
    ok: true,
    order: await orders.decorateOrder(orderRow),
  });
}

module.exports = { shippingMethods, quote, placeOrder };
