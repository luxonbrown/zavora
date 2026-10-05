/** Field-level validators. Each returns an error message, or null when valid. */

const MIN_PASSWORD_LENGTH = 8;

export const required =
  (message = 'This field is required.') =>
  (value) =>
    value && String(value).trim() ? null : message;

export const validateEmail = (value) => {
  if (!value || !String(value).trim()) return 'Enter your email address.';
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value).trim())
    ? null
    : 'Enter a valid email address.';
};

export const validatePassword = (value) => {
  if (!value) return 'Enter your password.';
  if (String(value).length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
};

/** Deliberately permissive: international formats vary too much to be strict. */
export const validatePhone = (value) => {
  if (!value || !String(value).trim()) return 'Enter your phone number.';
  const digits = String(value).replace(/[^\d]/g, '');
  return digits.length >= 7 && digits.length <= 15
    ? null
    : 'Enter a valid phone number.';
};

export const minLength =
  (n, message) =>
  (value) =>
    !value || String(value).length >= n ? null : message;

export const postalCode = (value) => {
  if (!value || !String(value).trim()) return 'Enter your postal code.';
  return String(value).trim().length >= 3 ? null : 'Enter a valid postal code.';
};

/** Luhn check — catches mistyped card numbers before a gateway round-trip. */
export function luhn(number) {
  const digits = String(number || '').replace(/\D/g, '');
  if (digits.length < 12) return false;

  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

export const cardNumber = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return 'Enter your card number.';
  if (digits.length < 12) return 'Check the card number.';
  return luhn(digits) ? null : 'Check the card number.';
};

export const expiry = (value) => {
  if (!value || !String(value).trim()) return 'Enter the expiry date.';
  const match = /^(\d{2})\s*\/\s*(\d{2})$/.exec(String(value).trim());
  if (!match) return 'Use MM/YY.';

  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return 'Use MM/YY.';

  // Card is valid through the last day of its expiry month.
  const now = new Date();
  const expiresAt = new Date(year, month, 0, 23, 59, 59);
  return expiresAt >= now ? null : 'This card has expired.';
};

export const cvc = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return 'Enter the security code.';
  return digits.length >= 3 && digits.length <= 4 ? null : 'Check the security code.';
};

/**
 * Rule-based strength estimate. Honest about what it measures — length and
 * character variety — so it never claims a weak password is strong.
 */
export function passwordStrength(password = '') {
  if (!password) return { score: 0, label: '', checks: [] };

  const checks = [
    { id: 'length', label: `${MIN_PASSWORD_LENGTH}+ characters`, met: password.length >= MIN_PASSWORD_LENGTH },
    { id: 'mixed', label: 'Upper and lowercase', met: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { id: 'number', label: 'A number', met: /\d/.test(password) },
    { id: 'symbol', label: 'A symbol', met: /[^A-Za-z0-9]/.test(password) },
  ];

  const met = checks.filter((c) => c.met).length;
  const score = Math.min(4, Math.round((met / checks.length) * 4));

  return { score, label: ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'][score], checks };
}

/** Run a field spec map against a values object. */
export function validateFields(fields, values) {
  const errors = {};
  for (const field of fields) {
    if (field.validate) {
      const message = field.validate(values[field.name]);
      if (message) errors[field.name] = message;
    }
  }
  return errors;
}

export const hasErrors = (errors) => Object.keys(errors).length > 0;