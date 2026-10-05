/**
 * CJdropshipping HTTP client.
 *
 * Two things matter here and both are easy to get wrong:
 *
 *  1. RATE LIMITING IS MANDATORY. CJ rejects more than one request per second
 *     with code 1600200 ("QPS limit is 1 time/1second"). This is a hard reject,
 *     not a warning, and it is not documented as a soft quota on the product
 *     endpoints, so every request passes through a serialising gate that
 *     enforces `minRequestIntervalMs` between the *start* of each call.
 *
 *  2. THE ENVELOPE IS NOT HTTP. A rate-limited or invalid-parameter call still
 *     returns HTTP 200 with `result: false` and a `code`. Treating the status
 *     line as success would silently record "0 products" instead of failing, so
 *     `result` and `code` are what decide success here.
 */

const config = require('../../config');
const tokenStore = require('./token');

/** Serialises requests and enforces the minimum gap between them. */
let gate = Promise.resolve();
let lastStartedAt = 0;

function throttle() {
  const run = gate.then(async () => {
    const wait = config.cj.minRequestIntervalMs - (Date.now() - lastStartedAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastStartedAt = Date.now();
  });
  // The gate must survive a rejection, otherwise one failure would unblock
  // every queued request at once and defeat the rate limit.
  gate = run.catch(() => {});
  return run;
}

/** CJ application-level error codes worth handling distinctly. */
const CJ_CODES = {
  RATE_LIMITED: 1600200,
  PARAM_ERROR: 1600100,
  AUTH_FAILED: 1600001,
  REFRESH_FAILED: 1600003,
  USER_NOT_FOUND: 1601000,
  /** The product has been removed or delisted upstream. Not retryable. */
  PRODUCT_REMOVED: 530,
};

class CjError extends Error {
  constructor(message, { cjCode, status, requestId, retried = false } = {}) {
    super(message);
    this.name = 'CjError';
    this.cjCode = cjCode;
    this.status = status;
    this.requestId = requestId;
    this.retried = retried;
  }

  /** Rate limiting is worth waiting out; a bad parameter is not. */
  get retryable() {
    return this.cjCode === CJ_CODES.RATE_LIMITED || this.status === 429 || this.status >= 500;
  }
}

function buildUrl(path, query) {
  const url = new URL(`${config.cj.baseUrl}${config.cj.apiPrefix}${path}`);
  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null || value === '') continue;
    // listV2 expects repeated params for array filters such as `features`.
    if (Array.isArray(value)) {
      for (const v of value) url.searchParams.append(key, v);
    } else {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * One authenticated call. Retries only on rate-limit / server faults, with
 * exponential backoff, and re-authorises once on a 401.
 */
async function request(path, { method = 'GET', query, body, allowRetry = true } = {}) {
  let attempt = 0;
  let reauthorized = false;

  for (;;) {
    await throttle();
    const accessToken = await tokenStore.getAccessToken();
    const url = buildUrl(path, query);

    let res;
    let json;
    try {
      res = await fetch(url, {
        method,
        headers: {
          'CJ-Access-Token': accessToken,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(config.cj.requestTimeoutMs),
      });
    } catch (err) {
      // Network-level failure (DNS, TLS, timeout) is retryable.
      if (attempt < config.cj.maxRetries) {
        attempt += 1;
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      throw new CjError(`CJ request failed: ${err.message}`, { status: 502 });
    }

    try {
      json = await res.json();
    } catch {
      throw new CjError(`CJ returned a non-JSON response (HTTP ${res.status})`, {
        status: res.status === 200 ? 502 : res.status,
      });
    }

    const succeeded = res.ok && json.result !== false && json.code === 200;
    if (succeeded) return json.data;

    const err = new CjError(
      `CJ ${method} ${path} failed: ${json.message || `HTTP ${res.status}`} (code ${json.code})`,
      { cjCode: json.code, status: res.status, requestId: json.requestId }
    );

    // A rejected token is retried once after re-authorising.
    if (res.status === 401 && !reauthorized) {
      reauthorized = true;
      tokenStore.invalidate();
      continue;
    }

    if (allowRetry && err.retryable && attempt < config.cj.maxRetries) {
      attempt += 1;
      // Rate-limit backoff must exceed the 1s window with margin.
      const backoff = err.cjCode === CJ_CODES.RATE_LIMITED ? 2500 * attempt : 1000 * 2 ** attempt;
      await new Promise((r) => setTimeout(r, backoff));
      continue;
    }

    throw err;
  }
}

/* ---- catalogue endpoints ------------------------------------------------- */

/**
 * One page of products.
 * NOTE the response shape: `content` is a single-element array that *wraps*
 * `productList`. It is not one entry per product, so the product list is
 * `data.content[0].productList`.
 */
async function listProducts({ page = 1, size = config.cj.pageSize, keyWord, categoryId, countryCode, features } = {}) {
  const data = await request(config.cj.catalog.listPath, {
    query: { page, size, keyWord, categoryId, countryCode, features },
  });

  const list = data?.content?.[0]?.productList ?? [];
  return {
    products: list,
    pageNumber: Number(data?.pageNumber) || page,
    pageSize: Number(data?.pageSize) || size,
    totalRecords: Number(data?.totalRecords) || 0,
    totalPages: Number(data?.totalPages) || 0,
  };
}

/**
 * Full detail for one product, including variants.
 * Variants are at `data.stanProducts[]` and each entry's `id` is the VARIANT id.
 */
async function getProductDetail(productId) {
  return request(config.cj.catalog.detailPath, {
    method: 'POST',
    body: { id: String(productId) },
  });
}

/** All variants of a product. `data` here is a bare array, unlike listV2. */
async function listVariants({ pid, productSku, variantSku, countryCode } = {}) {
  const data = await request('/product/variant/query', {
    query: { pid, productSku, variantSku, countryCode },
  });
  return Array.isArray(data) ? data : [];
}

/** First > second > third level category tree. */
async function listCategories() {
  const data = await request(config.cj.catalog.categoriesPath);
  return Array.isArray(data) ? data : [];
}

module.exports = {
  request,
  listProducts,
  listVariants,
  getProductDetail,
  listCategories,
  CjError,
  CJ_CODES,
};