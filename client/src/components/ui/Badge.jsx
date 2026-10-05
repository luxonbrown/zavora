import { cx } from '../../utils/format.js';

const TONES = {
  neutral: 'bg-surface-muted text-ink',
  ink: 'bg-ink text-paper',
  outline: 'border border-line text-muted',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/12 text-[#96650a]',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-info/10 text-info',
  // Brand accent — used sparingly, for promotional marks only.
  gradient: 'bg-brand-gradient text-white',
};

const SIZES = {
  xs: 'h-5 px-2 text-[10.5px]',
  sm: 'h-6 px-2.5 text-[11.5px]',
  md: 'h-7 px-3 text-[12.5px]',
};

/** Pill badge. Black is the default promotional treatment. */
export default function Badge({ tone = 'ink', size = 'sm', className, children }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full font-medium whitespace-nowrap',
        TONES[tone] ?? TONES.ink,
        SIZES[size] ?? SIZES.sm,
        className
      )}
    >
      {children}
    </span>
  );
}
