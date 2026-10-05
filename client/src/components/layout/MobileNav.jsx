import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Search, X } from 'lucide-react';

import { NAV_LINKS } from '../../constants/navigation.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { cx } from '../../utils/format.js';

const ACCOUNT_LINKS = [
  { label: 'My Account', to: '/account' },
  { label: 'My Orders', to: '/account/orders' },
  { label: 'Wishlist', to: '/account/wishlist' },
  { label: 'Track Order', to: '/track-order' },
];

/** Full-screen menu sheet with large type — mobile only. */
export default function MobileNav({ open, onClose }) {
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const primary = [
    ...NAV_LINKS.flatMap((l) => (l.hasMenu ? l.children : [l])),
  ];

  return (
    <div className="fixed inset-0 z-100 lg:hidden">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
      />

      <div className="page-rise absolute inset-y-0 right-0 flex w-[min(400px,92vw)] flex-col overflow-y-auto bg-paper">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-5">
          <span className="t-title">
            {isAuthenticated ? `Hi, ${user?.firstName ?? 'there'}` : 'Menu'}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="grid size-9 place-items-center rounded-full text-ink transition-colors duration-150 hover:bg-surface-muted"
          >
            <X className="size-5" strokeWidth={1.6} aria-hidden />
          </button>
        </div>

        <div className="border-b border-line p-5">
          <button
            type="button"
            onClick={onClose}
            className="flex w-full items-center gap-3 rounded-xl border border-line px-4 py-3 text-left text-muted"
          >
            <Search className="size-4" strokeWidth={1.6} aria-hidden />
            <span className="t-small">Search products</span>
          </button>
        </div>

        <nav aria-label="Mobile" className="px-5 py-4">
          <p className="t-eyebrow mb-3">Shop</p>
          <ul className="space-y-0.5">
            {primary.map((link) => (
              <li key={link.to + link.label}>
                <Link
                  to={link.to}
                  onClick={onClose}
                  className="flex items-center justify-between py-2.5 text-[22px] font-medium tracking-[-0.015em] text-ink"
                >
                  {link.label}
                  <ChevronRight className="size-4 text-muted" strokeWidth={1.6} aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Account" className="mt-auto border-t border-line px-5 py-5">
          <p className="t-eyebrow mb-3">Account</p>
          <ul className="space-y-0.5">
            {ACCOUNT_LINKS.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  onClick={onClose}
                  className="block py-2 text-[15px] text-muted"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                to={isAuthenticated ? '/account' : '/login'}
                onClick={onClose}
                className="t-small mt-3 inline-flex items-center rounded-full bg-ink px-5 py-2.5 font-medium text-paper"
              >
                {isAuthenticated ? 'My Account' : 'Sign in'}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}
