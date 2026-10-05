import { Star } from 'lucide-react';

import { cx } from '../../utils/format.js';

/**
 * Star rating with fractional fill. Decorative stars are aria-hidden; the
 * accessible value lives on the wrapper.
 */
export default function Rating({
  value = 0,
  count,
  size = 14,
  showValue = false,
  className,
}) {
  const clamped = Math.max(0, Math.min(5, Number(value) || 0));
  const percent = (clamped / 5) * 100;

  return (
    <span
      className={cx('inline-flex items-center gap-1.5', className)}
      role="img"
      aria-label={
        count !== undefined
          ? `Rated ${clamped.toFixed(1)} out of 5 from ${count} reviews`
          : `Rated ${clamped.toFixed(1)} out of 5`
      }
    >
      <span
        className="relative inline-flex"
        style={{ width: size * 5, height: size }}
        aria-hidden
      >
        <span className="absolute inset-0 flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              style={{ width: size, height: size }}
              className="text-line-strong"
              strokeWidth={1.5}
            />
          ))}
        </span>
        <span
          className="absolute inset-0 flex overflow-hidden"
          style={{ width: `${percent}%` }}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              style={{ width: size, height: size, minWidth: size }}
              className="shrink-0 fill-ink text-ink"
              strokeWidth={1.5}
            />
          ))}
        </span>
      </span>

      {showValue ? (
        <span className="t-caption tnum text-muted">{clamped.toFixed(1)}</span>
      ) : null}
      {count !== undefined ? (
        <span className="t-caption tnum text-muted">({count.toLocaleString()})</span>
      ) : null}
    </span>
  );
}
