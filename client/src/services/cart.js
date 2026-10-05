/**
 * Cart service.
 *
 * Mock mode replays the localStorage-backed CartContext behaviour; real mode
 * talks to the REST API. The server owns pricing and stock, so nothing here
 * sends a price or a stock level.
 */
import api from './api.js';

import { USE_MOCK } from './env';

function delay(ms = 180) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const cartService = {
  /** Current cart. Returns { items, itemCount, subtotal, issues, ... }. */
  async get() {
    if (USE_MOCK) {
      await delay();
      return { items: [] };
    }
    const { data } = await api.get('/cart');
    return data.cart;
  },

  async addItem({ productId, variantId = null, quantity = 1 }) {
    if (USE_MOCK) {
      await delay();
      return { items: [] };
    }
    const { data } = await api.post('/cart/items', { productId, variantId, quantity });
    return data.cart;
  },

  /** Set an exact quantity. The server treats 0 as "remove". */
  async updateItem(itemId, quantity) {
    if (USE_MOCK) {
      await delay();
      return { items: [] };
    }
    const { data } = await api.patch(`/cart/items/${itemId}`, { quantity });
    return data.cart;
  },

  async removeItem(itemId) {
    if (USE_MOCK) {
      await delay();
      return { items: [] };
    }
    const { data } = await api.delete(`/cart/items/${itemId}`);
    return data.cart;
  },

  async clear() {
    if (USE_MOCK) {
      await delay();
      return { items: [] };
    }
    const { data } = await api.delete('/cart');
    return data.cart;
  },
};

export default cartService;