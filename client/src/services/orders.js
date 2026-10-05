/**
 * Orders service (mock for steps 1-10).
 *
 * An order stores product *snapshots* — name, image, price, variant at the time
 * of purchase — so editing or delisting a product later never rewrites history.
 * Step 11 reads the same shape from MySQL.
 */
import api from './api.js';
import { mockProducts } from './mockCatalogue.js';
import { estimateShipping, estimateTax, getCountry } from './shipping.js';
import { isActive } from '../constants/orders.js';

import { USE_MOCK } from './env';

const CARRIERS = {
  DHL: { name: 'DHL Express', trackingUrl: 'https://www.dhl.com' },
  UPS: { name: 'UPS', trackingUrl: 'https://www.ups.com' },
  FEDEX: { name: 'FedEx', trackingUrl: 'https://www.fedex.com' },
  POSTNL: { name: 'PostNL', trackingUrl: 'https://www.postnl.nl' },
};

const OWNER_EMAIL = 'demo@zavora.com';

function productBySlug(slug) {
  return mockProducts.find((p) => p.slug === slug);
}

/** Snapshot a catalogue product into an order line. */
function lineFrom(product, quantity, variantName = null) {
  const variant = product.variants?.find((v) => v.name === variantName) ?? null;
  const unitPrice = variant?.price ?? product.price;
  return {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    image: product.images?.[0] ?? null,
    variantLabel: variant?.name ?? null,
    unitPrice,
    compareAtPrice: product.compareAtPrice ?? null,
    quantity,
    lineTotal: Math.round(unitPrice * quantity * 100) / 100,
  };
}

function buildOrder({
  orderNumber,
  placedAt,
  status,
  paymentStatus,
  lines,
  country,
  shippingMethodId = 'standard',
  carrier = null,
  trackingNumber = null,
  estimatedDeliveryAt = null,
}) {
  const subtotal = Math.round(lines.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100;
  const shippingEstimate = estimateShipping({ countryCode: country, subtotal });
  const shipping =
    shippingMethodId === 'standard' && shippingEstimate.free
      ? 0
      : Math.round(shippingEstimate.zoneFee * (shippingMethodId === 'express' ? 1.85 : 1) * 100) / 100;
  const tax = estimateTax({ countryCode: country, taxableAmount: subtotal + shipping });

  return {
    orderNumber,
    placedAt,
    status,
    paymentStatus,
    email: OWNER_EMAIL,
    lines,
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    country,
    countryName: getCountry(country).name,
    shippingMethodId,
    shipping,
    shippingMethodName: shippingMethodId === 'express' ? 'Express' : 'Standard tracked',
    subtotal,
    tax: tax.amount,
    taxRate: tax.rate,
    total: Math.round((subtotal + shipping + tax.amount) * 100) / 100,
    currency: 'USD',
    carrier: carrier ? CARRIERS[carrier] : null,
    trackingNumber,
    estimatedDeliveryAt,
    active: isActive(status),
  };
}

function daysFromNow(days, hour = 12) {
  const d = new Date(Date.now() + days * 86400000);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function daysAgo(days, hour = 12) {
  return daysFromNow(-days, hour);
}

const orders = [
  buildOrder({
    orderNumber: 'ZV-8KQ2M1-447',
    placedAt: daysAgo(2, 9),
    status: 'in_transit',
    paymentStatus: 'paid',
    carrier: 'DHL',
    trackingNumber: 'JD0146000038284712',
    estimatedDeliveryAt: daysFromNow(2, 18),
    country: 'DE',
    shippingMethodId: 'express',
    lines: [
      lineFrom(productBySlug('aura-noise-cancelling-headphones'), 1, 'Midnight Black'),
      lineFrom(productBySlug('halo-skincare-ritual-set'), 1),
    ],
  }),
  buildOrder({
    orderNumber: 'ZV-3PL8W7-102',
    placedAt: daysAgo(9, 14),
    status: 'shipped',
    paymentStatus: 'paid',
    carrier: 'UPS',
    trackingNumber: '1Z999AA10123456784',
    estimatedDeliveryAt: daysFromNow(4, 20),
    country: 'US',
    lines: [lineFrom(productBySlug('meridian-automatic-watch'), 1, 'Steel / Slate')],
  }),
  buildOrder({
    orderNumber: 'ZV-6TR4X9-881',
    placedAt: daysAgo(26, 11),
    status: 'delivered',
    paymentStatus: 'paid',
    carrier: 'FEDEX',
    trackingNumber: '7749 2200 3398',
    estimatedDeliveryAt: daysAgo(19, 16),
    country: 'GB',
    lines: [
      lineFrom(productBySlug('vero-ceramic-pour-over-set'), 2),
      lineFrom(productBySlug('drift-essential-oil-diffuser'), 1, 'Sand'),
    ],
  }),
  buildOrder({
    orderNumber: 'ZV-9HN5J2-336',
    placedAt: daysAgo(41, 16),
    status: 'delivered',
    paymentStatus: 'paid',
    carrier: 'POSTNL',
    trackingNumber: '3SABC123456789',
    estimatedDeliveryAt: daysAgo(34, 13),
    country: 'NL',
    lines: [lineFrom(productBySlug('mist-wool-overshirt'), 1, 'Fog')],
  }),
  buildOrder({
    orderNumber: 'ZV-2WQ7B3-590',
    placedAt: daysAgo(3, 8),
    status: 'processing',
    paymentStatus: 'paid',
    country: 'US',
    lines: [lineFrom(productBySlug('solstice-leather-tote'), 1, 'Tan')],
  }),
];

function delay(ms = 350) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Shape normalisation.
 *
 * The mock fixtures and the real API disagree on field names, which previously
 * meant the account overview rendered hard zeros against the real backend:
 *   mock  { totalOrders, activeOrders, deliveredOrders, lifetimeValue }
 *   real  { orderCount, activeOrderCount, lifetimeValue, wishlistCount }
 * A detail row is worse — mock orders carry `lines` and a `carrier` OBJECT,
 * while real orders carry `items` and a `carrier` STRING.
 *
 * These adapters are client-side only and keep one canonical shape for the UI,
 * so no page has to know which mode it is running in.
 */
function normalizeSummary(raw) {
  const s = raw?.summary ?? raw ?? {};
  return {
    totalOrders: s.orderCount ?? s.totalOrders ?? 0,
    activeOrders: s.activeOrderCount ?? s.activeOrders ?? 0,
    deliveredOrders: s.deliveredOrders ?? 0,
    lifetimeValue: s.lifetimeValue ?? 0,
    wishlistCount: s.wishlistCount ?? 0,
  };
}

/** Detail order. Returns null rather than an envelope, so callers can branch. */
function normalizeOrder(raw) {
  const o = raw?.order ?? raw;
  if (!o) return null;

  const address = o.shippingAddress ?? null;
  const lines = Array.isArray(o.items) ? o.items : Array.isArray(o.lines) ? o.lines : [];

  return {
    ...o,
    lines: lines.map((line) => ({
      ...line,
      // Real lines nest the product under `product` in some rows.
      productId: line.productId ?? line.productId ?? line.product?.id ?? null,
      image: line.image ?? line.imageUrl ?? line.product?.image ?? null,
      name: line.name ?? line.productName ?? line.product?.name ?? 'Product',
    })),
    // Mock puts shipping/tax at these names; the real API says shippingAmount.
    shipping: o.shippingAmount ?? o.shipping ?? 0,
    tax: o.taxAmount ?? o.tax ?? 0,
    shippingAddress: address,
    // Flat, mock-compatible country so tracking UIs need no branch.
    country: address?.country ?? o.country ?? o.countryName ?? null,
    countryName: address?.country ?? o.countryName ?? o.country ?? null,
    // Real carrier is a bare string; mock nests it.
    carrierName:
      typeof o.carrier === 'string' ? o.carrier : (o.carrier?.name ?? null),
    trackingUrl:
      (typeof o.carrier === 'object' && o.carrier?.trackingUrl) || null,
  };
}

export const ordersService = {
  /** Always returns a page envelope: `{ items, total, ... }`. */
  async list({ email = OWNER_EMAIL } = {}) {
    if (USE_MOCK) {
      await delay();
      const items = orders
        .filter((o) => o.email === email)
        .sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt))
        // Match the real list payload: a summary row, no line items.
        .map(({ lines, ...rest }) => ({
          ...rest,
          itemCount:
            rest.itemCount ??
            (Array.isArray(lines) ? lines.reduce((n, l) => n + (l.quantity ?? 1), 0) : 0),
          thumbnail: rest.thumbnail ?? lines?.[0]?.image ?? null,
        }));
      return { items, page: 1, pageSize: items.length, total: items.length, totalPages: 1 };
    }
    const { data } = await api.get('/orders', { params: { email } });
    return data;
  },

  /** Returns a normalised order, or null when not found. */
  async getByNumber(orderNumber, { email } = {}) {
    if (USE_MOCK) {
      await delay(300);
      const order = orders.find(
        (o) => o.orderNumber.toLowerCase() === String(orderNumber).trim().toLowerCase()
      );
      if (!order) return null;
      // Public tracking requires the matching email; the dashboard passes it
      // implicitly because the customer is signed in.
      if (email && order.email.toLowerCase() !== String(email).trim().toLowerCase()) return null;
      return normalizeOrder(order);
    }
    const { data } = await api.get(`/orders/${orderNumber}`, { params: { email } });
    return normalizeOrder(data);
  },

  /** Aggregate counts for the account overview. */
  async summary({ email = OWNER_EMAIL } = {}) {
    if (USE_MOCK) {
      await delay(200);
      const mine = orders.filter((o) => o.email === email);
      return {
        totalOrders: mine.length,
        activeOrders: mine.filter((o) => isActive(o.status)).length,
        deliveredOrders: mine.filter((o) => o.status === 'delivered').length,
        lifetimeValue: Math.round(mine.reduce((s, o) => s + o.total, 0) * 100) / 100,
        wishlistCount: 0,
      };
    }
    const { data } = await api.get('/orders/summary', { params: { email } });
    return normalizeSummary(data);
  },
};

export default ordersService;
export { normalizeOrder, normalizeSummary };