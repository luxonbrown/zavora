/**
 * ZAVORA — server configuration.
 *
 * NOTE: there is deliberately no `.env` file. Every value below is a
 * clearly marked placeholder. Replace with real credentials before running
 * against live data, and never commit real secrets.
 */

const PLACEHOLDER = 'REPLACE_ME';

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,

  // Comma-separated list of allowed browser origins.
  clientOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173'],

  session: {
    // PLACEHOLDER — long random string (e.g. 64+ random bytes).
    secret: process.env.SESSION_SECRET || `${PLACEHOLDER}_session_secret`,
    name: 'zavora.sid',
    // httpOnly + sameSite cookies; secure must be true behind HTTPS in production.
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // set to true in production
    maxAgeMs: 1000 * 60 * 60 * 24 * 7,
  },

  db: {
    // 'mysql' (default, local XAMPP/MariaDB) or 'postgres' (external hosted
    // PG via server/database/postgres/). Set DB_DRIVER=postgres together with
    // DATABASE_URL to switch without touching code: server/database/pool.js
    // dispatches to the postgres shim, which exposes the same API.
    driver: (process.env.DB_DRIVER || (process.env.DATABASE_URL ? 'postgres' : 'mysql')).toLowerCase(),
    // Full Postgres URL for hosted DBs (Neon/Supabase/Railway/Render).
    // Takes precedence over the discrete host/port/user/password/database
    // below when set. MySQL ignores it.
    connectionString: process.env.DATABASE_URL || '',
    // Force TLS to hosted Postgres. Auto-enabled for DATABASE_URLs with
    // sslmode=require or neon.tech/supabase.co/render.com hosts (see
    // database/postgres/pool.js); set DB_SSL=true for any other hosted PG.
    ssl: /^true$/i.test(process.env.DB_SSL || ''),
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    // Local XAMPP/MariaDB ships a blank root password, so `''` (no password) is
    // the honest development default and `??` keeps any real DB_PASSWORD ahead
    // of it. Note this could not be expressed as an empty *environment*
    // variable: Windows deletes env vars set to '', so an `in process.env`
    // check would always fall through to a placeholder instead.
    // PRODUCTION: set a real DB_PASSWORD — do not run with an empty one.
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME || 'zavora',
    connectionLimit: 10,
  },

  cj: {
    /**
     * CJdropshipping. Server-only: nothing under `cj` is ever sent to the React
     * bundle, and no endpoint exposes it.
     *
     * Authentication is two-stage. The `apiKey` below is the long-lived
     * credential of the form `CJ<userNum>@api@<secret>`; it is POSTed once to
     * /authentication/getAccessToken to obtain a ~566-character accessToken that
     * travels in the `CJ-Access-Token` header. Sending the apiKey directly as
     * the access token returns 401.
     */
    apiKey: process.env.CJ_API_KEY || 'CJ5894696@api@f91bac157290465e9cc8a2905ed2cfca',
    baseUrl: 'https://developers.cjdropshipping.com',
    apiPrefix: '/api2.0/v1',

    auth: {
      tokenPath: '/authentication/getAccessToken',
      refreshPath: '/authentication/refreshAccessToken',
    },

    catalog: {
      listPath: '/product/listV2',
      detailPath: '/product/productDetail/query',
      categoriesPath: '/product/getCategory',
    },

    /**
     * CJ enforces a hard limit of 1 request per second across the API
     * (error 1600200, "QPS limit is 1 time/1second"). Every request goes
     * through this gate; exceeding it is not a soft warning but a hard reject.
     */
    minRequestIntervalMs: Number(process.env.CJ_MIN_INTERVAL_MS) || 1100,
    maxRetries: 3,
    requestTimeoutMs: 30000,

    // Paging. listV2 caps `size` at 100 and reports at most 6000 records.
    pageSize: 100,
    maxPages: 60,

    /**
     * Variant enrichment is a second API call per product, so at 1 req/s a full
     * catalogue enrichment is not viable in one run. Phase A (list) imports
     * every product; Phase B enriches at most this many per run and leaves the
     * remainder for the next run.
     */
    maxVariantFetchesPerRun: 25,
  },

  pricing: {
    /**
     * Mock payment processing fee: applied to the customer total. Real provider
     * fees replace this when a live gateway is wired up.
     */
    paymentFeePercent: Number(process.env.PAYMENT_FEE_PERCENT) || 2.9,
    paymentFeeFixed: Number(process.env.PAYMENT_FEE_FIXED) || 0.30,

    /**
     * Applied to COST, not to the sell price:
     *     sell = cost * (1 + defaultMarkupPercent / 100)
     *
     * Markup and margin are NOT the same number: a 35% markup is a 26% margin,
     * because margin = markup / (1 + markup). Naming this "margin" invites an
     * off-by-a-lot pricing error, so it is called a markup. Both figures are
     * reported by GET /api/admin/cj/preview so the real result is visible.
     */
    defaultMarkupPercent: 35,
    // Dropshipper stock is not ours to promise, so the storefront caps what it
    // will sell regardless of what CJ reports.
    maxSellableStock: 25,
    // Fallback international shipping estimate used before live rates exist.
    defaultShippingFee: 6.95,
    freeShippingThreshold: 150,
    taxRatePercent: 0, // set per-market in store_settings
  },
};
