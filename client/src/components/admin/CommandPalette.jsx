/**
 * Admin command palette (Ctrl/Cmd-K).
 *
 * Searches the three real admin endpoints — products, orders and customers —
 * plus static page jumps. Everything is debounced and cancellable, and results
 * come only from `adminService`, so nothing here can surface a record the
 * backend would refuse.
 *
 * Deliberately no fuzzy-matching library: with a few hundred rows a simple
 * substring + prefix score is instant and adds nothing to the bundle.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boxes, CornerDownLeft, Search, ShoppingCart, User } from 'lucide-react';

import adminService from '../../services/admin.js';
import { cx } from '../../utils/format.js';
import { formatPrice } from '../../utils/format.js';

const PAGES = [
  { label: 'Dashboard', to: '/admin', group: 'Pages' },
  { label: 'Orders', to: '/admin/orders', group: 'Pages' },
  { label: 'Products', to: '/admin/products', group: 'Pages' },
  { label: 'CJ sync', to: '/admin/cj-sync', group: 'Pages' },
  { label: 'Categories', to: '/admin/categories', group: 'Pages' },
  { label: 'Customers', to: '/admin/customers', group: 'Pages' },
  { label: 'Shipping', to: '/admin/shipping', group: 'Pages' },
  { label: 'Payments', to: '/admin/payments', group: 'Pages' },
  { label: 'Analytics', to: '/admin/analytics', group: 'Pages' },
  { label: 'Settings', to: '/admin/settings', group: 'Pages' },
  { label: 'Storefront', to: '/', group: 'Pages' },
];

/** Prefix matches rank above substring matches. */
function score(haystack, needle) {
  const h = String(haystack ?? '').toLowerCase();
  if (!h) return 0;
  if (h.startsWith(needle)) return 3;
  const idx = h.indexOf(needle);
  if (idx === 0) return 3;
  if (idx > 0) return 2 - Math.min(1, idx / 40);
  return 0;
}

export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState({ products: [], orders: [] });
  const [cursor, setCursor] = useState(0);
  const abortRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setRemote({ products: [], orders: [] });
      setCursor(0);
    }
  }, [open]);

  // Debounced remote lookup.
  useEffect(() => {
    if (!open) return undefined;
    const q = query.trim();
    if (q.length < 2) {
      setRemote({ products: [], orders: [] });
      return undefined;
    }

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      const [products, orders] = await Promise.allSettled([
        adminService.products({ q, pageSize: 5 }),
        adminService.orders({ q, pageSize: 5 }),
      ]);
      if (signal.aborted) return;

      setRemote({
        products: products.status === 'fulfilled' ? (products.value?.items ?? []) : [],
        orders: orders.status === 'fulfilled' ? (orders.value?.items ?? []) : [],
      });
    }, 260);

    return () => clearTimeout(timer);
  }, [query, open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();

    const pages = PAGES.map((p) => ({ ...p, kind: 'page', score: q ? score(p.label, q) : 0 }))
      .filter((p) => (q ? p.score > 0 : true))
      .sort((a, b) => b.score - a.score)
      .slice(0, q ? 4 : 6);

    if (q.length < 2) return [...pages];

    return [
      ...pages,
      ...remote.products.map((p) => ({
        kind: 'product',
        id: p.id,
        label: p.name,
        meta: formatPrice(p.price),
        to: `/admin/products/${p.id}/edit`,
        score: score(p.name, q),
      })),
      ...remote.orders.map((o) => ({
        kind: 'order',
        id: o.id,
        label: o.orderNumber,
        meta: `${o.status} · ${formatPrice(o.total)}`,
        to: `/admin/orders/${o.orderNumber}`,
        score: score(o.orderNumber, q) + score(o.email, q) * 0.5,
      })),
    ]
      .filter((r) => r.kind === 'page' || r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }, [query, remote]);

  useEffect(() => setCursor(0), [query]);

  const go = useCallback(
    (item) => {
      if (!item) return;
      onClose();
      navigate(item.to);
    },
    [navigate, onClose],
  );

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((c) => Math.min(results.length - 1, c + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      go(results[cursor]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  // Keep the highlighted row in view while arrowing.
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${cursor}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  const iconFor = (kind) =>
    kind === 'product' ? Boxes : kind === 'order' ? ShoppingCart : User;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]">
      <div
        className="absolute inset-0 bg-navy/55 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-xl overflow-hidden rounded-[24px] border border-line bg-paper shadow-lift"
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-4 shrink-0 text-muted" strokeWidth={1.9} aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search products, orders, pages…"
            aria-label="Search the admin"
            className="min-w-0 flex-1 bg-transparent py-4 text-[14px] text-ink outline-none placeholder:text-muted/70"
          />
          <kbd className="hidden rounded-md border border-line px-1.5 py-0.5 text-[10px] text-muted sm:block">
            ESC
          </kbd>
        </div>

        <ul ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <li className="px-4 py-10 text-center">
              <p className="t-small text-ink">No matches</p>
              <p className="t-caption mt-1 text-muted">
                Try a product name, an order number, or a page.
              </p>
            </li>
          ) : (
            results.map((item, index) => {
              const Icon = iconFor(item.kind);
              const isActive = index === cursor;
              return (
                <li key={`${item.kind}-${item.id ?? item.to}`}>
                  <button
                    type="button"
                    data-index={index}
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => go(item)}
                    className={cx(
                      'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition',
                      isActive ? 'bg-brand-gradient text-white' : 'text-ink hover:bg-canvas'
                    )}
                  >
                    <Icon
                      className={cx('size-4 shrink-0', isActive ? 'text-white' : 'text-muted')}
                      strokeWidth={1.8}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">{item.label}</span>
                      {item.meta ? (
                        <span
                          className={cx(
                            'block truncate text-[11.5px]',
                            isActive ? 'text-white/75' : 'text-muted'
                          )}
                        >
                          {item.meta}
                        </span>
                      ) : null}
                    </span>
                    {isActive ? (
                      <CornerDownLeft className="size-3.5 shrink-0 text-white/80" aria-hidden />
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}