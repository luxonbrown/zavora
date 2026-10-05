/**
 * The reveal clip, presented as a product box alongside real products.
 *
 * What it is: a boxed video card on one side and a grid of live CJ products on
 * the other — not a full-screen player, and not an auto-hiding effect. The clip
 * is scenery and must simply be visible.
 *
 * What it deliberately is NOT (per the last two rounds of feedback):
 *   - full-viewport cinematic hero that opacity-hides until a media event fired
 *   - a tall ScrollTrigger pin (overlapping with sticky, hiding frames, and
 *     fighting the layout above/below it)
 *   - a letterbox of scrims and drifting glow behind it
 *
 * A plain IntersectionObserver starts playback when the card is ~60% visible and
 * pauses it when it leaves, so it behaves like inline media, not a spectacle.
 */
import { useEffect, useRef, useState } from 'react';

import { Mark } from '../brand/Logo.jsx';
import ProductImage from '../product/ProductImage.jsx';
import { WaveDivider } from '../brand/WaveDivider.jsx';
import { useInView, usePrefersReducedMotion } from '../../hooks/useMotionPrefs.js';
import productService from '../../services/products.js';
import { formatPrice } from '../../utils/format.js';
import { cx } from '../../utils/format.js';

const VIDEO_SRC = '/videos/ads.mp4';
const POSTER_SRC = '/videos/ads-poster.jpg';

export default function ProductRevealVideo({ className = '' }) {
  const videoRef = useRef(null);
  const [cardRef, inView] = useInView({ rootMargin: '0px 0px -10% 0px', threshold: 0.4 });
  const reduced = usePrefersReducedMotion();

  const [failed, setFailed] = useState(false);
  const [products, setProducts] = useState([]);

  // Start/stop playback with visibility. No pinning, no fading-out timers.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || failed || reduced) return;
    // React's `muted` JSX attribute does not always flip the element's muted
    // IDL property, and an unmuted autoplaying video is blocked by every modern
    // browser. Set it as a property so autoplay is actually allowed.
    try {
      // eslint-disable-next-line no-param-reassign
      v.muted = true;
    } catch {
      /* ignore */
    }
    if (inView) {
      try {
        v.play?.().catch(() => {});
      } catch {
        /* ignore */
      }
    } else {
      try {
        v.pause?.();
      } catch {
        /* ignore */
      }
    }
  }, [inView, failed, reduced]);

  useEffect(() => {
    let cancelled = false;
    productService
      .list({ sort: 'popular', pageSize: 4, inStock: true })
      .then((page) => {
        if (!cancelled) setProducts(page?.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      ref={cardRef}
      className={cx('relative isolate', className)}
      aria-label="Featured"
    >
      <div className="bg-navy">
        <WaveDivider tone="dark" height={130} />
      </div>

      <div
        className="relative"
        style={{
          background:
            'radial-gradient(120% 100% at 50% 0%, #0D0045 0%, #090A38 45%, #06121F 100%)',
        }}
      >
        <div className="container-z relative grid items-center gap-10 py-20 lg:grid-cols-2 lg:py-28">
          {/* ---- Left: the boxed video ---- */}
          <div>
            <p className="t-eyebrow text-paper/55">Featured</p>
            <h2 className="h2-section mt-3 max-w-xl text-paper">
              From the maker&apos;s bench to <span className="text-gradient-brand">your door</span>
            </h2>

            <div className="relative mt-8 w-full">
              <div
                className="absolute -inset-3 rounded-[30px] bg-brand-gradient opacity-25 blur-2xl"
                aria-hidden
              />
              <div className="relative rounded-3xl bg-brand-gradient p-px shadow-glow-blue">
                <div className="relative overflow-hidden rounded-[calc(1.5rem-1px)] bg-navy">
                  {/* Fixed aspect ratio: no layout shift while the file loads. */}
                  <div style={{ aspectRatio: '16 / 9' }}>
                    {!failed ? (
                      <video
                        ref={videoRef}
                        className="block size-full"
                        style={{ objectFit: 'cover' }}
                        src={VIDEO_SRC}
                        poster={POSTER_SRC}
                        muted
                        autoPlay
                        playsInline
                        loop
                        preload="auto"
                        controls={false}
                        aria-hidden
                        tabIndex={-1}
                        onError={() => setFailed(true)}
                      />
                    ) : (
                      <div className="grid size-full place-items-center bg-canvas px-8 text-center">
                        <div>
                          <Mark className="mx-auto size-14 opacity-50" title={null} />
                          <p className="t-small mt-4 text-muted">
                            Clip unavailable — add <code>/videos/ads.mp4</code>.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ---- Right: a clean, parallel product grid ---- */}
          <div>
            <div className="flex items-end justify-between gap-4">
              <h3 className="h3-sub text-paper">Featured now</h3>
              <a href="/shop" className="text-[13px] font-medium text-mh-sky hover:underline">
                View all →
              </a>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              {products.length === 0
                ? [...Array(4)].map((_, i) => (
                    <div key={i} className="skeleton h-[210px] rounded-[22px]" />
                  ))
                : products.map((p) => (
                    <a
                      key={p.id ?? p.slug}
                      href={`/product/${p.slug}`}
                      className="group block overflow-hidden rounded-[22px] border border-white/10 bg-white/5 transition hover:border-mh-sky/40"
                    >
                      <div className="relative">
                        <ProductImage product={p} ratio="4/5" hoverSwap={false} />
                      </div>
                      <div className="p-3.5">
                        <p className="line-clamp-2 text-[12.5px] font-medium leading-snug text-paper">
                          {p.name}
                        </p>
                        <p className="tnum mt-1 text-[12.5px] text-paper/60">
                          {formatPrice(p.price)}
                        </p>
                      </div>
                    </a>
                  ))}
            </div>
          </div>
        </div>

        <WaveDivider tone="dark" height={130} />
      </div>
    </section>
  );
}