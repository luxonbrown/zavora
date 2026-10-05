/**
 * Split auth shell: animated flowing-water panel on the left, form on the right.
 *
 * Reversed from the previous version so the brand panel leads on desktop. The
 * panel is pure CSS/SVG (no image request) — a generated gradient plus drifting
 * light reads better than a stock photo and cannot 404.
 */
import { Link } from 'react-router-dom';

import { Logo } from '../components/brand/Logo.jsx';
import { usePrefersReducedMotion } from '../hooks/useMotionPrefs.js';

const TAGLINES = [
  'Shop the world. Flow with it.',
  'Curated from everywhere.',
  'Tracked all the way to you.',
];

export default function AuthLayout({ title, subtitle, aside, children, footer }) {
  const reduced = usePrefersReducedMotion();
  const tagline = TAGLINES[Math.floor(Date.now() / 60000) % TAGLINES.length];

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(440px,46%)_1fr]">
      {/* Brand panel. */}
      <aside className="on-dark relative hidden overflow-hidden bg-navy lg:block">
        <div
          className="absolute inset-0 animate-flow"
          style={{
            backgroundImage:
              'linear-gradient(140deg, #06121F 0%, #0A2540 26%, #103A6B 48%, #0E5C7A 66%, #0F7A6E 84%, #0E8A5F 100%)',
          }}
          aria-hidden
        />
        <div className="absolute inset-0" aria-hidden>
          <div
            className={reduced ? undefined : 'animate-drift'}
            style={{ animationDelay: '-3s' }}
          >
            <div className="absolute -left-[14%] top-[8%] size-[46vw] rounded-full bg-mh-blue/30 blur-[120px]" />
          </div>
          <div
            className={reduced ? undefined : 'animate-drift'}
            style={{ animationDelay: '-11s' }}
          >
            <div className="absolute -right-[10%] bottom-[10%] size-[40vw] rounded-full bg-mh-emerald/24 blur-[130px]" />
          </div>
        </div>

        {/* Flowing contour lines — the "water" motif. */}
        <svg
          className="absolute inset-0 size-full opacity-30"
          viewBox="0 0 600 900"
          preserveAspectRatio="none"
          aria-hidden
        >
          {[...Array(9)].map((_, i) => (
            <path
              key={i}
              d={`M-50,${180 + i * 78} C160,${120 + i * 78} 320,${250 + i * 78} 660,${170 + i * 78}`}
              fill="none"
              stroke="#4CC9F0"
              strokeWidth="1"
              opacity={0.5 - i * 0.04}
            >
              {!reduced ? (
                <animate
                  attributeName="d"
                  dur={`${16 + i * 2}s`}
                  repeatCount="indefinite"
                  values={`M-50,${180 + i * 78} C160,${120 + i * 78} 320,${250 + i * 78} 660,${170 + i * 78};M-50,${210 + i * 78} C160,${260 + i * 78} 320,${130 + i * 78} 660,${220 + i * 78};M-50,${180 + i * 78} C160,${120 + i * 78} 320,${250 + i * 78} 660,${170 + i * 78}`}
                />
              ) : null}
            </path>
          ))}
        </svg>

        <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
          <Link to="/" aria-label="MARKETHUB home">
            <Logo
              variant="gradient"
              wordClassName="text-[17px]"
              markClassName="size-9"
            />
          </Link>

          {aside ?? (
            <div className="max-w-sm">
              <p className="wordmark text-[13px] text-paper/60">{tagline}</p>
              <p className="mt-6 text-[clamp(30px,3.4vw,46px)] font-semibold leading-[1.03] tracking-[-0.03em] text-paper">
                Thousands of products, one <span className="text-gradient-brand">calm place</span> to
                find them.
              </p>
            </div>
          )}

          <p className="t-caption text-paper/45">
            © {new Date().getFullYear()} MARKETHUB
          </p>
        </div>
      </aside>

      {/* Form side. */}
      <div className="flex flex-col bg-paper px-6 py-8 sm:px-10 lg:px-16">
        <header className="flex items-center justify-between gap-4">
          <Link to="/" aria-label="MARKETHUB home" className="lg:invisible">
            <Logo wordClassName="text-[15px]" markClassName="size-8" />
          </Link>
          <Link
            to="/shop"
            className="t-small text-muted transition hover:text-ink"
          >
            Back to shop
          </Link>
        </header>

        <div className="flex flex-1 items-center py-12">
          <div className="mx-auto w-full max-w-[400px]">
            <h1 className="h3-sub text-ink">{title}</h1>
            {subtitle ? <p className="t-small mt-2.5 text-muted">{subtitle}</p> : null}
            <div className="mt-9">{children}</div>
            {footer ? <div className="mt-8">{footer}</div> : null}
          </div>
        </div>

        <footer className="t-caption text-muted">
          © {new Date().getFullYear()} MARKETHUB · Secure session, no card details stored
        </footer>
      </div>
    </div>
  );
}