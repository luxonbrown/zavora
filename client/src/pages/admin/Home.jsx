import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, Package, RefreshCw, ShoppingCart, TrendingUp, Users } from 'lucide-react';

import PageHeader from '../../components/layout/PageHeader.jsx';
import OrderStatusBadge from '../../components/admin/OrderStatusBadge.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import useAsync from '../../hooks/useAsync.js';
import adminService from '../../services/admin.js';
import { formatPrice, formatNumber, formatDate, cx } from '../../utils/format.js';

/** One headline figure. */
function Kpi({ label, value, hint, icon: Icon, accent }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="t-caption text-muted">{label}</p>
        <Icon
          className={cx('size-4 shrink-0', accent ? 'text-brand' : 'text-muted')}
          strokeWidth={1.6}
          aria-hidden
        />
      </div>
      <p className="tnum mt-3 text-[26px] leading-none font-medium text-ink">{value}</p>
      {hint ? <p className="mt-2 text-[12px] text-muted">{hint}</p> : null}
    </div>
  );
}

export default function AdminHome() {
  const overview = useAsync(() => adminService.overview(), []);
  const cj = useAsync(() => adminService.cjStatus(), []);

  if (overview.loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Loading the current position…" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[132px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[280px] rounded-xl" />
      </div>
    );
  }

  if (overview.error || !overview.data) {
    return (
      <EmptyState
        title="Could not load the dashboard"
        description={overview.error?.message ?? 'The admin API did not respond.'}
      />
    );
  }

  const d = overview.data;
  const byStatus = d.orders.byStatus ?? {};
  const openOrders = Object.entries(byStatus)
    .filter(([s]) => s !== 'delivered' && s !== 'cancelled')
    .reduce((n, [, v]) => n + v, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Catalogue, orders and supply at a glance."
        actions={
          <Link
            to="/admin/cj-sync"
            className="inline-flex h-9 items-center gap-2 rounded-full border border-line px-4 text-[13px] text-ink transition-colors duration-150 hover:bg-surface-muted"
          >
            <RefreshCw
              className={cx('size-3.5', cj.data?.running && 'animate-spin')}
              strokeWidth={1.7}
              aria-hidden
            />
            {cj.data?.running ? 'Syncing CJ…' : 'Sync CJ catalogue'}
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Revenue collected"
          value={formatPrice(d.revenue.collected)}
          hint={`${formatPrice(d.revenue.gross)} gross · ${formatPrice(d.revenue.refunded)} refunded`}
          icon={TrendingUp}
          accent
        />
        <Kpi
          label="Open orders"
          value={formatNumber(openOrders)}
          hint={`${formatNumber(d.orders.total)} lifetime · ${formatNumber(d.orders.delivered)} delivered`}
          icon={ShoppingCart}
        />
        <Kpi
          label="Live products"
          value={formatNumber(d.catalogue.activeProducts)}
          hint={`${formatNumber(d.catalogue.archivedProducts)} archived`}
          icon={Package}
        />
        <Kpi
          label="Customers"
          value={formatNumber(d.customers)}
          hint={`${formatNumber(d.catalogue.categories)} categories`}
          icon={Users}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-line bg-surface lg:col-span-2">
          <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
            <h2 className="text-[15px] font-medium text-ink">Recent orders</h2>
            <Link
              to="/admin/orders"
              className="inline-flex items-center gap-1 text-[13px] text-muted transition-colors duration-150 hover:text-ink"
            >
              View all
              <ArrowUpRight className="size-3.5" strokeWidth={1.7} aria-hidden />
            </Link>
          </header>

          {d.recentOrders.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-muted">No orders yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {d.recentOrders.map((o) => (
                <li key={o.orderNumber}>
                  <Link
                    to={`/admin/orders/${o.orderNumber}`}
                    className="flex items-center gap-4 px-5 py-3.5 transition-colors duration-150 hover:bg-surface-muted"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] text-ink">{o.orderNumber}</span>
                      <span className="block truncate text-[12px] text-muted">
                        {formatDate(o.placedAt)} · {o.itemCount} item{o.itemCount === 1 ? '' : 's'}
                        {o.destination ? ` · ${o.destination}` : ''}
                      </span>
                    </span>
                    <OrderStatusBadge status={o.status} />
                    <span className="tnum w-20 shrink-0 text-right text-[14px] text-ink">
                      {formatPrice(o.total)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          <section className="rounded-xl border border-line bg-surface">
            <header className="flex items-center gap-2 border-b border-line px-5 py-4">
              <AlertTriangle className="size-4 text-warning" strokeWidth={1.7} aria-hidden />
              <h2 className="text-[15px] font-medium text-ink">Low stock</h2>
            </header>
            {d.lowStock.length === 0 ? (
              <p className="px-5 py-10 text-center text-[13px] text-muted">Nothing is running low.</p>
            ) : (
              <ul className="divide-y divide-line">
                {d.lowStock.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{p.name}</span>
                    <span className={cx('tnum text-[13px]', p.stock === 0 ? 'text-danger' : 'text-warning')}>
                      {p.stock}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-line bg-surface">
            <header className="border-b border-line px-5 py-4">
              <h2 className="text-[15px] font-medium text-ink">Top categories</h2>
            </header>
            {d.topCategories.length === 0 ? (
              <p className="px-5 py-10 text-center text-[13px] text-muted">No categories yet.</p>
            ) : (
              <ul className="space-y-2.5 px-5 py-4">
                {d.topCategories.map((c) => {
                  const max = d.topCategories[0].productCount || 1;
                  return (
                    <li key={c.id}>
                      <Link to={`/admin/products?category=${encodeURIComponent(c.slug)}`} className="block">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-[13px] text-ink">{c.name}</span>
                          <span className="tnum shrink-0 text-[12px] text-muted">
                            {formatNumber(c.productCount)}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-muted">
                          <div
                            className="h-full rounded-full bg-brand"
                            style={{ width: `${Math.max(4, (c.productCount / max) * 100)}%` }}
                          />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      <p className="text-[12px] text-muted">
        {formatNumber(d.catalogue.activeProducts)} live products ·{' '}
        {formatNumber(d.catalogue.variants)} variants ·{' '}
        {formatNumber(d.catalogue.supplierRows)} supplier links
      </p>
    </div>
  );
}
