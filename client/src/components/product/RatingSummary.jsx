import Rating from '../ui/Rating.jsx';
import { buildStarDistribution } from '../../utils/rating.js';
import { formatNumber } from '../../utils/format.js';

/**
 * Rating headline plus a 5→1 star distribution.
 *
 * The breakdown is derived from the average because the seed catalogue has no
 * per-star review rows; step 11 replaces it with real aggregates from the
 * reviews table. The maths lives in `utils/rating.js` and is unit-tested there.
 */
export default function RatingSummary({ rating, reviewCount, className }) {
  const distribution = buildStarDistribution(rating, reviewCount);
  const top = Math.max(...distribution, 1);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-6">
        <div>
          <p className="text-[44px] leading-none font-medium tracking-[-0.02em] tnum">
            {rating.toFixed(1)}
          </p>
          <Rating value={rating} size={15} className="mt-2.5" />
          <p className="t-caption mt-1.5 text-muted">
            {formatNumber(reviewCount)} verified reviews
          </p>
        </div>

        <ul className="min-w-[200px] flex-1 space-y-1.5">
          {distribution.map((count, i) => {
            const star = 5 - i;
            return (
              <li key={star} className="flex items-center gap-3">
                <span className="t-caption w-6 shrink-0 text-muted tnum">{star}★</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                  <span
                    className="block h-full rounded-full bg-ink"
                    style={{ width: `${(count / top) * 100}%` }}
                  />
                </span>
                <span className="t-caption w-8 shrink-0 text-right text-muted tnum">
                  {formatNumber(count)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
