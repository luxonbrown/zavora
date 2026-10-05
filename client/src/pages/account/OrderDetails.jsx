import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, MapPin, Package, Truck } from 'lucide-react';

import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import OrderTimeline from '../../components/account/OrderTimeline.jsx';
import { TONE_BY_STATUS } from '../../components/account/OrderCard.jsx';
import useAsync from '../../hooks/useAsync.js';
import ordersService from '../../services/orders.js';
import { getStatus } from '../../constants/orders.js';
import { getCountry } from '../../services/shipping.js';
import { formatDate, formatPrice } from '../../utils/format.js';

function Detail({ title, children, action }) {
  return (
    <section className="border-t border-line py-6 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-4">
        <h2 className="t-title">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function OrderDetails() {
  const { orderNumber } = useParams();
  const order = useAsync(() => ordersService.getByNumber(orderNumber), [orderNumber]);

  useEffect(() => {
    if (order.data) document.title = `${order.data.orderNumber} — MARKETHUB`;
  }, [order.data]);

  if (order.loading && !order.data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56 rounded-full" />
        <Skeleton className="h-40 w-full rounded-card" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  if (order.error) {
    return (
      <EmptyState
        title="We couldn't load this order"
        description="Please try again in a moment."
        onRetry={order.reload}
      />
    );
  }

  if (!order.data) {
    return (
      <div>
        <EmptyState
          icon={Package}
          title="Order not found"
          description={`We couldn't find an order matching ${orderNumber}. Check the number, or track it with your email address.`}
          action="Back to my orders"
          actionTo="/account/orders"
        />
      </div>
    );
  }

  const data = order.data;
  const status = getStatus(data.status);
  const country = getCountry(data.country);

  return (
    <div>
      <Link
        to="/account/orders"
        className="t-small inline-flex items-center gap-1.5 text-muted transition-colors duration-150 hover:text-ink"
      >
        <ArrowLeft className="size-4" strokeWidth={1.8} aria-hidden />
        My orders
      </Link>

      <header className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="h3-sub tnum">{data.orderNumber}</h1>
          <p className="t-small mt-2 text-muted">
            Placed {formatDate(data.placedAt, { withTime: true })}
          </p>
        </div>
        <Badge tone={TONE_BY_STATUS[data.status] ?? 'neutral'} size="md">
          {status.label}
        </Badge>
      </header>

      {/* Timeline */}
      <div className="mt-8 rounded-card border border-line p-6">
        <OrderTimeline status={data.status} orientation="horizontal" className="mb-2" />
      </div>

      {/* Tracking */}
      <div className="mt-4 rounded-card border border-line p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-muted text-ink">
              <Truck className="size-[18px]" strokeWidth={1.6} aria-hidden />
            </span>
            <div>
              <p className="t-title">
                {data.trackingNumber ? 'Tracking available' : 'Preparing your parcel'}
              </p>
              {data.trackingNumber ? (
                <>
                  <p className="t-small mt-1 text-muted">
                    {data.carrier?.name} ·{' '}
                    <span className="tnum">{data.trackingNumber}</span>
                  </p>
                  {data.estimatedDeliveryAt ? (
                    <p className="t-small mt-1 text-muted">
                      Estimated delivery{' '}
                      <span className="text-ink">{formatDate(data.estimatedDeliveryAt)}</span>
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="t-small mt-1 text-muted">
                  A carrier and tracking number are issued as soon as it ships.
                </p>
              )}
            </div>
          </div>

          {data.trackingNumber && data.carrier?.trackingUrl ? (
            <a
              href={data.carrier.trackingUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="t-small inline-flex items-center gap-1.5 font-medium text-ink underline underline-offset-4"
            >
              Track with {data.carrier.name}
              <ExternalLink className="size-3.5" strokeWidth={1.8} aria-hidden />
            </a>
          ) : null}
        </div>
      </div>

      {/* Items */}
      <div className="mt-4 rounded-card border border-line px-6 py-2">
        <Detail title={`Items (${data.itemCount})`}>
          <ul className="divide-y divide-line">
            {data.lines.map((line, i) => (
              <li key={`${line.productId}-${i}`} className="flex items-center gap-4 py-4">
                <img
                  src={line.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="size-16 shrink-0 rounded-image bg-surface-muted object-cover"
                />
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/product/${line.slug}`}
                    className="t-small font-medium transition-colors duration-150 hover:text-muted"
                  >
                    {line.name}
                  </Link>
                  <p className="t-caption mt-1 text-muted">
                    {line.variantLabel ? `${line.variantLabel} · ` : ''}
                    {line.quantity} × {formatPrice(line.unitPrice)}
                  </p>
                </div>
                <p className="t-small tnum shrink-0 font-medium">{formatPrice(line.lineTotal)}</p>
              </li>
            ))}
          </ul>
        </Detail>

        <Detail title="Totals">
          <dl className="ml-auto max-w-xs space-y-2.5">
            <div className="flex justify-between gap-4">
              <dt className="t-small text-muted">Subtotal</dt>
              <dd className="t-small tnum">{formatPrice(data.subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="t-small text-muted">
                Shipping · {data.shippingMethodName}
              </dt>
              <dd className="t-small tnum">
                {data.shipping === 0 ? 'Free' : formatPrice(data.shipping)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="t-small text-muted">
                Tax {data.taxRate ? `(${(data.taxRate * 100).toFixed(0)}%)` : ''}
              </dt>
              <dd className="t-small tnum">
                {data.tax === 0 ? '—' : formatPrice(data.tax)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-line pt-3">
              <dt className="text-[15px] font-medium">Total</dt>
              <dd className="tnum text-[17px] font-medium">{formatPrice(data.total)}</dd>
            </div>
          </dl>
        </Detail>

        <Detail title="Payment">
          <p className="t-small">
            {data.paymentStatus === 'paid' ? 'Paid' : 'Awaiting payment'} ·{' '}
            <span className="text-muted">{data.currency}</span>
          </p>
        </Detail>

        <Detail
          title="Shipping address"
          action={
            <Link
              to="/account/addresses"
              className="t-caption text-muted underline underline-offset-4 hover:text-ink"
            >
              Manage
            </Link>
          }
        >
          <p className="flex items-start gap-2 text-[14px] leading-relaxed">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted" strokeWidth={1.6} aria-hidden />
            <span>
              {country.name}
              <br />
              <span className="text-muted">Delivered to the address on this order</span>
            </span>
          </p>
        </Detail>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button to={`/account/orders/${data.orderNumber}/tracking`} variant="outline-dark" size="lg">
          View tracking
        </Button>
        <Button to="/contact" variant="ghost-dark" size="lg">
          Need help with this order?
        </Button>
      </div>
    </div>
  );
}