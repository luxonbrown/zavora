/**
 * Order lifecycle and admin fulfilment tests.
 *
 * The state machine in lib/orderStatus.js and the cancellation restock/refund
 * path are the two places where a bug is expensive and invisible: a bad
 * transition silently corrupts order history, and a cancellation that forgets to
 * restore stock quietly loses inventory.
 *
 * Usage: node test/orders.js
 */
const assert = require('assert');
const app = require('../app');
const { closePool, query, queryOne } = require('../database/pool');
const lifecycle = require('../lib/orderStatus');
const shipping = require('../lib/shipping');

let passed = 0;
let failed = 0;
const failures = [];

function t(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (err) {
    failed += 1;
    failures.push(`${name}: ${err.message}`);
    console.log(`  FAIL  ${name}: ${err.message}`);
  }
}

function makeClient(base) {
  let cookie = '';
  return async function call(method, path, body) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { status: res.status, body: json };
  };
}

/* ---- state machine (pure) ------------------------------------------------ */
console.log('order lifecycle');

t('a fresh order may only advance, never jump to delivered', () => {
  const { assertTransition } = lifecycle;
  assert.throws(() => assertTransition('placed', 'delivered'));
  assertTransition('placed', 'processing');
});

t('delivered and cancelled are final', () => {
  assert.throws(() => assertTransition('delivered', 'processing'));
  assert.throws(() => assertTransition('cancelled', 'processing'));
  assert.deepStrictEqual(lifecycle.allowedNext('delivered'), []);
});

t('a status cannot be set to itself', () => {
  assert.throws(() => lifecycle.assertTransition('shipped', 'shipped'), /already/);
});

t('an unknown status is rejected rather than written', () => {
  assert.throws(() => lifecycle.assertTransition('processing', 'teleported'));
  assert.throws(() => lifecycle.assertTransition('teleported', 'processing'));
});

t('the forward path works end to end', () => {
  const { assertTransition } = lifecycle;
  let s = 'placed';
  for (const next of ['payment_confirmed', 'processing', 'shipped', 'in_transit', 'delivered']) {
    assertTransition(s, next);
    s = next;
  }
});

t('cancellation is allowed before dispatch but not after', () => {
  assert.throws(() => lifecycle.assertTransition('shipped', 'cancelled'));
  assert.throws(() => lifecycle.assertTransition('in_transit', 'cancelled'));
  lifecycle.assertTransition('processing', 'cancelled');
});

t('open and closed sets do not overlap', () => {
  const all = Object.keys(lifecycle.TRANSITIONS);
  assert.strictEqual(lifecycle.OPEN_STATUSES.length + lifecycle.CLOSED_STATUSES.length, all.length);
  const overlap = lifecycle.OPEN_STATUSES.filter((s) => lifecycle.CLOSED_STATUSES.includes(s));
  assert.deepStrictEqual(overlap, []);
});

/* ---- shipping rules (pure) ------------------------------------------------ */
console.log('shipping rules');

t('only standard shipping qualifies for free delivery', () => {
  const over = 20000; // $200, above the $150 threshold
  assert.strictEqual(
    shipping.quoteShipping({ subtotalCents: over, methodId: 'standard', country: 'US' }).freeApplied,
    true
  );
  // This was a real bug once: express came out free on qualifying baskets.
  const express = shipping.quoteShipping({ subtotalCents: over, methodId: 'express', country: 'US' });
  assert.strictEqual(express.freeApplied, false);
  assert.strictEqual(express.amountCents, 1895);
});

t('below the threshold nothing is free', () => {
  const under = 5000;
  for (const id of ['standard', 'express', 'priority']) {
    assert.strictEqual(shipping.quoteShipping({ subtotalCents: under, methodId: id }).freeApplied, false, id);
  }
});

t('an unlisted destination costs more than a domestic one', () => {
  const us = shipping.quoteShipping({ subtotalCents: 1000, methodId: 'express', country: 'US' });
  const intl = shipping.quoteShipping({ subtotalCents: 1000, methodId: 'express', country: 'ZW' });
  assert.strictEqual(us.amountCents, 1895);
  assert.ok(intl.amountCents > us.amountCents, `${intl.amountCents} vs ${us.amountCents}`);
});

t('blocked destinations are refused', () => {
  assert.strictEqual(shipping.isBlocked('RU'), true);
  assert.strictEqual(shipping.isBlocked('US'), false);
});

t('an unknown method yields no quote rather than a wrong one', () => {
  assert.strictEqual(shipping.quoteShipping({ subtotalCents: 1000, methodId: 'teleport' }), null);
});

t('quotes are monotonic: faster costs more', () => {
  const all = shipping.quoteAll({ subtotalCents: 1000, country: 'US' });
  assert.strictEqual(all.length, 3);
  assert.ok(all[0].amountCents < all[1].amountCents);
  assert.ok(all[1].amountCents < all[2].amountCents);
});

t('free-shipping progress is reported for the UI', () => {
  const q = shipping.quoteShipping({ subtotalCents: 5000, methodId: 'standard', country: 'US' });
  assert.strictEqual(q.amountToFreeShippingCents, 15000 - 5000);
});

/* ---- admin API ------------------------------------------------------------ */
async function adminTests() {
  console.log('admin fulfilment');

  const server = await new Promise((r) => {
    const s = app.listen(0, () => r(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const anon = makeClient(base);
    const anonRes = await anon('GET', '/api/admin/orders');
    t('anonymous cannot list admin orders', () => assert.strictEqual(anonRes.status, 401));

    const cust = makeClient(base);
    await cust('POST', '/api/auth/login', { email: 'demo@zavora.com', password: 'zavora1234' });
    const custRes = await cust('GET', '/api/admin/orders');
    t('a signed-in customer is forbidden, not merely anonymous', () =>
      assert.strictEqual(custRes.status, 403));

    const admin = makeClient(base);
    const login = await admin('POST', '/api/auth/login', {
      email: 'admin@zavora.com',
      password: 'zavora-admin-2026',
    });
    if (login.status !== 200) throw new Error(`admin login failed: ${login.status}`);

    const list = await admin('GET', '/api/admin/orders?pageSize=5');
    t('admin can list orders', () => {
      assert.strictEqual(list.status, 200);
      assert.ok(Array.isArray(list.body.items));
    });
    t('order rows expose the allowed next statuses', () => {
      const first = list.body.items[0];
      assert.ok(Array.isArray(first.allowedNext), 'allowedNext missing');
    });

    const statuses = await admin('GET', '/api/admin/orders/statuses');
    t('the lifecycle is published for the UI', () => {
      assert.strictEqual(statuses.status, 200);
      assert.ok(statuses.body.statuses.length >= 7);
      const shipped = statuses.body.statuses.find((s) => s.status === 'shipped');
      assert.strictEqual(shipped.requiresTracking, true);
    });

    // Build a disposable order to move through the lifecycle.
    const fixture = await queryOne(
      "SELECT o.id, o.order_number, o.status FROM orders o WHERE o.status = 'placed' LIMIT 1"
    );

    if (fixture) {
      const illegal = await admin('PATCH', `/api/admin/orders/${fixture.order_number}/status`, {
        status: 'delivered',
        trackingNumber: 'TEST123',
      });
      t('an illegal transition is refused with a 409', () => {
        assert.strictEqual(illegal.status, 409, `got ${illegal.status}`);
      });

      const noTracking = await admin('PATCH', `/api/admin/orders/${fixture.order_number}/status`, {
        status: 'shipped',
      });
      t('shipping without a tracking number is refused', () => {
        assert.strictEqual(noTracking.status, 400, `got ${noTracking.status}`);
      });

      const shipped = await admin('PATCH', `/api/admin/orders/${fixture.order_number}/status`, {
        status: 'shipped',
        carrier: 'DHL Express',
        trackingNumber: `TEST${Date.now()}`,
      });
      t('a legal transition succeeds', () => {
        assert.strictEqual(shipped.status, 200, `got ${shipped.status} ${JSON.stringify(shipped.body)}`);
        assert.strictEqual(shipped.body.order.status, 'shipped');
      });

      const afterShip = await admin('GET', `/api/admin/orders/${fixture.order_number}`);
      t('the shipment record is created alongside', () => {
        assert.strictEqual(afterShip.body.order.shipments.length, 1);
        assert.ok(afterShip.body.order.shipments[0].trackingNumber);
      });

      // Cancellation after dispatch must be refused.
      const lateCancel = await admin('POST', `/api/admin/orders/${fixture.order_number}/cancel`, {});
      t('cancelling a shipped order is refused', () => {
        assert.strictEqual(lateCancel.status, 409, `got ${lateCancel.status}`);
      });

      // Put it back so the fixture is not left mid-lifecycle.
      await admin('PATCH', `/api/admin/orders/${fixture.order_number}/status`, {
        status: 'in_transit',
      });
    }

    // A cancellable order: create one and verify stock is restored.
    const products = await query(
      "SELECT id, stock FROM products WHERE is_active = 1 AND stock > 5 ORDER BY id ASC LIMIT 1"
    );
    if (products.length) {
      const product = products[0];
      const stockBefore = Number(product.stock);

      const buyer = makeClient(base);
      const anonCart = makeClient(base);
      await anonCart('POST', '/api/cart/items', { productId: String(product.id), quantity: 2 });

      const placed = await anonCart('POST', '/api/checkout/place-order', {
        email: 'cancel-test@zavora.test',
        shippingAddress: {
          firstName: 'Cancel', lastName: 'Test', country: 'US', state: 'NY',
          city: 'New York', address1: '1 Test St', postalCode: '10001',
        },
        shippingMethod: 'standard',
        payment: { cardNumber: '4242424242424242', cvc: '123', expiry: '12/30' },
      });

      if (placed.status === 201) {
        const orderNumber = placed.body.order.orderNumber;
        const midStock = await queryOne('SELECT stock FROM products WHERE id = ?', [product.id]);
        t('placing an order decrements stock', () => {
          assert.strictEqual(Number(midStock.stock), stockBefore - 2, `${stockBefore} -> ${midStock.stock}`);
        });

        const cancelled = await admin('POST', `/api/admin/orders/${orderNumber}/cancel`, {
          reason: 'test',
        });
        t('cancellation succeeds for an order in flight', () => {
          assert.strictEqual(cancelled.status, 200, `got ${cancelled.status}`);
          assert.strictEqual(cancelled.body.restockedLines, 1);
        });

        const endStock = await queryOne('SELECT stock FROM products WHERE id = ?', [product.id]);
        t('cancellation restores the stock', () => {
          assert.strictEqual(Number(endStock.stock), stockBefore, `${midStock.stock} -> ${endStock.stock}`);
        });

        const refund = await queryOne(
          "SELECT payment_status FROM orders WHERE order_number = ?",
          [orderNumber]
        );
        t('a captured payment is refunded on cancellation', () => {
          assert.strictEqual(refund.payment_status, 'refunded');
        });

        const twice = await admin('POST', `/api/admin/orders/${orderNumber}/cancel`, {});
        t('cancelling twice is refused, so stock is not credited twice', () => {
          assert.strictEqual(twice.status, 409, `got ${twice.status}`);
        });
        const afterTwice = await queryOne('SELECT stock FROM products WHERE id = ?', [product.id]);
        t('stock is unchanged by the refused second cancellation', () => {
          assert.strictEqual(Number(afterTwice.stock), stockBefore);
        });
      }
    }
  } finally {
    server.close();
  }

  return passed;
}

adminTests()
  .then(async () => {
    if (failed) {
      console.log(`\n${passed} passed, ${failed} FAILED`);
      for (const f of failures) console.log(`  - ${f}`);
      await closePool();
      process.exit(1);
    }
    console.log(`  ${passed} assertions passed`);
    await closePool();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('crashed:', err);
    await closePool();
    process.exit(1);
  });