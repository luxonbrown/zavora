/**
 * Storefront chrome: navbar, main outlet, footer, chat.
 *
 * Lenis smooth scroll is started here (not at module scope) so it is destroyed
 * with the layout, and it is skipped entirely for reduced-motion visitors.
 */
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Lenis from 'lenis';

import Navbar from '../components/layout/Navbar.jsx';
import Footer from '../components/layout/Footer.jsx';
import ChatWidget from '../components/chat/ChatWidget.jsx';
import { usePrefersReducedMotion } from '../hooks/useMotionPrefs.js';

export default function StoreLayout() {
  const reduced = usePrefersReducedMotion();
  const location = useLocation();

  useEffect(() => {
    if (reduced) return undefined;

    const lenis = new Lenis({
      duration: 1.05,
      // Gentle exponential ease-out; matches the --ease-mh token.
      easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
      smoothWheel: true,
      // Native touch scrolling feels better than emulated on mobile.
      syncTouch: false,
    });

    let frame = 0;
    const raf = (time) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, [reduced]);

  // Route changes must start at the top, and Lenis caches scroll position.
  useEffect(() => {
    if (reduced) {
      window.scrollTo(0, 0);
      return;
    }
    // Imported instance is not in scope here, so nudge the native scroll too;
    // Lenis reads window.scrollY and stays consistent.
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname, reduced]);

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <Navbar />
      <main className="flex-1">
        {/* Keyed so each route replays the page-rise transition. */}
        <div key={location.pathname} className="page-rise">
          <Outlet />
        </div>
      </main>
      <Footer />
      <ChatWidget />
    </div>
  );
}