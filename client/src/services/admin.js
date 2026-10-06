/**
 * Admin API client.
 *
 * Separate from the storefront services on purpose: admin responses carry
 * supplier cost and margin, which must never be reachable from storefront code
 * paths. Mock mode returns fixtures so the admin UI is developable without a
 * database; real mode talks to /api/admin/*.
 */
import api from './api.js';

import { USE_MOCK } from './env';

function delay(ms = 220) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MOCK_OVERVIEW = {
  catalogue: {
    activeProducts: 0,
    archivedProducts: 0,
    variants: 0,
    categories: 0,
    supplierRows: 0,
  },
  customers: 0,
  orders: { total: 0, open: 0, cancelled: 0, delivered: 0, byStatus: {} },
  revenue: { gross: 0, collected: 0, refunded: 0 },
  financials: {
    revenue: 0,
    supplierCosts: 0,
    shippingCosts: 0,
    paymentFees: 0,
    otherCosts: 0,
    grossMargin: 0,
    operatingMargin: 0,
    estimatedNetProfit: 0,
    averageOrderValue: 0,
    paidOrders: 0,
    pendingOrders: 0,
    deliveredOrders: 0,
    refunds: 0,
    bestSelling: [],
    mostProfitable: [],
    byDate: [],
  },
  syncRunning: false,
  lowStock: [],
  topCategories: [],
  recentOrders: [],
};

const MOCK_ORDERS = { items: [], page: 1, pageSize: 25, total: 0, totalPages: 1 };

const MOCK_PRODUCTS = { items: [], page: 1, pageSize: 25, total: 0, totalPages: 1 };

export const adminService = {
  /** Headline figures for the dashboard. */
  async overview() {
    if (USE_MOCK) {
      await delay();
      return MOCK_OVERVIEW;
    }
    const { data } = await api.get('/admin/overview');
    return data.overview;
  },

  /* ---- orders ---------------------------------------------------------- */

  /**
   * Order list. `status` accepts a comma-separated list, matching the admin
   * filter bar.
   */
  async orders({ page = 1, pageSize = 25, status, paymentStatus, q } = {}) {
    if (USE_MOCK) {
      await delay();
      return MOCK_ORDERS;
    }
    const { data } = await api.get('/admin/orders', {
      params: { page, pageSize, status, paymentStatus, q },
    });
    return data;
  },

  async order(orderNumber) {
    if (USE_MOCK) {
      await delay();
      return null;
    }
    const { data } = await api.get(`/admin/orders/${encodeURIComponent(orderNumber)}`);
    return data.order;
  },

  /**
   * Move an order through the lifecycle. The server validates the transition
   * and answers 409 with the legal alternatives when it is not allowed.
   */
  async updateOrderStatus(orderNumber, { status, carrier, trackingNumber, estimatedDeliveryAt, note } = {}) {
    if (USE_MOCK) {
      await delay();
      return null;
    }
    const { data } = await api.patch(`/admin/orders/${encodeURIComponent(orderNumber)}/status`, {
      status,
      carrier,
      trackingNumber,
      estimatedDeliveryAt,
      note,
    });
    return data.order;
  },

  /** Cancel and restock. Refuses once the order has shipped. */
  async cancelOrder(orderNumber, { reason, refund = true } = {}) {
    if (USE_MOCK) {
      await delay();
      return null;
    }
    const { data } = await api.post(`/admin/orders/${encodeURIComponent(orderNumber)}/cancel`, {
      reason,
      refund,
    });
    return data;
  },

  /** The lifecycle itself, for status pickers. */
  async orderStatuses() {
    if (USE_MOCK) {
      await delay(80);
      return { statuses: [], shippingCountries: [], blockedCountries: [] };
    }
    const { data } = await api.get('/admin/orders/statuses');
    return data;
  },

  /* ---- catalogue -------------------------------------------------------- */

  /**
   * Catalogue list. Each row carries the supplier cost and the margin derived
   * from it — admin-only data.
   */
  async products({ page = 1, pageSize = 25, q, category, includeArchived, lowStock } = {}) {
    if (USE_MOCK) {
      await delay();
      return MOCK_PRODUCTS;
    }
    const { data } = await api.get('/admin/products', {
      params: { page, pageSize, q, category, includeArchived, lowStock },
    });
    return data;
  },

  async product(id) {
    if (USE_MOCK) {
      await delay();
      return null;
    }
    const { data } = await api.get(`/admin/products/${encodeURIComponent(id)}`);
    return data.product;
  },

  /** Admin-controlled retail price. */
  async updateProductPrice(id, price) {
    if (USE_MOCK) {
      await delay();
      return { ok: true, price };
    }
    const { data } = await api.patch(`/admin/products/${encodeURIComponent(id)}`, { price });
    return data;
  },

  /* ---- CJ integration --------------------------------------------------- */

  async cjStatus() {
    if (USE_MOCK) {
      await delay(120);
      // `configured: null`, not `false`: reporting "not configured" here made a
      // mock-mode session look like a server with missing credentials, which
      // sent debugging in exactly the wrong direction. `mockMode` lets the UI
      // say what is actually true — no API is being consulted at all.
      return {
        status: {
          mockMode: true,
          configured: null,
          hasToken: false,
          authenticated: false,
          running: false,
          openId: null,
          tokenExpiresAt: null,
          lastRuns: [],
        },
      };
    }
    const { data } = await api.get('/admin/cj/status');
    return data.status;
  },

  /** Fire-and-forget: the server runs the sync in the background. */
  async triggerSync() {
    if (USE_MOCK) {
      await delay();
      return { ok: true, message: 'Mock mode: no sync was performed.' };
    }
    const { data } = await api.post('/admin/cj/sync');
    return data;
  },

  async syncRuns(limit = 20) {
    if (USE_MOCK) {
      await delay(120);
      return [];
    }
    const { data } = await api.get('/admin/cj/sync/runs', { params: { limit } });
    return data.items;
  },

  /** Upstream products with cost vs our sell price, for margin checking. */
  async cjPreview({ page = 1, size = 10 } = {}) {
    if (USE_MOCK) {
      await delay();
      return { items: [], totalRecords: 0, totalPages: 0 };
    }
    const { data } = await api.get('/admin/cj/preview', { params: { page, size } });
    return data;
  },

  /** Supplier rows for the products we sell. */
  async supplierRows(limit = 50) {
    if (USE_MOCK) {
      await delay();
      return [];
    }
    const { data } = await api.get('/admin/cj/suppliers', { params: { limit } });
    return data.items;
  },

  /* ---- categories ------------------------------------------------------- */

  /** Full three-level category tree. */
  async categoryTree({ depth = 3 } = {}) {
    if (USE_MOCK) {
      await delay();
      return [];
    }
    const { data } = await api.get('/categories', { params: { depth } });
    return data.tree;
  },
};

export default adminService;