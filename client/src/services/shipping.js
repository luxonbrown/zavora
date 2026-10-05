/**
 * Shipping destinations and estimates.
 *
 * Mock-backed for steps 1-10; step 11 replaces the estimate with server-issued
 * rates. Checkout (step 9) and the customer dashboard (step 10) both read from
 * here, so destination lists can never diverge between surfaces.
 */

export const COUNTRIES = [
  { code: 'US', name: 'United States', currency: 'USD', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', flag: '🇬🇧' },
  { code: 'DE', name: 'Germany', currency: 'EUR', flag: '🇩🇪' },
  { code: 'FR', name: 'France', currency: 'EUR', flag: '🇫🇷' },
  { code: 'NL', name: 'Netherlands', currency: 'EUR', flag: '🇳🇱' },
  { code: 'ES', name: 'Spain', currency: 'EUR', flag: '🇪🇸' },
  { code: 'IT', name: 'Italy', currency: 'EUR', flag: '🇮🇹' },
  { code: 'CA', name: 'Canada', currency: 'CAD', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', currency: 'AUD', flag: '🇦🇺' },
  { code: 'JP', name: 'Japan', currency: 'JPY', flag: '🇯🇵' },
  { code: 'SG', name: 'Singapore', currency: 'SGD', flag: '🇸🇬' },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED', flag: '🇦🇪' },
];

export const FREE_SHIPPING_THRESHOLD = 150;

/** Zone table: base fee and business-day range per country. */
const ZONES = {
  US: { fee: 6.95, minDays: 3, maxDays: 5 },
  CA: { fee: 9.95, minDays: 4, maxDays: 7 },
  GB: { fee: 7.95, minDays: 4, maxDays: 6 },
  DE: { fee: 7.95, minDays: 4, maxDays: 6 },
  FR: { fee: 7.95, minDays: 4, maxDays: 6 },
  NL: { fee: 7.95, minDays: 4, maxDays: 6 },
  ES: { fee: 8.95, minDays: 5, maxDays: 7 },
  IT: { fee: 8.95, minDays: 5, maxDays: 7 },
  AU: { fee: 13.95, minDays: 6, maxDays: 9 },
  JP: { fee: 13.95, minDays: 6, maxDays: 9 },
  SG: { fee: 11.95, minDays: 5, maxDays: 8 },
  AE: { fee: 14.95, minDays: 6, maxDays: 9 },
};

export function getCountry(code) {
  return COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0];
}

/**
 * Estimated shipping for a destination and basket subtotal.
 * Returns the fee in USD (the store's base currency) plus a day range.
 */
export function estimateShipping({ countryCode = 'US', subtotal = 0 } = {}) {
  const zone = ZONES[countryCode] ?? ZONES.US;
  const qualifiesFree = subtotal >= FREE_SHIPPING_THRESHOLD;

  return {
    countryCode,
    fee: qualifiesFree ? 0 : zone.fee,
    // The undiscounted zone rate. Free shipping is a basket-level benefit, not a
    // property of the zone — paid upgrades (express) still charge `zoneFee`.
    zoneFee: zone.fee,
    free: qualifiesFree,
    freeThreshold: FREE_SHIPPING_THRESHOLD,
    amountToFree: Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal),
    minDays: zone.minDays,
    maxDays: zone.maxDays,
    label: `${zone.minDays}–${zone.maxDays} business days`,
    // Duties are calculated at checkout — nothing to pay on arrival.
    dutiesIncluded: true,
  };
}

/**
 * Destination tax rates. Expressed as a fraction (0.2 = 20%).
 * These are indicative retail rates for the demo; step 11 replaces them with
 * server-issued figures per market.
 */
const TAX_RATES = {
  US: 0,
  CA: 0.05,
  GB: 0.2,
  DE: 0.19,
  FR: 0.2,
  NL: 0.21,
  ES: 0.21,
  IT: 0.22,
  AU: 0.1,
  JP: 0.1,
  SG: 0.09,
  AE: 0.05,
};

/**
 * Tax for a destination and taxable amount. Tax is assessed on goods plus
 * shipping, which is how most destination markets treat imported parcels.
 */
export function estimateTax({ countryCode = 'US', taxableAmount = 0 } = {}) {
  const rate = TAX_RATES[countryCode] ?? TAX_RATES.US;
  const amount = Math.round(Number(taxableAmount || 0) * rate * 100) / 100;
  return { rate, amount, included: rate === 0 };
}

export function formatDays({ minDays, maxDays }) {
  return minDays === maxDays ? `${minDays} business days` : `${minDays}–${maxDays} business days`;
}
