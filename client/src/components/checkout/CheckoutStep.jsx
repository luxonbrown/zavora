import { Check, ChevronDown } from 'lucide-react';

import { cx } from '../../utils/format.js';

/**
 * One accordion step. Collapsed steps show a summary and an "Edit" affordance,
 * so the customer can always see what they already entered without expanding
 * everything again.
 */
export default function CheckoutStep({
  index,
  title,
  summary,
  open,
  complete,
  onToggle,
  children,
}) {
  return (
    <section
      className={cx(
        'border-b border-line transition-colors duration-200',
        open && 'bg-canvas'
      )}
    >
      <div className="flex items-center gap-4 px-5 py-5 sm:px-7">
        <span
          className={cx(
            'grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-medium transition-colors duration-200',
            complete
              ? 'bg-ink text-paper'
              : open
                ? 'border border-ink text-ink'
                : 'border border-line-strong text-muted'
          )}
        >
          {complete ? <Check className="size-3.5" strokeWidth={2.6} aria-hidden /> : index}
        </span>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center justify-between gap-4 text-left"
        >
          <span className="min-w-0">
            <span className="block text-[15px] font-medium">{title}</span>
            {summary && !open ? (
              <span className="t-small mt-0.5 block truncate text-muted">{summary}</span>
            ) : null}
          </span>

          <ChevronDown
            className={cx(
              'size-4 shrink-0 text-muted transition-transform duration-200',
              open && 'rotate-180'
            )}
            strokeWidth={1.8}
            aria-hidden
          />
        </button>
      </div>

      {open ? <div className="page-rise px-5 pt-1 pb-7 sm:px-7">{children}</div> : null}
    </section>
  );
}