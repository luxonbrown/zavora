/**
 * CJ -> ZAVORA mapping.
 *
 * The most important rule in this file: a supplier cost NEVER becomes a
 * storefront price. `costPrice` is written only to `product_supplier`, and the
 * price the customer sees is computed here from our own margin setting. If the
 * two are ever allowed to coincide, changing the margin would silently repricing
 * the catalogue, and the supplier cost would become publicly derivable.
 */

const config = require('../../config');
const { toCents, fromCents } = require('../../lib/money');

/**
 * Sell price from cost, as integer cents, using our own markup.
 * Markup is applied to cost: sell = cost * (1 + markup/100). A 35% markup is a
 * 26% margin on the sell price — see the note in config.pricing.
 */
function sellPriceCentsFromCost(costCents, markupPercent = config.pricing.defaultMarkupPercent) {
  const markup = Number(markupPercent);
  if (!Number.isFinite(markup) || markup <= 0) return Math.max(0, costCents);
  return Math.round(costCents * (1 + markup / 100));
}

/**
 * The cost we actually pay. `nowPrice` / `discountPrice` are CJ's discounted
 * figures and are cheaper than `sellPrice` when present, so they win.
 * Never returns 0 for a real product — a 0 cost would produce a 0 sell price.
 */
function effectiveCostCents(product) {
  const candidates = [product.nowPrice, product.discountPrice, product.sellPrice]
    .filter((v) => v !== undefined && v !== null && v !== '' && Number(v) > 0)
    .map(toCents);
  return candidates.length ? Math.min(...candidates) : 0;
}

/** ZAVORA sku from the CJ sku, namespaced so the two can never collide. */
function zavoraSku(cjSku, cjId) {
  const base = String(cjSku || cjId || '').trim();
  return base ? `CJ-${base}`.slice(0, 64) : null;
}

/** Slug from the CJ name, always suffixed with the id to stay unique. */
function slugify(name, cjId) {
  const base = String(name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
  // The id suffix guarantees uniqueness even for identically-named CJ products.
  return `${base || 'product'}-${String(cjId).slice(-8).toLowerCase()}`.slice(0, 220);
}

/**
 * Map the two-level category names onto our own single-level list.
 * Returns the name to file the product under, preferring the most specific
 * level CJ gave us.
 */
function categoryNameFor(product) {
  return (
    product.threeCategoryName ||
    product.twoCategoryName ||
    product.oneCategoryName ||
    'Uncategorised'
  );
}

/** CJ descriptions are HTML; the storefront renders text. */
function stripHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Short description capped for the VARCHAR(500) column. */
function shortDescription(product) {
  const text = stripHtml(product.description);
  if (text) return text.slice(0, 500);
  return `${product.nameEn || 'ZAVORA product'} — sourced on demand and shipped worldwide.`.slice(0, 500);
}

/**
 * Whether this product can be sold at all.
 *
 * Some CJ listings carry no usable price at all (no `sellPrice`, `nowPrice` or
 * `discountPrice`) — quote-only or awaiting pricing. Importing those produced
 * 1,610 products priced at $0.00, which a storefront will happily offer for
 * free and a customer can check out. They are refused at the door instead.
 */
function isImportable(cjProduct) {
  return effectiveCostCents(cjProduct) > 0;
}

/**
 * Full row set for one CJ product.
 *
 * Returns two clearly separated objects:
 *   `product`     -> the `products` table (storefront fields, no cost)
 *   `supplier`    -> the `product_supplier` table (cost, ids, upstream stock)
 *
 * Keeping them apart in the return value makes it awkward to accidentally write
 * a cost into the wrong table.
 */
function mapProduct(cjProduct) {
  const costCents = effectiveCostCents(cjProduct);
  const upstreamStock = Number(cjProduct.warehouseInventoryNum) || 0;

  // Dropshipper inventory is not ours to promise, so the storefront caps it.
  const sellableStock = Math.min(upstreamStock, config.pricing.maxSellableStock);

  return {
    importable: costCents > 0,
    product: {
      name: String(cjProduct.nameEn || cjProduct.name || 'Untitled product').slice(0, 190),
      slug: slugify(cjProduct.nameEn, cjProduct.id),
      sku: zavoraSku(cjProduct.sku || cjProduct.spu, cjProduct.id),
      short_description: shortDescription(cjProduct),
      description: stripHtml(cjProduct.description) || null,
      // Independent of cost: see sellPriceCentsFromCost.
      price: fromCents(sellPriceCentsFromCost(costCents)),
      compare_at_price: null,
      stock: sellableStock,
      status: 'active',
      is_active: 1,
      // CJ createAt is epoch millis.
      published_at: cjProduct.createAt ? new Date(Number(cjProduct.createAt)) : new Date(),
      category_name: categoryNameFor(cjProduct),
    },
    supplier: {
      supplier: 'cj',
      supplier_product_id: String(cjProduct.id),
      supplier_sku: cjProduct.sku || cjProduct.spu || null,
      supplier_name: cjProduct.supplierName || '',
      supplier_url: `https://cjdropshipping.com/product/${cjProduct.id}`,
      cost_price: fromCents(costCents),
      shipping_cost: '0.00',
      supplier_stock: upstreamStock,
      last_synced_at: new Date(),
    },
    image: {
      url: cjProduct.bigImage || '',
      alt: String(cjProduct.nameEn || '').slice(0, 190),
    },
    /** Fingerprint of the fields that should trigger an update when changed. */
    sync_hash: hashProduct(cjProduct, costCents),
  };
}

/**
 * Change-detection hash. Stored in product_supplier.sync_hash so a re-sync can
 * skip untouched products instead of rewriting 6000 rows every run.
 */
function hashProduct(cjProduct, costCents) {
  const { createHash } = require('crypto');
  return createHash('sha256')
    .update(
      [
        cjProduct.id,
        cjProduct.nameEn,
        cjProduct.sellPrice,
        cjProduct.nowPrice || '',
        cjProduct.warehouseInventoryNum,
        cjProduct.bigImage || '',
        costCents,
      ].join('|')
    )
    .digest('hex')
    .slice(0, 64);
}

/**
 * Variants from `productDetail`'s `stanProducts[]`.
 * Each entry's `id` is the variant id; `variantkey` is a dash-joined option list.
 */
function mapVariants(detail) {
  const list = Array.isArray(detail?.stanProducts) ? detail.stanProducts : [];
  return list.map((v, index) => {
    const optionValues = String(v.variantkey || '')
      .split('-')
      .map((s) => s.trim())
      .filter(Boolean);

    return {
      supplier_variant_id: String(v.id),
      name: optionValues.length ? optionValues.join(' / ') : String(v.sku || `Option ${index + 1}`),
      option_type: guessOptionType(optionValues),
      option_value: null,
      sku: v.sku || null,
      // null means "same price as the product"; the sell price still comes from
      // our margin, never from v.sellprice.
      price: null,
      // Prefer the detail inventory when present; fall back to 0 rather than
      // inventing stock.
      stock: Number(v.totalInventory) || 0,
      position: index,
    };
  });
}

/**
 * Classify a variant's options as a colour or a size.
 *
 * CJ's `variantkey` is a dash-joined list like `Blue-XXL` or `Red`, so the size
 * is NOT reliably first — every token has to be checked.
 *
 * KNOWN LIMITATION: `product_variants.option_type` is a single ENUM, so a
 * variant carrying both a colour and a size (`Blue-XXL`) can only be stored as
 * one. Size wins, because that is what the storefront's variant gate acts on.
 * The full option string is always preserved in `name`, so nothing is lost from
 * the customer's point of view. Supporting multi-axis variants properly would
 * need a separate variant-options table.
 */
function guessOptionType(optionValues) {
  if (!optionValues.length) return null;

  const sizes = [
    'xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl', '4xl', '5xl',
    'small', 'medium', 'large', 'x-small', 'x-large',
  ];
  const lowered = optionValues.map((v) => String(v).toLowerCase().trim());

  if (lowered.some((v) => sizes.includes(v))) return 'size';

  // Hex-ish values are colours.
  if (optionValues.some((v) => /^#?[0-9a-f]{3,8}$/i.test(String(v).trim()))) return 'color';

  return null;
}

module.exports = {
  mapProduct,
  mapVariants,
  isImportable,
  sellPriceCentsFromCost,
  effectiveCostCents,
  slugify,
  zavoraSku,
  stripHtml,
  categoryNameFor,
  guessOptionType,
};