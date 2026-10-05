import { useId, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

import { PRICE_BANDS, RATING_OPTIONS } from '../../hooks/useProductFilters.js';
import { cx, formatNumber } from '../../utils/format.js';

/** Collapsible filter group. Open by default, chevron rotates. */
function FilterGroup({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className="border-b border-line py-5 first:pt-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="t-small font-medium">{title}</span>
        <ChevronDown
          className={cx(
            'size-4 shrink-0 text-muted transition-transform duration-200',
            open && 'rotate-180'
          )}
          strokeWidth={1.6}
          aria-hidden
        />
      </button>

      {open ? (
        <div id={panelId} className="mt-4">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Selectable pill used for price bands and minimum rating. */
function ChoicePill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        't-small rounded-full border px-3.5 py-2 transition-colors duration-150',
        active
          ? 'border-ink bg-ink text-paper'
          : 'border-line text-ink hover:border-ink'
      )}
    >
      {children}
    </button>
  );
}

/**
 * Shared filter surface. Rendered in the desktop sidebar and inside the mobile
 * bottom sheet, so the two can never drift apart.
 */
export default function FilterPanel({
  filters,
  categories = [],
  activePriceBand,
  activeCount,
  onChange,
  onPriceBand,
  onClear,
  hideHeader = false,
  className,
}) {
  return (
    <div className={cx('text-ink', className)}>
      {/* The sheet supplies its own "Filters" heading, so the panel header is
          suppressed there rather than repeating the same word twice. */}
      {hideHeader ? null : (
        <div className="flex items-center justify-between gap-3 pb-4">
          <p className="t-title">
            Filters
            {activeCount > 0 ? (
              <span className="t-caption ml-2 text-muted tnum">{activeCount} active</span>
            ) : null}
          </p>
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={onClear}
              className="t-caption text-muted underline underline-offset-4 transition-colors duration-150 hover:text-ink"
            >
              Clear all
            </button>
          ) : null}
        </div>
      )}

      {hideHeader && activeCount > 0 ? (
        <div className="flex justify-end pb-4">
          <button
            type="button"
            onClick={onClear}
            className="t-caption text-muted underline underline-offset-4 transition-colors duration-150 hover:text-ink"
          >
            Clear all ({activeCount})
          </button>
        </div>
      ) : null}

      <FilterGroup title="Category">
        <ul className="space-y-0.5">
          <li>
            <button
              type="button"
              onClick={() => onChange({ category: null })}
              className={cx(
                't-small flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left transition-colors duration-150',
                !filters.category ? 'bg-surface-muted font-medium' : 'hover:bg-canvas'
              )}
            >
              All categories
              {!filters.category ? <Check className="size-3.5" aria-hidden /> : null}
            </button>
          </li>
          {categories.map((category) => {
            const active = filters.category === category.slug;
            return (
              <li key={category.slug}>
                <button
                  type="button"
                  onClick={() => onChange({ category: active ? null : category.slug })}
                  className={cx(
                    't-small flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left transition-colors duration-150',
                    active ? 'bg-surface-muted font-medium' : 'hover:bg-canvas'
                  )}
                >
                  <span className="truncate">{category.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="t-caption tnum text-muted">
                      {formatNumber(category.productCount)}
                    </span>
                    {active ? <Check className="size-3.5" aria-hidden /> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </FilterGroup>

      <FilterGroup title="Price">
        <div className="flex flex-wrap gap-2">
          <ChoicePill active={!activePriceBand} onClick={() => onPriceBand(null)}>
            Any price
          </ChoicePill>
          {PRICE_BANDS.map((band) => (
            <ChoicePill
              key={band.id}
              active={activePriceBand === band.id}
              onClick={() => onPriceBand(band.id === activePriceBand ? null : band.id)}
            >
              {band.label}
            </ChoicePill>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Availability">
        <label className="flex cursor-pointer items-center gap-3 py-1">
          <input
            type="checkbox"
            checked={filters.inStock}
            onChange={(e) => onChange({ inStock: e.target.checked || null })}
            className="size-4 shrink-0 accent-ink"
          />
          <span className="t-small">In stock only</span>
        </label>
      </FilterGroup>

      <FilterGroup title="Rating" defaultOpen={false}>
        <div className="flex flex-wrap gap-2">
          <ChoicePill
            active={!filters.rating}
            onClick={() => onChange({ rating: null })}
          >
            Any rating
          </ChoicePill>
          {RATING_OPTIONS.map((option) => (
            <ChoicePill
              key={option.value}
              active={filters.rating === option.value}
              onClick={() =>
                onChange({ rating: filters.rating === option.value ? null : option.value })
              }
            >
              {option.label}
            </ChoicePill>
          ))}
        </div>
      </FilterGroup>
    </div>
  );
}
