/**
 * The approved hero — LOCKED. Reference: src/img/reference.png
 *
 * Composition, from the reference:
 *   - deep navy stage with a large blue radial glow on the RIGHT behind the
 *     bird, plus a teal/green bloom in the bottom-right corner
 *   - a bright cyan light streak sweeping from bottom-LEFT up to the right,
 *     passing behind the bird, with two fainter streaks beneath it
 *   - eyebrow pill with a bird chip: "GLOBAL CATALOGUE, ONE CALM PLACE"
 *   - two-line bold headline, support line, gradient + outlined pills
 *   - the large glowing origami bird, right of centre, overlapping the streak
 *
 * Only the permitted refinements are applied: the bird is the official mark,
 * the streak animates, the bird idles + takes pointer parallax on desktop, and
 * a scroll cue sits bottom-centre.
 */
import { useEffect, useRef, useState } from 'react';

import Button from '../ui/Button.jsx';
import { Bird } from '../brand/Logo.jsx';
import { useLowPower, useMediaQuery, usePrefersReducedMotion } from '../../hooks/useMotionPrefs.js';
import { cx } from '../../utils/format.js';

/**
 * Per-letter intro.
 *
 * Splits into WORDS first, then letters. Splitting the whole line per character
 * looks equivalent but is not: each letter sits in its own inline-block, and a
 * whitespace-only inline-block collapses to zero width — so the spaces vanish
 * and the headline renders as "Shoptheworld." Words are separated with an
 * explicit non-collapsing space instead.
 */
function SplitLine({ text, delay = 0 }) {
  const words = text.split(' ');

  return (
    <span className="block">
      {words.map((word, wi) => (
        <span key={`${word}-${wi}`} className="inline-block whitespace-nowrap">
          {word.split('').map((letter, i) => (
            <span
              key={`${letter}-${i}`}
              className="inline-block will-change-transform"
              style={{
                animation: 'mh-letter-in 0.85s cubic-bezier(0.16,1,0.3,1) both',
                animationDelay: `${(delay + wi * 0.07 + i * 0.032).toFixed(3)}s`,
              }}
              aria-hidden
            >
              {letter}
            </span>
          ))}
          {wi < words.length - 1 ? (
            <span className="inline-block" style={{ width: '0.26em' }} aria-hidden>
              &nbsp;
            </span>
          ) : null}
        </span>
      ))}
    </span>
  );
}

/**
 * The light streak. Three curves sharing one path family so they read as a
 * single current: a bright leading edge and two softer trailing ribbons.
 * Traced from the reference — it enters bottom-left and rises to the right,
 * passing behind the bird. Each streak carries an explicit alternate path for
 * the drift morph, rather than deriving one at runtime.
 */
function LightStreaks({ reduced }) {
  const streaks = [
    {
      d: 'M-60,640 C260,600 520,540 760,462 C960,398 1120,352 1300,330',
      alt: 'M-60,662 C260,616 520,556 760,478 C960,414 1120,366 1300,342',
      w: 3.2,
      o: 1,
      blur: 0,
      dur: 16,
    },
    {
      d: 'M-60,690 C260,652 540,592 780,514 C980,450 1140,404 1320,382',
      alt: 'M-60,712 C260,670 540,610 780,532 C980,468 1140,420 1320,396',
      w: 2.2,
      o: 0.55,
      blur: 1.4,
      dur: 21,
    },
    {
      d: 'M-60,742 C280,706 560,646 800,568 C1000,504 1160,458 1340,436',
      alt: 'M-60,764 C280,724 560,664 800,586 C1000,522 1160,474 1340,450',
      w: 1.8,
      o: 0.32,
      blur: 2.6,
      dur: 27,
    },
  ];

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <svg
        className="absolute inset-0 size-full"
        viewBox="0 0 1220 700"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="mh-streak-lead" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#0B8FFF" stopOpacity="0.1" />
            <stop offset="30%" stopColor="#0B8FFF" stopOpacity="0.75" />
            <stop offset="62%" stopColor="#62CAFF" stopOpacity="1" />
            <stop offset="88%" stopColor="#22C3C3" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#22C3C3" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="mh-streak-soft" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#0B8FFF" stopOpacity="0" />
            <stop offset="45%" stopColor="#0B8FFF" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#62CAFF" stopOpacity="0" />
          </linearGradient>
          <filter id="mh-streak-glow" x="-20%" y="-60%" width="140%" height="220%">
            <feGaussianBlur stdDeviation="7" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {streaks.map((s, i) => (
          <g key={i} filter={i === 0 ? 'url(#mh-streak-glow)' : undefined}>
            <path
              d={s.d}
              fill="none"
              stroke={i === 0 ? 'url(#mh-streak-lead)' : 'url(#mh-streak-soft)'}
              strokeWidth={s.w}
              strokeLinecap="round"
              opacity={s.o}
              style={{ filter: s.blur ? `blur(${s.blur}px)` : undefined }}
            >
              {/* Gentle drift so the current is never static. */}
              {reduced ? null : (
                <animate
                  attributeName="d"
                  dur={`${s.dur}s`}
                  repeatCount="indefinite"
                  calcMode="spline"
                  keyTimes="0;0.5;1"
                  keySplines="0.4 0 0.2 1;0.4 0 0.2 1"
                  values={`${s.d};${s.alt};${s.d}`}
                />
              )}
            </path>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function Hero() {
  const birdRef = useRef(null);
  const reduced = usePrefersReducedMotion();
  const lowPower = useLowPower();
  const canHover = useMediaQuery('(hover: hover) and (pointer: fine)');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const parallax = !reduced && !lowPower && canHover;

  // Pointer parallax: the bird leads, the streak counter-drifts slightly.
  useEffect(() => {
    if (!parallax) return undefined;
    const bird = birdRef.current;
    if (!bird) return undefined;

    let frame = 0;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;

    const onMove = (event) => {
      tx = (event.clientX / window.innerWidth - 0.5) * 24;
      ty = (event.clientY / window.innerHeight - 0.5) * 18;
    };

    const loop = () => {
      cx += (tx - cx) * 0.07;
      cy += (ty - cy) * 0.07;
      bird.style.setProperty('--px', `${cx.toFixed(2)}px`);
      bird.style.setProperty('--py', `${cy.toFixed(2)}px`);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
    };
  }, [parallax]);

  const show = ready || reduced;

  return (
    <section className="on-dark relative isolate min-h-[100svh] overflow-hidden bg-navy">
      {/* ---- Backdrop: navy base, blue glow right, teal bottom-right ---- */}
      <div className="absolute inset-0" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(115deg, #05101C 0%, #06121F 38%, #071B31 62%, #04101F 100%)',
          }}
        />
        {/* The dominant glow sits behind the bird, as in the reference. */}
        <div
          className="absolute top-[6%] right-[-6%] h-[86%] w-[62%] rounded-full"
          style={{
            background:
              'radial-gradient(closest-side, rgba(11,143,255,0.42) 0%, rgba(11,143,255,0.16) 45%, rgba(11,143,255,0) 78%)',
            filter: 'blur(10px)',
          }}
        />
        <div
          className="animate-drift absolute bottom-[-14%] right-[2%] h-[52%] w-[48%] rounded-full"
          style={{
            background:
              'radial-gradient(closest-side, rgba(34,195,195,0.30) 0%, rgba(16,185,129,0.10) 52%, rgba(16,185,129,0) 80%)',
          }}
        />
        <div className="absolute -left-[10%] top-[24%] h-[52%] w-[42%] rounded-full bg-mh-blue/10 blur-[140px]" />
      </div>

      <LightStreaks reduced={reduced} />

      {/* ---- Copy column ---- */}
      <div className="container-z relative flex min-h-[100svh] flex-col justify-center pb-36 pt-32">
        {/* Eyebrow pill. */}
        <div
          className={cx(
            'inline-flex w-fit items-center gap-2.5 rounded-full border border-white/20 bg-white/[0.06] py-1.5 pr-5 pl-1.5 backdrop-blur-md',
            !show && !reduced && 'opacity-0'
          )}
          style={{ transition: 'opacity .7s ease .1s' }}
        >
          <span className="grid size-7 place-items-center rounded-full bg-mh-blue/25">
            <Bird className="size-4" title={null} />
          </span>
          <span className="text-[10.5px] font-medium tracking-[0.16em] text-white/85 uppercase">
            Global catalogue, one calm place
          </span>
        </div>

        <h1 className="mt-8 max-w-[13ch] text-[clamp(44px,7.4vw,92px)] leading-[1.02] font-bold tracking-[-0.035em] text-white">
          {show ? (
            <>
              <SplitLine text="Shop the world." delay={0.12} />
              <SplitLine text="Flow with it." delay={0.34} />
            </>
          ) : (
            <>
              Shop the world.
              <br />
              Flow with it.
            </>
          )}
        </h1>

        <p
          className={cx(
            'mt-6 max-w-[380px] text-[15px] leading-relaxed text-white/75',
            !show && !reduced && 'translate-y-3 opacity-0'
          )}
          style={{ transition: 'opacity .8s ease .8s, transform .8s cubic-bezier(0.16,1,0.3,1) .8s' }}
        >
          Discover amazing products from global brands, delivered to your door —
          effortlessly.
        </p>

        <div
          className={cx(
            'mt-9 flex flex-col gap-3 sm:flex-row sm:items-center',
            !show && !reduced && 'translate-y-3 opacity-0'
          )}
          style={{ transition: 'opacity .8s ease .95s, transform .8s cubic-bezier(0.16,1,0.3,1) .95s' }}
        >
          <Button
            to="/shop"
            size="lg"
            variant="gradient"
            className="shadow-glow-blue"
            iconRight={<span aria-hidden>→</span>}
          >
            Shop Now
          </Button>
          <Button
            to="/category/new-arrivals"
            size="lg"
            variant="outline-light"
            iconRight={<span aria-hidden>→</span>}
          >
            Explore Collection
          </Button>
        </div>
      </div>

      {/* ---- The glowing origami bird, right of centre ---- */}
      <div
        className="pointer-events-none absolute top-1/2 right-[1%] hidden -translate-y-1/2 lg:block"
        style={{ width: 'min(31vw, 400px)' }}
      >
        <div
          className="absolute inset-[-18%] -z-10 animate-drift rounded-full"
          style={{
            background:
              'radial-gradient(closest-side, rgba(11,143,255,0.45) 0%, rgba(11,143,255,0.14) 55%, rgba(11,143,255,0) 80%)',
          }}
          aria-hidden
        />
        <div
          ref={birdRef}
          className="will-change-transform"
          style={
            reduced || lowPower
              ? undefined
              : {
                  // Parallax offset is written as a CSS var so the idle float
                  // animation and the pointer offset can compose instead of
                  // fighting over `transform`.
                  '--px': '0px',
                  '--py': '0px',
                  animation: 'mh-bird-float 7s ease-in-out infinite',
                  translate: 'var(--px) var(--py)',
                }
          }
        >
          <Bird className="h-auto w-full drop-shadow-[0_0_60px_rgba(11,143,255,0.55)]" title={null} />
        </div>
      </div>

      {/* Mobile bird — smaller, behind the copy, kept on the right. */}
      <div
        className="pointer-events-none absolute top-[16%] right-[-14%] -z-10 opacity-50 lg:hidden"
        style={{ width: 'min(64vw, 320px)' }}
        aria-hidden
      >
        <Bird className="h-auto w-full" title={null} glow />
      </div>

      {/* ---- Scroll cue ---- */}
      <div
        className={cx(
          'absolute inset-x-0 bottom-6 flex flex-col items-center gap-2',
          !show && !reduced && 'opacity-0'
        )}
        style={{ transition: 'opacity .8s ease 1.3s' }}
        aria-hidden
      >
        <span className="relative block h-8 w-px overflow-hidden bg-white/15">
          <span
            className="absolute inset-x-0 top-0 h-3 bg-brand-gradient"
            style={
              reduced ? undefined : { animation: 'mh-scroll-dot 2.2s cubic-bezier(0.65,0,0.35,1) infinite' }
            }
          />
        </span>
      </div>
    </section>
  );
}