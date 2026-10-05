/**
 * Admin header: command-palette trigger, notification bell with real counts,
 * and the store-status line.
 *
 * Every count comes from `GET /admin/overview`, which is the only endpoint that
 * aggregates them. No number here is estimated or faked — a count the backend
 * does not provide is simply not shown.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, PackageX, RefreshCw, Search, ShoppingCart } from 'lucide-react';

import CommandPalette from './CommandPalette.jsx';
import { cx } from '../../utils/format.js';

export default function AdminHeader({ overview }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);

  // Ctrl/Cmd-K opens the palette from anywhere in the admin.
  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const d = overview ?? {};
  const pendingOrders = d.orders?.open ?? 0;
  const lowStock = d.lowStock?.length ?? 0;
  const lastRun = d.cjSync?.lastRun ?? d.lastSyncRun ?? null;
  const syncFailed = lastRun && lastRun.status && lastRun.status !== 'success' && lastRun.status !== 'completed';

  const alerts = [
    {
      id: 'pending',
      to: '/admin/orders?status=placed',
      icon: ShoppingCart,
      label: 'Orders awaiting fulfilment',
      value: pendingOrders,
      tone: 'info',
    },
    {
      id: 'stock',
      to: '/admin/products?lowStock=1',
      icon: PackageX,
      label: 'Products low on stock',
      value: lowStock,
      tone: 'warning',
    },
    {
      id: 'sync',
      to: '/admin/cj-sync',
      icon: RefreshCw,
      label: syncFailed ? 'Last catalogue sync failed' : 'Catalogue sync status',
      value: null,
      tone: syncFailed ? 'danger' : 'success',
    },
  ].filter((alert) => alert.value === null || alert.value > 0 || alert.id === 'sync');

  const badgeCount = pendingOrders + lowStock;

  return (
    <>
      <div className="border-b border-line px-6 pt-5 pb-4 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Command palette trigger. */}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="group flex w-full max-w-sm items-center gap-2.5 rounded-full border border-line bg-canvas px-4 py-2.5 text-left transition hover:border-mh-blue"
          >
            <Search className="size-4 shrink-0 text-muted" strokeWidth={1.9} aria-hidden />
            <span className="flex-1 text-[13px] text-muted">
              Search products, orders, pages…
            </span>
            <kbd className="hidden rounded-md border border-line bg-paper px-1.5 py-0.5 text-[10px] text-muted sm:block">
              ⌘K
            </kbd>
          </button>

          <div className="flex items-center gap-2">
            {/* Notification bell. */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setBellOpen((v) => !v)}
                aria-label={`Notifications${badgeCount ? `, ${badgeCount} needing attention` : ''}`}
                aria-expanded={bellOpen}
                className="relative grid size-10 place-items-center rounded-full border border-line text-ink transition hover:border-mh-blue hover:text-mh-blue"
              >
                <Bell className="size-[17px]" strokeWidth={1.8} />
                {badgeCount > 0 ? (
                  <span className="tnum absolute -right-0.5 -top-0.5 grid min-w-[17px] place-items-center rounded-full bg-brand-gradient px-1 text-[10px] font-semibold leading-[17px] text-white">
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </span>
                ) : null}
              </button>

              {bellOpen ? (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setBellOpen(false)}
                    aria-hidden
                  />
                  <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-[320px] overflow-hidden rounded-[22px] border border-line bg-paper shadow-lift">
                    <p className="border-b border-line px-4 py-3 text-[13px] font-semibold text-ink">
                      Needs attention
                    </p>
                    <ul className="max-h-[320px] overflow-y-auto p-2">
                      {alerts.map((alert) => {
                        const Icon = alert.icon;
                        return (
                          <li key={alert.id}>
                            <Link
                              to={alert.to}
                              onClick={() => setBellOpen(false)}
                              className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition hover:bg-canvas"
                            >
                              <span
                                className={cx(
                                  'grid size-9 shrink-0 place-items-center rounded-xl',
                                  alert.tone === 'danger'
                                    ? 'bg-danger/12 text-danger'
                                    : alert.tone === 'warning'
                                      ? 'bg-warning/15 text-warning'
                                      : alert.tone === 'success'
                                        ? 'bg-success/12 text-success'
                                        : 'bg-info/12 text-info'
                                )}
                              >
                                <Icon className="size-4" strokeWidth={1.8} aria-hidden />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[12.5px] font-medium text-ink">
                                  {alert.label}
                                </span>
                                {alert.value != null ? (
                                  <span className="tnum block text-[11.5px] text-muted">
                                    {alert.value}
                                  </span>
                                ) : (
                                  <span className="block text-[11.5px] text-muted">
                                    {syncFailed ? 'Review the log' : 'Up to date'}
                                  </span>
                                )}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* Store status line. */}
        <p className="mt-4 flex items-center gap-2">
          <span
            className={cx(
              'size-2 rounded-full',
              syncFailed ? 'bg-danger' : 'bg-success'
            )}
            aria-hidden
          />
          <span className="t-caption text-muted">
            {syncFailed
              ? 'The last catalogue sync did not complete — check CJ sync'
              : 'Storefront and admin are operating normally'}
          </span>
        </p>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}