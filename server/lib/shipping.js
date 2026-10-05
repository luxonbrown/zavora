/**
 * Shipping rules.
 *
 * Replaces the flat `SHIPPING_METHODS` table that lived inside the checkout
 * controller. Rates are now resolved per destination country from a single
 * table so a zone change does not require touching pricing code, and the
 * storefront and the server quote from the same source.
 *
 * The free-shipping threshold is basket-level, not per-zone: a qualifying
 * basket gets free STANDARD shipping only. Paid upgrades still charge. That
 * distinction was previously the source of a real bug (express shipping coming
 * out free), so it is encoded explicitly in `quoteShipping` rather than left to
 * each caller.
 */

const config = require('../config');
const { toCents } = require('./money');

/** Methods offered everywhere. */
const METHODS = {
  standard: {
    id: 'standard',
    label: 'Standard',
    description: 'Tracked, 7-14 business days',
    baseCents: 695,
    days: [7, 14],
    freeEligible: true,
  },
  express: {
    id: 'express',
    label: 'Express',
    description: 'Tracked, 3-5 business days',
    baseCents: 1895,
    days: [3, 5],
    freeEligible: false,
  },
  priority: {
    id: 'priority',
    label: 'Priority',
    description: 'Tracked, 1-2 business days',
    baseCents: 3295,
    days: [1, 2],
    freeEligible: false,
  },
};

/**
 * Zone multipliers by destination country. Countries not listed fall back to
 * `DEFAULT_MULTIPLIER`, which is deliberately higher: unlisted destinations are
 * unknown territory and should not be quoted at domestic rates.
 */
const ZONES = {
  US: { multiplier: 1, zone: 'domestic-us' },
  CA: { multiplier: 1.1, zone: 'north-america' },
  MX: { multiplier: 1.2, zone: 'north-america' },
  GB: { multiplier: 1.1, zone: 'europe' },
  IE: { multiplier: 1.2, zone: 'europe' },
  DE: { multiplier: 1.05, zone: 'europe' },
  FR: { multiplier: 1.05, zone: 'europe' },
  NL: { multiplier: 1.05, zone: 'europe' },
  BE: { multiplier: 1.1, zone: 'europe' },
  ES: { multiplier: 1.15, zone: 'europe' },
  IT: { multiplier: 1.15, zone: 'europe' },
  PT: { multiplier: 1.2, zone: 'europe' },
  SE: { multiplier: 1.2, zone: 'europe' },
  DK: { multiplier: 1.2, zone: 'europe' },
  NO: { multiplier: 1.25, zone: 'europe' },
  CH: { multiplier: 1.3, zone: 'europe' },
  AT: { multiplier: 1.1, zone: 'europe' },
  PL: { multiplier: 1.25, zone: 'europe' },
  AU: { multiplier: 1.3, zone: 'oceania' },
  NZ: { multiplier: 1.35, zone: 'oceania' },
  JP: { multiplier: 1.2, zone: 'asia' },
  KR: { multiplier: 1.2, zone: 'asia' },
  SG: { multiplier: 1.25, zone: 'asia' },
  HK: { multiplier: 1.25, zone: 'asia' },
  CN: { multiplier: 1.15, zone: 'asia' },
  IN: { multiplier: 1.35, zone: 'asia' },
  AE: { multiplier: 1.4, zone: 'middle-east' },
  ZA: { multiplier: 1.35, zone: 'africa' },
  BR: { multiplier: 1.4, zone: 'south-america' },
  MX2: { multiplier: 1.2, zone: 'latam' },
};

const DEFAULT_MULTIPLIER = 1.35;

/** Countries we do not ship to at all. */
const BLOCKED = new Set(['RU', 'BY', 'KP', 'IR', 'SY', 'CU']);

function zoneFor(country) {
  if (!country) return { multiplier: DEFAULT_MULTIPLIER, zone: 'international' };
  const entry = ZONES[country];
  return entry || { multiplier: DEFAULT_MULTIPLIER, zone: 'international' };
}

function isBlocked(country) {
  return BLOCKED.has(String(country || '').toUpperCase());
}

/** Public shape of the shipping options, with no prices. */
function listMethods() {
  return Object.values(METHODS).map((m) => ({
    id: m.id,
    label: m.label,
    description: m.description,
    estimatedDays: m.days,
    freeShippingEligible: m.freeEligible,
  }));
}

/**
 * Quote shipping for a basket.
 *
 * `freeThresholdCents` defaults to config, but callers pass the value the
 * customer actually saw so a threshold change mid-session cannot silently
 * alter a quote.
 */
function quoteShipping({ subtotalCents, methodId = 'standard', country, freeThresholdCents } = {}) {
  const method = METHODS[methodId];
  if (!method) return null;

  const threshold =
    freeThresholdCents === undefined || freeThresholdCents === null
      ? toCents(config.pricing.freeShippingThreshold)
      : Number(freeThresholdCents);

  const qualifies = Number(subtotalCents) >= threshold;
  // Only standard shipping is free. A paid upgrade always charges, otherwise
  // "free shipping" quietly becomes "free express" on qualifying baskets.
  const freeApplied = qualifies && method.freeEligible;

  const { multiplier, zone } = zoneFor(country);
  const rawCents = freeApplied ? 0 : Math.round(method.baseCents * multiplier);
  const etaDays = freeApplied ? method.days[0] : method.days[1];

  const eta = new Date();
  eta.setDate(eta.getDate() + etaDays);

  return {
    method: method.id,
    label: method.label,
    zone,
    zoneMultiplier: multiplier,
    amountCents: rawCents,
    freeApplied,
    // Kept so the UI can show "you saved X" without recomputing the rate.
    baseAmountCents: method.baseCents,
    freeThresholdCents: threshold,
    amountToFreeShippingCents: Math.max(0, threshold - Number(subtotalCents)),
    estimatedDays: method.days,
    estimatedDeliveryAt: eta,
  };
}

/** Every method priced for one basket, for a shipping picker. */
function quoteAll({ subtotalCents, country, freeThresholdCents } = {}) {
  return Object.keys(METHODS)
    .map((id) => quoteShipping({ subtotalCents, methodId: id, country, freeThresholdCents }))
    .filter(Boolean);
}

module.exports = { METHODS, ZONES, listMethods, quoteShipping, quoteAll, zoneFor, isBlocked, DEFAULT_MULTIPLIER };
