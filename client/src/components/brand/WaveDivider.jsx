/**
 * Flowing section dividers.
 *
 * Three variants: `wave` (a morphing sine band), `blob` (organic mass), and
 * `curve` (the large rounded corner from the reference). The `wave` path animates
 * with SMIL `<animate>` on `d`, which keeps the morph off the main thread — a
 * JS rAF morph of a 120-point path costs more than the rest of the page combined.
 */
import { useId } from 'react';

import { usePrefersReducedMotion } from '../../hooks/useMotionPrefs.js';
import { cx } from '../../utils/format.js';

/** A calm sine. The second path is the same curve phase-shifted. */
const WAVE_A =
  'M0,64 C180,96 320,32 500,48 C680,64 820,112 1000,80 C1180,48 1320,16 1440,40 L1440,120 L0,120 Z';
const WAVE_B =
  'M0,80 C160,40 300,96 480,88 C660,80 800,32 980,56 C1160,80 1300,104 1440,72 L1440,120 L0,120 Z';

export function WaveDivider({
  className = '',
  height = 120,
  flip = false,
  /** `light` fills with the light canvas; `dark` with the navy surface. */
  tone = 'light',
  animated = true,
}) {
  const reduced = usePrefersReducedMotion();
  const gid = useId().replace(/:/g, '');
  const fill = tone === 'dark' ? 'var(--color-navy)' : 'var(--color-canvas)';
  const shouldAnimate = animated && !reduced;

  return (
    <div
      className={cx('pointer-events-none relative w-full overflow-hidden', className)}
      style={{ height }}
      aria-hidden
    >
      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className={cx('size-full', flip && 'scale-y-[-1]')}
      >
        <defs>
          <linearGradient id={`wv-${gid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1D6BFF" stopOpacity="0.16" />
            <stop offset="50%" stopColor="#22C3C3" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.16" />
          </linearGradient>
        </defs>

        {shouldAnimate ? (
          <path fill={fill} d={WAVE_A}>
            <animate
              attributeName="d"
              dur="14s"
              repeatCount="indefinite"
              calcMode="spline"
              keyTimes="0;0.5;1"
              keySplines="0.4 0 0.2 1;0.4 0 0.2 1"
              values={`${WAVE_A};${WAVE_B};${WAVE_A}`}
            />
          </path>
        ) : (
          <path fill={fill} d={WAVE_A} />
        )}

        {/* A hairline of brand gradient riding the crest. */}
        {shouldAnimate ? (
          <path fill="none" stroke={`url(#wv-${gid})`} strokeWidth="2" d={WAVE_A}>
            <animate
              attributeName="d"
              dur="14s"
              repeatCount="indefinite"
              calcMode="spline"
              keyTimes="0;0.5;1"
              keySplines="0.4 0 0.2 1;0.4 0 0.2 1"
              values={`${WAVE_A};${WAVE_B};${WAVE_A}`}
            />
          </path>
        ) : (
          <path fill="none" stroke={`url(#wv-${gid})`} strokeWidth="2" d={WAVE_A} />
        )}
      </svg>
    </div>
  );
}

/** Organic blob — used to hand off between two dark sections. */
export function BlobDivider({ className = '', tone = 'dark' }) {
  const gid = useId().replace(/:/g, '');
  const fill = tone === 'dark' ? 'var(--color-navy)' : 'var(--color-canvas)';

  return (
    <div className={cx('pointer-events-none w-full overflow-hidden leading-[0]', className)} aria-hidden>
      <svg viewBox="0 0 1440 160" preserveAspectRatio="none" className="w-full">
        <defs>
          <radialGradient id={`bl-${gid}`} cx="50%" cy="0%" r="80%">
            <stop offset="0%" stopColor="#1D6BFF" stopOpacity="0.30" />
            <stop offset="55%" stopColor="#22C3C3" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.05" />
          </radialGradient>
        </defs>
        <path
          fill={fill}
          d="M0,96 C240,160 420,32 700,64 C980,96 1180,144 1440,80 L1440,160 L0,160 Z"
        />
        <path
          fill={`url(#bl-${gid})`}
          d="M0,112 C260,168 460,52 720,80 C980,108 1180,150 1440,96 L1440,160 L0,160 Z"
          opacity="0.9"
        />
      </svg>
    </div>
  );
}

/**
 * The large rounded corner that carries the hero into the dark statement
 * section — the structural signature of the reference design.
 */
export function CurveTransition({ className = '', height = 200 }) {
  return (
    <div
      className={cx('pointer-events-none w-full overflow-hidden', className)}
      style={{ height }}
      aria-hidden
    >
      <svg viewBox="0 0 1440 200" preserveAspectRatio="none" className="size-full">
        <defs>
          <linearGradient id="curve-glow" x1="0" y1="0" x2="1" y2="0.4">
            <stop offset="0%" stopColor="#1D6BFF" stopOpacity="0.5" />
            <stop offset="50%" stopColor="#22C3C3" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <path
          fill="var(--color-navy)"
          d="M0,0 L1440,0 L1440,64 C1100,180 340,180 0,64 Z"
        />
        <path
          fill="none"
          stroke="url(#curve-glow)"
          strokeWidth="2"
          d="M0,64 C340,180 1100,180 1440,64"
          opacity="0.8"
        />
      </svg>
    </div>
  );
}

export default WaveDivider;