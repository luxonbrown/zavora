/**
 * Unit tests for the money helpers.
 *
 * These exist because a units bug (treating a DECIMAL column as if it were
 * integer cents) is invisible to the type system and to a passing build: the
 * database holds 147.95 while the API reports 1.48. Assert the boundary
 * explicitly.
 *
 * Usage: node test/money.js
 */
const assert = require('assert');
const { toCents, fromCents, centsToNumber, decimal, applyPercent } = require('../lib/money');

let passed = 0;
function t(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (err) {
    console.log(`  FAIL  ${name}: ${err.message}`);
    process.exitCode = 1;
  }
}

console.log('money');

/* ---- toCents: DECIMAL text/number -> integer cents ---------------------- */
t('toCents whole decimal string', () => assert.strictEqual(toCents('129.00'), 12900));
t('toCents two decimals', () => assert.strictEqual(toCents('18.95'), 1895));
t('toCents number', () => assert.strictEqual(toCents(349), 34900));
t('toCents integer number', () => assert.strictEqual(toCents(150), 15000));
t('toCents zero', () => assert.strictEqual(toCents('0.00'), 0));
t('toCents null is 0', () => assert.strictEqual(toCents(null), 0));
t('toCents undefined is 0', () => assert.strictEqual(toCents(undefined), 0));
t('toCents empty string is 0', () => assert.strictEqual(toCents(''), 0));
t('toCents rounds to the nearest cent', () => assert.strictEqual(toCents('1.005'), 101));
t('toCents rounds down below a half cent', () => assert.strictEqual(toCents('1.004'), 100));
t('toCents handles a negative amount', () => assert.strictEqual(toCents('-6.95'), -695));
t('toCents ignores a third decimal', () => assert.strictEqual(toCents('12.345'), 1235));

/* ---- fromCents: integer cents -> DECIMAL text ---------------------------- */
t('fromCents whole', () => assert.strictEqual(fromCents(12900), '129.00'));
t('fromCents always two decimals', () => assert.strictEqual(fromCents(5), '0.05'));
t('fromCents zero', () => assert.strictEqual(fromCents(0), '0.00'));
t('fromCents negative', () => assert.strictEqual(fromCents(-695), '-6.95'));

/* ---- the boundary that was actually broken ------------------------------ */
t('decimal passes a DECIMAL column through unscaled', () => assert.strictEqual(decimal('147.95'), 147.95));
t('decimal does not divide by 100', () => assert.notStrictEqual(decimal('147.95'), 1.4795));
t('decimal of null is null, not zero', () => assert.strictEqual(decimal(null), null));
t('decimal of undefined is null', () => assert.strictEqual(decimal(undefined), null));
t('decimal of zero is 0', () => assert.strictEqual(decimal('0.00'), 0));

t('centsToNumber converts real cents', () => assert.strictEqual(centsToNumber(14795), 147.95));
t('centsToNumber of 5 cents is 0.05', () => assert.strictEqual(centsToNumber(5), 0.05));
t('passing a raw DECIMAL column to centsToNumber is the original bug', () => {
  // The failure mode: centsToNumber("147.95") divides by 100 a second time and
  // reports 1.48. `decimal` is the correct helper for raw column values.
  assert.strictEqual(centsToNumber('147.95'), 1.48);
  assert.strictEqual(decimal('147.95'), 147.95);
  // ...and the correct path round-trips cleanly.
  assert.strictEqual(centsToNumber(toCents('147.95')), 147.95);
});

/* ---- round trips --------------------------------------------------------- */
t('toCents(fromCents(x)) round trip', () => {
  for (const cents of [0, 5, 99, 100, 1895, 12900, 14795, 999999]) {
    assert.strictEqual(toCents(fromCents(cents)), cents, `failed at ${cents}`);
  }
});

/* ---- percentages --------------------------------------------------------- */
t('applyPercent with a whole percent', () => assert.strictEqual(applyPercent(10000, 10), 1000));
t('applyPercent with a fractional rate', () => assert.strictEqual(applyPercent(10000, 0.0875), 875));
t('applyPercent zero', () => assert.strictEqual(applyPercent(10000, 0), 0));
t('applyPercent rounds half up', () => assert.strictEqual(applyPercent(101, 50), 51));

/* ---- order arithmetic stays exact ---------------------------------------- */
t('checkout subtotal + shipping is exact in cents', () => {
  const subtotal = 12900;
  const shipping = 1895;
  const total = subtotal + shipping;
  assert.strictEqual(fromCents(total), '147.95');
});
t('0.1 + 0.2 style float error cannot appear in cents math', () => {
  // The float equivalent is 0.30000000000000004; integer cents cannot drift.
  assert.strictEqual(fromCents(10 + 20), '0.30');
});

if (process.exitCode) {
  console.log('\nmoney tests FAILED');
} else {
  console.log(`  ${passed} assertions passed`);
}