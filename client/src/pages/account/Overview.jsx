import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MapPin, Package, RotateCcw, Settings, ShoppingBag, Truck, Wallet } from 'lucide-react';

import Button from '../../components/ui/Button.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import OrderCard from '../../components/account/OrderCard.jsx';
import StatTile from '../../components/account/StatTile.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useWishlist } from '../../context/WishlistContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import ordersService from '../../services/orders.js';
import { formatPrice } from '../../utils/format.js';

const QUICK_LINKS = [
  { to: '/account/orders', label: 'My orders', description: 'Track and review purchases', icon: Package },
  { to: '/account/addresses', label: 'Addresses', description: 'Manage delivery locations', icon: MapPin },
  { to: '/account/wishlist', label: 'Wishlist', description: 'Saved for later', icon: Heart },
  { to: '/track-order', label: 'Track order', description: 'Check a delivery', icon: Truck },
  { to: '/account/profile', label: 'Profile', description: 'Your details', icon: RotateCcw },
  { to: '/account/settings', label: 'Settings', description: 'Password and alerts', icon: Settings },
];

export default function Overview() {
  const { user } = useAuth();
  const { count: wishlistCount } = useWishlist();

  const orders = useAsync(() => ordersService.list(), []);
  const summary = useAsync(() => ordersService.summary(), []);

  useEffect(() => {
    document.title = 'Your account — MARKETHUB';
  }, []);

  const firstName = user?.firstName ?? 'there';
  // GET /api/orders returns a paginated envelope ({ ok, items }), not a bare
  // array. Treating it as an array threw on every account visit.
  const recent = (orders.data?.items ?? []).slice(0, 3);

  return (
    <div>
      <header className="rounded-card border border-line bg-surface px-6 py-8 sm:px-8">
        <p className="t-eyebrow text-muted">Your ZAVORA account</p>
        <h1 className="h3-sub mt-3">
          Welcome back{user?.firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="t-small mt-2 text-muted">
          Everything about your orders, addresses and saved items lives here.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button to="/shop" variant="primary-dark" size="md">
            Continue shopping
          </Button>
          <Button to="/account/orders" variant="outline-dark" size="md">
            View orders
          </Button>
        </div>
      </header>

      {/* Quick links */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_LINKS.map(({ to, label, description, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="group flex items-start gap-4 rounded-card border border-line bg-surface p-5 transition-colors duration-150 hover:bg-surface-muted"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-muted text-ink transition-colors group-hover:bg-paper">
              <Icon className="size-4" strokeWidth={1.6} aria-hidden />
            </span>
            <span>
              <span className="block text-[14px] font-medium text-ink">{label}</span>
              <span className="t-caption mt-1 block text-muted">{description}</span>
            </span>
          </Link>
        ))}
      </div>

      {/* Stats */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summary.loading && !summary.data ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[124px] rounded-card" />
          ))
        ) : (
          <>
            <StatTile
              label="Total orders"
              value={summary.data?.totalOrders ?? 0}
              icon={Package}
            />
            <StatTile
              label="Active orders"
              value={summary.data?.activeOrders ?? 0}
              hint="On the way to you"
              icon={Truck}
            />
            <StatTile label="Saved items" value={wishlistCount} icon={Heart} />
            <StatTile
              label="Lifetime spend"
              value={formatPrice(summary.data?.lifetimeValue ?? 0)}
              icon={Wallet}
            />
          </>
        )}
      </div>

      {/* Recent orders */}
      <section className="mt-10">
        <div className="flex items-center justify-between gap-4">
          <h2 className="t-title">Recent orders</h2>
          <Link
            to="/account/orders"
            className="t-small text-muted underline underline-offset-4 transition-colors duration-150 hover:text-ink"
          >
            View all
          </Link>
        </div>

        <div className="mt-4 rounded-card border border-line px-5 sm:px-6">
          {orders.loading && !orders.data ? (
            <div className="space-y-5 py-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-5">
                  <Skeleton className="size-14 shrink-0 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-40 rounded-full" />
                    <Skeleton className="h-3 w-56 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : recent.length ? (
            <ul>
              {recent.map((order) => (
                <OrderCard key={order.orderNumber} order={order} showTracking />
              ))}
            </ul>
          ) : (
            <div className="py-12 text-center">
              <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-surface-muted text-muted">
                <ShoppingBag className="size-5" strokeWidth={1.5} aria-hidden />
              </span>
              <p className="t-title">No orders yet</p>
              <p className="t-small mt-2 text-muted">
                When you place an order it will appear here with live tracking.
              </p>
              <Button to="/shop" variant="outline-dark" size="md" className="mt-6">
                Start shopping
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}