import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, Truck } from 'lucide-react';
import { toast } from 'sonner';

import PageHeader from '../../components/layout/PageHeader.jsx';
import OrderStatusBadge from '../../components/admin/OrderStatusBadge.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import useAsync from '../../hooks/useAsync.js';
import adminService from '../../services/admin.js';
import { getStatus } from '../../constants/orders.js';
import { formatPrice, formatDate, cx } from '../../utils/format.js';

/** Small labelled block for the detail grid. */
function Field({ label, value, className }) {
  return (
    <div className={className}>
      <p className="t-caption text-muted">{label}</p>
      <p className="mt-1 text-[14px] text-ink">{value}</p>
    </div>
  );
}

export default function AdminOrderDetails() {
  const { orderNumber } = useParams();
  const order = useAsync(() => adminService.order(orderNumber), [orderNumber]);

  const [carrier, setCarrier] = useState('');
  const [tracking, setTracking] = useState('');
  const [busy, setBusy] = useState(false);

  if (order.loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <Skeleton className="h-[220px] rounded-xl" />
        <Skeleton className="h-[280px] rounded-xl" />
      </div>
    );
  }

  if (order.error || !order.data) {
    return (
      <EmptyState
        title="Order not found"
        description={order.error?.message ?? `No order matches ${orderNumber}.`}
        action={
          <Link to="/admin/orders" className="text-[13px] text-ink underline underline-offset-2">
            Back to orders
          </Link>
        }
      />
    );
  }

  const o = order.data;
  const address = o.shippingAddress ?? {};

  /**
   * Status actions come from the SERVER's `allowedNext`, not from the shared
   * constants: only the server knows which moves are legal for this order's
   * current state, and duplicating that table on the client is how the two
   * drift apart.
   */
  const transitions = (o.allowedNext ?? []).filter((s) => s !== 'cancelled');

  const applyStatus = async (next) => {
    if (!tracking.trim() && ['shipped', 'in_transit', 'delivered'].includes(next)) {
      toast.error('A tracking number is required before marking an order as shipped.');
      return;
    }
    setBusy(true);
    try {
      await adminService.updateOrderStatus(o.orderNumber, {
        status: next,
        carrier: carrier.trim() || undefined,
        trackingNumber: tracking.trim() || undefined,
      });
      toast.success(`Order marked ${getStatus(next).label.toLowerCase()}`);
      // Re-read from the server rather than patching local state: the server
      // owns the lifecycle, so its answer is the only trustworthy next state.
      await order.reload();
    } catch (err) {
      toast.error(err.message ?? 'That status change was refused');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
     
    if (!window.confirm('Cancel this order? Stock is returned and any captured payment is refunded.')) return;
    setBusy(true);
    try {
      const result = await adminService.cancelOrder(o.orderNumber, { reason: 'cancelled from admin' });
      toast.success(
        `Order cancelled · ${result?.restockedLines ?? 0} line(s) restocked${result?.refunded ? ' · refunded' : ''}`
      );
      await order.reload();
    } catch (err) {
      toast.error(err.message ?? 'That order could not be cancelled');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link
        to="/admin/orders"
        className="inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors duration-150 hover:text-ink"
      >
        <ArrowLeft className="size-3.5" strokeWidth={1.7} aria-hidden />
        All orders
      </Link>

      <PageHeader
        title={o.orderNumber}
        description={`Placed ${formatDate(o.placedAt, { withTime: true })}`}
        actions={
          <>
            <OrderStatusBadge status={o.status} size="md" />
            {transitions.length ? (
              <Button variant="outline-dark" size="sm" onClick={cancel} disabled={busy}>
                <Ban className="size-3.5" strokeWidth={1.7} aria-hidden />
                Cancel order
              </Button>
            ) : null}
          </>
        }
      />

      {/* Fulfilment controls — only shown while the order is still moving. */}
      {transitions.length ? (
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="flex items-center gap-2 text-[15px] font-medium text-ink">
            <Truck className="size-4 text-muted" strokeWidth={1.7} aria-hidden />
            Fulfilment
          </h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder={o.carrier || 'Carrier (DHL, UPS…)'}
              aria-label="Carrier"
            />
            <Input
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder={o.trackingNumber || 'Tracking number'}
              aria-label="Tracking number"
            />
            <div className="flex flex-wrap gap-2 lg:col-span-2">
              {transitions.map((next) => (
                <Button
                  key={next}
                  size="sm"
                  disabled={busy}
                  onClick={() => applyStatus(next)}
                  title={`Move to ${getStatus(next).label}`}
                >
                  Mark {getStatus(next).short.toLowerCase()}
                </Button>
              ))}
            </div>
          </div>

          <p className="mt-3 text-[12px] text-muted">
            Only transitions the server permits are shown. Shipping without a tracking number is
            refused.
          </p>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-line bg-surface lg:col-span-2">
          <header className="border-b border-line px-5 py-4">
            <h2 className="text-[15px] font-medium text-ink">Items</h2>
          </header>
          <ul className="divide-y divide-line">
            {o.items.map((item, i) => (
              <li key={`${item.name}-${i}`} className="flex items-center gap-4 px-5 py-3.5">
                {item.image ? (
                  <img
                    src={item.image}
                    alt=""
                    className="size-12 shrink-0 rounded-lg object-cover"
                    loading="lazy"
                  />
                ) : null}
                <span className="min-w-0 flex-1">
                  {/* Snapshots, so this still renders if the product is gone. */}
                  <span className="block truncate text-[14px] text-ink">{item.name}</span>
                  <span className="block truncate text-[12px] text-muted">
                    {item.variantLabel ? `${item.variantLabel} · ` : ''}
                    {formatPrice(item.unitPrice)} × {item.quantity}
                  </span>
                </span>
                <span className="tnum shrink-0 text-[14px] text-ink">{formatPrice(item.lineTotal)}</span>
              </li>
            ))}
          </ul>

          <dl className="space-y-2 border-t border-line px-5 py-4 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="tnum text-ink">{formatPrice(o.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Shipping</dt>
              <dd className="tnum text-ink">{formatPrice(o.shippingAmount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Tax</dt>
              <dd className="tnum text-ink">{formatPrice(o.taxAmount)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-[15px]">
              <dt className="font-medium text-ink">Total</dt>
              <dd className="tnum font-medium text-ink">{formatPrice(o.total)}</dd>
            </div>
          </dl>

          {o.financials ? (
            <dl className="space-y-2 border-t border-line bg-surface-muted px-5 py-4 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-muted">Supplier cost</dt>
                <dd className="tnum text-ink">{formatPrice(o.financials.supplierCostTotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Supplier shipping</dt>
                <dd className="tnum text-ink">{formatPrice(o.financials.shippingCostTotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Payment fee</dt>
                <dd className="tnum text-ink">{formatPrice(o.financials.paymentFee)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Gross margin</dt>
                <dd className="tnum text-ink">{formatPrice(o.financials.grossMargin)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Operating margin</dt>
                <dd className="tnum text-ink">{formatPrice(o.financials.operatingMargin)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-2 font-medium">
                <dt className="text-ink">Estimated net profit</dt>
                <dd className="tnum text-ink">{formatPrice(o.financials.estimatedNetProfit)}</dd>
              </div>
            </dl>
          ) : null}
        </section>

        <div className="space-y-6">
          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="text-[15px] font-medium text-ink">Customer</h2>
            <div className="mt-3 space-y-3">
              <Field label="Email" value={<span className="break-all">{o.email}</span>} />
              <Field
                label="Ships to"
                value={
                  <>
                    {address.firstName} {address.lastName}
                    <br />
                    {address.address1}
                    {address.address2 ? `, ${address.address2}` : ''}
                    <br />
                    {address.city} {address.postalCode}, {address.country}
                  </>
                }
              />
              <Field label="Shipping method" value={o.shippingMethod} />
            </div>
          </section>

          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="text-[15px] font-medium text-ink">Payment &amp; tracking</h2>
            <div className="mt-3 space-y-3">
              <Field
                label="Payment"
                value={
                  <Badge
                    size="xs"
                    tone={o.payment?.status === 'captured' ? 'success' : o.payment?.status === 'refunded' ? 'neutral' : 'warning'}
                  >
                    {o.payment?.status ?? o.paymentStatus}
                  </Badge>
                }
              />
              {o.payment?.cardLast4 ? (
                <Field label="Card" value={`•••• ${o.payment.cardLast4}`} />
              ) : null}
              <Field label="Carrier" value={o.carrier || '—'} />
              <Field
                label="Tracking"
                value={<span className="break-all">{o.trackingNumber || '—'}</span>}
              />
              {o.estimatedDeliveryAt ? (
                <Field label="Estimated delivery" value={formatDate(o.estimatedDeliveryAt)} />
              ) : null}
            </div>
          </section>

          {o.shipments?.length ? (
            <section className="rounded-xl border border-line bg-surface">
              <header className="border-b border-line px-5 py-4">
                <h2 className="text-[15px] font-medium text-ink">Shipment history</h2>
              </header>
              <ul className="divide-y divide-line">
                {o.shipments.map((s, i) => (
                  <li key={`${s.trackingNumber}-${i}`} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="break-all text-[13px] text-ink">{s.trackingNumber}</span>
                      <Badge size="xs" tone="outline">
                        {s.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[12px] text-muted">
                      {s.carrier} · updated {formatDate(s.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
