/**
 * CJdropshipping integration tests.
 *
 * The mapper is pure, so it is tested directly against captured real payloads
 * — no network. The client and sync wiring are tested against a stubbed fetch so
 * the suite never spends CJ's 1 request/second budget or depends on the network.
 *
 * Usage: node test/cj.js
 */
const assert = require('assert');

const config = require('../config');
const mapper = require('../services/cj/mapper');

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

/* Real payload shape captured from GET /product/listV2. */
const CJ_PRODUCT = {
  id: '2411230720361609500',
  nameEn: 'Long Sleeve Solid Color And V-neck Leisure Pajamas Sunken Stripe Top',
  sku: 'CJWY2221864',
  spu: 'CJWY2221864',
  bigImage: 'https://cc-west-usa.oss-us-west-1.aliyuncs.com/20210129/2167381084610.png',
  sellPrice: '4.70',
  nowPrice: '',
  listedNum: 100,
  categoryId: '5E656DFB-9BAE-44DD-A755-40AFA2E0E686',
  threeCategoryName: 'Sweaters',
  twoCategoryName: 'Tops & Sets',
  oneCategoryName: "Women's Clothing",
  supplierName: '',
  createAt: 1609228800000,
  warehouseInventoryNum: 129956,
  description: '<p>Soft <b>cotton</b> jersey</p><script>alert(1)</script>',
  deliveryCycle: '3-5',
  saleStatus: '3',
};

console.log('cj integration');

/* ---- pricing: cost must never become the sell price --------------------- */
t('sell price is cost plus markup, not cost itself', () => {
  const { product, supplier } = mapper.mapProduct(CJ_PRODUCT);
  assert.notStrictEqual(product.price, supplier.cost_price);
  assert.strictEqual(Number(product.price), 6.35); // 4.70 * 1.35
});

t('changing the markup changes the sell price but not the recorded cost', () => {
  const before = mapper.mapProduct(CJ_PRODUCT);
  const original = config.pricing.defaultMarkupPercent;
  try {
    config.pricing.defaultMarkupPercent = 100;
    const after = mapper.mapProduct(CJ_PRODUCT);
    assert.strictEqual(Number(after.supplier.cost_price), Number(before.supplier.cost_price));
    assert.strictEqual(Number(after.product.price), 9.4); // 4.70 * 2
  } finally {
    config.pricing.defaultMarkupPercent = original;
  }
});

t('a discounted nowPrice is used as the cost when cheaper', () => {
  const m = mapper.mapProduct({ ...CJ_PRODUCT, nowPrice: '3.50' });
  assert.strictEqual(Number(m.supplier.cost_price), 3.5);
});

t('a product with no usable price yields zero cost and zero sell price', () => {
  const m = mapper.mapProduct({ ...CJ_PRODUCT, sellPrice: '', nowPrice: '', discountPrice: null });
  assert.strictEqual(Number(m.supplier.cost_price), 0);
  assert.strictEqual(Number(m.product.price), 0);
});

/* ---- supplier isolation -------------------------------------------------- */
t('the product payload carries no cost field', () => {
  const { product } = mapper.mapProduct(CJ_PRODUCT);
  const serialised = JSON.stringify(product);
  assert.ok(!/cost/i.test(serialised), `product leaked a cost field: ${serialised}`);
  assert.strictEqual(product.supplier_product_id, undefined);
});

t('supplier fields land only in the supplier payload', () => {
  const { product, supplier } = mapper.mapProduct(CJ_PRODUCT);
  assert.ok(supplier.cost_price);
  assert.strictEqual(supplier.supplier_product_id, CJ_PRODUCT.id);
  assert.ok(!('cost_price' in product));
  assert.ok(!('supplier_product_id' in product));
});

/* ---- stock capping ------------------------------------------------------- */
t('sellable stock is capped below the upstream figure', () => {
  const m = mapper.mapProduct(CJ_PRODUCT); // 129956 upstream
  assert.strictEqual(m.product.stock, config.pricing.maxSellableStock);
  assert.strictEqual(m.supplier.supplier_stock, 129956);
});

/* ---- identity ------------------------------------------------------------ */
t('sku is namespaced so CJ and ZAVORA skus cannot collide', () => {
  assert.strictEqual(mapper.zavoraSku('CJWY2221864', 'x'), 'CJ-CJWY2221864');
});

t('slug is unique per CJ id even for identical names', () => {
  const a = mapper.mapProduct({ ...CJ_PRODUCT, id: 'aaa11111' });
  const b = mapper.mapProduct({ ...CJ_PRODUCT, id: 'bbb22222' });
  assert.notStrictEqual(a.product.slug, b.product.slug);
});

t('slug survives punctuation and non-ascii names', () => {
  const m = mapper.mapProduct({ ...CJ_PRODUCT, nameEn: 'Café — Mug?! 100%', id: 'zzz99999' });
  assert.ok(/^[a-z0-9-]+$/.test(m.product.slug), m.product.slug);
});

/* ---- category selection -------------------------------------------------- */
t('the most specific available CJ category level is used', () => {
  assert.strictEqual(mapper.categoryNameFor(CJ_PRODUCT), 'Sweaters');
  assert.strictEqual(
    mapper.categoryNameFor({ twoCategoryName: 'Tops', oneCategoryName: 'Women' }),
    'Tops'
  );
  assert.strictEqual(mapper.categoryNameFor({}), 'Uncategorised');
});

/* ---- description handling ------------------------------------------------ */
t('HTML is stripped and scripts are removed', () => {
  const text = mapper.stripHtml(CJ_PRODUCT.description);
  assert.ok(!text.includes('<'), text);
  assert.ok(!text.toLowerCase().includes('alert'), text);
  assert.ok(text.includes('cotton'));
});

t('short description fits the VARCHAR(500) column', () => {
  const m = mapper.mapProduct({ ...CJ_PRODUCT, description: 'x'.repeat(5000) });
  assert.ok(m.product.short_description.length <= 500, `len=${m.product.short_description.length}`);
});

/* ---- change detection ---------------------------------------------------- */
t('an unchanged product produces an identical sync hash', () => {
  assert.strictEqual(
    mapper.mapProduct(CJ_PRODUCT).sync_hash,
    mapper.mapProduct({ ...CJ_PRODUCT }).sync_hash
  );
});

t('a price or stock change produces a different sync hash', () => {
  const base = mapper.mapProduct(CJ_PRODUCT).sync_hash;
  assert.notStrictEqual(mapper.mapProduct({ ...CJ_PRODUCT, sellPrice: '4.71' }).sync_hash, base);
  assert.notStrictEqual(
    mapper.mapProduct({ ...CJ_PRODUCT, warehouseInventoryNum: 1 }).sync_hash,
    base
  );
});

/* ---- variants ------------------------------------------------------------ */
t('variants map from stanProducts and never hardcode a price', () => {
  const detail = {
    stanProducts: [
      { id: 'v1', sku: 'CJWY2221864-XS', variantkey: 'Black-XS', sellprice: '9.99', totalInventory: 12 },
      { id: 'v2', sku: 'CJWY2221864-M', variantkey: 'Black-M', sellprice: '9.99', totalInventory: 4 },
    ],
  };
  const variants = mapper.mapVariants(detail);
  assert.strictEqual(variants.length, 2);
  assert.strictEqual(variants[0].supplier_variant_id, 'v1');
  // null means "inherit the product price"; CJ's own sellprice must not be used.
  assert.ok(variants.every((v) => v.price === null));
  assert.strictEqual(variants[0].stock, 12);
  assert.strictEqual(variants[0].name, 'Black / XS');
});

t('size options are typed as sizes', () => {
  const [v] = mapper.mapVariants({ stanProducts: [{ id: 'v', sku: 's', variantkey: 'Blue-XXL' }] });
  assert.strictEqual(v.option_type, 'size');
});

t('a product with no stanProducts yields no variants', () => {
  assert.deepStrictEqual(mapper.mapVariants({}), []);
  assert.deepStrictEqual(mapper.mapVariants(null), []);
});

/* ---- client: envelope parsing and error handling, against a stub ---------- */
async function clientTests() {
  const client = require('../services/cj/client');
  const tokenStore = require('../services/cj/token');
  const { closePool } = require('../database/pool');

  const originalFetch = global.fetch;
  const originalRetries = config.cj.maxRetries;
  let seen = [];

  /**
   * Endpoint-aware stub. The auth endpoint must SUCCEED, otherwise every
   * product call fails during `getAccessToken()` and the error under test is
   * never reached — an auth failure surfaces as a plain Error carrying a
   * `cjCode`, which is easy to mistake for the caller's own error.
   */
  const okAuth = {
    code: 200,
    result: true,
    data: {
      openId: 54102,
      accessToken: 'token-abc',
      accessTokenExpiryDate: new Date(Date.now() + 86400000).toISOString(),
      refreshToken: 'refresh-abc',
      refreshTokenExpiryDate: new Date(Date.now() + 86400000).toISOString(),
    },
  };

  function stub(handler) {
    global.fetch = async (url, init) => {
      const asString = String(url);
      seen.push({ url: asString, headers: init.headers });
      const body = asString.includes('/authentication/') ? okAuth : handler(asString);
      return {
        ok: body.code === 200,
        status: 200,
        json: async () => ({
          code: body.code,
          result: body.code === 200,
          message: body.message || 'Success',
          data: body.data ?? null,
          requestId: 'req-1',
        }),
      };
    };
  }

  // Keep retry backoff out of the test runtime; retry behaviour is asserted by
  // inspecting the error, not by waiting it out.
  config.cj.maxRetries = 0;

  // Snapshot the real credential rather than deleting it. The suite stubs the
  // auth endpoint, so it must not leave a fabricated token behind, but wiping
  // the stored one would force the next real sync to re-authorise and burn a
  // request from the 1/sec budget.
  const snapshot = await tokenStore.readPersistedRows();

  try {
    await tokenStore.invalidate();

    // The product list is wrapped: content[0].productList, NOT content[].
    stub(() => ({
      code: 200,
      data: {
        pageSize: 2,
        pageNumber: 1,
        totalRecords: 2,
        totalPages: 1,
        content: [{ productList: [CJ_PRODUCT, { ...CJ_PRODUCT, id: 'other' }], keyWord: '' }],
      },
    }));
    const list = await client.listProducts({
      page: 1,
      size: 2,
      features: ['enable_description', 'enable_category'],
    });
    t('client unwraps content[0].productList', () => {
      assert.strictEqual(list.products.length, 2);
      assert.strictEqual(list.products[0].id, CJ_PRODUCT.id);
      assert.strictEqual(list.totalRecords, 2);
    });

    t('the access token is sent as the CJ-Access-Token header', () => {
      const authed = seen.filter((s) => s.headers && s.headers['CJ-Access-Token']);
      assert.ok(authed.length > 0, 'no request carried the token header');
    });

    t('array params are sent as repeated query keys', () => {
      const listCall = seen.find((s) => s.url.includes('/product/listV2'));
      assert.ok(listCall.url.includes('features=enable_description'), listCall.url);
      assert.ok(listCall.url.includes('features=enable_category'), listCall.url);
    });

    // A rate-limit rejection must throw, not be reported as "0 products".
    stub(() => ({ code: 1600200, message: 'Too Many Requests, QPS limit is 1 time/1second' }));
    await assert.rejects(
      () => client.listProducts({ page: 1, size: 2 }),
      (err) => {
        assert.strictEqual(err.name, 'CjError');
        assert.strictEqual(err.cjCode, 1600200);
        assert.strictEqual(err.retryable, true);
        return true;
      }
    );
    t('a QPS rejection throws a CjError rather than returning an empty page', () => true);

    // A removed product is not retryable.
    stub(() => ({ code: 530, message: 'Sorry, the product is removed.' }));
    await assert.rejects(
      () => client.getProductDetail('x'),
      (err) => {
        assert.strictEqual(err.cjCode, 530);
        assert.strictEqual(err.retryable, false);
        return true;
      }
    );
    t('a removed product (code 530) is treated as non-retryable', () => true);

    // Variants come back as a bare array on this endpoint.
    stub(() => ({ code: 200, data: [{ vid: 'v1', variantKey: 'Black-XS', variantSellPrice: '3.00' }] }));
    const variants = await client.listVariants({ pid: 'p1' });
    t('variant endpoint returns a bare array', () => {
      assert.ok(Array.isArray(variants));
      assert.strictEqual(variants[0].vid, 'v1');
    });
  } finally {
    global.fetch = originalFetch;
    config.cj.maxRetries = originalRetries;
    await tokenStore.restorePersistedRows(snapshot).catch(() => {});
    await closePool().catch(() => {});
  }
}

/* ---- token exchange shape, stubbed ---------------------------------------- */
async function tokenTests() {
  const tokenStore = require('../services/cj/token');
  const { closePool, execute } = require('../database/pool');
  const originalFetch = global.fetch;
  const FAKE_TOKEN = 'stub-access-token-do-not-log';
  let calls = [];

  global.fetch = async (url, init) => {
    calls.push({ url: String(url), body: init.body, headers: init.headers });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        code: 200,
        result: true,
        message: 'Success',
        data: {
          openId: 54102,
          accessToken: FAKE_TOKEN,
          accessTokenExpiryDate: new Date(Date.now() + 86400000).toISOString(),
          refreshToken: 'stub-refresh-token-do-not-log',
          refreshTokenExpiryDate: new Date(Date.now() + 86400000).toISOString(),
        },
      }),
    };
  };

  // The real credential must be present for the restore to be meaningful, and
  // absent while the stub runs so the exchange is genuinely exercised. Neither
  // token value is ever placed in an assertion message: a failed
  // strictEqual prints its operands, which would leak the secret into CI logs.
  const snapshot = await tokenStore.readPersistedRows();

  try {
    await execute("DELETE FROM store_settings WHERE setting_group = 'cj'");
    await tokenStore.invalidate();

    const tok = await tokenStore.getAccessToken();
    t('apiKey is exchanged for an access token', () => {
      assert.ok(tok, 'no token returned');
      assert.strictEqual(tok === FAKE_TOKEN, true, 'token did not come from the stub');
    });
    t('the exchange posts the apiKey to the token endpoint', () => {
      assert.ok(calls[0].url.includes('/authentication/getAccessToken'), calls[0].url);
      const body = JSON.parse(calls[0].body);
      assert.ok(body.apiKey, 'apiKey was not sent');
      // The documented format is CJ<userNum>@api@<secret>.
      assert.match(String(body.apiKey), /@api@|^REPLACE_ME/);
    });
    t('the apiKey is posted in the body, never as a header', () => {
      const headers = calls[0].headers || {};
      const headerValues = Object.values(headers).join(' ');
      assert.ok(!headerValues.includes('@api@'), 'the apiKey leaked into a request header');
    });

    const status = await tokenStore.status();
    t('status reports openId and a live token', () => {
      assert.strictEqual(status.hasToken, true);
      assert.strictEqual(status.expired, false);
      // Coerced to a string regardless of whether it came from the API or the DB.
      assert.strictEqual(status.openId, '54102');
    });

    t('status never exposes the token itself', () => {
      const serialised = JSON.stringify(status);
      assert.ok(!serialised.includes(FAKE_TOKEN), 'status leaked the access token');
      assert.ok(!/refresh/i.test(serialised), 'status exposed a refresh token');
    });
  } finally {
    global.fetch = originalFetch;
    await tokenStore.restorePersistedRows(snapshot).catch(() => {});
    await closePool().catch(() => {});
  }
}

(async () => {
  await clientTests();
  await tokenTests();

  if (failed) {
    console.log(`\n${passed} passed, ${failed} FAILED`);
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log(`  ${passed} assertions passed`);
  process.exit(0);
})();