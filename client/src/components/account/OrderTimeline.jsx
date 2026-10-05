import { Check } from 'lucide-react';

import { ORDER_STATUSES, statusIndex } from '../../constants/orders.js';
import { cx } from '../../utils/format.js';

/** Vertical order lifecycle. Steps after the current one are muted. */
export default function OrderTimeline({ status, orientation = 'vertical', className }) {
  const current = statusIndex(status);
  const horizontal = orientation === 'horizontal';

  return (
    <ol
      className={cx(
        horizontal
          ? 'flex flex-wrap items-start gap-x-2 gap-y-4'
          : 'flex flex-col',
        className
      )}
    >
      {ORDER_STATUSES.map((step, i) => {
        const done = i < current;
        const active = i === current;

        return (
          <li
            key={step.id}
            className={cx(
              horizontal ? 'flex min-w-[104px] flex-1 flex-col' : 'flex gap-4'
            )}
          >
            {/* Marker + connector */}
            <div className={cx(horizontal ? 'flex w-full items-center' : 'flex flex-col items-center')}>
              <span
                className={cx(
                  'grid size-6 shrink-0 place-items-center rounded-full border transition-colors duration-200',
                  done && 'border-ink bg-ink text-paper',
                  active && 'border-ink bg-paper text-ink',
                  !done && !active && 'border-line-strong bg-paper text-muted'
                )}
              >
                {done ? (
                  <Check className="size-3.5" strokeWidth={3} aria-hidden />
                ) : (
                  <span
                    className={cx(
                      'size-1.5 rounded-full',
                      active ? 'bg-ink' : 'bg-line-strong'
                    )}
                  />
                )}
              </span>

              {!horizontal && i < ORDER_STATUSES.length - 1 ? (
                <span
                  className={cx(
                    'my-1 w-px flex-1 transition-colors duration-200',
                    done ? 'bg-ink' : 'bg-line'
                  )}
                  aria-hidden
                />
              ) : null}

              {horizontal && i < ORDER_STATUSES.length - 1 ? (
                <span
                  className={cx(
                    'mx-1 h-px flex-1 transition-colors duration-200',
                    done ? 'bg-ink' : 'bg-line'
                  )}
                  aria-hidden
                />
              ) : null}
            </div>

            {/* Label */}
            <div className={cx(horizontal ? 'mt-2' : 'pb-5')}>
              <p
                className={cx(
                  'text-[13px] leading-tight',
                  active ? 'font-medium text-ink' : done ? 'text-ink' : 'text-muted'
                )}
              >
                {step.label}
              </p>
              {active ? (
                <p className="t-caption mt-1 text-muted">Current status</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}