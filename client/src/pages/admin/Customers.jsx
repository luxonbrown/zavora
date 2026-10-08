import PageHeader from '../../components/layout/PageHeader.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import useAsync from '../../hooks/useAsync.js';
import adminService from '../../services/admin.js';
import { formatPrice, formatNumber, formatDate } from '../../utils/format.js';

export default function AdminCustomers() {
  const result = useAsync(() => adminService.customers(), []);
  const items = result.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" description="Every registered customer and what they are worth." />

      {result.loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[54px] rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="No customers yet" description="Accounts appear here once people register." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  {['Name', 'Email', 'Orders', 'Lifetime value', 'Last order', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-3 t-caption font-medium whitespace-nowrap text-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((u) => (
                  <tr key={u.id} className="transition-colors duration-150 hover:bg-surface-muted">
                    <td className="px-4 py-2.5 text-[13.5px] text-ink">{u.name}</td>
                    <td className="max-w-[220px] truncate px-4 py-2.5 text-[13px] text-muted">{u.email}</td>
                    <td className="tnum px-4 py-2.5 text-[13px] text-ink">{formatNumber(u.orders)}</td>
                    <td className="tnum px-4 py-2.5 text-[13px] text-ink">{formatPrice(u.lifetimeValue)}</td>
                    <td className="px-4 py-2.5 text-[13px] text-muted">{u.lastOrderAt ? formatDate(u.lastOrderAt) : '—'}</td>
                    <td className="px-4 py-2.5">
                      <Badge size="xs" tone={u.isActive ? 'success' : 'neutral'}>
                        {u.isActive ? 'Active' : 'Disabled'}
                      </Badge>
                    </td>
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
