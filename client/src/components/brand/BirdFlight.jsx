/**
 * Scene 1 — the bird takes flight.
 *
 * A fixed overlay above the hero for the first ~1.2vh of scroll. The bird
 * detaches from the hero, climbs along a curved path toward the centre of the
 * box scene, banking into the turns, shrinking with distance, and leaving a
 * flowing-water trail that fades out behind it.
 *
 * Implementation note — why not MotionPathPlugin:
 * `motionPath: { align }` resolves a STRING as a CSS selector, so passing path
 * data throws "not a valid selector"; and its `path` coordinates are resolved in
 * the target element's own space, which does not exist for a DOM node outside
 * an SVG. So the trail lives in a full-screen SVG (viewBox 0 0 100 100) and the
 * bird is positioned from that same path via `getPointAtLength`, mapping the
 * viewBox units to pixels. The trail and the bird therefore cannot drift apart,
 * and the banking angle is the real path tangent rather than a guess.
 */
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { Bird } from '../brand/Logo.jsx';
import { useLowPower, usePrefersReducedMotion } from '../../hooks/useMotionPrefs.js';

gsap.registerPlugin(ScrollTrigger);

/** Bottom-left → centre-top. Reads as a climb, not a drift. */
const FLIGHT_PATH =
  'M4,96 C10,80 20,64 34,54 C48,44 52,30 46,18 C42,10 44,4 50,0';

/** Generous dash length so the trail reads as solid regardless of true length. */
const DASH = 400;

export default function BirdFlight({ className = '' }) {
  const root = useRef(null);
  const svgRef = useRef(null);
  const pathRef = useRef(null);
  const birdRef = useRef(null);
  const trailRef = useRef(null);
  const reduced = usePrefersReducedMotion();
  const lowPower = useLowPower();

  useEffect(() => {
    const el = root.current;
    const svg = svgRef.current;
    const path = pathRef.current;
    const bird = birdRef.current;
    const trail = trailRef.current;
    if (!el || !svg || !path || !bird || reduced || lowPower) return undefined;

    let length = 0;
    try {
      length = path.getTotalLength();
    } catch {
      length = 0;
    }
    if (!length) return undefined;

    const setTrail = (p) => {
      if (!trail) return;
      // Draw the trail ahead of the bird, then fade the whole thing out at the
      // end so it does not linger as the scene hands over.
      trail.style.strokeDashoffset = String(DASH * p);
      trail.style.opacity = String(p < 0.08 ? p / 0.08 : p > 0.78 ? (1 - p) / 0.22 : 1);
    };

    const position = (p) => {
      const point = path.getPointAtLength(length * p);
      const before = path.getPointAtLength(Math.max(0, length * p - 4));
      const after = path.getPointAtLength(Math.min(length, length * p + 4));

      const rect = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      // viewBox units -> rendered pixels (non-uniform, matching the SVG).
      const sx = rect.width / (vb.width || rect.width || 1);
      const sy = rect.height / (vb.height || rect.height || 1);

      // Bank into the turn: angle of the tangent, damped so it never spins.
      const angle = (Math.atan2(after.y - before.y, after.x - before.x) * 180) / Math.PI;
      const scale = 1 - p * 0.55;

      bird.style.transform =
        `translate3d(${(point.x * sx).toFixed(2)}px, ${(point.y * sy).toFixed(2)}px, 0) ` +
        `translate(-50%, -50%) rotate(${angle.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      bird.style.opacity = String(p < 0.06 ? p / 0.06 : p > 0.86 ? (1 - p) / 0.14 : 1);

      setTrail(p);
    };

    position(0);

    const state = { t: 0 };
    const tween = gsap.to(state, {
      t: 1,
      ease: 'none',
      onUpdate: () => position(state.t),
      scrollTrigger: {
        trigger: el,
        start: 'top top',
        end: '+=120%',
        scrub: 0.85,
        invalidateOnRefresh: true,
      },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [reduced, lowPower]);

  if (reduced || lowPower) return null;

  return (
    <div ref={root} className={className} aria-hidden>
      {/* Trail + the path used for measurement. Non-scaling-stroke keeps the
          line width constant despite the viewBox stretching to fit. */}
      <svg
        ref={svgRef}
        className="pointer-events-none fixed inset-0 size-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="mh-flight-trail" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#0B8FFF" stopOpacity="0.15" />
            <stop offset="45%" stopColor="#0B8FFF" stopOpacity="0.8" />
            <stop offset="80%" stopColor="#62CAFF" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* Invisible: this element is the measurement source for the bird. */}
        <path ref={pathRef} d={FLIGHT_PATH} fill="none" stroke="none" />

        <path
          ref={trailRef}
          d={FLIGHT_PATH}
          fill="none"
          stroke="url(#mh-flight-trail)"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeDasharray={DASH}
          strokeDashoffset={DASH}
          vectorEffect="non-scaling-stroke"
          style={{ opacity: 0, filter: 'blur(0.5px)' }}
        />
      </svg>

      {/* The travelling bird. */}
      <div
        ref={birdRef}
        className="pointer-events-none fixed left-0 top-0 z-30 opacity-0"
        style={{ willChange: 'transform' }}
      >
        <Bird className="size-20 md:size-28" title={null} glow />
      </div>
    </div>
  );
}