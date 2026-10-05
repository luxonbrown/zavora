/**
 * Wishlist service. Server-backed in real mode; the localStorage path is only
 * reachable in mock mode.
 */
import api from './api.js';

import { USE_MOCK } from './env';

function delay(ms = 140) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const wishlistService = {
  /** Full wishlist rows, for the dashboard's saved-items view. */
  async list() {
    if (USE_MOCK) {
      await delay();
      return [];
    }
    const { data } = await api.get('/wishlist');
    return data.items ?? [];
  },

  /** Toggle membership. Resolves to the resulting state. */
  async toggle(productId) {
    if (USE_MOCK) {
      await delay();
      return { inWishlist: false };
    }
    const { data } = await api.post('/wishlist', { productId });
    return data;
  },

  async remove(productId) {
    if (USE_MOCK) {
      await delay();
      return true;
    }
    await api.delete(`/wishlist/${productId}`);
    return true;
  },
};

export default wishlistService;