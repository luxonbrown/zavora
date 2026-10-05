import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cx } from '../../utils/format.js';

/** Build a compact page list with ellipses, e.g. 1 … 4 5 6 … 12 */
function pageWindow(current, total, span = 1) {
  const pages = new Set([1, total]);
  for (let i = current - span; i <= current + span; i++) {
    if (i >= 1 && i <= total) pages.add(i);
  }
  const sorted = [...pages].sort((a, b) => a - b);

  const out = [];
  let previous = 0;
  for (const page of sorted) {
    if (previous && page - previous > 1) out.push('gap');
    out.push(page);
    previous = page;
  }
  return out;
}

const navButton =
  'grid size-9 place-items-center rounded-full border border-line text-ink transition-colors duration-150 hover:border-ink disabled:pointer-events-none disabled:opacity-30';

export default function Pagination({ page, totalPages, onPageChange, className }) {
  if (!totalPages || totalPages <= 1) return null;

  const items = pageWindow(page, totalPages);

  return (
    <nav aria-label="Pagination" className={cx('flex items-center justify-center gap-1.5', className)}>
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
        className={navButton}
      >
        <ChevronLeft className="size-4" strokeWidth={1.8} aria-hidden />
      </button>

      {items.map((item, i) =>
        item === 'gap' ? (
          <span key={`gap-${i}`} className="t-small w-7 text-center text-muted" aria-hidden>
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            aria-label={`Page ${item}`}
            aria-current={item === page ? 'page' : undefined}
            className={cx(
              't-small tnum grid size-9 place-items-center rounded-full transition-colors duration-150',
              item === page
                ? 'bg-ink text-paper'
                : 'border border-line text-ink hover:border-ink'
            )}
          >
            {item}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next page"
        className={navButton}
      >
        <ChevronRight className="size-4" strokeWidth={1.8} aria-hidden />
      </button>
    </nav>
  );
}
