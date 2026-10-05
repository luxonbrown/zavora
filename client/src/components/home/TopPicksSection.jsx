/**
 * Scene D — "Top Picks" ranking panel + horizontally scrolling collection rails.
 *
 * The discovery *logic* comes from the Alibaba reference (a ranking panel next
 * to collection cards with thumbnails, price and a tag); none of the branding,
 * colour or wording does. Every product comes from the existing catalogue
 * endpoints — `GET /products` with the sort keys the server already supports
 * (`newest`, `popular`, `price-asc`, `price-desc`) and `GET /products/trending`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, Flame, Sparkles, Tag } from 'lucide-react';

import productsService from '../../services/products.js';
import ProductImage from '../product/ProductImage.jsx';
import { useInView, usePrefersReducedMotion } from '../../hooks/useMotionPrefs.js';
import { cx } from '../../utils/format.js';
import { formatPrice } from '../../utils/format.js';

const RANKINGS = [
  { id: 'popular', label: 'Most popular', sort: 'popular', icon: Flame },
  { id: 'new', label: 'New in', sort: 'newest', icon: Sparkles },
  { id: 'value', label: 'Best value', sort: 'price-asc', icon: Tag },
];

const RAILS = [
  { id: 'trending', title: 'Market trending', subtitle: 'What everyone is looking at this week', sort: 'popular' },
  { id: 'new', title: 'New arrivals', subtitle: 'Freshly added to the catalogue', sort: 'newest' },
  { id: 'value', title: 'Best value', subtitle: 'Lowest prices we carry', sort: 'price-asc' },
];

export default function TopPicksSection({ className = '' }) {
  const [ref, inView] = useInView({ rootMargin: '200px' });
  const reduced = usePrefersReducedMotion();

  const [ranking, setRanking] = useState(RANKINGS[0].id);
  const [rankingItems, setRankingItems] = useState([]);
  const [railItems, setRailItems] = useState({});
  const [loading, setLoading] = useState(true);

  const railRefs = useRef({});
  const [dots, setDots] = useState({});

  const activeRanking = RANKINGS.find((r) => r.id === ranking) ?? RANKINGS[0];

  // Ranking panel data.
  useEffect(() => {
    if (!inView) return undefined;
    let cancelled = false;
    setLoading(true);

    productsService
      .list({ sort: activeRanking.sort, pageSize: 8, inStock: true })
      .then((page) => {
        if (cancelled) return;
        setRankingItems(page?.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setRankingItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [inView, activeRanking.sort]);

  // Rails load lazily and only once each.
  useEffect(() => {
    if (!inView) return undefined;
    let cancelled = false;

    RAILS.forEach((rail) => {
      if (railItems[rail.id]) return;
      productsService
        .list({ sort: rail.sort, pageSize: 10, inStock: true })
        .then((page) => {
          if (cancelled) return;
          setRailItems((prev) => ({ ...prev, [rail.id]: page?.items ?? [] }));
        })
        .catch(() => {
          if (!cancelled) setRailItems((prev) => ({ ...prev, [rail.id]: [] }));
        });
    });

    return () => {
      cancelled = true;
    };
  }, [inView]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollRail = useCallback((id, dir) => {
    const el = railRefs.current[id];
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(280, el.clientWidth * 0.8), behavior: 'smooth' });
  }, []);

  const onRailScroll = useCallback((id) => (event) => {
    const el = event.currentTarget;
    const page = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    setDots((prev) => ({ ...prev, [id]: page }));
  }, []);

  return (
    <section ref={ref} className={cx('bg-paper py-24', className)}>
      <div className="container-z">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="t-eyebrow">Curated for you</p>
            <h2 className="h2-section mt-3 text-ink">
              Today&apos;s <span className="text-gradient-brand">top picks</span>
            </h2>
          </div>
          <Link
            to="/shop"
            className="group inline-flex items-center gap-1.5 text-[14px] font-medium text-ink"
          >
            View all
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={1.8} />
          </Link>
        </header>

        <div className="mt-10 grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* Ranking panel. */}
          <aside className="rounded-[28px] border border-line bg-canvas p-5 lg:sticky lg:top-24 lg:self-start">
            <h3 className="t-eyebrow">Rankings</h3>
            <div className="mt-4 space-y-1.5" role="tablist" aria-label="Product rankings">
              {RANKINGS.map((option) => {
                const Icon = option.icon;
                const isActive = option.id === ranking;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setRanking(option.id)}
                    className={cx(
                      'flex w-full items-center gap-2.5 rounded-full px-4 py-2.5 text-left text-[13.5px] font-medium transition',
                      isActive
                        ? 'bg-brand-gradient text-white shadow-glow-blue'
                        : 'text-muted hover:bg-paper hover:text-ink'
                    )}
                  >
                    <Icon className="size-4 shrink-0" strokeWidth={1.9} aria-hidden />
                    {option.label}
                  </button>
                );
              })}
            </div>

            {/* #1 highlight. */}
            {loading ? (
              <div className="mt-5 space-y-3">
                <div className="skeleton h-40 rounded-[20px]" />
                <div className="skeleton h-4 w-3/4 rounded-full" />
                <div className="skeleton h-4 w-1/3 rounded-full" />
              </div>
            ) : rankingItems.length ? (
              <Link
                to={`/product/${rankingItems[0].slug}`}
                className="group mt-5 block overflow-hidden rounded-[20px] border border-line bg-paper"
              >
                <div className="relative h-[190px] w-full bg-white">
                  <ProductImage product={rankingItems[0]} ratio="none" fit="contain" hoverSwap={false} className="h-full" />
                  <span className="absolute left-3 top-3 rounded-full bg-brand-gradient px-2.5 py-1 text-[11px] font-semibold text-white">
                    #1 {activeRanking.label}
                  </span>
                </div>
                <div className="p-4">
                  <p className="t-small line-clamp-2 font-medium text-ink">
                    {rankingItems[0].name}
                  </p>
                  <p className="t-small tnum mt-1.5 font-medium text-ink">
                    {formatPrice(rankingItems[0].price)}
                  </p>
                </div>
              </Link>
            ) : (
              <p className="t-small mt-5 text-muted">
                No products available for this ranking yet.
              </p>
            )}

            {/* Runners-up. */}
            {rankingItems.length > 1 ? (
              <ol className="mt-4 space-y-2.5">
                {rankingItems.slice(1, 4).map((product, i) => (
                  <li key={`${product.slug}-${i}`}>
                    <Link
                      to={`/product/${product.slug}`}
                      className="group flex items-center gap-3 rounded-2xl p-1.5 transition hover:bg-paper"
                    >
                      <span className="t-caption tnum w-4 shrink-0 font-semibold text-muted">
                        {i + 2}
                      </span>
                      <span className="size-11 shrink-0 overflow-hidden rounded-xl bg-surface-muted">
                        <ProductImage
                          product={product}
                          ratio="1/1"
                          hoverSwap={false}
                          className="size-full"
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-medium text-ink">
                          {product.name}
                        </span>
                        <span className="tnum block text-[12px] text-muted">
                          {formatPrice(product.price)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : null}
          </aside>

          {/* Collection rails. */}
          <div className="space-y-10">
            {RAILS.map((rail) => {
              const items = railItems[rail.id];
              const page = dots[rail.id] ?? 0;

              return (
                <section key={rail.id} aria-label={rail.title}>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <h3 className="h3-sub text-ink">{rail.title}</h3>
                      <p className="t-small mt-1 text-muted">{rail.subtitle}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => scrollRail(rail.id, -1)}
                        aria-label={`Scroll ${rail.title} left`}
                        className="grid size-9 place-items-center rounded-full border border-line text-ink transition hover:border-mh-blue hover:text-mh-blue"
                      >
                        <ChevronLeft className="size-4" strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollRail(rail.id, 1)}
                        aria-label={`Scroll ${rail.title} right`}
                        className="grid size-9 place-items-center rounded-full border border-line text-ink transition hover:border-mh-blue hover:text-mh-blue"
                      >
                        <ChevronRight className="size-4" strokeWidth={2} />
                      </button>
                    </div>
                  </div>

                  {!items ? (
                    <div className="mt-5 flex gap-4">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="skeleton h-64 w-[220px] shrink-0 rounded-[22px]" />
                      ))}
                    </div>
                  ) : items.length === 0 ? (
                    <p className="t-small mt-5 text-muted">Nothing here yet.</p>
                  ) : (
                    <>
                      <div
                        ref={(el) => {
                          railRefs.current[rail.id] = el;
                        }}
                        onScroll={onRailScroll(rail.id)}
                        className="no-scrollbar mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
                      >
                        {/* The Explore card leads each rail. */}
                        <Link
                          to="/shop"
                          className="group relative flex w-[220px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-[22px] bg-navy p-5 text-paper"
                        >
                          <div className="absolute inset-0 bg-brand-gradient opacity-25 transition-opacity duration-500 group-hover:opacity-40" aria-hidden />
                          <div className="relative">
                            <p className="t-eyebrow text-paper/60">{rail.title}</p>
                            <p className="t-title mt-2 leading-snug">{rail.subtitle}</p>
                          </div>
                          <span className="relative mt-6 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/95 px-4 py-2 text-[12.5px] font-semibold text-ink">
                            Explore
                            <ArrowRight className="size-3.5" strokeWidth={2.2} />
                          </span>
                        </Link>

                        {items.map((product, i) => (
                          <Link
                            key={`${product.slug}-${i}`}
                            to={`/product/${product.slug}`}
                            className="group w-[220px] shrink-0 snap-start overflow-hidden rounded-[22px] border border-line bg-paper transition hover:border-mh-blue"
                          >
                            <div className="relative">
                              <ProductImage product={product} ratio="4/5" />
                              {i < 2 ? (
                                <span className="absolute left-3 top-3 rounded-full bg-mh-blue px-2.5 py-1 text-[10.5px] font-semibold text-white">
                                  {rail.id === 'new' ? 'New' : 'Hot'}
                                </span>
                              ) : null}
                            </div>
                            <div className="p-4">
                              <p className="t-small line-clamp-2 font-medium leading-snug text-ink">
                                {product.name}
                              </p>
                              <p className="t-small tnum mt-1.5 text-muted">
                                {formatPrice(product.price)}
                              </p>
                            </div>
                          </Link>
                        ))}
                      </div>

                      {/* Pagination dots. */}
                      {!reduced ? (
                        <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden>
                          {[0, 1, 2].map((index) => (
                            <span
                              key={index}
                              className={cx(
                                'h-1.5 rounded-full transition-all duration-300',
                                page === index ? 'w-6 bg-brand-gradient' : 'w-1.5 bg-line-strong'
                              )}
                            />
                          ))}
                        </div>
                      ) : null}
                    </>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}