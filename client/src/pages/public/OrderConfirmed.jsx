import { Link, Navigate, useLocation } from 'react-router-dom';
import { Check, Mail, PackageCheck, Truck } from 'lucide-react';

import Container from '../../components/layout/Container.jsx';
import Button from '../../components/ui/Button.jsx';
import { formatDate, formatPrice } from '../../utils/format.js';

const TIMELINE = [
  { icon: Check, label: 'Order placed', detail: 'We have your order.' },
  { icon: Mail, label: 'Payment confirmed', detail: 'Receipt sent by email.' },
  { icon: PackageCheck, label: 'Processing', detail: 'Picked and packed.' },
  { icon: Truck, label: 'Shipped', detail: 'Tracking number issued.' },
];

/** Post-purchase confirmation. Reads the order from navigation state. */
export default function OrderConfirmed() {
  const { state } = useLocation();
  const order = state?.order;

  // Reached directly (refresh, bookmark) with no order in state.
  if (!order) return <Navigate to="/shop" replace />;

  const [minDays, maxDays] = order.estimatedDeliveryDays ?? [3, 6];
  const arrivesBy = new Date(Date.now() + maxDays * 86400000);

  return (
    <div className="bg-paper pt-28 pb-24 md:pt-32 md:pb-32">
      <Container size="narrow">
        <div className="text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-success/12 text-success">
            <Check className="size-6" strokeWidth={2} aria-hidden />
          </span>

          <p className="t-eyebrow mt-6">Order confirmed</p>
          <h1 className="h2-section mt-3">Thank you, your order is in.</h1>
          <p className="t-body mx-auto mt-4 max-w-lg text-muted">
            We have emailed a receipt to{' '}
            <span className="text-ink">{order.email}</span>. You will get a tracking
            number as soon as it ships.
          </p>
        </div>

        {/* Reference */}
        <div className="mt-12 rounded-card border border-line bg-paper p-6">
          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <p className="t-caption text-muted">Order number</p>
              <p className="t-title tnum mt-1">{order.orderNumber}</p>
            </div>
            <div>
              <p className="t-caption text-muted">Placed</p>
              <p className="t-title mt-1">{formatDate(order.placedAt, { withTime: true })}</p>
            </div>
            <div>
              <p className="t-caption text-muted">Total paid</p>
              <p className="t-title tnum mt-1">{formatPrice(order.total)}</p>
            </div>
          </div>

          <div className="mt-6 border-t border-line pt-5">
            <p className="t-caption text-muted">
              Estimated delivery to {order.countryName}
            </p>
            <p className="t-title mt-1">
              {minDays}–{maxDays} business days · by {formatDate(arrivesBy)}
            </p>
          </div>
        </div>

        {/* Timeline */}
        <ol className="mt-8">
          {TIMELINE.map(({ icon: Icon, label, detail }, i) => (
            <li key={label} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span
                  className={
                    i === 0
                      ? 'grid size-8 shrink-0 place-items-center rounded-full bg-ink text-paper'
                      : 'grid size-8 shrink-0 place-items-center rounded-full border border-line text-muted'
                  }
                >
                  <Icon className="size-4" strokeWidth={1.7} aria-hidden />
                </span>
                {i < TIMELINE.length - 1 ? (
                  <span className="my-1 w-px flex-1 bg-line" aria-hidden />
                ) : null}
              </div>

              <div className={i === 0 ? 'pb-6' : 'py-1 pb-6'}>
                <p className={i === 0 ? 't-title' : 't-small text-muted'}>{label}</p>
                <p className="t-caption mt-0.5 text-muted">{detail}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button to="/account/orders" variant="primary-dark" size="lg" className="flex-1">
            Track this order
          </Button>
          <Button to="/shop" variant="outline-dark" size="lg" className="flex-1">
            Continue shopping
          </Button>
        </div>

        <p className="t-caption mt-8 text-center text-muted">
          Need to change something?{' '}
          <Link to="/contact" className="underline underline-offset-4 hover:text-ink">
            Contact support
          </Link>{' '}
          within one hour of ordering.
        </p>
      </Container>
    </div>
  );
}