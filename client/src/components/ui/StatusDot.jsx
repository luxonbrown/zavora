import { cx } from '../../utils/format.js';

const TONES = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  muted: 'bg-muted',
  live: 'bg-paper',
};

const SIZES = {
  sm: 'size-1.5',
  md: 'size-2',
  lg: 'size-2.5',
};

/**
 * Tiny status indicator — the only place the accent palette appears in the
 * admin shell. `pulse` is reserved for a genuinely running process.
 */
export default function StatusDot({ tone = 'success', size = 'md', pulse = false, className }) {
  return (
    <span
      className={cx(
        'inline-block shrink-0 rounded-full',
        TONES[tone] ?? TONES.success,
        SIZES[size] ?? SIZES.md,
        pulse && 'animate-pulse',
        className
      )}
      aria-hidden
    />
  );
}
