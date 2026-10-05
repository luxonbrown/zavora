/**
 * Checkout service.
 *
 * The important property: the browser never decides what an order costs.
 * `quote()` and `placeOrder()` both re-read every line from the catalogue and
 * recompute the money server-side, then return the authoritative figures. The
 * UI renders whatever comes back — it does not send prices it expects to be
 * honoured, and any mismatch between a client-sent price and the catalogue is
 * rejected rather than silently corrected.
 *
 * Steps 1-10 are backed by the mock catalogue; step 11 swaps the lookups for
 * MySQL while keeping the same contract.
 */
import api from './api.js';
import { estimateShipping, estimateTax, getCountry } from './shipping.js';
import { mockProducts } from './mockCatalogue.js';

import { USE_MOCK } from './env';

const SHIPPING_METHODS = [
  {
    id: 'standard',
    name: 'Standard tracked',
    description: 'Insured, signature on delivery',
    multiplier: 1,
    extraDays: 0,
  },
  {
    id: 'express',
    name: 'Express',
    description: 'Priority handling, tracked end to end',
    multiplier: 1.85,
    extraDays: -2,
  },
];

export const PAYMENT_METHODS = [
  { id: 'card', name: 'Credit or debit card', description: 'Visa, Mastercard, Amex' },
  { id: 'paypal', name: 'PayPal', description: "You'll be redirected to approve" },
  { id: 'applepay', name: 'Apple Pay', description: 'Confirm with Face ID' },
];

function delay(ms = 500) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function findProduct(id) {
  return mockProducts.find((p) => p.id === id) ?? null;
}

/**
 * Rebuild the order from catalogue truth.
 *
 * @param lines cart lines as sent by the browser: { productId, variantId, quantity, price }
 * @returns authoritative lines + totals, or throws with a customer-safe reason.
 */
export function priceOrder({ lines = [], countryCode = 'US', shippingMethodId = 'standard' }) {
  if (!Array.isArray(lines) || lines.length === 0) {
    const error = new Error('Your cart is empty.');
    error.code = 'EMPTY_CART';
    throw error;
  }

  const priced = [];

  for (const line of lines) {
    const product = findProduct(line.productId);
    if (!product) {
      const error = new Error(
        'One of the items in your cart is no longer available. Please review your cart.'
      );
      error.code = 'PRODUCT_UNAVAILABLE';
      throw error;
    }

    // Resolve the variant server-side; never trust a client-sent price.
    const variant = product.variants?.find((v) => v.id === line.variantId) ?? null;
    const unitPrice = variant?.price ?? product.price;
    const stock = variant?.stock ?? product.stock;

    const quantity = Math.max(1, Math.min(20, Math.floor(Number(line.quantity) || 0)));

    if (stock <= 0) {
      const error = new Error(`${product.name} has sold out. Please remove it to continue.`);
      error.code = 'OUT_OF_STOCK';
      throw error;
    }
    if (quantity > stock) {
      const error = new Error(
        `Only ${stock} × ${product.name} left in stock. Please reduce the quantity.`
      );
      error.code = 'INSUFFICIENT_STOCK';
      throw error;
    }

    // If the browser sent a price and it disagrees with the catalogue, reject —
    // silently overwriting would hide a real problem (stale cart, tampering).
    if (line.price !== undefined && Number(line.price) !== Number(unitPrice)) {
      const error = new Error(
        `The price of ${product.name} changed since you added it. Please review your cart.`
      );
      error.code = 'PRICE_CHANGED';
      error.currentPrice = unitPrice;
      throw error;
    }

    priced.push({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.images?.[0] ?? null,
      variantId: variant?.id ?? null,
      variantLabel: variant?.name ?? null,
      unitPrice,
      compareAtPrice: product.compareAtPrice ?? null,
      quantity,
      lineTotal: round2(unitPrice * quantity),
    });
  }

  const method =
    SHIPPING_METHODS.find((m) => m.id === shippingMethodId) ?? SHIPPING_METHODS[0];

  const subtotal = round2(priced.reduce((sum, l) => sum + l.lineTotal, 0));

  // Free shipping over the threshold applies to the standard method only — an
  // express upgrade is still charged. `zoneFee` is the undiscounted zone rate,
  // because `estimateShipping().fee` is already zeroed on a qualifying basket.
  const baseShipping = estimateShipping({ countryCode, subtotal });
  const standardIsFree = method.id === 'standard' && baseShipping.free;
  const shippingFee = standardIsFree
    ? 0
    : round2(baseShipping.zoneFee * method.multiplier);

  const taxableAmount = round2(subtotal + shippingFee);
  const tax = estimateTax({ countryCode, taxableAmount });

  const total = round2(taxableAmount + tax.amount);

  return {
    lines: priced,
    itemCount: priced.reduce((n, l) => n + l.quantity, 0),
    countryCode,
    countryName: getCountry(countryCode).name,
    shippingMethod: {
      id: method.id,
      name: method.name,
      description: method.description,
      fee: shippingFee,
      minDays: Math.max(1, baseShipping.minDays + method.extraDays),
      maxDays: Math.max(1, baseShipping.maxDays + method.extraDays),
    },
    freeShippingApplied: standardIsFree,
    subtotal,
    shipping: shippingFee,
    taxRate: tax.rate,
    tax: tax.amount,
    total,
    currency: 'USD',
  };
}

function nextOrderNumber() {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.floor(100 + Math.random() * 900);
  return `ZV-${stamp}-${rand}`;
}

export const checkoutService = {
  /** Destination-calculated shipping options. */
  async shippingMethods({ countryCode = 'US', subtotal = 0 } = {}) {
    if (USE_MOCK) {
      await delay(220);
      const base = estimateShipping({ countryCode, subtotal });
      return SHIPPING_METHODS.map((method) => ({
        ...method,
        fee:
          method.id === 'standard' && base.free
            ? 0
            : round2(base.zoneFee * method.multiplier),
        minDays: Math.max(1, base.minDays + method.extraDays),
        maxDays: Math.max(1, base.maxDays + method.extraDays),
      }));
    }
    const { data } = await api.get('/checkout/shipping-methods', {
      params: { countryCode, subtotal },
    });
    return data;
  },

  paymentMethods() {
    return PAYMENT_METHODS;
  },

  /** Authoritative pricing for the review step. */
  async quote({ lines, countryCode, shippingMethodId }) {
    if (USE_MOCK) {
      await delay(400);
      return priceOrder({ lines, countryCode, shippingMethodId });
    }
    const { data } = await api.post('/checkout/quote', { lines, countryCode, shippingMethodId });
    return data;
  },

  async placeOrder({ lines, contact, address, shippingMethodId, payment }) {
    if (USE_MOCK) {
      await delay(900);

      // Re-price at the moment of purchase, not from the last quote.
      const priced = priceOrder({ lines, countryCode: address.country, shippingMethodId });

      if (!contact?.email) {
        const error = new Error('A contact email is required.');
        error.code = 'MISSING_EMAIL';
        throw error;
      }

      // Declines are simulated the way a gateway does: a specific card number
      // fails, so the error path is reachable without breaking the happy path.
      if (payment?.method === 'card') {
        const digits = String(payment.cardNumber || '').replace(/\D/g, '');
        if (digits.endsWith('0002')) {
          const error = new Error('Your card was declined. Try a different payment method.');
          error.code = 'PAYMENT_DECLINED';
          throw error;
        }
        if (digits.length < 13) {
          const error = new Error('Check the card number and try again.');
          error.code = 'PAYMENT_INVALID';
          throw error;
        }
      }

      return {
        orderNumber: nextOrderNumber(),
        status: 'placed',
        email: contact.email,
        address,
        ...priced,
        placedAt: new Date().toISOString(),
        estimatedDeliveryDays: [priced.shippingMethod.minDays, priced.shippingMethod.maxDays],
      };
    }

    const { data } = await api.post('/checkout/place-order', {
      lines,
      contact,
      address,
      shippingMethodId,
      payment,
    });
    return data;
  },
};

export { SHIPPING_METHODS, checkoutService as default };