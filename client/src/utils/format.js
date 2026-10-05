const DEFAULT_SETTINGS = {
  currency: 'USD',
  locale: 'en-US',
  markets: ['US', 'GB', 'DE', 'FR', 'CA', 'AU', 'JP', 'AE'],
};

/** Currency/locale formatting used across storefront and admin. */
export function formatPrice(amount, { currency = 'USD', locale = 'en-US' } = {}) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

export function formatNumber(value, locale = 'en-US') {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(locale).format(n);
}

export function formatDate(value, { locale = 'en-US', withTime = false } = {}) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(d);
}

export function discountPercent(price, compareAt) {
  const p = Number(price);
  const c = Number(compareAt);
  if (!Number.isFinite(p) || !Number.isFinite(c) || c <= p) return 0;
  return Math.round(((c - p) / c) * 100);
}

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export { DEFAULT_SETTINGS };
