import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PackageSearch, Search } from 'lucide-react';

import Container from '../../components/layout/Container.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import OrderTimeline from '../../components/account/OrderTimeline.jsx';
import { TONE_BY_STATUS } from '../../components/account/OrderCard.jsx';
import Badge from '../../components/ui/Badge.jsx';
import ordersService from '../../services/orders.js';
import { getStatus } from '../../constants/orders.js';
import { getCountry } from '../../services/shipping.js';
import { formatDate, formatPrice } from '../../utils/format.js';

/**
 * Public order lookup: order number + email. Both are required so an order
 * cannot be probed by number alone.
 */
export default function TrackOrder() {
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState({});
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    document.title = 'Track your order — MARKETHUB';
  }, []);

  const submit = async (event) => {
    event.preventDefault();

    const nextErrors = {};
    if (!orderNumber.trim()) nextErrors.orderNumber = 'Enter your order number.';
    if (!email.trim()) nextErrors.email = 'Enter the email used on the order.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    try {
      const found = await ordersService.getByNumber(orderNumber, { email });
      setOrder(found);
      setSearched(true);
    } catch {
      setOrder(null);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const status = order ? getStatus(order.status) : null;
  const country = order ? getCountry(order.country) : null;

  return (
    <div className="bg-paper pt-28 pb-24 md:pt-32 md:pb-32">
      <Container size="narrow">
        <header>
          <p className="t-eyebrow">Order tracking</p>
          <h1 className="h2-section mt-3">Where is my order?</h1>
          <p className="t-body mt-4 text-muted">
            Enter your order number and the email you used at checkout. You will find
            the order number in your confirmation email.
          </p>
        </header>

        <form onSubmit={submit} noValidate className="mt-10 rounded-card border border-line p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Order number"
              name="orderNumber"
              placeholder="ZV-8KQ2M1-447"
              value={orderNumber}
              error={errors.orderNumber}
              onChange={(e) => {
                setOrderNumber(e.target.value);
                setErrors((p) => ({ ...p, orderNumber: undefined }));
              }}
            />
            <Input
              label="Email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              error={errors.email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors((p) => ({ ...p, email: undefined }));
              }}
            />
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              type="submit"
              variant="primary-dark"
              size="lg"
              loading={loading}
              iconLeft={<Search className="size-4" strokeWidth={1.8} aria-hidden />}
            >
              Track order
            </Button>
          </div>
        </form>

        {searched && !order ? (
          <div className="mt-6">
            <EmptyState
              icon={PackageSearch}
              title="No matching order"
              description="Check the order number and email match the order exactly as they appear in your confirmation."
              compact
            />
          </div>
        ) : null}

        {order ? (
          <div className="page-rise mt-6 space-y-4">
            <div className="rounded-card border border-line p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="t-caption text-muted">Order</p>
                  <p className="t-title tnum mt-1">{order.orderNumber}</p>
                  <p className="t-small mt-1.5 text-muted">
                    Placed {formatDate(order.placedAt)} · {order.itemCount}{' '}
                    {order.itemCount === 1 ? 'item' : 'items'} · {country.name}
                  </p>
                </div>
                <Badge tone={TONE_BY_STATUS[order.status] ?? 'neutral'} size="md">
                  {status.label}
                </Badge>
              </div>

              {order.trackingNumber ? (
                <div className="mt-5 rounded-xl bg-canvas px-4 py-3.5">
                  <p className="t-caption text-muted">{order.carrier?.name ?? 'Carrier'}</p>
                  <p className="tnum t-small mt-1 font-medium">{order.trackingNumber}</p>
                  {order.estimatedDeliveryAt ? (
                    <p className="t-caption mt-1.5 text-muted">
                      Estimated delivery {formatDate(order.estimatedDeliveryAt)}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="rounded-card border border-line p-6">
              <h2 className="t-title">Progress</h2>
              <OrderTimeline status={order.status} className="mt-6" />
            </div>

            <div className="rounded-card border border-line px-6 py-2">
              <h2 className="t-title py-5">Items</h2>
              <ul className="divide-y divide-line">
                {order.lines.map((line, i) => (
                  <li key={`${line.productId}-${i}`} className="flex items-center gap-4 py-4">
                    <img
                      src={line.image}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="size-14 shrink-0 rounded-image bg-surface-muted object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="t-small font-medium">{line.name}</p>
                      <p className="t-caption mt-1 text-muted">
                        {line.variantLabel ? `${line.variantLabel} · ` : ''}
                        {line.quantity} × {formatPrice(line.unitPrice)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <p className="t-small text-muted">
              Need more help?{' '}
              <Link to="/contact" className="text-ink underline underline-offset-4">
                Contact support
              </Link>{' '}
              with your order number.
            </p>
          </div>
        ) : null}
      </Container>
    </div>
  );
}