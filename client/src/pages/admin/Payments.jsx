import PageHeader from '../../components/layout/PageHeader.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import useAsync from '../../hooks/useAsync.js';
import adminService from '../../services/admin.js';
import { formatPrice, formatDate } from '../../utils/format.js';

export default function AdminPayments() {
  const result = useAsync(() => adminService.payments(), []);
  const items = result.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="The latest captured, failed and refunded payments." />

      {result.loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[54px] rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="No payments yet" description="Payments appear here after checkouts." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  {['Order', 'Customer', 'Method', 'Amount', 'Status', 'Date'].map((h) => (
                    <th key={h} className="px-4 py-3 t-caption font-medium whitespace-nowrap text-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((p) => (
                  <tr key={p.id} className="transition-colors duration-150 hover:bg-surface-muted">
                    <td className="px-4 py-2.5 text-[13.5px] text-ink">{p.orderNumber}</td>
                    <td className="max-w-[200px] truncate px-4 py-2.5 text-[13px] text-muted">{p.email}</td>
                    <td className="px-4 py-2.5 text-[13px] text-muted">
                      {p.provider} · {p.method}
                      {p.cardLast4 ? ` ·•• ${p.cardLast4}` : ''}
                    </td>
                    <td className="tnum px-4 py-2.5 text-[13px] text-ink">{formatPrice(p.amount)}</td>
                    <td className="px-4 py-2.5">
                      <Badge
                        size="xs"
                        tone={p.status === 'captured' ? 'success' : p.status === 'refunded' ? 'neutral' : p.status === 'failed' ? 'danger' : 'warning'}
                      >
                        {p.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-muted">{formatDate(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
