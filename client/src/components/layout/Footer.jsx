/**
 * MARKETHUB footer — dark navy, wave divider on top, giant flowing wordmark with
 * a mirrored water reflection (see `FlowWordmark`).
 */
import { Link } from 'react-router-dom';

import FlowWordmark from '../brand/FlowWordmark.jsx';
import { Logo } from '../brand/Logo.jsx';
import NewsletterForm from './NewsletterForm.jsx';
import { WaveDivider } from '../brand/WaveDivider.jsx';

/** Lucide has Instagram and Facebook but not TikTok, so TikTok is inline. */
function TikTokIcon({ className = 'size-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 1 1 .77-5.06V9.7a5.68 5.68 0 0 0-.77-.05A5.68 5.68 0 1 0 15.54 15.4V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.28 4.28 0 0 1-3.24-1.48Z" />
    </svg>
  );
}

const COLUMNS = [
  {
    title: 'Navigate',
    links: [
      { label: 'Shop all', to: '/shop' },
      { label: 'Categories', to: '/category/new-arrivals' },
      { label: 'New arrivals', to: '/category/new-arrivals' },
      { label: 'About', to: '/about' },
    ],
  },
  {
    title: 'Customer support',
    links: [
      { label: 'Contact', to: '/contact' },
      { label: 'Shipping information', to: '/about' },
      { label: 'Returns / refund policy', to: '/about' },
      { label: 'Order tracking', to: '/track-order' },
      { label: 'FAQ', to: '/about' },
    ],
  },
  {
    title: 'Shopping',
    links: [
      { label: 'Your account', to: '/account' },
      { label: 'Your orders', to: '/account/orders' },
      { label: 'Saved items', to: '/account/wishlist' },
      { label: 'Addresses', to: '/account/addresses' },
      { label: 'Cart', to: '/cart' },
    ],
  },
];

const SOCIALS = [
  { label: 'Instagram', href: 'https://instagram.com', Icon: InstagramIcon },
  { label: 'TikTok', href: 'https://tiktok.com', Icon: TikTokIcon },
  { label: 'Facebook', href: 'https://facebook.com', Icon: FacebookIcon },
];

function InstagramIcon({ className = 'size-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookIcon({ className = 'size-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M14 9V7.2c0-.8.2-1.2 1.4-1.2H16V3h-2.4C11 3 10 4.6 10 7v2H8v3h2v9h4v-9h2.3l.7-3H14Z" />
    </svg>
  );
}

const PAYMENTS = ['Visa', 'Mastercard', 'Amex', 'PayPal', 'Apple Pay'];

export default function Footer() {
  return (
    <footer className="on-dark relative overflow-hidden bg-navy pt-16">
      <WaveDivider tone="dark" height={110} />

      <div className="container-z relative">
        {/* Top: brand + newsletter. */}
        <div className="grid gap-10 border-b border-white/10 pb-12 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <Logo variant="gradient" wordClassName="text-[17px]" markClassName="size-9" />
            <p className="t-body mt-5 max-w-sm text-paper/60">
              Thousands of products from around the world, chosen with care and
              tracked all the way to your door.
            </p>

            <div className="mt-7 flex items-center gap-2.5">
              {SOCIALS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={label}
                  className="grid size-10 place-items-center rounded-full border border-white/15 text-paper/70 transition hover:border-mh-blue hover:text-paper"
                >
                  <Icon />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h2 className="t-title text-paper">Stay in the current</h2>
            <p className="t-small mt-2 text-paper/55">
              New arrivals and the occasional good idea. No noise.
            </p>
            <div className="mt-5">
              <NewsletterForm />
            </div>
          </div>
        </div>

        {/* Link columns. */}
        <div className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="t-eyebrow text-paper/45">{column.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="t-small text-paper/65 transition hover:text-paper"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div>
            <h2 className="t-eyebrow text-paper/45">We accept</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {PAYMENTS.map((method) => (
                <li
                  key={method}
                  className="rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] font-medium text-paper/60"
                >
                  {method}
                </li>
              ))}
            </ul>
            <p className="t-caption mt-5 text-paper/40">
              Payments are processed securely. We never store your card details.
            </p>
          </div>
        </div>

        {/* The giant flowing wordmark. */}
        <div className="pb-2 pt-2">
          <FlowWordmark />
        </div>

        {/* Legal. */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/10 py-7 sm:flex-row">
          <p className="t-caption text-paper/45">
            © {new Date().getFullYear()} MARKETHUB. All rights reserved.
          </p>
          <ul className="flex items-center gap-5">
            <li>
              <Link to="/about" className="t-caption text-paper/45 transition hover:text-paper/80">
                Privacy
              </Link>
            </li>
            <li>
              <Link to="/about" className="t-caption text-paper/45 transition hover:text-paper/80">
                Terms
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}