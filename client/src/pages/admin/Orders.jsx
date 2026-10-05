import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';

import PageHeader from '../../components/layout/PageHeader.jsx';
import OrderStatusBadge from '../../components/admin/OrderStatusBadge.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Input from '../../components/ui/Input.jsx';
import Select from '../../components/ui/Select.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import useAsync from '../../hooks/useAsync.js';
import adminService from '../../services/admin.js';
import { ORDER_STATUSES } from '../../constants/orders.js';
import { formatPrice, formatNumber, formatDate, cx } from '../../utils/format.js';

const PAGE_SIZE = 25;

export default function AdminOrders() {
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  // Debounce the free-text filter so typing does not fire a request per key.
  const debounced = useMemo(() => {
    let timer;
    return (value) => {
      clearTimeout(timer);
      timer = setTimeout(() => setQuery(value), 300);
    };
  }, []);

  const result = useAsync(
    () => adminService.orders({ page, pageSize: PAGE_SIZE, status, paymentStatus, q: query }),
    [page, status, paymentStatus, query]
  );

  const items = result.data?.items ?? [];
  const total = result.data?.total ?? 0;
  const totalPages = result.data?.totalPages ?? 1;

  const resetTo = (fn) => (value) => {
    fn(value);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="Every order across the store. Status changes are validated by the server."
      />

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <form
          className="relative min-w-[220px] flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            resetTo(setQuery)(search.trim());
          }}
        >
          <label htmlFor="admin-order-search" className="sr-only">
            Search orders
          </label>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
            strokeWidth={1.7}
            aria-hidden
          />
          <Input
            id="admin-order-search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              debounced(e.target.value.trim());
            }}
            placeholder="Order number or email"
            className="pl-9"
          />
        </form>

        <div className="w-[168px]">
          <Select value={status} onChange={(e) => resetTo(setStatus)(e.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-[148px]">
          <Select
            value={paymentStatus}
            onChange={(e) => resetTo(setPaymentStatus)(e.target.value)}
            aria-label="Filter by payment"
          >
            <option value="">All payments</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </Select>
        </div>
      </div>

      {result.loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[58px] rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No orders match"
          description={
            status || paymentStatus || query
              ? 'Try clearing the filters.'
              : 'Orders will appear here as customers check out.'
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  {['Order', 'Placed', 'Customer', 'Destination', 'Items', 'Payment', 'Status', 'Total'].map(
                    (h) => (
                      <th
                        key={h}
                        scope="col"
                        className="px-4 py-3 t-caption font-medium text-muted whitespace-nowrap"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((o) => (
                  <tr key={o.id} className="transition-colors duration-150 hover:bg-surface-muted">
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/orders/${o.orderNumber}`}
                        className="text-[13.5px] text-ink underline-offset-2 hover:underline"
                      >
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[13px] whitespace-nowrap text-muted">
                      {formatDate(o.placedAt)}
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-[13px] text-muted">{o.email}</td>
                    <td className="px-4 py-3 text-[13px] whitespace-nowrap text-muted">
                      {o.destination || '—'}
                    </td>
                    <td className="tnum px-4 py-3 text-[13px] text-muted">{o.itemCount}</td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          o.paymentStatus === 'paid'
                            ? 'success'
                            : o.paymentStatus === 'refunded'
                              ? 'neutral'
                              : o.paymentStatus === 'failed'
                                ? 'danger'
                                : 'warning'
                        }
                        size="xs"
                      >
                        {o.paymentStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={o.status} size="xs" />
                    </td>
                    <td className="tnum px-4 py-3 text-right text-[13.5px] whitespace-nowrap text-ink">
                      {formatPrice(o.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-4">
          <p className="tnum text-[13px] text-muted">
            Page {page} of {totalPages} · {formatNumber(total)} orders
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className={cx(
                'h-9 rounded-full border border-line px-4 text-[13px] transition-colors duration-150',
                page <= 1 ? 'cursor-not-allowed opacity-40' : 'hover:bg-surface-muted'
              )}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className={cx(
                'h-9 rounded-full border border-line px-4 text-[13px] transition-colors duration-150',
                page >= totalPages ? 'cursor-not-allowed opacity-40' : 'hover:bg-surface-muted'
              )}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
