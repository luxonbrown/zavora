import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

import Badge from '../ui/Badge.jsx';
import { getStatus } from '../../constants/orders.js';
import { formatDate, formatPrice } from '../../utils/format.js';

const TONE_BY_STATUS = {
  placed: 'neutral',
  payment_confirmed: 'info',
  processing: 'warning',
  shipped: 'info',
  in_transit: 'info',
  delivered: 'success',
};

/** One row in an order list.
 *
 *  GET /api/orders deliberately returns a *summary* row (thumbnail, itemCount,
 *  no line items) while GET /api/orders/:orderNumber returns full `lines`.
 *  This component is used in both places, so it must cope with `lines` being
 *  absent — reading `order.lines.slice()` unconditionally threw a TypeError and
 *  took down the whole account page.
 */
export default function OrderCard({ order, showTracking = false }) {
  const status = getStatus(order.status);

  // Detail payload has lines; the list payload does not. Never assume either.
  const lines = Array.isArray(order.lines) ? order.lines : [];
  const names = lines.map((l) => l.name).filter(Boolean);
  const preview = names.join(', ');
  const extra = Math.max(0, lines.length - 3);

  return (
    <li className="border-b border-line last:border-b-0">
      <Link
        to={`/account/orders/${order.orderNumber}`}
        className="group flex flex-col gap-4 py-5 transition-colors duration-150 hover:bg-canvas sm:flex-row sm:items-center sm:gap-6 sm:px-4 sm:-mx-4 sm:rounded-xl"
      >
        {/* Thumbnails — fall back to the summary thumbnail when there are no lines. */}
        <div className="flex shrink-0 -space-x-3">
          {lines.length > 0 ? (
            lines.slice(0, 3).map((line, i) => (
              <img
                key={`${line.productId ?? line.name ?? i}-${i}`}
                src={line.image}
                alt=""
                loading="lazy"
                decoding="async"
                className="size-14 rounded-xl border-2 border-paper bg-surface-muted object-cover"
              />
            ))
          ) : order.thumbnail ? (
            <img
              src={order.thumbnail}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-14 rounded-xl border-2 border-paper bg-surface-muted object-cover"
            />
          ) : (
            <span className="grid size-14 place-items-center rounded-xl border-2 border-paper bg-surface-muted text-[11px] text-muted">
              —
            </span>
          )}
          {extra > 0 ? (
            <span className="grid size-14 place-items-center rounded-xl border-2 border-paper bg-surface-muted text-[13px] font-medium text-muted">
              +{extra}
            </span>
          ) : null}
        </div>

        {/* Meta */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <p className="t-small tnum font-medium">{order.orderNumber}</p>
            <Badge tone={TONE_BY_STATUS[order.status] ?? 'neutral'} size="xs">
              {status.short}
            </Badge>
          </div>

          <p className="t-caption mt-1 text-muted">
            {formatDate(order.placedAt)} · {order.itemCount}{' '}
            {order.itemCount === 1 ? 'item' : 'items'}
            {showTracking && order.trackingNumber ? (
              <>
                {' · '}
                <span className="tnum">{order.trackingNumber}</span>
              </>
            ) : null}
          </p>

          {preview ? (
            <p className="t-small mt-1 truncate text-muted">{preview}</p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-4 sm:justify-end">
          <p className="t-small tnum shrink-0 font-medium">{formatPrice(order.total)}</p>
          <ChevronRight
            className="size-4 shrink-0 text-muted transition-transform duration-150 group-hover:translate-x-0.5"
            strokeWidth={1.8}
            aria-hidden
          />
        </div>
      </Link>
    </li>
  );
}

export { TONE_BY_STATUS };