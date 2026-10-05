/**
 * MARKETHUB homepage — "flowing water".
 *
 * Scene order follows the brief: hero → box-open transition → karaoke
 * statement → top picks + rails → orbital categories → why → process →
 * newsletter → footer. Heavy scenes are code-split and each one internally
 * degrades on reduced-motion / low-power, so the page is never blank and never
 * the most expensive thing on the device.
 *
 * All product and category data comes from the existing API through
 * `productsService` — nothing is hard-coded and CJ is never called from here.
 */
import { Suspense, lazy, useCallback, useEffect, useState } from 'react';

import Hero from '../../components/home/Hero.jsx';
import BirdFlight from '../../components/brand/BirdFlight.jsx';
import StatementSection from '../../components/home/StatementSection.jsx';
import TopPicksSection from '../../components/home/TopPicksSection.jsx';
import WhySection from '../../components/home/WhySection.jsx';
import NewsletterBand from '../../components/home/NewsletterBand.jsx';
import { WaveDivider } from '../../components/brand/WaveDivider.jsx';
import productsService from '../../services/products.js';
import { cx } from '../../utils/format.js';

// Heavy scenes are split out so the first paint is only the hero.
const ProductRevealVideo = lazy(() => import('../../components/home/ProductRevealVideo.jsx'));
const OrbitGallery = lazy(() => import('../../components/brand/OrbitGallery.jsx'));
const ProcessDiagram = lazy(() => import('../../components/brand/ProcessDiagram.jsx'));

function SceneFallback({ height = 'h-[60vh]' }) {
  return (
    <div className={cx('bg-navy', height)}>
      <div className="flex h-full items-center justify-center">
        <div className="size-10 animate-pulse rounded-full bg-brand-gradient opacity-30" />
      </div>
    </div>
  );
}

export default function Home() {
  const [orbitProducts, setOrbitProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [loadingOrbit, setLoadingOrbit] = useState(true);

  useEffect(() => {
    document.title = 'MARKETHUB — Shop the world. Flow with it.';
  }, []);

  // Categories for the orbital section's selector.
  useEffect(() => {
    let cancelled = false;
    productsService
      .topCategories()
      .then((tree) => {
        if (!cancelled) setCategories(Array.isArray(tree) ? tree : []);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Orbit contents follow the selected category, or the default trending set.
  const loadOrbit = useCallback((categorySlug) => {
    setLoadingOrbit(true);
    const request = categorySlug
      ? productsService.listByCategory(categorySlug, { pageSize: 24, inStock: true })
      : productsService.trending(24);

    request
      .then((result) => {
        // `trending` returns a bare array; `list*` returns a page envelope.
        const items = Array.isArray(result) ? result : (result?.items ?? []);
        setOrbitProducts(items);
      })
      .catch(() => setOrbitProducts([]))
      .finally(() => setLoadingOrbit(false));
  }, []);

  useEffect(() => {
    loadOrbit(null);
  }, [loadOrbit]);

  const onSelectCategory = useCallback(
    (slug) => {
      setActiveCategory(slug);
      loadOrbit(slug);
    },
    [loadOrbit],
  );

  return (
    <>
      <Hero />

      {/* Scene 1 — the bird detaches from the hero and flies toward the box.
          Fixed overlay, scrubbed, and skipped entirely for reduced motion /
          low power (it renders null). */}
      <BirdFlight />

      {/* Hero navy → reveal-video stage. */}
      <div className="bg-navy">
        <WaveDivider tone="dark" height={130} />
      </div>

      <Suspense fallback={<SceneFallback />}>
        <ProductRevealVideo />
      </Suspense>

      {/* Reveal stage → karaoke navy. */}
      <div className="bg-indigo">
        <WaveDivider tone="dark" height={130} />
      </div>

      <StatementSection />

      {/* Hand off dark → light before the discovery rails. */}
      <WaveDivider tone="light" height={140} flip />

      <TopPicksSection />

      <Suspense fallback={<SceneFallback height="h-[40vh]" />}>
        {loadingOrbit ? (
          <section className="container-z py-20">
            <div className="skeleton mx-auto h-[520px] max-w-5xl rounded-full" />
          </section>
        ) : (
          <OrbitGallery
            products={orbitProducts}
            categories={categories}
            activeCategory={activeCategory}
            onSelectCategory={onSelectCategory}
            className="bg-canvas"
          />
        )}
      </Suspense>

      <WhySection />

      <Suspense fallback={<SceneFallback height="h-[40vh]" />}>
        <ProcessDiagram />
      </Suspense>

      <NewsletterBand />
    </>
  );
}