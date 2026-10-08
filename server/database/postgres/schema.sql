-- ============================================================================
-- ZAVORA — PostgreSQL schema (external database)
-- ============================================================================
-- This is a faithful port of server/database/schema.sql (MySQL/MariaDB) to
-- PostgreSQL 14+. It is intended for an EXTERNAL hosted database
-- (Neon, Supabase, Railway, Render, or any managed Postgres) referenced via
-- DATABASE_URL, so the storefront can run without a local MySQL install.
--
-- Design rules (same as MySQL):
--   1. Supplier data lives ONLY in `product_supplier`. No storefront table has
--      a cost, supplier id or fulfilment column.
--   2. Public reads never `SELECT *` across the supplier boundary.
--   3. Order lines snapshot name/image/price/variant.
--   4. Phase-2 hooks (referral) exist as nullable columns only.
--
-- MySQL -> Postgres notes:
--   - BIGINT UNSIGNED AUTO_INCREMENT -> BIGSERIAL, INT UNSIGNED -> SERIAL.
--   - TINYINT(1) booleans are kept as SMALLINT 0/1 (not BOOLEAN) so existing
--     queries using `is_active = 1` / `is_primary = 1` work unchanged.
--   - ENUM(...) -> TEXT + CHECK constraint (same allowed values).
--   - DATETIME -> TIMESTAMPTZ DEFAULT NOW(). MySQL's
--     ON UPDATE CURRENT_TIMESTAMP is emulated with a trigger below.
--   - DECIMAL(10,2) -> NUMERIC(10,2). Both mysql2 (decimalNumbers:false) and
--     pg return NUMERIC as a string, so money code is unchanged.
--   - MEDIUMTEXT -> TEXT. CHARSET/COLLATE/ENGINE clauses are dropped.
--   - FULLTEXT index -> GIN tsvector index + pg_trgm indexes for ILIKE.
--   - cart_items.variant_key: MySQL `IFNULL(variant_id,0)` generated column
--     becomes Postgres `COALESCE(variant_id,0)` STORED generated column.
--   - `MATCH(...) AGAINST (... IN BOOLEAN MODE)` has no Postgres equivalent;
--     server/lib/catalog.js uses ILIKE fallback when DB_DRIVER=postgres.
--   - `ON DUPLICATE KEY UPDATE ... VALUES(col)` becomes
--     `ON CONFLICT (...) DO UPDATE SET ... = EXCLUDED.col`
--     (handled by server/database/postgres/pool.js translation shim).
--
-- Usage (external DB):
--   $env:DATABASE_URL = 'postgresql://user:pass@host:5432/zavora?sslmode=require'
--   $env:DB_DRIVER = 'postgres'
--   npm run db:pg:schema   # applies this file (destructive: DROPs tables)
--   npm run db:pg:seed     # demo data (same seed-data.js as MySQL)
-- ============================================================================

-- Required for fast ILIKE / substring search (catalog fallback path).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Auto-touch updated_at on row updates (emulates MySQL ON UPDATE CURRENT_TIMESTAMP).
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TABLE IF EXISTS wishlist CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS shipments CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS cart_items CASCADE;
DROP TABLE IF EXISTS cart CASCADE;
DROP TABLE IF EXISTS addresses CASCADE;
DROP TABLE IF EXISTS product_supplier CASCADE;
DROP TABLE IF EXISTS product_variants CASCADE;
DROP TABLE IF EXISTS product_images CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS cj_sync_logs CASCADE;
DROP TABLE IF EXISTS store_settings CASCADE;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id             BIGSERIAL PRIMARY KEY,
  email          VARCHAR(190)    NOT NULL,
  password_hash  VARCHAR(255)    NOT NULL,
  first_name     VARCHAR(80)     NOT NULL DEFAULT '',
  last_name      VARCHAR(80)     NOT NULL DEFAULT '',
  phone          VARCHAR(40)     NOT NULL DEFAULT '',
  role           TEXT            NOT NULL DEFAULT 'customer'
                 CHECK (role IN ('customer','admin')),
  is_active      SMALLINT        NOT NULL DEFAULT 1,
  email_verified_at TIMESTAMPTZ  NULL DEFAULT NULL,
  last_login_at  TIMESTAMPTZ     NULL DEFAULT NULL,
  -- PHASE-2 HOOK (no logic implemented): unique code a customer can share.
  referral_code  VARCHAR(32)     NULL DEFAULT NULL,
  -- JSON map of the customer's email notification preferences.
  email_preferences TEXT NULL DEFAULT NULL,
  created_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  UNIQUE (email),
  UNIQUE (referral_code)
);
CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_users_created ON users (created_at);

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
CREATE TABLE categories (
  id         SERIAL PRIMARY KEY,
  parent_id  INTEGER NULL DEFAULT NULL REFERENCES categories (id) ON DELETE SET NULL ON UPDATE CASCADE,
  name       VARCHAR(120) NOT NULL,
  slug       VARCHAR(140) NOT NULL UNIQUE,
  tagline    VARCHAR(190) NOT NULL DEFAULT '',
  position   INTEGER NOT NULL DEFAULT 0,
  is_active  SMALLINT  NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_categories_parent ON categories (parent_id);
CREATE INDEX idx_categories_active_position ON categories (is_active, position);

-- ---------------------------------------------------------------------------
-- products  (storefront fields only — no supplier data here)
-- ---------------------------------------------------------------------------
CREATE TABLE products (
  id                BIGSERIAL PRIMARY KEY,
  category_id       INTEGER    NULL DEFAULT NULL REFERENCES categories (id) ON DELETE SET NULL ON UPDATE CASCADE,
  name              VARCHAR(190)    NOT NULL,
  slug              VARCHAR(220)    NOT NULL UNIQUE,
  sku               VARCHAR(64)     NOT NULL UNIQUE,
  brand             VARCHAR(80)     NOT NULL DEFAULT 'ZAVORA',
  short_description VARCHAR(500)    NOT NULL DEFAULT '',
  description       TEXT            NULL,
  -- ZAVORA computes this independently of supplier cost (see store_settings).
  price             NUMERIC(10,2)   NOT NULL,
  compare_at_price  NUMERIC(10,2)   NULL DEFAULT NULL,
  rating            NUMERIC(3,2)    NOT NULL DEFAULT 0,
  review_count      INTEGER         NOT NULL DEFAULT 0,
  stock             INTEGER         NOT NULL DEFAULT 0,
  -- Merchandising fields shown on the storefront. `specifications` holds a JSON
  -- array of [label, value] pairs, e.g. [["Driver","40mm"],["Weight","268 g"]].
  badge             VARCHAR(40)     NULL DEFAULT NULL,
  specifications    TEXT            NULL DEFAULT NULL,
  status            TEXT            NOT NULL DEFAULT 'active'
                    CHECK (status IN ('draft','active','archived')),
  is_active         SMALLINT        NOT NULL DEFAULT 1,
  published_at      TIMESTAMPTZ     NULL DEFAULT NULL,
  created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_products_category ON products (category_id);
CREATE INDEX idx_products_status_active ON products (status, is_active);
CREATE INDEX idx_products_price ON products (price);
CREATE INDEX idx_products_rating ON products (rating);
CREATE INDEX idx_products_name ON products (name);
CREATE INDEX idx_products_published ON products (published_at);
CREATE INDEX idx_products_stock ON products (stock);
-- Full-text search vector (english) over name + short_description + description.
CREATE INDEX ft_products_search
  ON products USING gin (to_tsvector('english',
    name || ' ' || short_description || ' ' || COALESCE(description, '')));
-- Trigram indexes accelerate the ILIKE fallback path used by the API on PG.
CREATE INDEX trgm_products_name ON products USING gin (name gin_trgm_ops);
CREATE INDEX trgm_products_short_desc ON products USING gin (short_description gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- product_supplier  — CJdropshipping data. ADMIN-ONLY. Never joined into a
-- public response. The separation is structural, not just conventional.
-- ---------------------------------------------------------------------------
CREATE TABLE product_supplier (
  id                    BIGSERIAL PRIMARY KEY,
  product_id            BIGINT NOT NULL REFERENCES products (id) ON DELETE CASCADE ON UPDATE CASCADE,
  supplier              VARCHAR(40)  NOT NULL DEFAULT 'cj',
  supplier_product_id   VARCHAR(80)  NOT NULL,
  supplier_variant_id   VARCHAR(80)  NULL DEFAULT NULL,
  supplier_sku          VARCHAR(80)  NULL DEFAULT NULL,
  supplier_name         VARCHAR(190) NOT NULL DEFAULT '',
  supplier_url          VARCHAR(500) NULL DEFAULT NULL,
  cost_price            NUMERIC(10,2) NOT NULL DEFAULT 0,
  shipping_cost         NUMERIC(10,2) NOT NULL DEFAULT 0,
  supplier_stock        INTEGER      NOT NULL DEFAULT 0,
  sync_hash             VARCHAR(64)  NULL DEFAULT NULL,
  last_synced_at        TIMESTAMPTZ  NULL DEFAULT NULL,
  -- Set once variants have been fetched for this product. Without it, a product
  -- that genuinely has no variants looks "not yet enriched" forever and is
  -- re-fetched on every sync, burning the 1 req/s budget on nothing.
  variants_synced_at    TIMESTAMPTZ  NULL DEFAULT NULL,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (supplier, supplier_product_id),
  UNIQUE (product_id, supplier)
);
CREATE INDEX idx_supplier_cost ON product_supplier (cost_price);

-- ---------------------------------------------------------------------------
-- product_images
-- ---------------------------------------------------------------------------
CREATE TABLE product_images (
  id         BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products (id) ON DELETE CASCADE ON UPDATE CASCADE,
  url        VARCHAR(500) NOT NULL,
  alt        VARCHAR(190) NOT NULL DEFAULT '',
  position   SMALLINT NOT NULL DEFAULT 0,
  is_primary SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_images_product ON product_images (product_id, position);

-- ---------------------------------------------------------------------------
-- product_variants
-- ---------------------------------------------------------------------------
CREATE TABLE product_variants (
  id                    BIGSERIAL PRIMARY KEY,
  product_id            BIGINT NOT NULL REFERENCES products (id) ON DELETE CASCADE ON UPDATE CASCADE,
  name                  VARCHAR(120) NOT NULL,
  option_type           TEXT NULL DEFAULT NULL CHECK (option_type IS NULL OR option_type IN ('color','size')),
  option_value          VARCHAR(120) NULL DEFAULT NULL,
  sku                   VARCHAR(80)  NULL DEFAULT NULL,
  -- Only differs from the parent price when a variant genuinely costs more.
  price                 NUMERIC(10,2) NULL DEFAULT NULL,
  stock                 INTEGER      NOT NULL DEFAULT 0,
  supplier_variant_id   VARCHAR(80)  NULL DEFAULT NULL,
  position              SMALLINT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, name)
);
CREATE INDEX idx_variants_product ON product_variants (product_id, position);

-- ---------------------------------------------------------------------------
-- addresses
-- ---------------------------------------------------------------------------
CREATE TABLE addresses (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  label       VARCHAR(60)  NOT NULL DEFAULT 'Home',
  first_name  VARCHAR(80)  NOT NULL,
  last_name   VARCHAR(80)  NOT NULL,
  phone       VARCHAR(40)  NOT NULL DEFAULT '',
  country     CHAR(2)      NOT NULL,
  state       VARCHAR(120) NOT NULL DEFAULT '',
  city        VARCHAR(120) NOT NULL,
  address1    VARCHAR(190) NOT NULL,
  address2    VARCHAR(190) NOT NULL DEFAULT '',
  postal_code VARCHAR(24)  NOT NULL,
  is_default  SMALLINT     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_addresses_user ON addresses (user_id, is_default);

-- ---------------------------------------------------------------------------
-- cart / cart_items  (user_id for signed-in, session_key for guests)
-- ---------------------------------------------------------------------------
CREATE TABLE cart (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NULL DEFAULT NULL REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE UNIQUE,
  session_key VARCHAR(64) NULL DEFAULT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cart_items (
  id          BIGSERIAL PRIMARY KEY,
  cart_id     BIGINT NOT NULL REFERENCES cart (id) ON DELETE CASCADE ON UPDATE CASCADE,
  product_id  BIGINT NOT NULL REFERENCES products (id) ON DELETE CASCADE ON UPDATE CASCADE,
  variant_id  BIGINT NULL DEFAULT NULL REFERENCES product_variants (id) ON DELETE SET NULL ON UPDATE CASCADE,
  quantity    SMALLINT NOT NULL DEFAULT 1,
  -- Snapshot at add-time purely for display; checkout always re-prices.
  unit_price_snapshot NUMERIC(10,2) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A product with no variant stores variant_id NULL. NULLs compare as distinct,
  -- so a plain UNIQUE (cart_id, product_id, variant_id) would store the same
  -- un-varianted line twice. variant_key folds NULL to 0 so the constraint
  -- actually holds. (MySQL used IFNULL; Postgres uses COALESCE.)
  variant_key BIGINT GENERATED ALWAYS AS (COALESCE(variant_id, 0)) STORED,
  UNIQUE (cart_id, product_id, variant_key)
);
CREATE INDEX idx_cart_items_cart ON cart_items (cart_id);

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
CREATE TABLE orders (
  id              BIGSERIAL PRIMARY KEY,
  order_number    VARCHAR(32)  NOT NULL UNIQUE,
  user_id         BIGINT NULL DEFAULT NULL REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
  email           VARCHAR(190) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'placed'
                  CHECK (status IN ('placed','payment_confirmed','processing','shipped','in_transit','delivered','cancelled')),
  payment_status  TEXT NOT NULL DEFAULT 'pending'
                  CHECK (payment_status IN ('pending','paid','failed','refunded')),
  -- Address is snapshotted onto the order; later book edits must not rewrite it.
  shipping_first_name VARCHAR(80)  NOT NULL,
  shipping_last_name  VARCHAR(80)  NOT NULL,
  shipping_phone      VARCHAR(40)  NOT NULL DEFAULT '',
  shipping_country    CHAR(2)      NOT NULL,
  shipping_state      VARCHAR(120) NOT NULL DEFAULT '',
  shipping_city       VARCHAR(120) NOT NULL,
  shipping_address1   VARCHAR(190) NOT NULL,
  shipping_address2   VARCHAR(190) NOT NULL DEFAULT '',
  shipping_postal_code VARCHAR(24)  NOT NULL,
  shipping_method     VARCHAR(40)  NOT NULL DEFAULT 'standard',
  subtotal      NUMERIC(10,2) NOT NULL DEFAULT 0,
  shipping_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_rate      NUMERIC(5,4)  NOT NULL DEFAULT 0,
  total         NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- Financial snapshot: frozen at order creation, never recomputed from the
  -- live product_supplier table (CJ prices change; order history must not).
  supplier_cost_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  shipping_cost_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_fee   NUMERIC(10,2) NOT NULL DEFAULT 0,
  advertising_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  other_costs   NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency      CHAR(3)      NOT NULL DEFAULT 'USD',
  tracking_number VARCHAR(80) NULL DEFAULT NULL,
  carrier       VARCHAR(60)     NULL DEFAULT NULL,
  estimated_delivery_at TIMESTAMPTZ NULL DEFAULT NULL,
  -- PHASE-2 HOOK (no logic implemented).
  referrer_id   BIGINT NULL DEFAULT NULL REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
  placed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_orders_user ON orders (user_id, placed_at);
CREATE INDEX idx_orders_email ON orders (email);
CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_orders_payment_status ON orders (payment_status);
CREATE INDEX idx_orders_placed ON orders (placed_at);
CREATE INDEX idx_orders_tracking ON orders (tracking_number);
CREATE INDEX idx_orders_referrer ON orders (referrer_id);

-- ---------------------------------------------------------------------------
-- order_items — snapshot columns are the historical record of truth.
-- ---------------------------------------------------------------------------
CREATE TABLE order_items (
  id             BIGSERIAL PRIMARY KEY,
  order_id       BIGINT NOT NULL REFERENCES orders (id) ON DELETE CASCADE ON UPDATE CASCADE,
  product_id     BIGINT NULL DEFAULT NULL REFERENCES products (id) ON DELETE SET NULL ON UPDATE CASCADE,
  variant_id     BIGINT NULL DEFAULT NULL REFERENCES product_variants (id) ON DELETE SET NULL ON UPDATE CASCADE,
  name           VARCHAR(190) NOT NULL,
  variant_label  VARCHAR(120) NOT NULL DEFAULT '',
  image_url      VARCHAR(500) NOT NULL DEFAULT '',
  unit_price     NUMERIC(10,2) NOT NULL,
  quantity       SMALLINT NOT NULL DEFAULT 1,
  line_total     NUMERIC(10,2) NOT NULL,
  -- Historical snapshot of what ZAVORA paid/owed CJ for this line.
  unit_supplier_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  shipping_cost      NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_fee        NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_order_items_order ON order_items (order_id);
CREATE INDEX idx_order_items_product ON order_items (product_id);

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
CREATE TABLE payments (
  id            BIGSERIAL PRIMARY KEY,
  order_id      BIGINT NOT NULL REFERENCES orders (id) ON DELETE CASCADE ON UPDATE CASCADE,
  provider      VARCHAR(40)  NOT NULL DEFAULT 'mock',
  method        VARCHAR(40)  NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','authorised','captured','failed','refunded')),
  amount        NUMERIC(10,2) NOT NULL,
  currency      CHAR(3)      NOT NULL DEFAULT 'USD',
  reference     VARCHAR(120) NULL DEFAULT NULL,
  card_last4    CHAR(4)      NULL DEFAULT NULL,
  error_message VARCHAR(255) NULL DEFAULT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_payments_order ON payments (order_id);
CREATE INDEX idx_payments_status ON payments (status);

-- ---------------------------------------------------------------------------
-- shipments
-- ---------------------------------------------------------------------------
CREATE TABLE shipments (
  id            BIGSERIAL PRIMARY KEY,
  order_id      BIGINT NOT NULL REFERENCES orders (id) ON DELETE CASCADE ON UPDATE CASCADE,
  carrier       VARCHAR(60)  NOT NULL,
  tracking_number VARCHAR(80) NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'label_created'
                CHECK (status IN ('label_created','in_transit','out_for_delivery','delivered','exception')),
  shipped_at    TIMESTAMPTZ NULL DEFAULT NULL,
  delivered_at  TIMESTAMPTZ NULL DEFAULT NULL,
  estimated_delivery_at TIMESTAMPTZ NULL DEFAULT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_shipments_order ON shipments (order_id);
CREATE INDEX idx_shipments_status ON shipments (status);

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
CREATE TABLE reviews (
  id           BIGSERIAL PRIMARY KEY,
  product_id   BIGINT NOT NULL REFERENCES products (id) ON DELETE CASCADE ON UPDATE CASCADE,
  user_id      BIGINT NULL DEFAULT NULL REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
  order_id     BIGINT NULL DEFAULT NULL REFERENCES orders (id) ON DELETE SET NULL ON UPDATE CASCADE,
  rating       SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title        VARCHAR(160) NOT NULL DEFAULT '',
  body         TEXT NOT NULL,
  author_name  VARCHAR(120) NOT NULL DEFAULT '',
  country      CHAR(2)      NOT NULL DEFAULT '',
  is_verified  SMALLINT     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_reviews_product ON reviews (product_id, created_at);
CREATE INDEX idx_reviews_user ON reviews (user_id);

-- ---------------------------------------------------------------------------
-- wishlist
-- ---------------------------------------------------------------------------
CREATE TABLE wishlist (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products (id) ON DELETE CASCADE ON UPDATE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);
CREATE INDEX idx_wishlist_user ON wishlist (user_id);

-- ---------------------------------------------------------------------------
-- cj_sync_logs — one row per sync run (steps 12-13)
-- ---------------------------------------------------------------------------
CREATE TABLE cj_sync_logs (
  id               BIGSERIAL PRIMARY KEY,
  run_id           VARCHAR(40)  NOT NULL UNIQUE,
  status           TEXT NOT NULL DEFAULT 'running'
                   CHECK (status IN ('running','success','partial','failed')),
  triggered_by     BIGINT NULL DEFAULT NULL REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
  pages_fetched    INTEGER NOT NULL DEFAULT 0,
  products_seen    INTEGER NOT NULL DEFAULT 0,
  products_created INTEGER NOT NULL DEFAULT 0,
  products_updated INTEGER NOT NULL DEFAULT 0,
  products_skipped INTEGER NOT NULL DEFAULT 0,
  products_failed  INTEGER NOT NULL DEFAULT 0,
  error_message    TEXT NULL,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at      TIMESTAMPTZ NULL DEFAULT NULL
);
CREATE INDEX idx_sync_status ON cj_sync_logs (status);
CREATE INDEX idx_sync_started ON cj_sync_logs (started_at);

-- ---------------------------------------------------------------------------
-- store_settings — key/value. Pricing rules live here, not in code.
-- ---------------------------------------------------------------------------
CREATE TABLE store_settings (
  id            BIGSERIAL PRIMARY KEY,
  setting_key   VARCHAR(80)  NOT NULL UNIQUE,
  setting_value TEXT         NOT NULL,
  setting_group VARCHAR(40)  NOT NULL DEFAULT 'general',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_setting_group ON store_settings (setting_group);

-- ---------------------------------------------------------------------------
-- updated_at triggers (MySQL ON UPDATE CURRENT_TIMESTAMP equivalent)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_users_updated ON users;
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_categories_updated ON categories;
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated ON products;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_supplier_updated ON product_supplier;
CREATE TRIGGER trg_supplier_updated BEFORE UPDATE ON product_supplier
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_variants_updated ON product_variants;
CREATE TRIGGER trg_variants_updated BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_addresses_updated ON addresses;
CREATE TRIGGER trg_addresses_updated BEFORE UPDATE ON addresses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_cart_updated ON cart;
CREATE TRIGGER trg_cart_updated BEFORE UPDATE ON cart
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_cart_items_updated ON cart_items;
CREATE TRIGGER trg_cart_items_updated BEFORE UPDATE ON cart_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated ON orders;
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_payments_updated ON payments;
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_shipments_updated ON shipments;
CREATE TRIGGER trg_shipments_updated BEFORE UPDATE ON shipments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_settings_updated ON store_settings;
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON store_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
