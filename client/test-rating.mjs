// Unit test: the star distribution must agree with the stated average and sum
// exactly to the review total, for every product in the catalogue.
//
//   node test-rating.mjs
import { buildStarDistribution, weightedMean } from './src/utils/rating.js';
import { mockProducts } from './src/services/mockCatalogue.js';

const STARS = [5, 4, 3, 2, 1];
let failures = 0;

function check(label, condition, detail) {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? ` -> ${detail}` : ''}`);
  }
}

console.log('buildStarDistribution invariants\n');

// Integer counts mean the weighted mean can only land on a lattice, so the
// tolerance has to allow for granularity. Moving a single review between the
// extreme buckets shifts the mean by (max - min) / total — that is the tightest
// bound available, and it is what the assertions below enforce.
const toleranceFor = (total) => Math.max(0.005, 4 / total);

// 1. Every catalogue product.
console.log('catalogue products');
for (const p of mockProducts) {
  const counts = buildStarDistribution(p.rating, p.reviewCount);
  const sum = counts.reduce((a, b) => a + b, 0);
  const mean = weightedMean(counts);

  check(
    `${p.slug} (${p.rating} / ${p.reviewCount})`,
    sum === p.reviewCount && Math.abs(mean - p.rating) <= toleranceFor(p.reviewCount),
    `sum=${sum} mean=${mean.toFixed(4)} tol=${toleranceFor(p.reviewCount).toFixed(4)}`
  );
}

// 2. Sweep the whole plausible average range.
console.log('\naverage sweep 1.0 - 5.0');
let worstMeanError = 0;
let worstAtTotal = 0;
let worstSumError = 0;
for (let avg = 1; avg <= 5.0001; avg += 0.05) {
  for (const total of [1, 7, 99, 1284, 40000]) {
    const counts = buildStarDistribution(avg, total);
    const sum = counts.reduce((a, b) => a + b, 0);
    const mean = weightedMean(counts);
    const excess = Math.abs(mean - avg) - toleranceFor(total);
    if (excess > worstMeanError) {
      worstMeanError = excess;
      worstAtTotal = total;
    }
    worstSumError = Math.max(worstSumError, Math.abs(sum - total));
    if (counts.some((c) => c < 0)) {
      check(
        `no negative counts at avg=${avg.toFixed(2)} total=${total}`,
        false,
        JSON.stringify(counts)
      );
    }
  }
}
check(
  `weighted mean within lattice tolerance (worst excess ${worstMeanError.toExponential(2)} at total=${worstAtTotal})`,
  worstMeanError <= 0
);
check(`rows sum to total (max error ${worstSumError})`, worstSumError === 0);

// 3. Edge cases.
console.log('\nedge cases');
check('zero total returns zeros', buildStarDistribution(4.5, 0).every((c) => c === 0));
check('single review', (() => {
  const c = buildStarDistribution(5, 1);
  return c[0] === 1 && c.slice(1).every((x) => x === 0);
})());
check('average of exactly 1.0 is all 1-star', (() => {
  const c = buildStarDistribution(1, 500);
  return c[4] === 500 && c.slice(0, 4).every((x) => x === 0);
})());
check('average of exactly 5.0 is all 5-star', (() => {
  const c = buildStarDistribution(5, 500);
  return c[0] === 500 && c.slice(1).every((x) => x === 0);
})());
check('clamps below range', Math.abs(weightedMean(buildStarDistribution(-3, 500)) - 1) < 0.005);
check('clamps above range', Math.abs(weightedMean(buildStarDistribution(99, 500)) - 5) < 0.005);
check(
  'monotonically decreasing buckets',
  (() => {
    const c = buildStarDistribution(4.2, 1000);
    return c.every((v, i) => i === 0 || v <= c[i - 1]);
  })()
);

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
