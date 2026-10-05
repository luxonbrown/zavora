-- ============================================================================
-- ZAVORA — MySQL / MariaDB schema
-- ============================================================================
-- Compatible with MySQL 8.0 and MariaDB 10.4+. Deliberately avoids
-- MySQL-only syntax so the same DDL runs on either engine.
--
-- Design rules enforced here:
--   1. Supplier data lives ONLY in `product_supplier`. No storefront table has
--      a cost, supplier id or fulfilment column, so it is structurally
--      impossible to leak it through a careless join.
--   2. Public reads never `SELECT *` across the supplier boundary; the API
--      selects explicit column lists (see server/controllers).
--   3. Order lines snapshot name/image/price/variant, so later catalogue edits
--      never rewrite order history.
--   4. Phase-2 hooks (referral) exist as nullable columns only. No affiliate
--      logic is implemented — see the marked block at the bottom.
--
-- Usage:  mysql -u root -p < schema.sql
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `wishlist`;
DROP TABLE IF EXISTS `reviews`;
DROP TABLE IF EXISTS `shipments`;
DROP TABLE IF EXISTS `payments`;
DROP TABLE IF EXISTS `order_items`;
DROP TABLE IF EXISTS `orders`;
DROP TABLE IF EXISTS `cart_items`;
DROP TABLE IF EXISTS `cart`;
DROP TABLE IF EXISTS `addresses`;
DROP TABLE IF EXISTS `product_supplier`;
DROP TABLE IF EXISTS `product_variants`;
DROP TABLE IF EXISTS `product_images`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `categories`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `cj_sync_logs`;
DROP TABLE IF EXISTS `store_settings`;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE `users` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email`          VARCHAR(190)    NOT NULL,
  `password_hash`  VARCHAR(255)    NOT NULL COMMENT 'bcrypt; never returned by the API',
  `first_name`     VARCHAR(80)     NOT NULL DEFAULT '',
  `last_name`      VARCHAR(80)     NOT NULL DEFAULT '',
  `phone`          VARCHAR(40)     NOT NULL DEFAULT '',
  `role`           ENUM('customer','admin') NOT NULL DEFAULT 'customer',
  `is_active`      TINYINT(1)      NOT NULL DEFAULT 1,
  `email_verified_at` DATETIME     NULL DEFAULT NULL,
  `last_login_at`  DATETIME        NULL DEFAULT NULL,
  -- PHASE-2 HOOK (no logic implemented): unique code a customer can share.
  `referral_code`  VARCHAR(32)     NULL DEFAULT NULL,
  `created_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  UNIQUE KEY `uq_users_referral_code` (`referral_code`),
  KEY `idx_users_role` (`role`),
  KEY `idx_users_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
CREATE TABLE `categories` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `parent_id`  INT UNSIGNED NULL DEFAULT NULL,
  `name`       VARCHAR(120) NOT NULL,
  `slug`       VARCHAR(140) NOT NULL,
  `tagline`    VARCHAR(190) NOT NULL DEFAULT '',
  `position`   INT NOT NULL DEFAULT 0,
  `is_active`  TINYINT(1)  NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_categories_slug` (`slug`),
  KEY `idx_categories_parent` (`parent_id`),
  KEY `idx_categories_active_position` (`is_active`, `position`),
  CONSTRAINT `fk_categories_parent` FOREIGN KEY (`parent_id`)
    REFERENCES `categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- products  (storefront fields only — no supplier data here)
-- ---------------------------------------------------------------------------
CREATE TABLE `products` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `category_id`       INT UNSIGNED    NULL DEFAULT NULL,
  `name`              VARCHAR(190)    NOT NULL,
  `slug`              VARCHAR(220)    NOT NULL,
  `sku`               VARCHAR(64)     NOT NULL,
  `brand`             VARCHAR(80)     NOT NULL DEFAULT 'ZAVORA',
  `short_description` VARCHAR(500)    NOT NULL DEFAULT '',
  `description`       MEDIUMTEXT      NULL,
  -- ZAVORA computes this independently of supplier cost (see store_settings).
  `price`             DECIMAL(10,2)   NOT NULL,
  `compare_at_price`  DECIMAL(10,2)   NULL DEFAULT NULL,
  `rating`            DECIMAL(3,2)    NOT NULL DEFAULT 0,
  `review_count`      INT UNSIGNED    NOT NULL DEFAULT 0,
  `stock`             INT             NOT NULL DEFAULT 0,
  -- Merchandising fields shown on the storefront. `specifications` holds a JSON
  -- array of [label, value] pairs, e.g. [["Driver","40mm"],["Weight","268 g"]].
  `badge`             VARCHAR(40)     NULL DEFAULT NULL COMMENT 'e.g. New, Bestseller',
  `specifications`    TEXT            NULL DEFAULT NULL COMMENT 'JSON array of [label, value]',
  `status`            ENUM('draft','active','archived') NOT NULL DEFAULT 'active',
  `is_active`         TINYINT(1)      NOT NULL DEFAULT 1,
  `published_at`      DATETIME        NULL DEFAULT NULL,
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_products_slug` (`slug`),
  UNIQUE KEY `uq_products_sku` (`sku`),
  KEY `idx_products_category` (`category_id`),
  KEY `idx_products_status_active` (`status`, `is_active`),
  KEY `idx_products_price` (`price`),
  KEY `idx_products_rating` (`rating`),
  KEY `idx_products_name` (`name`),
  KEY `idx_products_published` (`published_at`),
  KEY `idx_products_stock` (`stock`),
  FULLTEXT KEY `ft_products_search` (`name`, `short_description`, `description`),
  CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`)
    REFERENCES `categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- product_supplier  — CJdropshipping data. ADMIN-ONLY. Never joined into a
-- public response. The separation is structural, not just conventional.
-- ---------------------------------------------------------------------------
CREATE TABLE `product_supplier` (
  `id`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id`            BIGINT UNSIGNED NOT NULL,
  `supplier`              VARCHAR(40)  NOT NULL DEFAULT 'cj',
  `supplier_product_id`   VARCHAR(80)  NOT NULL COMMENT 'CJ product id',
  `supplier_variant_id`   VARCHAR(80)  NULL DEFAULT NULL,
  `supplier_sku`          VARCHAR(80)  NULL DEFAULT NULL,
  `supplier_name`         VARCHAR(190) NOT NULL DEFAULT '',
  `supplier_url`          VARCHAR(500) NULL DEFAULT NULL,
  `cost_price`            DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'unit cost, excl. shipping',
  `shipping_cost`         DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'supplier shipping per unit',
  `supplier_stock`        INT          NOT NULL DEFAULT 0,
  `sync_hash`             VARCHAR(64)  NULL DEFAULT NULL COMMENT 'detect upstream changes',
  `last_synced_at`        DATETIME     NULL DEFAULT NULL,
  -- Set once variants have been fetched for this product. Without it, a product
  -- that genuinely has no variants looks "not yet enriched" forever and is
  -- re-fetched on every sync, burning the 1 req/s budget on nothing.
  `variants_synced_at`    DATETIME     NULL DEFAULT NULL,
  `created_at`            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_supplier_product` (`supplier`, `supplier_product_id`),
  UNIQUE KEY `uq_supplier_product_link` (`product_id`, `supplier`),
  KEY `idx_supplier_cost` (`cost_price`),
  CONSTRAINT `fk_supplier_product` FOREIGN KEY (`product_id`)
    REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- product_images
-- ---------------------------------------------------------------------------
CREATE TABLE `product_images` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `url`        VARCHAR(500) NOT NULL,
  `alt`        VARCHAR(190) NOT NULL DEFAULT '',
  `position`   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `is_primary` TINYINT(1)  NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_images_product` (`product_id`, `position`),
  CONSTRAINT `fk_images_product` FOREIGN KEY (`product_id`)
    REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- product_variants
-- ---------------------------------------------------------------------------
CREATE TABLE `product_variants` (
  `id`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id`            BIGINT UNSIGNED NOT NULL,
  `name`                  VARCHAR(120) NOT NULL COMMENT 'e.g. "Midnight Black" or "EU 42"',
  `option_type`           ENUM('color','size') NULL DEFAULT NULL,
  `option_value`          VARCHAR(120) NULL DEFAULT NULL COMMENT 'hex for colour',
  `sku`                   VARCHAR(80)  NULL DEFAULT NULL,
  -- Only differs from the parent price when a variant genuinely costs more.
  `price`                 DECIMAL(10,2) NULL DEFAULT NULL,
  `stock`                 INT          NOT NULL DEFAULT 0,
  `supplier_variant_id`   VARCHAR(80)  NULL DEFAULT NULL,
  `position`              SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `created_at`            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_variant_product_name` (`product_id`, `name`),
  KEY `idx_variants_product` (`product_id`, `position`),
  CONSTRAINT `fk_variants_product` FOREIGN KEY (`product_id`)
    REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- addresses
-- ---------------------------------------------------------------------------
CREATE TABLE `addresses` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`     BIGINT UNSIGNED NOT NULL,
  `label`       VARCHAR(60)  NOT NULL DEFAULT 'Home',
  `first_name`  VARCHAR(80)  NOT NULL,
  `last_name`   VARCHAR(80)  NOT NULL,
  `phone`       VARCHAR(40)  NOT NULL DEFAULT '',
  `country`     CHAR(2)      NOT NULL,
  `state`       VARCHAR(120) NOT NULL DEFAULT '',
  `city`        VARCHAR(120) NOT NULL,
  `address1`    VARCHAR(190) NOT NULL,
  `address2`    VARCHAR(190) NOT NULL DEFAULT '',
  `postal_code` VARCHAR(24)  NOT NULL,
  `is_default`  TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_addresses_user` (`user_id`, `is_default`),
  CONSTRAINT `fk_addresses_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- cart / cart_items  (user_id for signed-in, session_key for guests)
-- ---------------------------------------------------------------------------
CREATE TABLE `cart` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`     BIGINT UNSIGNED NULL DEFAULT NULL,
  `session_key` VARCHAR(64)     NULL DEFAULT NULL,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cart_user` (`user_id`),
  UNIQUE KEY `uq_cart_session` (`session_key`),
  CONSTRAINT `fk_cart_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `cart_items` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `cart_id`     BIGINT UNSIGNED NOT NULL,
  `product_id`  BIGINT UNSIGNED NOT NULL,
  `variant_id`  BIGINT UNSIGNED NULL DEFAULT NULL,
  `quantity`    SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  -- Snapshot at add-time purely for display; checkout always re-prices.
  `unit_price_snapshot` DECIMAL(10,2) NOT NULL,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  -- A product with no variant stores variant_id NULL. NULLs compare as distinct
  -- in both MySQL and MariaDB, so a plain UNIQUE (cart_id, product_id, variant_id)
  -- would happily store the same un-varianted line twice. variant_key folds NULL
  -- to 0 so the constraint actually holds. Indexed generated columns are
  -- supported by MySQL 5.7+ and MariaDB 5.2+.
  `variant_key`   BIGINT UNSIGNED AS (IFNULL(`variant_id`, 0)) PERSISTENT,
  UNIQUE KEY `uq_cart_item` (`cart_id`, `product_id`, `variant_key`),
  KEY `idx_cart_items_cart` (`cart_id`),
  CONSTRAINT `fk_cart_items_cart` FOREIGN KEY (`cart_id`)
    REFERENCES `cart` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cart_items_product` FOREIGN KEY (`product_id`)
    REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cart_items_variant` FOREIGN KEY (`variant_id`)
    REFERENCES `product_variants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
CREATE TABLE `orders` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_number`    VARCHAR(32)  NOT NULL,
  `user_id`         BIGINT UNSIGNED NULL DEFAULT NULL COMMENT 'null for guest checkout',
  `email`           VARCHAR(190) NOT NULL,
  `status`          ENUM('placed','payment_confirmed','processing','shipped','in_transit','delivered','cancelled')
                    NOT NULL DEFAULT 'placed',
  `payment_status`  ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  -- Address is snapshotted onto the order; later book edits must not rewrite it.
  `shipping_first_name` VARCHAR(80)  NOT NULL,
  `shipping_last_name`  VARCHAR(80)  NOT NULL,
  `shipping_phone`      VARCHAR(40)  NOT NULL DEFAULT '',
  `shipping_country`    CHAR(2)      NOT NULL,
  `shipping_state`      VARCHAR(120) NOT NULL DEFAULT '',
  `shipping_city`       VARCHAR(120) NOT NULL,
  `shipping_address1`   VARCHAR(190) NOT NULL,
  `shipping_address2`   VARCHAR(190) NOT NULL DEFAULT '',
  `shipping_postal_code` VARCHAR(24)  NOT NULL,
  `shipping_method`     VARCHAR(40)  NOT NULL DEFAULT 'standard',
  `subtotal`      DECIMAL(10,2) NOT NULL DEFAULT 0,
  `shipping_amount` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `tax_amount`    DECIMAL(10,2) NOT NULL DEFAULT 0,
  `tax_rate`      DECIMAL(5,4)  NOT NULL DEFAULT 0,
  `total`         DECIMAL(10,2) NOT NULL DEFAULT 0,
  `currency`      CHAR(3)      NOT NULL DEFAULT 'USD',
  `tracking_number` VARCHAR(80) NULL DEFAULT NULL,
  `carrier`       VARCHAR(60)     NULL DEFAULT NULL,
  `estimated_delivery_at` DATETIME NULL DEFAULT NULL,
  -- PHASE-2 HOOK (no logic implemented).
  `referrer_id`   BIGINT UNSIGNED NULL DEFAULT NULL,
  `placed_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_orders_number` (`order_number`),
  KEY `idx_orders_user` (`user_id`, `placed_at`),
  KEY `idx_orders_email` (`email`),
  KEY `idx_orders_status` (`status`),
  KEY `idx_orders_payment_status` (`payment_status`),
  KEY `idx_orders_placed` (`placed_at`),
  KEY `idx_orders_tracking` (`tracking_number`),
  KEY `idx_orders_referrer` (`referrer_id`),
  CONSTRAINT `fk_orders_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_orders_referrer` FOREIGN KEY (`referrer_id`)
    REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- order_items — snapshot columns are the historical record of truth.
-- ---------------------------------------------------------------------------
CREATE TABLE `order_items` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id`       BIGINT UNSIGNED NOT NULL,
  `product_id`     BIGINT UNSIGNED NULL DEFAULT NULL COMMENT 'null once a product is hard-deleted',
  `variant_id`     BIGINT UNSIGNED NULL DEFAULT NULL,
  `name`           VARCHAR(190) NOT NULL,
  `variant_label`  VARCHAR(120) NOT NULL DEFAULT '',
  `image_url`      VARCHAR(500) NOT NULL DEFAULT '',
  `unit_price`     DECIMAL(10,2) NOT NULL,
  `quantity`       SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  `line_total`     DECIMAL(10,2) NOT NULL,
  `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_order_items_order` (`order_id`),
  KEY `idx_order_items_product` (`product_id`),
  CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`)
    REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_order_items_product` FOREIGN KEY (`product_id`)
    REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_order_items_variant` FOREIGN KEY (`variant_id`)
    REFERENCES `product_variants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
CREATE TABLE `payments` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id`      BIGINT UNSIGNED NOT NULL,
  `provider`      VARCHAR(40)  NOT NULL DEFAULT 'mock',
  `method`        VARCHAR(40)  NOT NULL,
  `status`        ENUM('pending','authorised','captured','failed','refunded') NOT NULL DEFAULT 'pending',
  `amount`        DECIMAL(10,2) NOT NULL,
  `currency`      CHAR(3)      NOT NULL DEFAULT 'USD',
  `reference`     VARCHAR(120) NULL DEFAULT NULL,
  `card_last4`    CHAR(4)      NULL DEFAULT NULL,
  `error_message` VARCHAR(255) NULL DEFAULT NULL,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payments_order` (`order_id`),
  KEY `idx_payments_status` (`status`),
  CONSTRAINT `fk_payments_order` FOREIGN KEY (`order_id`)
    REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- shipments
-- ---------------------------------------------------------------------------
CREATE TABLE `shipments` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id`      BIGINT UNSIGNED NOT NULL,
  `carrier`       VARCHAR(60)  NOT NULL,
  `tracking_number` VARCHAR(80) NOT NULL,
  `status`        ENUM('label_created','in_transit','out_for_delivery','delivered','exception')
                  NOT NULL DEFAULT 'label_created',
  `shipped_at`    DATETIME NULL DEFAULT NULL,
  `delivered_at`  DATETIME NULL DEFAULT NULL,
  `estimated_delivery_at` DATETIME NULL DEFAULT NULL,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_shipment_tracking` (`tracking_number`),
  KEY `idx_shipments_order` (`order_id`),
  KEY `idx_shipments_status` (`status`),
  CONSTRAINT `fk_shipments_order` FOREIGN KEY (`order_id`)
    REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
CREATE TABLE `reviews` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id`   BIGINT UNSIGNED NOT NULL,
  `user_id`      BIGINT UNSIGNED NULL DEFAULT NULL,
  `order_id`     BIGINT UNSIGNED NULL DEFAULT NULL,
  `rating`       TINYINT UNSIGNED NOT NULL,
  `title`        VARCHAR(160) NOT NULL DEFAULT '',
  `body`         TEXT NOT NULL,
  `author_name`  VARCHAR(120) NOT NULL DEFAULT '',
  `country`      CHAR(2)      NOT NULL DEFAULT '',
  `is_verified`  TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_reviews_product` (`product_id`, `created_at`),
  KEY `idx_reviews_user` (`user_id`),
  CONSTRAINT `fk_reviews_product` FOREIGN KEY (`product_id`)
    REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_reviews_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_reviews_order` FOREIGN KEY (`order_id`)
    REFERENCES `orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- wishlist
-- ---------------------------------------------------------------------------
CREATE TABLE `wishlist` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_wishlist` (`user_id`, `product_id`),
  KEY `idx_wishlist_user` (`user_id`),
  CONSTRAINT `fk_wishlist_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_wishlist_product` FOREIGN KEY (`product_id`)
    REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- cj_sync_logs — one row per sync run (steps 12-13)
-- ---------------------------------------------------------------------------
CREATE TABLE `cj_sync_logs` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `run_id`           VARCHAR(40)  NOT NULL,
  `status`           ENUM('running','success','partial','failed') NOT NULL DEFAULT 'running',
  `triggered_by`     BIGINT UNSIGNED NULL DEFAULT NULL,
  `pages_fetched`    INT UNSIGNED NOT NULL DEFAULT 0,
  `products_seen`    INT UNSIGNED NOT NULL DEFAULT 0,
  `products_created` INT UNSIGNED NOT NULL DEFAULT 0,
  `products_updated` INT UNSIGNED NOT NULL DEFAULT 0,
  `products_skipped` INT UNSIGNED NOT NULL DEFAULT 0,
  `products_failed`  INT UNSIGNED NOT NULL DEFAULT 0,
  `error_message`    TEXT NULL,
  `started_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `finished_at`      DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sync_run` (`run_id`),
  KEY `idx_sync_status` (`status`),
  KEY `idx_sync_started` (`started_at`),
  CONSTRAINT `fk_sync_user` FOREIGN KEY (`triggered_by`)
    REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- store_settings — key/value. Pricing rules live here, not in code.
-- ---------------------------------------------------------------------------
CREATE TABLE `store_settings` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `setting_key`   VARCHAR(80)  NOT NULL,
  `setting_value` TEXT         NOT NULL,
  `setting_group` VARCHAR(40)  NOT NULL DEFAULT 'general',
  `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_setting_key` (`setting_key`),
  KEY `idx_setting_group` (`setting_group`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================================================
-- PHASE 2 — deliberately NOT implemented.
--
-- A future "Shop -> Share -> Earn" system would need: creator profiles, a
-- link/click ledger, commission accrual per fulfilled order, and withdrawals.
-- The only schema prepared for it is:
--   users.referral_code  (unique, nullable)
--   orders.referrer_id   (nullable FK + index)
-- No affiliate logic, tables or endpoints exist yet. Those columns can be
-- dropped without touching anything else if the idea is abandoned.
-- ===========================================================================