import { useEffect, useRef, useState } from 'react';
import { SearchX } from 'lucide-react';

import Container from '../layout/Container.jsx';
import ProductGrid from './ProductGrid.jsx';
import FilterPanel from './FilterPanel.jsx';
import ShopToolbar from './ShopToolbar.jsx';
import Pagination from '../ui/Pagination.jsx';
import Sheet from '../ui/Sheet.jsx';
import Select from '../ui/Select.jsx';
import Button from '../ui/Button.jsx';
import EmptyState, { ErrorState } from '../ui/EmptyState.jsx';
import useProductFilters from '../../hooks/useProductFilters.js';
import useAsync from '../../hooks/useAsync.js';
import productsService from '../../services/products.js';
import { formatNumber } from '../../utils/format.js';

const PAGE_SIZE = 8;

/**
 * The one listing implementation behind /shop, /search and /category/:slug.
 * Filter state lives in the URL, so each of those routes is a thin wrapper that
 * only decides its heading.
 */
export default function ProductListing({
  eyebrow,
  title,
  description,
  showSearch = true,
  lockedCategory = null,
  lockedCategoryName = null,
}) {
  const {
    filters,
    activePriceBand,
    activeCount,
    sortOptions,
    commit,
    setPage,
    setPriceBand,
    clearAll,
  } = useProductFilters();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const resultsRef = useRef(null);
  const lastSignature = useRef(null);

  const categories = useAsync(() => productsService.categories(), []);

  // A category page owns its category — it can't be changed by the filter UI.
  const effectiveCategory = lockedCategory ?? filters.category;

  const results = useAsync(
    () =>
      productsService.list({
        page: filters.page,
        pageSize: PAGE_SIZE,
        sort: filters.sort,
        q: filters.q || undefined,
        category: effectiveCategory || undefined,
        minPrice: filters.min ?? undefined,
        maxPrice: filters.max ?? undefined,
        inStock: filters.inStock || undefined,
        minRating: filters.rating ?? undefined,
      }),
    [
      filters.page,
      filters.sort,
      filters.q,
      effectiveCategory,
      filters.min,
      filters.max,
      filters.inStock,
      filters.rating,
    ]
  );

  // Bring the results back into view when the result set changes, so a filter
  // tweak on a long page doesn't leave the user looking at the wrong section.
  //
  // Compared against the previous signature rather than guarded by a
  // "first render" flag: React StrictMode double-invokes effects, so a boolean
  // guard is consumed by the first invocation and the second one scrolls on
  // mount, dumping the user past the heading and toolbar.
  const signature = [
    filters.page,
    filters.sort,
    filters.q,
    filters.min,
    filters.max,
    filters.inStock,
    filters.rating,
    effectiveCategory,
  ].join('|');

  useEffect(() => {
    if (lastSignature.current === null) {
      lastSignature.current = signature;
      return;
    }
    if (lastSignature.current === signature) return;
    lastSignature.current = signature;
    resultsRef.current?.scrollIntoView({ block: 'start' });
  }, [signature]);

  const panelProps = {
    filters: { ...filters, category: effectiveCategory },
    categories: categories.data ?? [],
    activePriceBand,
    activeCount,
    onChange: commit,
    onPriceBand: setPriceBand,
    onClear: clearAll,
  };

  const total = results.data?.total ?? 0;
  const heading = lockedCategoryName ?? title;

  return (
    <div className="bg-paper pt-28 pb-24 md:pt-32 md:pb-32">
      <Container>
        {/* Heading */}
        <header className="max-w-2xl">
          {eyebrow ? <p className="t-eyebrow">{eyebrow}</p> : null}
          <h1 className="h2-section mt-3 text-ink">{heading}</h1>
          {description ? <p className="t-body mt-4 text-muted">{description}</p> : null}
        </header>

        {/* Toolbar */}
        <div className="mt-10 border-y border-line py-4 md:mt-12">
          <ShopToolbar
            filters={{ ...filters, category: effectiveCategory }}
            categories={categories.data ?? []}
            sortOptions={sortOptions}
            activeCount={activeCount}
            onChange={commit}
            onOpenFilters={() => setFiltersOpen(true)}
            resultCount={total}
            loading={results.loading}
            showSearch={showSearch}
          />
        </div>

        {/* Body */}
        <div className="mt-10 lg:grid lg:grid-cols-[236px_1fr] lg:gap-12 xl:gap-16">
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <FilterPanel {...panelProps} />
            </div>
          </aside>

          <div ref={resultsRef} className="scroll-mt-24">
            {results.error ? (
              <ErrorState
                title="We couldn't load these products"
                description="Check your connection and try again."
                onRetry={results.reload}
              />
            ) : results.loading && !results.data ? (
              <ProductGrid loading skeletonCount={PAGE_SIZE} />
            ) : results.data?.items?.length ? (
              <>
                <ProductGrid products={results.data.items} />
                <Pagination
                  className="mt-14"
                  page={results.data.page}
                  totalPages={results.data.totalPages}
                  onPageChange={setPage}
                />
              </>
            ) : (
              <EmptyState
                icon={SearchX}
                title="No products found"
                description={
                  filters.q
                    ? `Nothing matches “${filters.q}”. Try a different search or clear your filters.`
                    : 'Nothing matches these filters yet. Try widening your selection.'
                }
                action={activeCount > 0 || filters.q ? 'Clear filters' : undefined}
                actionTo={activeCount > 0 || filters.q ? '/shop' : undefined}
              />
            )}
          </div>
        </div>
      </Container>

      {/* Mobile filters — bottom sheet, same panel as the sidebar */}
      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
        description={`${formatNumber(total)} ${total === 1 ? 'item' : 'items'}`}
        footer={
          <Button
            variant="primary-dark"
            size="lg"
            fullWidth
            onClick={() => setFiltersOpen(false)}
          >
            Show {formatNumber(total)} {total === 1 ? 'item' : 'items'}
          </Button>
        }
      >
        {/* Sort lives here below `lg` — the toolbar row has no space for it at
            narrow widths without truncating the category value. It sits above
            the filter groups because it is a more frequent control than any
            single facet. */}
        <div className="border-b border-line pb-5 lg:hidden">
          <label className="t-small mb-2 block font-medium" htmlFor="sheet-sort">
            Sort by
          </label>
          <Select
            id="sheet-sort"
            value={filters.sort}
            onChange={(e) => commit({ sort: e.target.value })}
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <FilterPanel {...panelProps} hideHeader />
      </Sheet>
    </div>
  );
}
