import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { SORT_OPTIONS } from '../services/products.js';

/** Price bands are single-select; picking one sets both min and max. */
export const PRICE_BANDS = [
  { id: 'under-50', label: 'Under $50', min: 0, max: 50 },
  { id: '50-150', label: '$50 – $150', min: 50, max: 150 },
  { id: '150-300', label: '$150 – $300', min: 150, max: 300 },
  { id: 'over-300', label: '$300 and up', min: 300, max: null },
];

// Half-star steps. Whole-star steps ("4 and up") are close to a no-op on a
// well-reviewed catalogue, so the control would look broken even when working.
export const RATING_OPTIONS = [
  { value: 4.5, label: '4.5 stars and up' },
  { value: 4, label: '4 stars and up' },
  { value: 3.5, label: '3.5 stars and up' },
];

const toNumber = (value) => {
  if (value === null || value === '' || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * Single source of truth for listing state.
 *
 * Filter state lives in the URL, so /shop, /search and /category/:slug all share
 * one implementation and every filtered view is shareable and bookmarkable.
 */
export default function useProductFilters() {
  const [params, setParams] = useSearchParams();

  const filters = useMemo(
    () => ({
      q: params.get('q') ?? '',
      category: params.get('category') ?? '',
      sort: params.get('sort') ?? 'newest',
      min: toNumber(params.get('min')),
      max: toNumber(params.get('max')),
      inStock: params.get('inStock') === '1',
      rating: toNumber(params.get('rating')),
      page: Math.max(1, toNumber(params.get('page')) ?? 1),
    }),
    [params]
  );

  const activePriceBand = useMemo(
    () =>
      PRICE_BANDS.find(
        (band) => band.min === filters.min && band.max === filters.max
      )?.id ?? null,
    [filters.min, filters.max]
  );

  const commit = useCallback(
    (patch, { keepPage = false } = {}) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);

          for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === undefined || value === '' || value === false) {
              next.delete(key);
            } else if (key === 'inStock') {
              next.set('inStock', '1');
            } else {
              next.set(key, String(value));
            }
          }

          if (!keepPage && !('page' in patch)) next.delete('page');
          return next;
        },
        { replace: true }
      );
    },
    [setParams]
  );

  const setPage = useCallback((page) => commit({ page: page > 1 ? page : null }, { keepPage: true }), [commit]);

  const setPriceBand = useCallback(
    (bandId) => {
      const band = PRICE_BANDS.find((b) => b.id === bandId);
      commit({ min: band?.min ?? null, max: band?.max ?? null });
    },
    [commit]
  );

  const clearAll = useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        // Keep the query on /search, drop everything else.
        ['category', 'sort', 'min', 'max', 'inStock', 'rating', 'page'].forEach((k) =>
          next.delete(k)
        );
        return next;
      },
      { replace: true }
    );
  }, [setParams]);

  const activeCount =
    (filters.category ? 1 : 0) +
    (activePriceBand ? 1 : 0) +
    (filters.inStock ? 1 : 0) +
    (filters.rating ? 1 : 0);

  return {
    filters,
    activePriceBand,
    activeCount,
    sortOptions: SORT_OPTIONS,
    commit,
    setPage,
    setPriceBand,
    clearAll,
  };
}
