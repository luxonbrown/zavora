import { useMemo } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Boxes,
  LayoutGrid,
  LogOut,
  Package,
  RefreshCw,
  Settings,
  ShoppingCart,
  Truck,
  Users,
} from 'lucide-react';

import DashboardShell from '../components/layout/DashboardShell.jsx';
import AdminHeader from '../components/admin/AdminHeader.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import useAsync from '../hooks/useAsync.js';
import adminService from '../services/admin.js';

function initials(user) {
  const first = user?.firstName?.[0] ?? '';
  const last = user?.lastName?.[0] ?? '';
  return (first + last).toUpperCase() || 'A';
}

/**
 * Admin shell (Reference B): near-black sidebar framing a white canvas.
 *
 * Shares `DashboardShell` with the customer dashboard so the two cannot drift
 * apart, but passes `groups` — the collapsible sections that make the admin
 * read as denser and more task-oriented.
 */
export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Only the live counters, fetched once at mount: the dashboard page owns the
  // full overview, and polling it from the shell would double the requests.
  const openOrders = useAsync(async () => {
    const page = await adminService.orders({ pageSize: 1, status: 'placed,payment_confirmed,processing,shipped,in_transit' });
    return page.total;
  }, []);

  const nav = useMemo(
    () => [
      { label: 'Dashboard', to: '/admin', icon: LayoutGrid, end: true },
      { label: 'Orders', to: '/admin/orders', icon: ShoppingCart, badge: openOrders.data || undefined },
      { label: 'Products', to: '/admin/products', icon: Package },
      { label: 'Categories', to: '/admin/categories', icon: Boxes },
      { label: 'Customers', to: '/admin/customers', icon: Users },
    ],
    [openOrders.data]
  );

  const groups = useMemo(
    () => [
      {
        label: 'Operations',
        items: [
          { label: 'Shipping', to: '/admin/shipping', icon: Truck },
          { label: 'Payments', to: '/admin/payments', icon: Package },
        ],
      },
      {
        label: 'Insights',
        items: [{ label: 'Analytics', to: '/admin/analytics', icon: BarChart3 }],
      },
      {
        label: 'Supply',
        items: [
          { label: 'CJ Sync', to: '/admin/cj-sync', icon: RefreshCw },
          { label: 'Settings', to: '/admin/settings', icon: Settings },
        ],
      },
    ],
    []
  );

  const footer = (
    <div className="space-y-1">
      <div className="mb-3 flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-brand-gradient text-[12px] font-semibold text-white">
          {initials(user)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] text-paper">
            {user?.firstName} {user?.lastName}
          </span>
          <span className="block truncate text-[11px] text-muted-on-dark">
            {user?.email}
          </span>
        </span>
      </div>
      <button
        type="button"
        onClick={async () => {
          await logout();
          navigate('/');
        }}
        className="flex h-9 w-full items-center gap-3 rounded-xl px-3 text-[14px] text-muted-on-dark transition hover:bg-white/10 hover:text-paper"
      >
        <LogOut className="size-[17px] shrink-0" strokeWidth={1.6} aria-hidden />
        <span>Sign out</span>
      </button>
    </div>
  );

  // One aggregated fetch feeds both the KPI header and the notification bell,
  // so opening the admin makes exactly one request rather than one per panel.
  const overviewRequest = useAsync(async () => adminService.overview(), []);

  return (
    <DashboardShell
      nav={nav}
      groups={groups}
      footer={footer}
      header={<AdminHeader overview={overviewRequest.data} />}
      ariaLabel="Store administration"
    >
      <div className="mx-auto w-full max-w-[1280px] px-6 py-8 md:px-8 md:py-10">
        <Outlet />
      </div>
    </DashboardShell>
  );
}