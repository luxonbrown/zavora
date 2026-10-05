/**
 * Scene G — "How it works": eight connected steps.
 *
 * One SVG path threads all eight cards and draws itself as the section scrolls.
 * Desktop lays the cards out on a 2-row snake so the connector can snake too;
 * below `lg` it collapses to a single vertical timeline with a straight
 * connector, because a zig-zag on a 380px screen is unreadable.
 */
import { useEffect, useRef, useState } from 'react';
import {
  Banknote,
  Box,
  CheckCircle2,
  CreditCard,
  Package,
  Search,
  Truck,
} from 'lucide-react';

import { Bird } from './Logo.jsx';
import { useInView, usePrefersReducedMotion } from '../../hooks/useMotionPrefs.js';
import { cx } from '../../utils/format.js';

/**
 * The connector the bird flies along. Must match the SVG path below exactly or
 * the bird leaves the line — both are driven from this one constant.
 */
const SNAKE_PATH =
  'M75,110 C260,110 260,300 445,300 C630,300 630,110 815,110 C1000,110 1000,300 1125,300';

const STEPS = [
  { id: 'browse', label: 'Browse', icon: Search, body: 'Explore a catalogue built from the world’s best makers.' },
  { id: 'choose', label: 'Choose', icon: CheckCircle2, body: 'Pick a size, a colour, and we take care of the rest.' },
  { id: 'order', label: 'Order', icon: Package, body: 'Checkout in a couple of taps. No hidden steps.' },
  { id: 'payment', label: 'Payment', icon: CreditCard, body: 'Pay securely. Your card details are never stored here.' },
  { id: 'processing', label: 'Processing', icon: Box, body: 'We confirm stock and prepare your order for dispatch.' },
  { id: 'shipping', label: 'Shipping', icon: Truck, body: 'On its way, with a carrier you can trust.' },
  { id: 'tracking', label: 'Tracking', icon: Banknote, body: 'Follow every step, from our shelf to your door.' },
  { id: 'delivery', label: 'Delivery', icon: CheckCircle2, body: 'Delivered. Questions? Our team is right here.' },
];

export default function ProcessDiagram({ className = '' }) {
  const [ref, inView] = useInView({ rootMargin: '0px 0px -15% 0px', threshold: 0.2 });
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const birdRef = useRef(null);
  const pathRef = useRef(null);

  // Lights each card up in sequence as the section passes through the viewport,
  // and walks the bird along the connector at the same rate.
  useEffect(() => {
    if (reduced || !inView) return undefined;
    let frame = 0;
    const start = performance.now();
    const DURATION = STEPS.length * 0.15;

    const tick = (now) => {
      const elapsed = (now - start) / 1000;
      const p = Math.min(1, elapsed / DURATION);
      setProgress(p);
      setActive(Math.min(STEPS.length - 1, Math.floor(p * STEPS.length)));

      // Position the bird from the path itself rather than a hand-written
      // curve, so it can never drift off the line if the path changes.
      const path = pathRef.current;
      const bird = birdRef.current;
      if (path && bird && typeof path.getPointAtLength === 'function') {
        const total = path.getTotalLength();
        if (total > 0) {
          const pt = path.getPointAtLength(total * p);
          const svg = path.ownerSVGElement;
          const rect = svg.getBoundingClientRect();
          const vb = svg.viewBox.baseVal;
          // Map viewBox units to the element's rendered pixels.
          const sx = rect.width / (vb.width || rect.width);
          const sy = rect.height / (vb.height || rect.height);
          bird.style.transform = `translate3d(${pt.x * sx}px, ${pt.y * sy}px, 0) translate(-50%, -50%)`;
          bird.style.opacity = '1';
        }
      }

      if (elapsed < DURATION + 0.5) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, reduced]);

  return (
    <section ref={ref} className={cx('relative overflow-hidden bg-canvas py-24', className)}>
      <div className="container-z">
        <header className="mx-auto max-w-2xl text-center">
          <p className="t-eyebrow">How it works</p>
          <h2 className="h2-section mt-3 text-ink">
            From click to <span className="text-gradient-brand">doorstep</span>
          </h2>
          <p className="t-body mt-4 text-muted">
            Eight simple steps. You can watch every one of them from your account.
          </p>
        </header>

        {/* You-are-here progress. */}
        <div className="mx-auto mt-10 flex max-w-md items-center gap-1.5" aria-hidden>
          {STEPS.map((step, i) => (
            <span
              key={step.id}
              className={cx(
                'h-1 flex-1 rounded-full transition-colors duration-300',
                i <= active ? 'bg-brand-gradient' : 'bg-line'
              )}
            />
          ))}
        </div>
        <p className="sr-only" aria-live="polite">
          Step {active + 1} of {STEPS.length}: {(STEPS[active] ?? STEPS[0]).label}
        </p>

        <div className="relative mt-12">
          {/* The connector. Hidden on mobile, where the vertical rail replaces it. */}
          <svg
            className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
            viewBox="0 0 1200 420"
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <linearGradient id="mh-process" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#1D6BFF" />
                <stop offset="50%" stopColor="#22C3C3" />
                <stop offset="100%" stopColor="#10B981" />
              </linearGradient>
            </defs>
            <path
              ref={pathRef}
              d={SNAKE_PATH}
              fill="none"
              stroke="url(#mh-process)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="1600"
              strokeDashoffset={reduced || inView ? 0 : 1600}
              style={{ transition: 'stroke-dashoffset 2.4s cubic-bezier(0.16,1,0.3,1)' }}
            />

            {/* The bird travelling the path, from Browse to Delivery. */}
            {reduced ? null : (
              <g ref={birdRef} style={{ opacity: inView ? 1 : 0, transition: 'opacity .5s ease' }}>
                <foreignObject x="-18" y="-18" width="36" height="36">
                  <Bird className="size-9" title={null} />
                </foreignObject>
              </g>
            )}
          </svg>

          {/* Vertical rail for mobile/tablet. */}
          <div className="absolute left-[27px] top-6 w-0.5 lg:hidden" aria-hidden>
            <div
              className="h-full bg-brand-gradient transition-[height] duration-1000 ease-out"
              style={{ height: reduced || inView ? '100%' : '0%' }}
            />
          </div>

          <ol className="relative grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              const isActive = i <= active;
              const row = Math.floor(i / 4);

              return (
                <li
                  key={step.id}
                  className={cx(
                    'relative rounded-[24px] border bg-paper p-6 transition-all duration-500',
                    'lg:min-h-[190px]',
                    row === 1 && 'lg:mt-10',
                    isActive
                      ? 'border-transparent shadow-lift'
                      : 'border-line opacity-60'
                  )}
                  style={
                    isActive && !reduced
                      ? { boxShadow: '0 24px 60px -28px rgb(29 107 255 / 0.45)' }
                      : undefined
                  }
                >
                  {/* Mobile rail node. */}
                  <span
                    className={cx(
                      'absolute -left-[26px] top-6 grid size-14 place-items-center rounded-full border-4 border-canvas transition-colors duration-500 lg:hidden',
                      isActive ? 'bg-brand-gradient text-white' : 'bg-paper text-muted'
                    )}
                    aria-hidden
                  >
                    <Icon className="size-5" strokeWidth={1.8} />
                  </span>

                  <span
                    className={cx(
                      't-caption tnum inline-flex size-8 items-center justify-center rounded-full transition-colors duration-500',
                      isActive ? 'bg-brand-gradient text-white' : 'bg-surface-muted text-muted'
                    )}
                    aria-hidden
                  >
                    {i + 1}
                  </span>

                  <h3 className="t-title mt-4 text-ink">{step.label}</h3>
                  <p className="t-small mt-2 text-muted">{step.body}</p>

                  {/* Gradient top edge once lit. */}
                  <span
                    className={cx(
                      'pointer-events-none absolute inset-x-6 top-0 h-px bg-brand-gradient transition-opacity duration-500',
                      isActive ? 'opacity-100' : 'opacity-0'
                    )}
                    aria-hidden
                  />
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}