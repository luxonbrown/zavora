import { cx } from '../../utils/format.js';

/** Base shimmer block. Compose with any sizing utilities. */
export default function Skeleton({ className, ...rest }) {
  return <div aria-hidden className={cx('skeleton rounded-md', className)} {...rest} />;
}

/** Text line placeholder with a realistic width rhythm. */
export function SkeletonText({ lines = 3, className }) {
  const widths = ['w-full', 'w-11/12', 'w-9/12', 'w-10/12', 'w-8/12'];
  return (
    <div className={cx('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cx('h-3 rounded-full', widths[i % widths.length])} />
      ))}
    </div>
  );
}
