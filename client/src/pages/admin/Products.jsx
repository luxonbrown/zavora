import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';

import PageHeader from '../../components/layout/PageHeader.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Input from '../../components/ui/Input.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import useAsync from '../../hooks/useAsync.js';
import adminService from '../../services/admin.js';
import { formatPrice, formatNumber, cx } from '../../utils/format.js';

/** Inline selling-price editor: ZAVORA controls the retail price, CJ cost never does. */
function PriceEditor({ product, onSaved }) {
  const [value, setValue] = useState(String(product.price ?? ''));
  const [status, setStatus] = useState('idle'); // idle | saving | saved | error

  const save = async () => {
    const price = Number(value);
    if (!Number.isFinite(price) || price < 0) {
      setStatus('error');
      return;
    }
    setStatus('saving');
    try {
      await adminService.updateProductPrice(product.id, price);
      setStatus('saved');
      onSaved?.();
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[13.5px] text-muted">$</span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setStatus('idle');
        }}
        className="tnum w-20 rounded-md border border-line bg-transparent px-2 py-1 text-[13.5px] text-ink"
        aria-label={`Selling price for ${product.name}`}
      />
      <button
        type="button"
        onClick={save}
        disabled={status === 'saving'}
        className="rounded-md border border-line px-2 py-1 text-[12px] text-ink transition-colors duration-150 hover:bg-surface-muted disabled:opacity-40"
      >
        {status === 'saving' ? '…' : status === 'saved' ? 'Saved' : status === 'error' ? 'Retry' : 'Save'}
      </button>
    </div>
  );
}

const PAGE_SIZE = 25;

/** Colour-codes a margin so an unprofitable row is obvious at a glance. */
function Margin({ percent }) {
  if (percent === null || percent === undefined) return <span className="text-muted">—</span>;
  const tone = percent < 15 ? 'danger' : percent < 30 ? 'warning' : 'success';
  return (
    <Badge size="xs" tone={tone}>
      {percent.toFixed(1)}%
    </Badge>
  );
}

export default function AdminProducts() {
  const [params, setParams] = useSearchParams();
  const category = params.get('category') ?? '';

  const [search, setSearch] = useState(params.get('q') ?? '');
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(1);

  const result = useAsync(
    () => adminService.products({ page, pageSize: PAGE_SIZE, q: query, category, includeArchived }),
    [page, query, category, includeArchived]
  );

  const items = result.data?.items ?? [];
  const total = result.data?.total ?? 0;
  const totalPages = result.data?.totalPages ?? 1;

  const update = (next) => {
    const merged = new URLSearchParams(params);
    if (next.category !== undefined) {
      if (next.category) merged.set('category', next.category);
      else merged.delete('category');
    }
    if (next.q !== undefined) {
      if (next.q) merged.set('q', next.q);
      else merged.delete('q');
    }
    setParams(merged, { replace: true });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="The live catalogue, sourced from CJdropshipping. Cost and margin are admin-only."
      />

      <div className="flex flex-wrap items-center gap-3">
        <form
          className="relative min-w-[220px] flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            update({ q: search.trim() });
            setQuery(search.trim());
          }}
        >
          <label htmlFor="admin-product-search" className="sr-only">
            Search products
          </label>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
            strokeWidth={1.7}
            aria-hidden
          />
          <Input
            id="admin-product-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or SKU"
            className="pl-9"
          />
        </form>

        {category ? (
          <button
            type="button"
            onClick={() => {
              setPage(1);
              update({ category: '' });
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface-muted px-3 text-[13px] text-ink"
          >
            {category}
            <span aria-hidden>×</span>
          </button>
        ) : null}

        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-line px-3 text-[13px] text-ink">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => {
              setIncludeArchived(e.target.checked);
              setPage(1);
            }}
            className="size-3.5 accent-[var(--color-ink)]"
          />
          Show archived
        </label>
      </div>

      {result.loading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-[54px] rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No products match"
          description={
            query || category
              ? 'Try clearing the search or category filter.'
              : 'Run a CJ sync to import the catalogue.'
          }
          actionTo="/admin/cj-sync"
          action="Go to CJ sync"
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  {['Product', 'Category', 'Sell price (edit)', 'Cost', 'Margin $', 'Margin %', 'Stock', 'Upstream', 'Synced'].map(
                    (h) => (
                      <th key={h} scope="col" className="px-4 py-3 t-caption font-medium whitespace-nowrap text-muted">
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((p) => (
                  <tr key={p.id} className={cx('transition-colors duration-150 hover:bg-surface-muted', !p.isActive && 'opacity-55')}>
                    <td className="max-w-[280px] px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        {p.image ? (
                          <img src={p.image} alt="" className="size-9 shrink-0 rounded-md object-cover" loading="lazy" />
                        ) : (
                          <span className="size-9 shrink-0 rounded-md bg-surface-muted" />
                        )}
                        <span className="min-w-0">
                          <Link
                            to={`/product/${p.slug}`}
                            className="block truncate text-[13.5px] text-ink underline-offset-2 hover:underline"
                          >
                            {p.name}
                          </Link>
                          <span className="block truncate text-[11.5px] text-muted">{p.sku}</span>
                        </span>
                      </div>
                    </td>
                    <td className="max-w-[150px] truncate px-4 py-2.5 text-[13px] text-muted">
                      {p.category?.name ?? '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <PriceEditor product={p} onSaved={() => result.reload?.()} />
                    </td>
                    <td className="tnum px-4 py-2.5 text-[13.5px] whitespace-nowrap text-muted">
                      {p.supplier ? formatPrice(p.supplier.costPrice) : '—'}
                    </td>
                    <td className="tnum px-4 py-2.5 text-[13.5px] whitespace-nowrap text-ink">
                      {p.marginAmount !== null && p.marginAmount !== undefined ? formatPrice(p.marginAmount) : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <Margin percent={p.marginPercent} />
                    </td>
                    <td className="tnum px-4 py-2.5 text-[13px]">
                      <span className={cx(p.stock === 0 ? 'text-danger' : p.stock <= 3 ? 'text-warning' : 'text-ink')}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="tnum px-4 py-2.5 text-[13px] whitespace-nowrap text-muted">
                      {p.supplier ? formatNumber(p.supplier.stock) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] whitespace-nowrap text-muted">
                      {p.supplier?.lastSyncedAt ? new Date(p.supplier.lastSyncedAt).toLocaleDateString() : '—'}
                      {!p.isActive ? (
                        <Badge size="xs" tone="outline" className="ml-2">
                          archived
                        </Badge>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <p className="tnum text-[13px] text-muted">
          Page {page} of {totalPages} · {formatNumber(total)} products
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
    </div>
  );
}
