import PageHeader from '../../components/layout/PageHeader.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import useAsync from '../../hooks/useAsync.js';
import adminService from '../../services/admin.js';
import { formatPrice, formatNumber, formatDate } from '../../utils/format.js';

export default function AdminAnalytics() {
  const overview = useAsync(() => adminService.overview(), []);
  const d = overview.data;

  if (overview.loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Analytics" description="Loading…" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[220px] rounded-xl" />
        ))}
      </div>
    );
  }

  if (overview.error || !d) {
    return (
      <EmptyState
        title="Could not load analytics"
        description={overview.error?.message ?? 'The admin API did not respond.'}
      />
    );
  }

  const f = d.financials ?? {};

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Revenue, profit and product performance from live orders." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Revenue', formatPrice(f.revenue)],
          ['Supplier costs', formatPrice(f.supplierCosts)],
          ['Gross margin', formatPrice(f.grossMargin)],
          ['Estimated net profit', formatPrice(f.estimatedNetProfit)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-line bg-surface p-5">
            <p className="t-caption text-muted">{label}</p>
            <p className="tnum mt-3 text-[22px] leading-none font-medium text-ink">{value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-line bg-surface">
        <header className="border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-medium text-ink">Revenue &amp; profit by date</h2>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line">
                {['Date', 'Revenue', 'Profit'].map((h) => (
                  <th key={h} className="px-5 py-3 t-caption font-medium text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(f.byDate ?? []).map((row) => (
                <tr key={row.date}>
                  <td className="px-5 py-2.5 text-[13px] text-ink">{formatDate(row.date)}</td>
                  <td className="tnum px-5 py-2.5 text-[13px] text-ink">{formatPrice(row.revenue)}</td>
                  <td className="tnum px-5 py-2.5 text-[13px] text-ink">{formatPrice(row.profit)}</td>
                </tr>
              ))}
              {!f.byDate?.length && (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-[13px] text-muted">No sales yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-surface">
          <header className="border-b border-line px-5 py-4">
            <h2 className="text-[15px] font-medium text-ink">Best sellers</h2>
          </header>
          <ul className="divide-y divide-line">
            {(f.bestSelling ?? []).map((p) => (
              <li key={p.name} className="flex items-center justify-between px-5 py-3">
                <span className="truncate text-[13px] text-ink">{p.name}</span>
                <span className="tnum text-[13px] text-muted">
                  {formatNumber(p.units)} · {formatPrice(p.revenue)}
                </span>
              </li>
            ))}
            {!f.bestSelling?.length && (
              <li className="px-5 py-8 text-center text-[13px] text-muted">No sales yet.</li>
            )}
          </ul>
        </section>

        <section className="rounded-xl border border-line bg-surface">
          <header className="border-b border-line px-5 py-4">
            <h2 className="text-[15px] font-medium text-ink">Most profitable</h2>
          </header>
          <ul className="divide-y divide-line">
            {(f.mostProfitable ?? []).map((p) => (
              <li key={p.name} className="flex items-center justify-between px-5 py-3">
                <span className="truncate text-[13px] text-ink">{p.name}</span>
                <span className="tnum text-[13px] text-muted">{formatPrice(p.profit)}</span>
              </li>
            ))}
            {!f.mostProfitable?.length && (
              <li className="px-5 py-8 text-center text-[13px] text-muted">No sales yet.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
