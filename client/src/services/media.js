/**
 * Single place where image URLs are produced.
 *
 * Steps 1-10 run on deterministic placeholder photography so the UI is fully
 * testable before any backend exists. Step 11 (API) and step 12 (CJ sync) make
 * this read real URLs from the database — nothing else needs to change.
 */

const PROVIDERS = {
  picsum: (seed, w, h) => `https://picsum.photos/seed/${seed}/${w}/${h}`,
  // Swap to the real CDN when supplier imagery is available.
  cdn: (seed, w, h) => `/media/products/${seed}-${w}x${h}.jpg`,
};

const provider = PROVIDERS.picsum;

/** 4:5 product imagery — the ratio every ProductCard reserves. */
export function productImage(seed, width = 800, height = 1000) {
  return provider(seed, width, height);
}

/** Wide cinematic hero / editorial imagery. */
export function editorialImage(seed, width = 1920, height = 1280) {
  return provider(seed, width, height);
}

/** Category tile imagery. */
export function categoryImage(seed, width = 900, height = 1125) {
  return provider(seed, width, height);
}

/** Deterministic placeholder when a product has no imagery yet. */
export function fallbackImage(seed) {
  return productImage(`MARKETHUB-fallback-${seed}`, 800, 1000);
}
