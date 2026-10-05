import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart,
  LayoutGrid,
  LogOut,
  MapPin,
  Package,
  Settings,
  User,
} from 'lucide-react';
import { Outlet } from 'react-router-dom';

import DashboardShell from '../components/layout/DashboardShell.jsx';
import StatusDot from '../components/ui/StatusDot.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';

function initials(user) {
  const first = user?.firstName?.[0] ?? '';
  const last = user?.lastName?.[0] ?? '';
  return (first + last).toUpperCase() || 'Z';
}

export default function AccountLayout() {
  const { user, logout } = useAuth();
  const { count: wishlistCount } = useWishlist();
  const navigate = useNavigate();

  const nav = useMemo(
    () => [
      { label: 'Overview', to: '/account', icon: LayoutGrid, end: true },
      { label: 'My Orders', to: '/account/orders', icon: Package },
      { label: 'Wishlist', to: '/account/wishlist', icon: Heart, badge: wishlistCount || undefined },
      { label: 'Addresses', to: '/account/addresses', icon: MapPin },
      { label: 'Profile', to: '/account/profile', icon: User },
      { label: 'Settings', to: '/account/settings', icon: Settings },
    ],
    [wishlistCount]
  );

  const footer = (
    <div className="space-y-1">
      <button
        type="button"
        onClick={async () => {
          await logout();
          navigate('/');
        }}
        className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-[14px] text-muted-on-dark transition-colors duration-150 hover:bg-sidebar-hover hover:text-paper"
      >
        <LogOut className="size-[17px] shrink-0" strokeWidth={1.6} aria-hidden />
        <span>Sign out</span>
      </button>

      <div className="mt-3 flex items-center gap-3 rounded-lg bg-sidebar-hover px-3 py-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-brand text-[12px] font-medium text-paper">
          {initials(user)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] text-paper">
            {user?.firstName} {user?.lastName}
          </span>
          <span className="block truncate text-[11px] text-muted-on-dark">{user?.email}</span>
        </span>
      </div>
    </div>
  );

  // Reference B's top-left ambient status line — calmer than the admin's.
  const header = (
    <div className="border-b border-line px-6 pt-6 pb-5 md:px-8">
      <p className="flex items-center gap-2">
        <StatusDot tone="success" size="sm" />
        <span className="t-caption text-muted">Orders and tracking are up to date</span>
      </p>
    </div>
  );

  return (
    <DashboardShell nav={nav} footer={footer} header={header} ariaLabel="Your account">
      <div className="mx-auto w-full max-w-[1100px] px-6 py-8 md:px-8 md:py-10">
        <Outlet />
      </div>
    </DashboardShell>
  );
}