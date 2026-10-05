import { Minus, Plus } from 'lucide-react';

import { cx } from '../../utils/format.js';

/** Quantity control used on the product page and in the cart. */
export default function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 20,
  size = 'md',
  disabled = false,
  className,
  label = 'Quantity',
}) {
  const height = size === 'sm' ? 'h-9' : 'h-11';
  const button = `grid ${size === 'sm' ? 'size-8' : 'size-10'} shrink-0 place-items-center text-ink transition-colors duration-150 hover:bg-canvas disabled:pointer-events-none disabled:opacity-30`;

  return (
    <div
      className={cx(
        'inline-flex items-center rounded-full border border-line bg-paper',
        height,
        className
      )}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        aria-label={`Decrease ${label.toLowerCase()}`}
        className={cx(button, 'rounded-l-full')}
      >
        <Minus className="size-4" strokeWidth={1.8} aria-hidden />
      </button>

      <span
        className="tnum min-w-8 text-center text-sm font-medium"
        aria-live="polite"
        aria-label={label}
      >
        {value}
      </span>

      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        aria-label={`Increase ${label.toLowerCase()}`}
        className={cx(button, 'rounded-r-full')}
      >
        <Plus className="size-4" strokeWidth={1.8} aria-hidden />
      </button>
    </div>
  );
}
