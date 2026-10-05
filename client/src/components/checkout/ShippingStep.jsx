import { ArrowLeft, Check } from 'lucide-react';

import Button from '../ui/Button.jsx';
import Skeleton from '../ui/Skeleton.jsx';
import { cx, formatPrice } from '../../utils/format.js';

/** Destination-calculated shipping options. */
export default function ShippingStep({
  methods,
  value,
  onChange,
  onContinue,
  onBack,
  loading,
  error,
  onRetry,
}) {
  return (
    <div>
      {loading && !methods?.length ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-card" />
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-danger/30 bg-danger/6 px-4 py-3">
          <p className="t-small text-danger">{error}</p>
          {onRetry ? (
            <Button variant="outline-dark" size="sm" className="mt-3" onClick={onRetry}>
              Try again
            </Button>
          ) : null}
        </div>
      ) : null}

      {methods?.length ? (
        <ul className="space-y-3" role="radiogroup" aria-label="Shipping method">
          {methods.map((method) => {
            const selected = value === method.id;
            return (
              <li key={method.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChange(method.id)}
                  className={cx(
                    'flex w-full items-center gap-4 rounded-card border px-5 py-4 text-left transition-colors duration-150',
                    selected ? 'border-ink bg-paper' : 'border-line hover:border-line-strong'
                  )}
                >
                  <span
                    className={cx(
                      'grid size-5 shrink-0 place-items-center rounded-full border transition-colors duration-150',
                      selected ? 'border-ink bg-ink text-paper' : 'border-line-strong'
                    )}
                  >
                    {selected ? (
                      <Check className="size-3" strokeWidth={3} aria-hidden />
                    ) : null}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium">{method.name}</span>
                    <span className="t-caption mt-0.5 block text-muted">
                      {method.description} · {method.minDays}–{method.maxDays} business days
                    </span>
                  </span>

                  <span className="t-small tnum shrink-0 font-medium">
                    {method.fee === 0 ? 'Free' : formatPrice(method.fee)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="mt-7 flex items-center justify-between gap-4">
        <Button
          variant="ghost-dark"
          size="lg"
          iconLeft={<ArrowLeft className="size-4" strokeWidth={1.8} aria-hidden />}
          onClick={onBack}
        >
          Back
        </Button>

        <Button
          variant="primary-dark"
          size="lg"
          onClick={onContinue}
          loading={loading}
          disabled={!value}
        >
          Continue to payment
        </Button>
      </div>
    </div>
  );
}