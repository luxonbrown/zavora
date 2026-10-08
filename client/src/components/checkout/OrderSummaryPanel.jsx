import Button from '../ui/Button.jsx';
import Skeleton from '../ui/Skeleton.jsx';
import StatusDot from '../ui/StatusDot.jsx';
import { cx, formatPrice } from '../../utils/format.js';

function Row({ label, value, muted, hint }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="min-w-0">
        <span className={cx('text-[14px]', muted ? 'text-muted' : 'text-ink')}>{label}</span>
        {hint ? <span className="t-caption mt-0.5 block text-muted">{hint}</span> : null}
      </span>
      <span className={cx('tnum shrink-0 text-[14px]', muted && 'text-muted')}>{value}</span>
    </div>
  );
}

/**
 * Sticky order summary.
 *
 * Every figure here comes from the server-side quote — the browser never
 * supplies a price. `loading` marks a re-quote in flight (changing country or
 * shipping method), and the figures are replaced only when the server answers.
 */
export default function OrderSummaryPanel({
  quote,
  loading = false,
  error = null,
  onRetry,
  placing = false,
  children,
}) {
  return (
    <div className="rounded-card border border-line bg-paper p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="t-title">Order summary</h2>
        {loading ? (
          <span className="flex items-center gap-2">
            <StatusDot tone="warning" size="sm" pulse />
            <span className="t-caption text-muted">Updating…</span>
          </span>
        ) : null}
      </div>

      {/* Lines */}
      <div className="mt-5 space-y-4 border-t border-line pt-5">
        {loading && !quote ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-14 shrink-0 rounded-image" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-3/4 rounded-full" />
                <Skeleton className="h-3 w-1/3 rounded-full" />
              </div>
            </div>
          ))
        ) : quote ? (
          quote.lines.map((line) => (
            <div key={`${line.productId}-${line.variantId ?? 'default'}`} className="flex gap-3">
              <div className="relative shrink-0">
                <img
                  src={line.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="size-14 rounded-image bg-surface-muted object-cover"
                />
                <span className="tnum absolute -top-1.5 -right-1.5 grid min-w-5 place-items-center rounded-full bg-ink px-1 text-[10px] leading-4 font-medium text-paper">
                  {line.quantity}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="t-small truncate font-medium">{line.name}</p>
                {line.variantLabel ? (
                  <p className="t-caption truncate text-muted">{line.variantLabel}</p>
                ) : null}
              </div>

              <p className="t-small tnum shrink-0 font-medium">{formatPrice(line.lineTotal)}</p>
            </div>
          ))
        ) : null}
      </div>

      {/* Totals */}
      {quote ? (
        <div className="mt-6 space-y-3 border-t border-line pt-5">
          <Row label="Subtotal" value={formatPrice(quote.subtotal)} />
          <Row
            label="Shipping"
            hint={
              quote.shippingMethod
                ? quote.estimatedDeliveryAt
                  ? `${quote.shippingMethod.name} · arrives ${new Date(quote.estimatedDeliveryAt).toLocaleDateString()}`
                  : quote.shippingMethod.name
                : undefined
            }
            value={quote.shipping === 0 ? 'Free' : formatPrice(quote.shipping)}
            muted={quote.shipping === 0}
          />
          <Row
            label="Tax"
            hint={
              quote.taxRate
                ? `${(quote.taxRate * 100).toFixed(0)}% · included in the total`
                : 'No tax due for this destination'
            }
            value={quote.tax === 0 ? '—' : formatPrice(quote.tax)}
            muted={quote.tax === 0}
          />

          <div className="border-t border-line pt-4">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[15px] font-medium">
                Total <span className="t-caption ml-1 text-muted">{quote.currency}</span>
              </span>
              <span className="tnum text-[21px] font-medium tracking-[-0.015em]">
                {formatPrice(quote.total)}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-xl border border-danger/30 bg-danger/6 px-4 py-3">
          <p className="t-small text-danger">{error}</p>
          {onRetry ? (
            <Button variant="outline-dark" size="sm" className="mt-3" onClick={onRetry}>
              Try again
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6">{children}</div>
    </div>
  );
}