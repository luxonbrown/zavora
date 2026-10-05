/**
 * MARKETHUB navbar — transparent over the hero, solid once scrolled.
 */
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Heart, Menu, Search, ShoppingBag, User, X } from 'lucide-react';

import { Logo as BrandLogo } from '../brand/Logo.jsx';
import Button from '../ui/Button.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCart } from '../../context/CartContext.jsx';
import { useWishlist } from '../../context/WishlistContext.jsx';
import { cx } from '../../utils/format.js';

const LINKS = [
  { label: 'Shop', to: '/shop' },
  { label: 'Categories', to: '/category/new-arrivals' },
  { label: 'New Arrivals', to: '/category/new-arrivals' },
  { label: 'About', to: '/about' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const { isAuthenticated } = useAuth();
  const { itemCount } = useCart();
  const { count: wishlistCount } = useWishlist();

  // Only the storefront hero should sit under a transparent bar.
  const overHero = location.pathname === '/';

  useEffect(() => {
    if (!overHero) {
      setScrolled(true);
      return undefined;
    }
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [overHero]);

  // A route change must not leave the drawer hanging open.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  const solid = scrolled || !overHero;

  return (
    <>
      <header
        className={cx(
          'fixed inset-x-0 top-0 z-50 transition-all duration-300',
          solid
            ? 'border-b border-line bg-paper/85 backdrop-blur-xl'
            : 'border-b border-transparent bg-transparent'
        )}
      >
        <nav className="container-z flex h-16 items-center gap-6 md:h-20">
          <Link to="/" aria-label="MARKETHUB home" className="shrink-0">
            {/* The bird is the identity — sized deliberately larger than the
                wordmark rather than as a small glyph beside it. */}
            <BrandLogo
              variant={solid ? 'gradient' : 'plain'}
              markClassName="size-8 sm:size-10"
              wordClassName={cx(
                'text-[14px] leading-none sm:text-[17px]',
                !solid && 'text-paper'
              )}
              className="gap-2"
            />
          </Link>

          {/* Desktop links. */}
          <ul className="ml-4 hidden items-center gap-1 lg:flex">
            {LINKS.map((link) => (
              <li key={link.label}>
                <NavLink
                  to={link.to}
                  className={({ isActive }) =>
                    cx(
                      'relative rounded-full px-3.5 py-2 text-[13.5px] font-medium transition-colors',
                      solid
                        ? isActive
                          ? 'text-ink'
                          : 'text-muted hover:text-ink'
                        : isActive
                          ? 'text-paper'
                          : 'text-paper/70 hover:text-paper'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {link.label}
                      {/* Active indicator — the brand shows up here. */}
                      <span
                        className={cx(
                          'absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-brand-gradient transition-opacity duration-300',
                          isActive ? 'opacity-100' : 'opacity-0'
                        )}
                        aria-hidden
                      />
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="ml-auto flex items-center gap-1">
            <IconLink to="/search" label="Search" solid={solid}>
              <Search className="size-[18px]" strokeWidth={1.8} />
            </IconLink>
            {/* Wishlist and account are reachable from the mobile drawer, so they
                are hidden below sm to keep the icon row within a small screen. */}
            <span className="hidden sm:contents">
              <IconLink to="/account/wishlist" label="Wishlist" solid={solid} badge={wishlistCount}>
                <Heart className="size-[18px]" strokeWidth={1.8} />
              </IconLink>
              <IconLink
                to={isAuthenticated ? '/account' : '/login'}
                label={isAuthenticated ? 'Your account' : 'Log in'}
                solid={solid}
              >
                <User className="size-[18px]" strokeWidth={1.8} />
              </IconLink>
            </span>
            <IconLink to="/cart" label="Cart" solid={solid} badge={itemCount}>
              <ShoppingBag className="size-[18px]" strokeWidth={1.8} />
            </IconLink>

            {!isAuthenticated ? (
              <Button
                to="/shop"
                size="sm"
                variant="gradient"
                className="ml-2 hidden shadow-glow-blue md:inline-flex"
              >
                Shop Now
              </Button>
            ) : null}

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className={cx(
                'ml-1 grid size-10 place-items-center rounded-full transition lg:hidden',
                solid ? 'text-ink hover:bg-surface-muted' : 'text-paper hover:bg-white/10'
              )}
            >
              <Menu className="size-5" strokeWidth={1.8} />
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile drawer. */}
      <div
        className={cx(
          'fixed inset-0 z-[60] lg:hidden',
          menuOpen ? 'pointer-events-auto' : 'pointer-events-none'
        )}
        aria-hidden={!menuOpen}
      >
        <div
          className={cx(
            'absolute inset-0 bg-navy/50 backdrop-blur-sm transition-opacity duration-300',
            menuOpen ? 'opacity-100' : 'opacity-0'
          )}
          onClick={() => setMenuOpen(false)}
        />
        <div
          className={cx(
            'absolute inset-y-0 right-0 flex w-[86%] max-w-sm flex-col bg-paper shadow-lift transition-transform duration-300 ease-out',
            menuOpen ? 'translate-x-0' : 'translate-x-full'
          )}
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <BrandLogo />
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              className="grid size-10 place-items-center rounded-full text-ink hover:bg-surface-muted"
            >
              <X className="size-5" strokeWidth={1.8} />
            </button>
          </div>

          <ul className="flex-1 space-y-1 overflow-y-auto p-4">
            {LINKS.map((link) => (
              <li key={link.label}>
                <NavLink
                  to={link.to}
                  className={({ isActive }) =>
                    cx(
                      'block rounded-2xl px-4 py-3.5 text-[15px] font-medium transition',
                      isActive ? 'bg-brand-gradient text-white' : 'text-ink hover:bg-canvas'
                    )
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
            <li className="pt-2">
              <NavLink
                to="/track-order"
                className="block rounded-2xl px-4 py-3.5 text-[15px] font-medium text-ink hover:bg-canvas"
              >
                Track order
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/contact"
                className="block rounded-2xl px-4 py-3.5 text-[15px] font-medium text-ink hover:bg-canvas"
              >
                Contact
              </NavLink>
            </li>
          </ul>

          <div className="border-t border-line p-4">
            <Button
              to={isAuthenticated ? '/account' : '/login'}
              variant="gradient"
              fullWidth
              className="shadow-glow-blue"
            >
              {isAuthenticated ? 'Your account' : 'Log in'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function IconLink({ to, label, children, badge, solid }) {
  return (
    <Link
      to={to}
      aria-label={badge ? `${label}, ${badge} items` : label}
      className={cx(
        'relative grid size-10 place-items-center rounded-full transition',
        solid ? 'text-ink hover:bg-surface-muted' : 'text-paper hover:bg-white/10'
      )}
    >
      {children}
      {badge > 0 ? (
        <span className="tnum absolute right-1 top-1 grid min-w-[17px] place-items-center rounded-full bg-brand-gradient px-1 text-[10px] font-semibold leading-[17px] text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </Link>
  );
}