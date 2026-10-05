/**
 * Money is handled exclusively in integer minor units ("cents").
 *
 * DECIMAL columns are read as strings (pool.js sets decimalNumbers: false), so
 * every amount crossing this boundary is parsed to an integer here. No pricing
 * code anywhere else should do floating-point arithmetic on money.
 */

/** Parse a DECIMAL string / number / cents integer into integer cents. */
function toCents(amount) {
  if (amount === null || amount === undefined || amount === '') return 0;
  if (typeof amount === 'number') {
    if (!Number.isFinite(amount)) return 0;
    return Math.round(amount * 100);
  }
  const cleaned = String(amount).trim();
  const negative = cleaned.startsWith('-');
  const unsigned = negative ? cleaned.slice(1) : cleaned;
  const [whole = '0', fraction = ''] = unsigned.split('.');
  const padded = `${fraction}000`.slice(0, 3); // keep 3dp, then round below
  let cents = Number(whole || '0') * 100 + Number(padded.slice(0, 2));
  if (Number(padded[2] || '0') >= 5) cents += 1;
  return negative ? -cents : cents;
}

/** Render integer cents as a 2dp decimal string, safe for a DECIMAL column. */
function fromCents(cents) {
  return (Math.round(Number(cents) || 0) / 100).toFixed(2);
}

/** Render integer cents for JSON responses, as a Number. */
function centsToNumber(cents) {
  return Math.round(Number(cents) || 0) / 100;
}

/**
 * Coerce a DECIMAL column for a JSON response.
 *
 * DECIMAL columns are ALREADY in currency units ("147.95" means 147.95), so
 * they must not be passed through centsToNumber — that would divide by 100 a
 * second time and turn 147.95 into 1.48. Use this for raw column values and
 * reserve centsToNumber for genuine integer-cent values computed in code.
 */
function decimal(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Apply a percentage to a cent amount, rounding half-up.
 * `percent` may be 35 (35%) or 0.0875 (an already-fractional rate).
 */
function applyPercent(cents, percent) {
  const rate = Number(percent) || 0;
  const fraction = rate > 1 ? rate / 100 : rate;
  return Math.round(Number(cents) * fraction);
}

module.exports = { toCents, fromCents, centsToNumber, decimal, applyPercent };
