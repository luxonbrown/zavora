/**
 * Small shared validators. Kept deliberately thin — they exist to give a clear
 * 400 instead of letting a bad value reach the driver and fail obscurely.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isValidEmail(value) {
  return typeof value === 'string' && value.length <= 190 && EMAIL_RE.test(value.trim());
}

function isNonEmptyString(value, max = 255) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

/** Positive integer within an inclusive range. */
function isIntegerInRange(value, min, max) {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max;
}

/** ISO-3166 alpha-2, uppercased. */
function normalizeCountry(value) {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

/** Trim and cap a string field, returning '' for absent values. */
function cleanString(value, max) {
  if (value === null || value === undefined) return '';
  return String(value).trim().slice(0, max);
}

module.exports = { isValidEmail, isNonEmptyString, isIntegerInRange, normalizeCountry, cleanString };
