/**
 * Demo catalogue used by steps 1-10 so every storefront surface is testable
 * before MySQL or CJdropshipping exist.
 *
 * Shape is identical to the public API contract in step 11 — note what is
 * ABSENT: no supplier cost, no CJ product id, no fulfilment data. Those fields
 * are added server-side for admin only and must never reach this file.
 */
import { productImage } from './media.js';

const categories = [
  { slug: 'electronics', name: 'Electronics', tagline: 'Sound, power and light' },
  { slug: 'fashion', name: 'Fashion', tagline: 'Considered essentials' },
  { slug: 'home-living', name: 'Home & Living', tagline: 'Objects for daily rituals' },
  { slug: 'beauty', name: 'Beauty', tagline: 'Skincare and body care' },
  { slug: 'accessories', name: 'Accessories', tagline: 'Watches, bags, eyewear' },
  { slug: 'lifestyle', name: 'Lifestyle', tagline: 'Movement and recovery' },
];

/**
 * Product-specific spec rows, kept beside the catalogue rather than inline in
 * each product so the product definitions stay readable. Derived rows (SKU,
 * category, brand) are merged in by the factory below.
 */
const SPEC_LIBRARY = {
  'aura-noise-cancelling-headphones': [
    ['Driver', '40mm custom dynamic'],
    ['Battery life', '40 hours with ANC on, 60 hours off'],
    ['Connectivity', 'Bluetooth 5.3, USB-C, 3.5mm'],
    ['Weight', '268 g'],
    ['In the box', 'Case, USB-C cable, 3.5mm cable'],
  ],
  'meridian-automatic-watch': [
    ['Movement', 'Japanese automatic, 42-hour reserve'],
    ['Case', '316L stainless steel, 38mm'],
    ['Crystal', 'Sapphire, anti-reflective coating'],
    ['Water resistance', '50 m / 5 ATM'],
    ['Strap', '19mm quick-release leather'],
  ],
  'lumen-desk-lamp': [
    ['Light output', '450 lumens max'],
    ['Colour temperature', '2700K – 5000K, continuous'],
    ['CRI', '95+'],
    ['Reach', '52 cm from base'],
    ['Power', '9W USB-C'],
  ],
  'vero-ceramic-pour-over-set': [
    ['Material', 'Stoneware, satin glaze'],
    ['Capacity', '600ml carafe, 2–4 cups'],
    ['Ridging', 'Spiral, 18 grooves'],
    ['Care', 'Dishwasher safe, not microwave'],
    ['Set', 'Dripper, carafe, 2 coasters'],
  ],
  'solstice-leather-tote': [
    ['Material', 'Full-grain vegetable-tanned leather'],
    ['Dimensions', '38 × 30 × 14 cm'],
    ['Closure', 'Magnetic snap'],
    ['Interior', 'One zipped pocket, suede-lined base'],
    ['Strap drop', '24 cm'],
  ],
  'nimbus-running-shoes': [
    ['Midsole', 'Nitrogen-infused foam'],
    ['Upper', 'Engineered recycled knit'],
    ['Outsole', 'Blown rubber, 4mm drop'],
    ['Weight', '238 g (size 9)'],
    ['Fit', 'True to size'],
  ],
  'halo-skincare-ritual-set': [
    ['Includes', 'Cleanser 100ml, serum 30ml, barrier cream 50ml'],
    ['Key actives', 'Niacinamide 5%, ceramides, squalane'],
    ['Free from', 'Fragrance, essential oils, alcohol'],
    ['Suited to', 'Sensitive and combination skin'],
    ['Cruelty free', 'Yes'],
  ],
  'drift-essential-oil-diffuser': [
    ['Capacity', '300ml'],
    ['Runtime', 'Up to 10 hours intermittent'],
    ['Noise level', 'Under 25 dB'],
    ['Controls', 'Touch, 1/3/6 hour timer'],
    ['Lamp', 'Warm glow, independently switchable'],
  ],
  'terra-ceramic-tableware-set': [
    ['Pieces', '16 (4 place settings)'],
    ['Material', 'Stoneware, reactive glaze'],
    ['Microwave safe', 'Yes'],
    ['Care', 'Dishwasher safe'],
    ['Note', 'Reactive glaze makes every piece unique'],
  ],
  'pulse-fitness-band': [
    ['Battery', '14 days typical'],
    ['Water resistance', '5 ATM, swim-proof'],
    ['Sensors', 'Heart rate, SpO2, sleep stages'],
    ['Workout modes', '90'],
    ['Weight', '24 g'],
  ],
  'mist-wool-overshirt': [
    ['Material', 'Wool-cotton blend, 380gsm'],
    ['Fit', 'Relaxed, layer-friendly'],
    ['Pockets', 'Two deep patch'],
    ['Care', 'Dry clean or cold wash'],
    ['Origin', 'Woven in Portugal'],
  ],
  'onyx-sunglasses': [
    ['Frame', 'Italian acetate, hand-polished'],
    ['Lenses', 'Polarised mineral glass'],
    ['Width', '148mm'],
    ['Includes', 'Hard case, microfibre cloth'],
    ['UV', '100% UVA/UVB'],
  ],
};

/** Deterministic pick so a product always returns the same review subset. */
const REVIEW_POOL = [
  {
    rating: 5,
    title: 'Better than I expected',
    body: 'Ordered on a Tuesday and it arrived by Friday. The finish is genuinely nice in person — it does not feel like something that cost this little. Two weeks in and no complaints at all.',
    author: 'Marta K.',
    country: 'DE',
    verified: true,
  },
  {
    rating: 5,
    title: 'Exactly as described',
    body: 'I was sceptical about ordering from an international store but the tracking worked the whole way and I could see it clear customs. Product matches the photos closely.',
    author: 'Daniel R.',
    country: 'GB',
    verified: true,
  },
  {
    rating: 4,
    title: 'Very good, one small note',
    body: 'No complaints about quality. Took a day longer than the estimate to reach me, which the tracking page did explain. Would happily buy again.',
    author: 'Aiko T.',
    country: 'JP',
    verified: true,
  },
  {
    rating: 5,
    title: 'Third one I have bought',
    body: 'Bought this as a gift after seeing mine. Packaging was minimal and tidy which I appreciated. Consistent quality across all three.',
    author: 'Sofia L.',
    country: 'ES',
    verified: false,
  },
  {
    rating: 4,
    title: 'Solid, ships quickly',
    body: 'Does what it says. Slight colour difference from the listing photo, though that is likely just my screen. Support answered my question within a day.',
    author: 'James O.',
    country: 'US',
    verified: true,
  },
  {
    rating: 5,
    title: 'Worth the wait',
    body: 'Took a little getting used to the delivery time but once it landed I understood the value. Feels like an item that will last a decade.',
    author: 'Nadia B.',
    country: 'FR',
    verified: true,
  },
];

/** Stable non-negative hash, so the same product always gets the same reviews. */
function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function buildSpecifications(slug, data) {
  return [
    ['SKU', data.sku],
    ['Category', categories.find((c) => c.slug === data.category)?.name ?? data.category],
    ['Brand', 'MARKETHUB'],
    ...(SPEC_LIBRARY[slug] ?? []),
  ];
}

function variant(id, name, price, stock, extra = {}) {
  return { id, name, price, stock, ...extra };
}

/** Compact product factory so the catalogue stays readable. */
function product(id, seed, data) {
  return {
    id,
    slug: data.slug,
    sku: data.sku,
    name: data.name,
    brand: 'MARKETHUB',
    categorySlug: data.category,
    categoryName: categories.find((c) => c.slug === data.category)?.name ?? data.category,
    price: data.price,
    compareAtPrice: data.compareAtPrice ?? null,
    rating: data.rating,
    reviewCount: data.reviewCount,
    stock: data.stock,
    badge: data.badge ?? null,
    shortDescription: data.shortDescription,
    description: data.description,
    specifications: buildSpecifications(data.slug, data),
    images: [productImage(seed, 800, 1000), productImage(`${seed}-alt`, 800, 1000)],
    colors: data.colors ?? null,
    sizes: data.sizes ?? null,
    variants: data.variants ?? [],
    createdAt: data.createdAt,
  };
}

const products = [
  product('zv_0001', 'aura-headphones', {
    slug: 'aura-noise-cancelling-headphones',
    sku: 'ZV-AUD-0001',
    name: 'Aura Noise-Cancelling Headphones',
    category: 'electronics',
    price: 349,
    compareAtPrice: 429,
    rating: 4.8,
    reviewCount: 1284,
    stock: 42,
    badge: 'Bestseller',
    shortDescription:
      'Adaptive noise cancellation, 40-hour battery and a build that feels considered in every detail.',
    description:
      'Aura pairs a pair of custom 40mm drivers with adaptive cancellation that reads the room forty times a second. Memory-foam ear cushions are wrapped in protein leather, and the whole frame folds flat for travel. Tuned warm, so long sessions stay easy rather than tiring.',
    colors: [
      { name: 'Midnight Black', hex: '#111111' },
      { name: 'Sandstone', hex: '#C8B7A6' },
      { name: 'Silver', hex: '#D5D7D9' },
    ],
    variants: [
      variant('v1', 'Midnight Black', 349, 18),
      variant('v2', 'Sandstone', 349, 14),
      variant('v3', 'Silver', 349, 10),
    ],
    createdAt: '2026-08-14',
  }),
  product('zv_0002', 'meridian-watch', {
    slug: 'meridian-automatic-watch',
    sku: 'ZV-ACC-0002',
    name: 'Meridian Automatic Watch',
    category: 'accessories',
    price: 289,
    compareAtPrice: 340,
    rating: 4.7,
    reviewCount: 862,
    stock: 26,
    shortDescription:
      'A 38mm automatic with a sapphire crystal and a brushed steel case that ages well.',
    description:
      'Meridian runs on a Japanese automatic movement with a 42-hour reserve. The dial is sunray-brushed with applied indices, and the case is 316L steel with a 50m water resistance. Sized at 38mm with a 19mm strap, so it sits comfortably on a smaller wrist.',
    colors: [
      { name: 'Steel / Slate', hex: '#5B6068' },
      { name: 'Steel / Ivory', hex: '#E6E0D4' },
    ],
    variants: [
      variant('v1', 'Steel / Slate', 289, 15),
      variant('v2', 'Steel / Ivory', 289, 11),
    ],
    createdAt: '2026-07-30',
  }),
  product('zv_0003', 'lumen-lamp', {
    slug: 'lumen-desk-lamp',
    sku: 'ZV-HOM-0003',
    name: 'Lumen Desk Lamp',
    category: 'home-living',
    price: 129,
    compareAtPrice: 159,
    rating: 4.6,
    reviewCount: 431,
    stock: 8,
    badge: 'Low stock',
    shortDescription:
      'Continuous dimming, a warm-to-cool range, and a weighted base that does not slide.',
    description:
      'Lumen uses a high-CRI LED behind a diffuser, so colour stays accurate even at the lowest setting. The arm holds any position without drift, and the touch strip on the base controls brightness and colour temperature from 2700K to 5000K.',
    colors: [
      { name: 'Bone', hex: '#EDE9E2' },
      { name: 'Graphite', hex: '#3A3A3A' },
    ],
    variants: [
      variant('v1', 'Bone', 129, 5),
      variant('v2', 'Graphite', 129, 3),
    ],
    createdAt: '2026-09-01',
  }),
  product('zv_0004', 'vero-pourover', {
    slug: 'vero-ceramic-pour-over-set',
    sku: 'ZV-HOM-0004',
    name: 'Vero Ceramic Pour-Over Set',
    category: 'home-living',
    price: 68,
    rating: 4.9,
    reviewCount: 2140,
    stock: 64,
    badge: 'Bestseller',
    shortDescription:
      'Stoneware dripper, carafe and two coasters in a single glazed set.',
    description:
      'Thrown from a single stoneware body and finished in a satin glaze that resists staining. The spiral ribbing keeps the drawdown even, and the carafe is dishwasher safe. Designed to be left on the counter rather than put away.',
    colors: [{ name: 'Chalk', hex: '#F1EDE6' }],
    createdAt: '2026-06-18',
  }),
  product('zv_0005', 'solstice-tote', {
    slug: 'solstice-leather-tote',
    sku: 'ZV-FAS-0005',
    name: 'Solstice Leather Tote',
    category: 'fashion',
    price: 245,
    compareAtPrice: 310,
    rating: 4.7,
    reviewCount: 517,
    stock: 19,
    shortDescription:
      'Full-grain leather with a soft structure that holds its shape without a rigid frame.',
    description:
      'Cut from full-grain leather with a vegetable-tanned finish, the Solstice slouches when full and stands upright when empty. Magnetic closure, one zipped interior pocket, and a suede-lined base that resists scuffing.',
    colors: [
      { name: 'Tan', hex: '#B98B5E' },
      { name: 'Espresso', hex: '#4A342A' },
      { name: 'Black', hex: '#1A1A1A' },
    ],
    variants: [
      variant('v1', 'Tan', 245, 9),
      variant('v2', 'Espresso', 245, 6),
      variant('v3', 'Black', 245, 4),
    ],
    sizes: [
      { name: 'One size' },
    ],
    createdAt: '2026-08-02',
  }),
  product('zv_0006', 'nimbus-runner', {
    slug: 'nimbus-running-shoes',
    sku: 'ZV-FAS-0006',
    name: 'Nimbus Running Shoes',
    category: 'fashion',
    price: 158,
    compareAtPrice: 195,
    rating: 4.5,
    reviewCount: 1893,
    stock: 73,
    shortDescription:
      'A lightweight everyday trainer with a foam midsole that stays stable past 10km.',
    description:
      'The Nimbus uses a nitrogen-infused foam midsole under a breathable engineered knit upper. The outsole is rubber only where it needs to be, which keeps the shoe light without giving up grip. Weighs 238g in a size 9.',
    colors: [
      { name: 'Bone / Clay', hex: '#E4DCD0' },
      { name: 'Slate / Volt', hex: '#5F6B70' },
    ],
    sizes: ['EU 38', 'EU 39', 'EU 40', 'EU 41', 'EU 42', 'EU 43', 'EU 44', 'EU 45'],
    variants: [
      variant('v1', 'Bone / Clay', 158, 24),
      variant('v2', 'Slate / Volt', 158, 22),
    ],
    createdAt: '2026-07-11',
  }),
  product('zv_0007', 'halo-skincare', {
    slug: 'halo-skincare-ritual-set',
    sku: 'ZV-BEA-0007',
    name: 'Halo Skincare Ritual Set',
    category: 'beauty',
    price: 118,
    compareAtPrice: 145,
    rating: 4.8,
    reviewCount: 3042,
    stock: 55,
    badge: 'Bestseller',
    shortDescription:
      'Cleanser, serum and barrier cream sized for travel and formulated without fragrance.',
    description:
      'Three steps, no filler. A low-pH cleanser, a niacinamide serum at 5%, and a barrier cream with ceramides and squalane. Fragrance-free, non-comedogenic, and tested on volunteers with sensitive skin.',
    createdAt: '2026-06-02',
  }),
  product('zv_0008', 'drift-diffuser', {
    slug: 'drift-essential-oil-diffuser',
    sku: 'ZV-HOM-0008',
    name: 'Drift Essential Oil Diffuser',
    category: 'home-living',
    price: 84,
    rating: 4.4,
    reviewCount: 726,
    stock: 3,
    badge: 'Low stock',
    shortDescription:
      'A 300ml ultrasonic diffuser with a real timer and a lamp that can be switched off.',
    description:
      'Drift runs quietly enough to use in a bedroom, holds 300ml, and shuts down cleanly when the tank is empty. The warm lamp is independently switchable, so it can run through the night without light.',
    colors: [
      { name: 'White', hex: '#F5F5F5' },
      { name: 'Sand', hex: '#DCD2C4' },
    ],
    createdAt: '2026-09-05',
  }),
  product('zv_0009', 'terra-tableware', {
    slug: 'terra-ceramic-tableware-set',
    sku: 'ZV-HOM-0009',
    name: 'Terra Ceramic Tableware Set',
    category: 'home-living',
    price: 152,
    compareAtPrice: 189,
    rating: 4.6,
    reviewCount: 388,
    stock: 21,
    shortDescription:
      'Sixteen pieces of reactive-glazed stoneware for everyday use.',
    description:
      'Sixteen pieces — four place settings, each with a dinner plate, side plate, bowl and mug. The reactive glaze means no two pieces are identical. Chip-resistant edges, microwave safe.',
    colors: [
      { name: 'Ash', hex: '#B4B8B2' },
      { name: 'Clay', hex: '#B07C5E' },
    ],
    createdAt: '2026-08-21',
  }),
  product('zv_0010', 'pulse-band', {
    slug: 'pulse-fitness-band',
    sku: 'ZV-LIF-0010',
    name: 'Pulse Fitness Band',
    category: 'lifestyle',
    price: 99,
    compareAtPrice: 129,
    rating: 4.3,
    reviewCount: 2210,
    stock: 96,
    shortDescription:
      'Fourteen-day battery, continuous heart rate and a swim-proof chassis.',
    description:
      'Pulse tracks heart rate, sleep stages and 90 workout types. The 5ATM chassis means it survives pool and open-water swims. Fourteen days per charge, and the band itself weighs 24g.',
    sizes: [{ name: 'S / M / L' }],
    createdAt: '2026-05-29',
  }),
  product('zv_0011', 'mist-overshirt', {
    slug: 'mist-wool-overshirt',
    sku: 'ZV-FAS-0011',
    name: 'Mist Wool Overshirt',
    category: 'fashion',
    price: 175,
    rating: 4.7,
    reviewCount: 642,
    stock: 34,
    shortDescription:
      'A heavy wool-overshirt cut that works as a light jacket through autumn.',
    description:
      'Woven from a wool-cotton blend at 380gsm, with a clean placket and two deep patch pockets. It layers over a tee or a fine knit and reads as a jacket without the weight of one.',
    colors: [
      { name: 'Fog', hex: '#A8ADB0' },
      { name: 'Olive', hex: '#5A6048' },
      { name: 'Ink', hex: '#242A33' },
    ],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    createdAt: '2026-09-08',
  }),
  product('zv_0012', 'onyx-sunglasses', {
    slug: 'onyx-sunglasses',
    sku: 'ZV-ACC-0012',
    name: 'Onyx Sunglasses',
    category: 'accessories',
    price: 210,
    compareAtPrice: 265,
    rating: 4.6,
    reviewCount: 355,
    stock: 4,
    badge: 'Low stock',
    shortDescription:
      'Hand-polished acetate frames with polarised mineral lenses.',
    description:
      'Cut from Italian acetate and polished by hand for fourteen hours. The mineral lenses are polarised and treated with an anti-reflective coating. Comes with a hard case and a folded microfibre cloth.',
    colors: [
      { name: 'Black', hex: '#141414' },
      { name: 'Tortoise', hex: '#6B4A2E' },
    ],
    variants: [
      variant('v1', 'Black', 210, 2),
      variant('v2', 'Tortoise', 210, 2),
    ],
    createdAt: '2026-07-25',
  }),
];

export const mockProducts = products;
export const mockCategories = categories;

export function getMockProductBySlug(slug) {
  return products.find((p) => p.slug === slug) ?? null;
}

export function getMockProductsByCategory(slug) {
  return products.filter((p) => p.categorySlug === slug);
}

export function getMockCategoriesWithCounts() {
  return categories.map((c) => ({
    ...c,
    productCount: products.filter((p) => p.categorySlug === c.slug).length,
  }));
}

export function searchMockProducts(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return products.filter((p) =>
    [p.name, p.sku, p.categoryName, p.shortDescription]
      .join(' ')
      .toLowerCase()
      .includes(q)
  );
}

/** Deterministic reviews for a product, newest first. */
export function getMockReviews(slug, count = 4) {
  const seed = hashString(slug);
  const start = seed % REVIEW_POOL.length;
  return Array.from({ length: Math.min(count, REVIEW_POOL.length) }, (_, i) => {
    const template = REVIEW_POOL[(start + i) % REVIEW_POOL.length];
    return {
      id: `${slug}-rev-${i}`,
      // Spread reviews over the last few months, oldest first.
      daysAgo: (count - i) * 9 + (seed % 5),
      ...template,
    };
  });
}

export default products;
