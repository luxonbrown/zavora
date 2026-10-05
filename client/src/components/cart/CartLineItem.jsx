import { Link } from 'react-router-dom';
import { BookmarkPlus, ShoppingBag, Trash2 } from 'lucide-react';

import QuantityStepper from '../ui/QuantityStepper.jsx';
import { cx, formatPrice } from '../../utils/format.js';

/**
 * One cart line. The whole row is not a link — only the image and title are,
 * so the quantity and remove controls don't fire navigation.
 */
export default function CartLineItem({
  line,
  onQuantityChange,
  onRemove,
  onSaveForLater,
  variant = 'cart',
}) {
  const saved = variant === 'saved';

  return (
    <li
      className={cx(
        'page-rise flex gap-4 py-6 sm:gap-5',
        !saved && 'border-b border-line'
      )}
    >
      <Link
        to={`/product/${line.slug}`}
        className="shrink-0 self-start overflow-hidden rounded-image bg-surface-muted"
      >
        <img
          src={line.image}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-24 object-cover sm:size-32"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="t-title leading-snug">
              <Link
                to={`/product/${line.slug}`}
                className="transition-colors duration-150 hover:text-muted"
              >
                {line.name}
              </Link>
            </h3>

            {line.variantLabel ? (
              <p className="t-caption mt-1 text-muted">{line.variantLabel}</p>
            ) : null}

            <p className="t-small tnum mt-1.5 font-medium">{formatPrice(line.price)}</p>
          </div>

          <div className="shrink-0 text-right">
            {/* Line total only — the unit price already sits under the title, so
                repeating it as "each" just printed the same figure twice. */}
            <p className="t-small tnum font-medium">
              {formatPrice(line.price * line.quantity)}
            </p>
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-3 pt-4">
          {saved ? (
            <>
              <button
                type="button"
                onClick={() => onSaveForLater(line.key)}
                className="t-small inline-flex items-center gap-1.5 font-medium text-ink transition-colors duration-150 hover:text-muted"
              >
                <ShoppingBag className="size-4" strokeWidth={1.6} aria-hidden />
                Move to cart
              </button>

              <button
                type="button"
                onClick={() => onRemove(line.key)}
                className="t-small inline-flex items-center gap-1.5 text-muted transition-colors duration-150 hover:text-ink"
              >
                <Trash2 className="size-4" strokeWidth={1.6} aria-hidden />
                Remove
              </button>
            </>
          ) : (
            <>
              <QuantityStepper
                value={line.quantity}
                onChange={(q) => onQuantityChange(line.key, q)}
                size="sm"
              />

              <button
                type="button"
                onClick={() => onSaveForLater(line.key)}
                className="t-small inline-flex items-center gap-1.5 text-muted transition-colors duration-150 hover:text-ink"
              >
                <BookmarkPlus className="size-4" strokeWidth={1.6} aria-hidden />
                Save for later
              </button>

              <button
                type="button"
                onClick={() => onRemove(line.key)}
                className="t-small inline-flex items-center gap-1.5 text-muted transition-colors duration-150 hover:text-ink"
              >
                <Trash2 className="size-4" strokeWidth={1.6} aria-hidden />
                Remove
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}