/**
 * Shared capability + scroll hooks.
 *
 * `usePrefersReducedMotion` gates every heavy scene (hero video, box-open,
 * orbits, karaoke). Honouring it is not optional here: the homepage pins a
 * 150vh scroll scene and runs particles, so a reduced-motion visitor would
 * otherwise get the most expensive version of the page.
 */
import { useEffect, useRef, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia(QUERY);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

/** Cheap low-power heuristic: coarse pointer + small viewport + few cores. */
export function useLowPower() {
  const [low, setLow] = useState(() => {
    if (typeof window === 'undefined') return true;
    const cores = navigator.hardwareConcurrency ?? 8;
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
    const small = window.innerWidth < 820;
    return cores <= 4 || (coarse && small);
  });

  useEffect(() => {
    const cores = navigator.hardwareConcurrency ?? 8;
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
    const small = window.innerWidth < 820;
    setLow(cores <= 4 || (coarse && small));
  }, []);

  return low;
}

/**
 * True once the element has scrolled into view. Used to pause offscreen
 * animation loops — an orbit or particle field keeps burning frames when it is
 * off screen unless something tells it to stop.
 */
export function useInView({ rootMargin = '200px', threshold = 0.01 } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin, threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin, threshold]);

  return [ref, inView];
}

/**
 * Scroll reveal that CANNOT hide content permanently.
 *
 * The naive pattern — `opacity: 0` until `isIntersecting` — makes the reveal
 * load-bearing: if IntersectionObserver never fires (no IO, a throttled
 * background tab, a full-page screenshot capture, a headless renderer) the
 * content is invisible forever. That is an accessibility bug, not a cosmetic
 * one, because the text simply is not on the page for those users.
 *
 * So: reveal on intersection, AND reveal unconditionally after a short timeout.
 * Worst case the animation is skipped and the content is simply visible.
 */
export function useReveal({
  rootMargin = '160px',
  threshold = 0.05,
  fallbackMs = 1500,
  ref: providedRef,
} = {}) {
  const [ownRef, inView] = useInView({ rootMargin, threshold });
  const [forced, setForced] = useState(false);

  // A caller may already own the ref (e.g. the orbit needs the same element to
  // drive its rAF loop), so honour it instead of creating a second one.
  const ref = providedRef ?? ownRef;

  useEffect(() => {
    if (inView) return undefined;
    const timer = setTimeout(() => setForced(true), fallbackMs);
    return () => clearTimeout(timer);
  }, [inView, fallbackMs]);

  return [ref, inView || forced];
}

/** Element size, tracked with ResizeObserver. Orbit radius must follow it. */
export function useMeasure() {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const apply = (rect) =>
      setSize({ width: rect.width, height: rect.height });
    apply(el.getBoundingClientRect());

    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) apply(rect);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, size];
}

/** Debounced window size, for swapping mobile/desktop scene variants. */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}