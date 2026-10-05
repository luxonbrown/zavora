/**
 * Product service — the only module that knows whether data is mocked.
 *
 * Steps 1-10: resolved from `mockCatalogue`.
 * Step 11:    `USE_MOCK` flips to false and every call goes to the REST API.
 *
 * Nothing else in the app imports the mock catalogue directly.
 */
import api from './api.js';
import {
  getMockCategoriesWithCounts,
  getMockProductBySlug,
  getMockProductsByCategory,
  getMockReviews,
  mockProducts,
  searchMockProducts,
} from './mockCatalogue.js';

import { USE_MOCK } from './env';

/** Simulated latency so loading states are actually exercised in development. */
function delay(ms = 220) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Popular' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
];

function applySort(list, sort) {
  const copy = [...list];
  switch (sort) {
    case 'price-asc':
      return copy.sort((a, b) => a.price - b.price);
    case 'price-desc':
      return copy.sort((a, b) => b.price - a.price);
    case 'popular':
      return copy.sort((a, b) => b.reviewCount - a.reviewCount);
    case 'newest':
    default:
      return copy.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

function applyFilters(list, { category, minPrice, maxPrice, inStock, minRating, q }) {
  const term = typeof q === 'string' ? q.trim().toLowerCase() : '';

  return list.filter((p) => {
    if (term) {
      const haystack = [p.name, p.sku, p.categoryName, p.shortDescription]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    if (category && p.categorySlug !== category) return false;
    if (typeof minPrice === 'number' && p.price < minPrice) return false;
    if (typeof maxPrice === 'number' && p.price > maxPrice) return false;
    if (inStock && p.stock <= 0) return false;
    if (typeof minRating === 'number' && p.rating < minRating) return false;
    return true;
  });
}

/**
 * Map the API's product shape onto the flat shape the UI already consumes.
 *
 * The components (ProductCard, ProductDetail, SearchOverlay, FeaturedCollection)
 * read `categorySlug`, `categoryName` and `image` as flat fields, which is what
 * the mock catalogue produced. The API nests the category and returns `image`
 * rather than an images array. Normalising here means zero component changes
 * when the mock is switched off.
 */
function normaliseProduct(p) {
  if (!p) return p;
  return {
    ...p,
    categorySlug: p.categorySlug ?? p.category?.slug ?? null,
    categoryName: p.categoryName ?? p.category?.name ?? null,
    image: p.image ?? (Array.isArray(p.images) ? p.images[0]?.url ?? null : null),
    images: Array.isArray(p.images) && p.images.length ? p.images : p.image ? [{ url: p.image, alt: p.name, isPrimary: true }] : [],
    inStock: p.inStock ?? (p.stock ?? 0) > 0,
    compareAtPrice: p.compareAtPrice ?? null,
    badge: p.badge ?? null,
    specifications: p.specifications ?? [],
    createdAt: p.createdAt ?? p.publishedAt ?? null,
  };
}

/** Normalise a { items, ... } page envelope. */
function normalisePage(data) {
  return { ...data, items: (data?.items ?? []).map(normaliseProduct) };
}

/**
 * Flatten the API's nested category tree into a list, annotating each node with
 * its depth. Consumers that just need "a list of categories" keep working
 * unchanged now that the API returns a tree.
 */
function flattenTree(tree, depth = 0, out = []) {
  for (const node of tree ?? []) {
    out.push({ ...node, depth });
    flattenTree(node.children, depth + 1, out);
  }
  return out;
}

export const productsService = {
  async list({ page = 1, pageSize = 12, sort = 'newest', q, category, minPrice, maxPrice, inStock, minRating } = {}) {
    if (USE_MOCK) {
      await delay();
      const filtered = applySort(
        applyFilters(mockProducts, { q, category, minPrice, maxPrice, inStock, minRating }),
        sort
      );
      const start = (page - 1) * pageSize;
      return {
        items: filtered.slice(start, start + pageSize),
        total: filtered.length,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
      };
    }
    const { data } = await api.get('/products', {
      params: { page, pageSize, sort, q, category, minPrice, maxPrice, inStock, minRating },
    });
    return normalisePage(data);
  },

  async getBySlug(slug) {
    if (USE_MOCK) {
      await delay(160);
      return getMockProductBySlug(slug);
    }
    // The API wraps the product in `{ ok, product }`.
    const { data } = await api.get(`/products/${slug}`);
    return normaliseProduct(data.product);
  },

  async listByCategory(slug, params = {}) {
    if (USE_MOCK) {
      await delay();
      return this.list({ ...params, category: slug });
    }
    // Filtering the product list by category slug; there is no dedicated
    // /categories/:slug/products route.
    const { data } = await api.get('/products', { params: { ...params, category: slug } });
    return normalisePage(data);
  },

  async search(query, { limit = 8 } = {}) {
    if (USE_MOCK) {
      await delay(120);
      return searchMockProducts(query).slice(0, limit);
    }
    const { data } = await api.get('/products/search', { params: { q: query, limit } });
    return (data.items ?? []).map(normaliseProduct);
  },

  /**
   * Categories for the shop filter and generic lookups: the first two levels
   * of the tree, flattened.
   *
   * The live catalogue is a three-level CJ hierarchy with ~560 nodes; sending
   * all of it on every listing render measured 354 KB, so the API is depth
   * limited and deeper levels are fetched on demand via categoryBranch().
   */
  async categories() {
    if (USE_MOCK) {
      await delay(140);
      return getMockCategoriesWithCounts();
    }
    const { data } = await api.get('/categories', { params: { depth: 2 } });
    return flattenTree(data.tree ?? []);
  },

  /** Top-level categories only — for homepage tiles and primary navigation. */
  async topCategories() {
    if (USE_MOCK) {
      await delay(140);
      return getMockCategoriesWithCounts();
    }
    const { data } = await api.get('/categories', { params: { depth: 1 } });
    return (data.tree ?? []).map((n) => ({
      ...n,
      // Depth 1 means children were pruned; surface how many leaves are behind.
      leafCount: n.leafCount ?? 1,
    }));
  },

  /**
   * One category plus its immediate children and rollup count. Used for the
   * heading on /category/:slug and for drill-down in the filter panel.
   */
  async categoryBranch(slug) {
    if (USE_MOCK) {
      await delay(80);
      const found = getMockCategoriesWithCounts().find((c) => c.slug === slug);
      return found ? { ...found, children: [] } : null;
    }
    const { data } = await api.get(`/categories/${slug}`);
    return data.category;
  },

  /** Nested view, for a collapsible navigation menu. */
  async categoryTree({ depth = 2 } = {}) {
    if (USE_MOCK) {
      await delay(140);
      return getMockCategoriesWithCounts().map((c) => ({ ...c, children: [] }));
    }
    const { data } = await api.get('/categories', { params: { depth } });
    return data.tree ?? [];
  },

  async trending(limit = 8) {
    if (USE_MOCK) {
      await delay();
      return applySort(mockProducts, 'popular').slice(0, limit);
    }
    const { data } = await api.get('/products/trending', { params: { limit } });
    return (data.items ?? []).map(normaliseProduct);
  },

  async related(product, limit = 4) {
    if (USE_MOCK) {
      await delay();
      return mockProducts
        .filter((p) => p.categorySlug === product.categorySlug && p.id !== product.id)
        .slice(0, limit);
    }
    const { data } = await api.get(`/products/${product.slug}/related`, { params: { limit } });
    return (data.items ?? []).map(normaliseProduct);
  },

  async reviews(slug, { limit = 4 } = {}) {
    if (USE_MOCK) {
      await delay(140);
      return getMockReviews(slug, limit);
    }
    const { data } = await api.get(`/products/${slug}/reviews`, { params: { limit } });
    return data.items ?? [];
  },
};

export default productsService;
