import { useEffect, useMemo, useState } from 'react';
import { PackageSearch } from 'lucide-react';

import EmptyState from '../../components/ui/EmptyState.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import OrderCard from '../../components/account/OrderCard.jsx';
import useAsync from '../../hooks/useAsync.js';
import ordersService from '../../services/orders.js';
import { isActive } from '../../constants/orders.js';
import { cx } from '../../utils/format.js';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'In progress' },
  { id: 'delivered', label: 'Delivered' },
];

export default function MyOrders() {
  const [filter, setFilter] = useState('all');
  const orders = useAsync(() => ordersService.list(), []);

  useEffect(() => {
    document.title = 'My orders — MARKETHUB';
  }, []);

  const filtered = useMemo(() => {
    // GET /api/orders returns a paginated envelope ({ ok, items }), not a bare array.
    const list = orders.data?.items ?? [];
    if (filter === 'active') return list.filter((o) => isActive(o.status));
    if (filter === 'delivered') return list.filter((o) => o.status === 'delivered');
    return list;
  }, [orders.data, filter]);

  return (
    <div>
      <header>
        <h1 className="h3-sub">My orders</h1>
        <p className="t-small mt-2 text-muted">
          {orders.loading
            ? 'Loading your orders…'
            : `${filtered.length} ${filtered.length === 1 ? 'order' : 'orders'}`}
        </p>
      </header>

      {/* Filters */}
      <div className="mt-7 flex flex-wrap gap-2">
        {FILTERS.map((option) => {
          const active = filter === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id)}
              aria-pressed={active}
              className={cx(
                't-small rounded-full border px-4 py-2 transition-colors duration-150',
                active
                  ? 'border-ink bg-ink text-paper'
                  : 'border-line text-ink hover:border-ink'
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6 rounded-card border border-line px-5 sm:px-6">
        {orders.loading && !orders.data ? (
          <div className="space-y-5 py-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-5">
                <Skeleton className="size-14 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-44 rounded-full" />
                  <Skeleton className="h-3 w-52 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length ? (
          <ul>
            {filtered.map((order) => (
              <OrderCard key={order.orderNumber} order={order} showTracking />
            ))}
          </ul>
        ) : (
          <div className="py-4">
            <EmptyState
              icon={PackageSearch}
              title={filter === 'all' ? 'No orders yet' : 'Nothing here'}
              description={
                filter === 'all'
                  ? 'When you place an order it will appear here with live tracking.'
                  : 'No orders match this filter right now.'
              }
              compact
            />
          </div>
        )}
      </div>
    </div>
  );
}