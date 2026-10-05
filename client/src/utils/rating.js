/**
 * Star-distribution maths for review summaries.
 *
 * Kept out of the component so it can be unit-tested directly — the numbers
 * have to agree with the displayed average or the summary contradicts itself.
 */

/**
 * Counts per star for `stars` given an average and a total.
 *
 * A plain exponential falloff around the mean does not work: it yields a
 * plausible shape whose weighted mean is far below the stated average (4.8
 * shown next to a 3.9 breakdown). Instead the decay rate `k` is solved by
 * bisection so the weighted mean equals the average exactly.
 *
 * @returns {number[]} counts ordered 5★ → 1★, summing exactly to `total`.
 */
export function buildStarDistribution(average, total, stars = [5, 4, 3, 2, 1]) {
  const safeTotal = Math.max(0, Math.round(Number(total) || 0));
  if (safeTotal === 0) return stars.map(() => 0);

  const meanFor = (k) => {
    const weights = stars.map((star) => Math.exp(k * star));
    const sum = weights.reduce((a, b) => a + b, 0);
    return weights.reduce((a, w, i) => a + w * stars[i], 0) / sum;
  };

  // meanFor is monotonically increasing in k, so bisection converges. The range
  // is wide because meanFor only approaches its limits asymptotically: reaching
  // an average of exactly 1.0 (all 1★) needs a steeply negative k.
  const min = Math.min(...stars);
  const max = Math.max(...stars);
  const target = Math.max(min, Math.min(max, Number(average) || 0));

  let low = -30;
  let high = 30;
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    if (meanFor(mid) < target) low = mid;
    else high = mid;
  }

  const k = (low + high) / 2;
  const weights = stars.map((star) => Math.exp(k * star));
  const weightSum = weights.reduce((a, b) => a + b, 0);

  const counts = weights.map((w) => Math.floor((w / weightSum) * safeTotal));

  // Flooring strands up to `stars.length - 1` reviews. Hand each one to
  // whichever bucket moves the running weighted mean closest to the target —
  // dumping the whole remainder into the largest bucket is badly wrong at small
  // totals (one review at an average of 1.0 would become a 5★ review).
  let assigned = counts.reduce((a, b) => a + b, 0);
  let weighted = counts.reduce((a, c, i) => a + c * stars[i], 0);

  while (assigned < safeTotal) {
    let best = 0;
    let bestError = Infinity;

    for (let i = 0; i < stars.length; i++) {
      const nextMean = (weighted + stars[i]) / (assigned + 1);
      const error = Math.abs(nextMean - target);
      if (error < bestError) {
        bestError = error;
        best = i;
      }
    }

    counts[best] += 1;
    assigned += 1;
    weighted += stars[best];
  }

  return counts;
}

/** Weighted mean of a distribution — used to assert the invariant in tests. */
export function weightedMean(counts, stars = [5, 4, 3, 2, 1]) {
  const sum = counts.reduce((a, b) => a + b, 0);
  if (!sum) return 0;
  return counts.reduce((a, c, i) => a + c * stars[i], 0) / sum;
}
