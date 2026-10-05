/**
 * The giant MARKETHUB wordmark with a flowing-water reflection, and a bird that
 * crosses it on a loop.
 *
 * The reflection is the same wordmark flipped and masked, pushed through an
 * `feTurbulence` + `feDisplacementMap` filter whose `baseFrequency` animates via
 * SMIL — the only cheap way to get organic ripple without a rAF loop over a
 * full-width filter.
 *
 * The bird flies left-to-right roughly every 12s. As it passes, it "flips a
 * switch": the displacement scale spikes and the turbulence seed steps, which
 * reads as the bird disturbing the water. That is a real attribute change, not
 * an opacity trick, so the reflection genuinely ripples where the bird is.
 */
import { useEffect, useRef } from 'react';

import { Bird } from './Logo.jsx';
import { useInView, usePrefersReducedMotion } from '../../hooks/useMotionPrefs.js';
import { cx } from '../../utils/format.js';

const LETTERS = 'MARKETHUB'.split('');
const CYCLE_MS = 12000;
const FLIGHT_MS = 2600;

export default function FlowWordmark({ className = '' }) {
  const [ref, inView] = useInView({ rootMargin: '150px' });
  const reduced = usePrefersReducedMotion();
  const displacementRef = useRef(null);
  const turbulenceRef = useRef(null);
  const birdRef = useRef(null);

  // Bird flight loop. Paused when the footer is offscreen so it costs nothing
  // while the user is reading the rest of the page.
  useEffect(() => {
    if (reduced || !inView) return undefined;

    let raf = 0;
    let timer = 0;
    let start = 0;
    let seed = 3;

    const step = (now) => {
      if (!start) start = now;
      const t = (now - start) % CYCLE_MS;
      const p = Math.min(1, t / FLIGHT_MS);
      const bird = birdRef.current;
      const disp = displacementRef.current;
      const turb = turbulenceRef.current;

      if (bird) {
        if (t < FLIGHT_MS) {
          // Enter from off-frame left, cross, exit right.
          const x = -12 + p * 124;
          const y = 18 - Math.sin(p * Math.PI) * 26;
          bird.style.opacity = String(Math.sin(p * Math.PI) * 0.95);
          bird.style.transform = `translate3d(${x.toFixed(2)}%, ${y.toFixed(2)}%, 0) rotate(${(p - 0.5) * 10}deg)`;

          // Disturb the water as it passes the centre of the wordmark.
          const near = 1 - Math.min(1, Math.abs(p - 0.5) / 0.28);
          if (disp) disp.setAttribute('scale', String(10 + near * 26));
        } else {
          bird.style.opacity = '0';
          // Settle the water, then re-seed on the next pass.
          if (disp) disp.setAttribute('scale', '12');
        }
      }

      // Re-seed the turbulence once per cycle so each pass looks different.
      if (t >= CYCLE_MS - 16 && turb) {
        seed = (seed * 7 + 11) % 97;
        turb.setAttribute('seed', String(seed));
      }

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [inView, reduced]);

  return (
    <div ref={ref} className={cx('relative select-none overflow-hidden', className)} aria-hidden>
      <svg viewBox="0 0 1000 170" className="block w-full">
        <defs>
          <linearGradient id="mh-flow-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0B8FFF" />
            <stop offset="35%" stopColor="#22C3C3" />
            <stop offset="60%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#62CAFF" />
          </linearGradient>

          <filter id="mh-ripple" x="-20%" y="-40%" width="140%" height="200%">
            <feTurbulence
              ref={turbulenceRef}
              type="fractalNoise"
              baseFrequency="0.012 0.028"
              numOctaves="2"
              seed="7"
              result="noise"
            >
              {reduced ? null : (
                <animate
                  attributeName="baseFrequency"
                  dur="26s"
                  repeatCount="indefinite"
                  values="0.012 0.028;0.022 0.016;0.012 0.028"
                />
              )}
            </feTurbulence>
            <feDisplacementMap
              ref={displacementRef}
              in="SourceGraphic"
              in2="noise"
              scale={reduced ? 5 : 12}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>

          <linearGradient id="mh-reflect-mask" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.40" />
            <stop offset="55%" stopColor="#fff" stopOpacity="0.11" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id="mh-reflect">
            <rect x="0" y="0" width="1000" height="62" fill="url(#mh-reflect-mask)" />
          </mask>
        </defs>

        {/* The wordmark. */}
        <g fill="url(#mh-flow-grad)">
          {LETTERS.map((letter, i) => (
            <text
              key={letter}
              x={i * 111 + 66}
              y="118"
              textAnchor="middle"
              fontSize="118"
              fontWeight="700"
              letterSpacing="2"
              fontFamily="'Poppins', system-ui, sans-serif"
            >
              {letter}
            </text>
          ))}
        </g>

        {/* Mirrored, rippling reflection. */}
        <g mask="url(#mh-reflect)" filter="url(#mh-ripple)" opacity="0.55">
          <g transform="translate(0,242) scale(1,-1)">
            <g fill="url(#mh-flow-grad)">
              {LETTERS.map((letter, i) => (
                <text
                  key={letter}
                  x={i * 111 + 66}
                  y="118"
                  textAnchor="middle"
                  fontSize="118"
                  fontWeight="700"
                  letterSpacing="2"
                  fontFamily="'Poppins', system-ui, sans-serif"
                >
                  {letter}
                </text>
              ))}
            </g>
          </g>
        </g>
      </svg>

      {/* The flying bird, positioned in percentages so it scales with the word. */}
      {reduced ? null : (
        <div
          ref={birdRef}
          className="pointer-events-none absolute left-0 top-0 opacity-0 will-change-transform"
          style={{ width: '9%' }}
        >
          <Bird className="h-auto w-full" title={null} glow />
        </div>
      )}

      <span className="sr-only">MARKETHUB</span>
    </div>
  );
}