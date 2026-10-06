/**
 * The only button in MARKETHUB.
 *
 * Variants are pills; `gradient` is the brand action and the only one carrying a
 * glow shadow. The shine sweep runs on hover via a pseudo-element positioned
 * off-stage — it is transform-only, so it stays on the compositor.
 *
 * NOTE on responsive visibility: this component's base class sets
 * `inline-flex`, and Tailwind v4 emits `.hidden` BEFORE `.inline-flex`, so a
 * caller passing a bare `hidden` loses the cascade. Use `max-md:hidden` instead,
 * which is emitted later and wins reliably.
 */
import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { cx } from '../../utils/format.js';

const VARIANTS = {
  // Brand action — the one place the full gradient is a fill.
  gradient:
    'bg-brand-gradient text-white hover:brightness-[1.08] active:brightness-95 shadow-glow-blue',

  // On dark surfaces.
  'primary-light': 'bg-paper text-ink hover:bg-paper/88',
  'outline-light':
    'border-[1.5px] border-paper/70 text-paper hover:bg-paper/10 hover:border-paper',
  'ghost-light': 'text-paper/80 hover:text-paper hover:bg-white/5',

  // On light surfaces.
  'primary-dark': 'bg-ink text-paper hover:bg-ink/88',
  'outline-dark': 'border-[1.5px] border-ink/70 text-ink hover:bg-ink/5 hover:border-ink',
  'ghost-dark': 'text-muted hover:text-ink',

  quiet: 'bg-surface-muted text-ink hover:bg-line',
  danger: 'bg-danger text-paper hover:bg-danger/90',
};

const SIZES = {
  xs: 'h-7 px-2.5 text-[11px] gap-1',
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-9 px-4 text-[13px] gap-1.5',
  lg: 'h-11 px-6 text-sm gap-2',
  xl: 'h-13 px-8 text-[15px] gap-2',
};

/** Adds the hover shine sweep. Only the gradient variant gets it. */
function withShine(variant, className) {
  if (variant !== 'gradient') return className;
  return cx(
    'group/btn relative overflow-hidden',
    className,
    // Pseudo-element held off-stage, swept across on hover.
    "before:absolute before:inset-y-0 before:left-[-60%] before:w-1/2 before:skew-x-[-18deg] before:bg-white/25 before:blur-[6px] before:content-[''] before:transition-transform before:duration-700 before:ease-out hover:before:translate-x-[340%] motion-reduce:before:hidden",
  );
}

const Button = forwardRef(function Button(
  {
    as,
    to,
    href,
    variant = 'primary-dark',
    size = 'lg',
    fullWidth = false,
    loading = false,
    disabled = false,
    iconLeft,
    iconRight,
    className,
    children,
    ...rest
  },
  ref,
) {
  const Component = as || (to ? Link : href ? 'a' : 'button');
  const isNativeButton = Component === 'button';

  // When a caller asks to hide the button (e.g. hidden md:inline-flex) it
  // ignores the base `inline-flex` at that breakpoint — both set `display` and
  // CSS source order, not class order, decides the winner. Drop the base class
  // whenever a display override is passed.
  const wantsDisplayOverride = /(^|\s)(inline-flex|hidden|inline-block|block|flex|contents)(\s|$)/.test(
    String(className ?? ''),
  );

  const classes = cx(
    'select-none items-center justify-center rounded-full font-medium',
    !wantsDisplayOverride && 'inline-flex',
    'whitespace-nowrap transition-[transform,background-color,border-color,color,opacity,filter] duration-200 ease-out',
    'active:scale-[0.98]',
    'disabled:pointer-events-none disabled:opacity-40',
    'focus-ring-gradient',
    VARIANTS[variant] ?? VARIANTS['primary-dark'],
    SIZES[size] ?? SIZES.lg,
    fullWidth && 'w-full',
    className,
  );

  return (
    <Component
      ref={ref}
      to={to}
      href={href}
      className={withShine(variant, classes)}
      disabled={isNativeButton ? disabled || loading : undefined}
      aria-disabled={!isNativeButton && (disabled || loading) ? true : undefined}
      aria-busy={loading || undefined}
      {...(isNativeButton ? { type: rest.type ?? 'button' } : {})}
      {...rest}
    >
      {loading ? (
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
      ) : (
        iconLeft
      )}
      {children}
      {!loading && iconRight}
    </Component>
  );
});

export default Button;
export { VARIANTS as BUTTON_VARIANTS, SIZES as BUTTON_SIZES };