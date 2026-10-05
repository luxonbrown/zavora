import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, ExternalLink, Truck } from 'lucide-react';
import { toast } from 'sonner';

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
import { formatDate } from '../../utils/format.js';

const copy = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Tracking number copied');
  } catch {
    toast.error('Could not copy', { description: text });
  }
};

export default function OrderTracking() {
  const { orderNumber } = useParams();
  const order = useAsync(() => ordersService.getByNumber(orderNumber), [orderNumber]);

  useEffect(() => {
    document.title = `Tracking ${orderNumber} — MARKETHUB`;
  }, [orderNumber]);

  if (order.loading && !order.data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56 rounded-full" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  if (!order.data) {
    return (
      <EmptyState
        title="Order not found"
        description={`No order matches ${orderNumber}.`}
        action="Back to my orders"
        actionTo="/account/orders"
      />
    );
  }

  const data = order.data;
  const status = getStatus(data.status);
  const country = getCountry(data.country);

  return (
    <div>
      <Link
        to={`/account/orders/${data.orderNumber}`}
        className="t-small inline-flex items-center gap-1.5 text-muted transition-colors duration-150 hover:text-ink"
      >
        <ArrowLeft className="size-4" strokeWidth={1.8} aria-hidden />
        Order {data.orderNumber}
      </Link>

      <header className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="h3-sub">Tracking</h1>
          <p className="t-small mt-2 text-muted">
            {data.itemCount} {data.itemCount === 1 ? 'item' : 'items'} · to {country.name}
          </p>
        </div>
        <Badge tone={TONE_BY_STATUS[data.status] ?? 'neutral'} size="md">
          {status.label}
        </Badge>
      </header>

      {/* Carrier panel */}
      <div className="mt-8 rounded-card border border-line p-6">
        {data.trackingNumber ? (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-muted text-ink">
                <Truck className="size-5" strokeWidth={1.6} aria-hidden />
              </span>
              <div>
                <p className="t-title">{data.carrier?.name ?? 'Carrier'}</p>
                <p className="tnum t-small mt-1.5">{data.trackingNumber}</p>
                {data.estimatedDeliveryAt ? (
                  <p className="t-small mt-2 text-muted">
                    Estimated delivery{' '}
                    <span className="text-ink">{formatDate(data.estimatedDeliveryAt)}</span>
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline-dark"
                size="sm"
                iconLeft={<Copy className="size-3.5" strokeWidth={1.8} aria-hidden />}
                onClick={() => copy(data.trackingNumber)}
              >
                Copy
              </Button>
              {data.carrier?.trackingUrl ? (
                <a
                  href={data.carrier.trackingUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="t-small inline-flex h-8 items-center gap-1.5 rounded-full bg-ink px-4 font-medium text-paper transition-[transform,opacity] duration-150 hover:opacity-90"
                >
                  Carrier site
                  <ExternalLink className="size-3.5" strokeWidth={1.8} aria-hidden />
                </a>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-muted text-muted">
              <Truck className="size-5" strokeWidth={1.6} aria-hidden />
            </span>
            <div>
              <p className="t-title">Not shipped yet</p>
              <p className="t-small mt-1.5 text-muted">
                Your parcel is being prepared. The carrier and tracking number appear
                here as soon as it leaves the warehouse.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Vertical timeline */}
      <div className="mt-4 rounded-card border border-line p-6">
        <h2 className="t-title">Progress</h2>
        <OrderTimeline status={data.status} className="mt-6" />
      </div>
    </div>
  );
}