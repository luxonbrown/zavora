/**
 * The MARKETHUB origami bird — the canonical brand mark.
 *
 * FOUR flat facets, reconstructed from the official logo (src/img/1.png):
 *   1. left wing    — light blue triangle
 *   2. main body    — bright blue triangle (the largest facet)
 *   3. neck         — light blue triangle
 *   4. beak         — small bright blue triangle
 *
 * This is the single source of truth for the mark. The hero, navbar, eyebrow
 * chip, section corners, process diagram and loaders all render THIS component
 * rather than their own drawing — the previous version had a geometric "M" in
 * some places and a different bird shape in others, which is exactly the drift
 * the brief forbids.
 *
 * Facets are addressable (`data-facet`) so Scene 2 can fly them apart and
 * reassemble them into a bird, and Scene 1 can animate one bird into another.
 */

export const BIRD_COLORS = {
  wing: '#62CAFF',
  body: '#0B8FFF',
  neck: '#62CAFF',
  beak: '#0B8FFF',
};

/**
 * Facet geometry on a 100×100 viewBox, traced from the 2000px reference and
 * normalised. Each facet is a triangle so the whole mark stays flat.
 */
export const FACETS = {
  wing: 'M33.1 20.4 L46 20.4 L46 32.75 Z',
  body: 'M46 20.4 L64.5 38.25 L46 56.5 Z',
  neck: 'M57.5 32.75 L64.4 26 L64.5 38.25 Z',
  beak: 'M64.4 26 L68.6 30.2 L64.4 30.2 Z',
};

const ORDER = ['wing', 'body', 'neck', 'beak'];

/**
 * The bird. `classNameByFacet` lets a caller style each facet (e.g. per-facet
 * delays during the assemble animation).
 *
 * The viewBox is the important detail here. The four facets only occupy
 * x 33.1–68.6 and y 20.4–56.5, so a naive `0 0 100 100` box leaves roughly 65%
 * of the box empty. The bird then renders tiny inside its own element AND sits
 * high above the optical centre — which is exactly why it read as a small glyph
 * floating above the wordmark instead of sitting level with it. Fitting the
 * viewBox to the artwork makes the mark fill its declared size and centre on
 * the text.
 */
export const BIRD_VIEWBOX = '32 19 38 39';

export function Bird({
  className,
  size,
  title = 'MARKETHUB',
  animated = false,
  classNameByFacet,
  glow = false,
  style,
}) {
  const box = className ?? (size ? undefined : 'size-8');
  const showTitle = title !== null && title !== undefined && title !== '';

  return (
    <svg
      viewBox={BIRD_VIEWBOX}
      className={box}
      style={{
        ...(className || size ? { width: size, height: size } : null),
        overflow: 'visible',
        ...(glow
          ? { filter: 'drop-shadow(0 0 26px rgba(98,202,255,0.55))' }
          : null),
        ...style,
      }}
      role={showTitle ? 'img' : 'presentation'}
      aria-hidden={showTitle ? undefined : 'true'}
      aria-label={showTitle || undefined}
      fill="none"
    >
      {ORDER.map((key) => (
        <path
          key={key}
          data-facet={key}
          d={FACETS[key]}
          fill={BIRD_COLORS[key]}
          className={classNameByFacet?.[key]}
        />
      ))}
    </svg>
  );
}

/**
 * Mark + wordmark. `variant` picks the treatment:
 *  - `gradient` — gradient wordmark, for dark surfaces and the giant footer type
 *  - `plain`    — currentColor, for light surfaces
 */
export function Logo({
  className = '',
  variant = 'gradient',
  showMark = true,
  markClassName = 'size-8',
  wordClassName = 'text-[15px]',
  glow = false,
}) {
  const word = (
    <span
      className={[
        'wordmark leading-none',
        wordClassName,
        variant === 'gradient' ? 'text-gradient-brand' : 'text-ink',
      ].join(' ')}
    >
      MarketHub
    </span>
  );

  if (!showMark) return word;

  return (
    <span className={['inline-flex items-center gap-2.5', className].join(' ')}>
      <Bird className={markClassName} title={null} glow={glow} />
      {word}
    </span>
  );
}

/**
 * `Mark` is the historical name still used by DashboardShell and others.
 * It is now an alias for `Bird`, which is why there is only ever one bird.
 */
export const Mark = Bird;

export default Logo;