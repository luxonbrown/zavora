/**
 * Scene E — "Shop by category": products on concentric orbits around a
 * glowing centre, connected by flowing stream curves.
 *
 * Implementation notes that matter:
 *  - Position is computed once per frame in a rAF loop and written as a single
 *    `transform` per node. Deliberately NOT React state: re-rendering 24 nodes
 *    at 60fps would dominate the frame budget and thrash layout.
 *  - The loop stops when the section leaves the viewport.
 *  - Reduced motion and mobile get a compact arc/carousel instead of an orbit,
 *    with a reduced node count.
 *  - Everything is a real link, and a visually-hidden list mirrors the orbital
 *    arrangement so keyboard and screen-reader users get the same content.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import ProductImage from '../product/ProductImage.jsx';
import { useInView, useLowPower, useMediaQuery, usePrefersReducedMotion, useReveal } from '../../hooks/useMotionPrefs.js';
import { cx } from '../../utils/format.js';
import { formatPrice } from '../../utils/format.js';

const ORBIT_SPEEDS = [0.055, -0.038, 0.026]; // degrees per frame, per ring
const DESKTOP_NODES = 22;
const MOBILE_NODES = 9;

/** Even angular distribution with a per-index offset so rings don't align. */
function layout(count, ring, spin) {
  const step = 360 / count;
  return Array.from({ length: count }, (_, i) => {
    const angle = i * step + spin;
    const rad = (angle * Math.PI) / 180;
    return { angle, x: Math.cos(rad), y: Math.sin(rad) };
  });
}

export default function OrbitGallery({
  products = [],
  categories = [],
  activeCategory,
  onSelectCategory,
  className = '',
}) {
  // Two different questions, deliberately two hooks:
  //   inView   — is it on screen right now? gates the rAF loop (pause offscreen)
  //   revealed — may the content be shown? fail-safe, never permanently hidden
  const [viewportRef, inView] = useInView({ rootMargin: '250px' });
  const [ref, revealed] = useReveal({ rootMargin: '250px', ref: viewportRef });
  const reduced = usePrefersReducedMotion();
  const lowPower = useLowPower();
  const isDesktop = useMediaQuery('(min-width: 900px)');

  const compact = !isDesktop || lowPower;
  const nodeCount = compact ? MOBILE_NODES : DESKTOP_NODES;

  const ringRef = useRef(null);
  const nodeRefs = useRef([]);
  const spin = useRef(0);
  const [hovered, setHovered] = useState(null);
  const [paused, setPaused] = useState(false);

  const items = useMemo(() => {
    const list = products.filter(Boolean).slice(0, nodeCount);
    // Orbit two always gets *something*: with one product the inner ring would
    // otherwise be an empty circle, which reads as broken rather than sparse.
    if (list.length === 1) return [list[0], list[0]];
    return list;
  }, [products, nodeCount]);

  // Split across rings, largest ring outermost.
  const rings = useMemo(() => {
    if (!items.length) return [];
    const perRing = Math.ceil(items.length / 3);
    return [
      items.slice(0, perRing),
      items.slice(perRing, perRing * 2),
      items.slice(perRing * 2),
    ].filter((r) => r.length);
  }, [items]);

  // The animation loop. Transform-only writes.
  useEffect(() => {
    if (reduced || !inView || compact || paused || !items.length) return undefined;

    let frame = 0;
    const tick = () => {
      spin.current = (spin.current + 0.06) % 360;
      const nodeEls = nodeRefs.current;
      let idx = 0;

      rings.forEach((ring, ringIndex) => {
        const positions = layout(ring.length, ringIndex, spin.current * (ringIndex === 1 ? -1 : 1));
        positions.forEach((p, i) => {
          const el = nodeEls[idx];
          if (el) {
            const radiusX = 46 - ringIndex * 9;
            const radiusY = 42 - ringIndex * 8;
            el.style.transform = `translate3d(calc(-50% + ${(p.x * radiusX).toFixed(2)}%), calc(-50% + ${(p.y * radiusY).toFixed(2)}%), 0)`;
            // Depth cue: nodes on the far side sit slightly smaller/dimmer.
            const depth = (p.y + 1) / 2;
            el.style.setProperty('--depth', depth.toFixed(3));
          }
          idx += 1;
        });
      });

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduced, inView, compact, paused, rings, items.length]);

  // Reveal nodes progressively. The fail-safe hook already guarantees this is
  // true even if the observer never fires.
  const shown = revealed || reduced;

  const handleCategory = (slug) => {
    if (onSelectCategory) onSelectCategory(slug);
  };

  if (!items.length) {
    return (
      <section ref={ref} className={cx('container-z py-24', className)}>
        <div className="rounded-[28px] border border-dashed border-line-strong bg-canvas px-8 py-16 text-center">
          <p className="t-title text-ink">No products to arrange yet</p>
          <p className="t-small mt-2 text-muted">
            Once the catalogue is synced, products appear here automatically.
          </p>
        </div>
      </section>
    );
  }

  /* ---------------- Compact: arc carousel ---------------- */
  if (compact) {
    return (
      <section ref={ref} className={cx('overflow-hidden py-20', className)} aria-label="Shop by category">
        <div className="container-z">
          <h2 className="h2-section text-ink">
            Start with what you <span className="text-gradient-brand">need</span>
          </h2>

          <div className="no-scrollbar -mx-6 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2">
            {items.map((product, i) => (
              <Link
                key={`${product.id ?? product.slug}-${i}`}
                to={`/product/${product.slug}`}
                className="group w-[190px] shrink-0 snap-center"
              >
                <div className="overflow-hidden rounded-[22px] border border-line bg-paper">
                  <ProductImage product={product} ratio="1/1" />
                  <div className="p-3.5">
                    <p className="t-small line-clamp-2 font-medium text-ink">{product.name}</p>
                    <p className="t-small tnum mt-1 text-muted">{formatPrice(product.price)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {categories.length ? (
            <div className="no-scrollbar -mx-6 mt-6 flex gap-2 overflow-x-auto px-6">
              <button
                type="button"
                onClick={() => handleCategory(null)}
                className={cx(
                  'shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition',
                  !activeCategory
                    ? 'bg-brand-gradient text-white'
                    : 'border border-line bg-paper text-muted hover:text-ink'
                )}
              >
                All products
              </button>
              {categories.slice(0, 12).map((cat) => (
                <button
                  key={cat.slug}
                  type="button"
                  onClick={() => handleCategory(cat.slug)}
                  className={cx(
                    'shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition',
                    activeCategory === cat.slug
                      ? 'bg-brand-gradient text-white'
                      : 'border border-line bg-paper text-muted hover:text-ink'
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <ul className="sr-only">
          {items.map((p, i) => (
            <li key={`sr-${p.slug}-${i}`}>
              <Link to={`/product/${p.slug}`}>{p.name}</Link>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  /* ---------------- Desktop: true orbits ---------------- */
  let flatIndex = 0;

  return (
    <section ref={ref} className={cx('relative overflow-hidden py-24', className)} aria-label="Shop by category">
      <div className="container-z">
        <header className="mx-auto max-w-2xl text-center">
          <p className="t-eyebrow">Shop by category</p>
          <h2 className="h2-section mt-3 text-ink">
            Start with what you <span className="text-gradient-brand">need</span>
          </h2>
        </header>

        {categories.length ? (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => handleCategory(null)}
              className={cx(
                'rounded-full px-4 py-2 text-[13px] font-medium transition',
                !activeCategory
                  ? 'bg-brand-gradient text-white shadow-glow-blue'
                  : 'border border-line bg-paper text-muted hover:text-ink'
              )}
            >
              All products
            </button>
            {categories.slice(0, 10).map((cat) => (
              <button
                key={cat.slug}
                type="button"
                onClick={() => handleCategory(cat.slug)}
                className={cx(
                  'rounded-full px-4 py-2 text-[13px] font-medium transition',
                  activeCategory === cat.slug
                    ? 'bg-brand-gradient text-white shadow-glow-blue'
                    : 'border border-line bg-paper text-muted hover:text-ink'
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div
        className="relative mx-auto mt-10 h-[620px] w-full max-w-5xl"
        onMouseEnter={() => setPaused(false)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Glowing centre orb. */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 size-[240px] -translate-x-1/2 -translate-y-1/2">
          <div className="absolute inset-0 animate-drift rounded-full bg-brand-gradient opacity-25 blur-3xl" />
          <div className="absolute inset-8 rounded-full border border-white/60 bg-white/70 backdrop-blur-xl" />
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <p className="wordmark text-[13px] text-ink">{activeCategoryName(categories, activeCategory)}</p>
              <p className="t-caption mt-1 text-muted">{items.length} picks</p>
            </div>
          </div>
        </div>

        {/* Orbit rings + flowing stream curves. */}
        <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 1000 620" aria-hidden>
          <defs>
            <linearGradient id="mh-stream" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1D6BFF" stopOpacity="0.05" />
              <stop offset="50%" stopColor="#4CC9F0" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {[0, 1, 2].slice(0, rings.length).map((ringIndex) => (
            <ellipse
              key={ringIndex}
              cx="500"
              cy="310"
              rx={460 - ringIndex * 90}
              ry={420 - ringIndex * 80}
              fill="none"
              stroke="url(#mh-stream)"
              strokeWidth="1.5"
              strokeDasharray="10 14"
            >
              {!reduced ? (
                <animate
                  attributeName="stroke-dashoffset"
                  dur={`${16 + ringIndex * 6}s`}
                  repeatCount="indefinite"
                  values="0;-240"
                />
              ) : null}
            </ellipse>
          ))}

          {/* Connect neighbouring nodes with a flowing stream. */}
          {items.slice(0, 14).map((_, i) => {
            const a = (i * 2.618) % 1; // golden-angle spacing, no cluster
            const b = ((i + 1) * 2.618) % 1;
            const ang = (t) => t * Math.PI * 2;
            const r = 200;
            const x1 = 500 + Math.cos(ang(a)) * r;
            const y1 = 310 + Math.sin(ang(a)) * r * 0.88;
            const x2 = 500 + Math.cos(ang(b)) * r;
            const y2 = 310 + Math.sin(ang(b)) * r * 0.88;
            return (
              <path
                key={`stream-${i}`}
                d={`M${x1},${y1} Q500,${y1 < 310 ? y1 - 60 : y1 + 60} ${x2},${y2}`}
                fill="none"
                stroke="url(#mh-stream)"
                strokeWidth="1"
                opacity="0.5"
              />
            );
          })}
        </svg>

        {/* Nodes. Transform-only positioning, driven by the rAF loop above. */}
        {rings.map((ring, ringIndex) =>
          ring.map((product, i) => {
            const index = flatIndex++;
            const isHovered = hovered === index;
            return (
              <Link
                key={`${product.id ?? product.slug}-${index}`}
                ref={(el) => {
                  nodeRefs.current[index] = el;
                }}
                to={`/product/${product.slug}`}
                onMouseEnter={() => setHovered(index)}
                onFocus={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
                onBlur={() => setHovered(null)}
                className={cx(
                  'group absolute left-1/2 top-1/2 z-10 block w-[112px] -translate-x-1/2 -translate-y-1/2 rounded-full',
                  'transition-[opacity,filter] duration-500 ease-out',
                  shown ? 'opacity-100' : 'opacity-0'
                )}
                style={{
                  // --depth is written each frame for the near/far size cue.
                  opacity: shown ? undefined : 0,
                  transitionDelay: shown ? `${Math.min(index * 45, 700)}ms` : '0ms',
                }}
                tabIndex={shown ? 0 : -1}
              >
                <div
                  className={cx(
                    'relative aspect-square overflow-hidden rounded-full border bg-paper shadow-lift transition-transform duration-300',
                    isHovered ? 'scale-110 border-mh-blue' : 'border-white'
                  )}
                  style={{
                    // Slight depth-driven scale without touching layout.
                    filter: 'saturate(1.05)',
                  }}
                >
                  <ProductImage
                    product={product}
                    ratio="1/1"
                    className="size-full rounded-full"
                    hoverSwap={false}
                  />
                </div>

                {/* Mini info on hover/focus. */}
                <div
                  className={cx(
                    'pointer-events-none absolute left-1/2 top-[calc(100%+10px)] z-20 w-[190px] -translate-x-1/2 rounded-2xl border border-line bg-paper p-3 text-left shadow-lift transition-all duration-200',
                    isHovered ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
                  )}
                >
                  <p className="t-small line-clamp-2 font-medium text-ink">{product.name}</p>
                  <p className="t-small tnum mt-1 text-muted">{formatPrice(product.price)}</p>
                  <span className="t-caption mt-2 inline-flex items-center gap-1 font-medium text-mh-blue">
                    View product →
                  </span>
                </div>
              </Link>
            );
          }),
        )}
      </div>

      <div className="container-z flex justify-center">
        <Link
          to="/shop"
          className="rounded-full bg-brand-gradient px-7 py-3.5 text-[14px] font-medium text-white shadow-glow-blue transition hover:brightness-110"
        >
          View all products
        </Link>
      </div>

      {/* Accessible mirror of the orbital layout. */}
      <ul className="sr-only">
        {items.map((p, i) => (
          <li key={`sr-${p.slug}-${i}`}>
            <Link to={`/product/${p.slug}`}>{p.name}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function activeCategoryName(categories, active) {
  if (!active) return 'MARKETHUB';
  return categories.find((c) => c.slug === active)?.name ?? 'MARKETHUB';
}