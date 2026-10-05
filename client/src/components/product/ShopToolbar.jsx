import { useEffect, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';

import Select from '../ui/Select.jsx';
import { cx, formatNumber } from '../../utils/format.js';

/**
 * Listing toolbar with the reference's chip-filter row.
 *
 * The chips are pure conveniences that map onto sort keys and flags the server
 * already supports — `inStock` and the four `sort` values. There is no
 * "shipping from" or "profit margin" chip here on purpose: the API exposes no
 * such filter, and inventing a client-side approximation would silently lie
 * about what the result set contains. Those belong in admin, where the fields
 * exist.
 */
export default function ShopToolbar({
  filters,
  categories,
  sortOptions,
  activeCount,
  onChange,
  onOpenFilters,
  resultCount,
  loading,
  showSearch = true,
}) {
  const [term, setTerm] = useState(filters.q);

  // Keep the input in sync when the URL changes from elsewhere (nav, clear).
  useEffect(() => {
    setTerm(filters.q);
  }, [filters.q]);

  // Debounce so typing doesn't push a history entry per keystroke.
  useEffect(() => {
    if (term === filters.q) return undefined;
    const timer = setTimeout(() => onChange({ q: term || null }), 320);
    return () => clearTimeout(timer);
  }, [term, filters.q, onChange]);

  const chips = [
    { id: 'all', label: 'All products', active: !filters.sort && filters.inStock !== true, onClick: () => onChange({ sort: null, inStock: null }) },
    { id: 'new', label: 'New arrivals', active: filters.sort === 'newest', onClick: () => onChange({ sort: 'newest' }) },
    { id: 'popular', label: 'Most popular', active: filters.sort === 'popular', onClick: () => onChange({ sort: 'popular' }) },
    { id: 'value', label: 'Best value', active: filters.sort === 'price-asc', onClick: () => onChange({ sort: 'price-asc' }) },
    {
      id: 'instock',
      label: 'In stock',
      active: filters.inStock === true,
      onClick: () => onChange({ inStock: filters.inStock === true ? null : true }),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Chip row. */}
      <div className="no-scrollbar -mx-6 flex gap-2 overflow-x-auto px-6 md:mx-0 md:px-0">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={chip.onClick}
            aria-pressed={chip.active}
            className={cx(
              'shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition',
              chip.active
                ? 'bg-brand-gradient text-white shadow-glow-blue'
                : 'border border-line bg-paper text-muted hover:border-mh-blue hover:text-ink'
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {showSearch ? (
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted"
              strokeWidth={1.6}
              aria-hidden
            />
            <input
              type="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search products or SKU"
              aria-label="Search products"
              className="h-11 w-full rounded-full border border-line bg-paper pr-10 pl-10 text-sm transition focus:border-mh-blue focus:ring-2 focus:ring-mh-blue/15 focus:outline-none"
            />
            {term ? (
              <button
                type="button"
                onClick={() => setTerm('')}
                aria-label="Clear search"
                className="absolute top-1/2 right-2.5 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted transition hover:bg-surface-muted hover:text-ink"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          {/* Category is reachable from the toolbar on every size, so the filter
              panel is never the only way to change it on mobile. */}
          <Select
            aria-label="Category"
            value={filters.category}
            onChange={(e) => onChange({ category: e.target.value || null })}
            className="min-w-0 flex-1 rounded-full lg:w-52 lg:flex-none"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.name}
              </option>
            ))}
          </Select>

          {/* Below `lg` the toolbar row has no room for a third control without
              truncating the category value, so sorting moves into the filter
              sheet instead (see ProductListing). */}
          <Select
            aria-label="Sort by"
            value={filters.sort}
            onChange={(e) => onChange({ sort: e.target.value })}
            className="hidden min-w-0 lg:block lg:w-48 lg:flex-none"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>

          <button
            type="button"
            onClick={onOpenFilters}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-line px-4 text-[13px] font-medium transition hover:border-mh-blue lg:hidden"
          >
            <SlidersHorizontal className="size-4" strokeWidth={1.6} aria-hidden />
            Filters
            {activeCount > 0 ? (
              <span className="tnum grid size-5 place-items-center rounded-full bg-brand-gradient text-[10px] text-white">
                {activeCount}
              </span>
            ) : null}
          </button>
        </div>

        <p
          className="t-caption shrink-0 text-muted lg:ml-auto lg:w-28 lg:text-right"
          aria-live="polite"
        >
          {loading ? 'Loading…' : `${formatNumber(resultCount)} ${resultCount === 1 ? 'item' : 'items'}`}
        </p>
      </div>
    </div>
  );
}