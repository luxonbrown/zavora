import { cx, formatNumber } from '../../utils/format.js';

/**
 * Bordered metric tile. Monochrome by design — the only colour in the account
 * shell is a tiny status dot, per the design system.
 */
export default function StatTile({ label, value, hint, icon: Icon, className }) {
  return (
    <div
      className={cx(
        'rounded-card border border-line bg-paper px-5 py-5',
        'transition-colors duration-150 hover:border-line-strong',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="t-caption text-muted">{label}</p>
        {Icon ? (
          <Icon className="size-4 shrink-0 text-muted" strokeWidth={1.6} aria-hidden />
        ) : null}
      </div>

      <p className="tnum mt-3 text-[26px] leading-none font-medium tracking-[-0.02em]">
        {typeof value === 'number' ? formatNumber(value) : value}
      </p>

      {hint ? <p className="t-caption mt-2 text-muted">{hint}</p> : null}
    </div>
  );
}