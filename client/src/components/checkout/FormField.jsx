import Input from '../ui/Input.jsx';
import Select from '../ui/Select.jsx';
import PasswordField from '../ui/PasswordField.jsx';
import { cx } from '../../utils/format.js';

/**
 * Renders a declarative field spec so the five checkout steps don't each
 * hand-roll labels, errors and ids.
 *
 * spec: { name, label, type?, as?: 'input'|'select'|'password', options?,
 *         placeholder?, autoComplete?, span?: 1|2, validate?, format? }
 */
export function renderField(spec, values, errors, onChange) {
  const shared = {
    name: spec.name,
    label: spec.label,
    error: errors[spec.name],
    value: values[spec.name] ?? '',
    onChange: onChange(spec),
    placeholder: spec.placeholder,
    autoComplete: spec.autoComplete,
  };

  if (spec.as === 'select') {
    return (
      <Select
        {...shared}
        size={spec.size ?? 'lg'}
        hint={spec.hint}
      >
        {(spec.options ?? []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    );
  }

  if (spec.as === 'password') return <PasswordField {...shared} hint={spec.hint} size={spec.size ?? 'lg'} />;

  return (
    <Input
      {...shared}
      type={spec.type ?? 'text'}
      size={spec.size ?? 'lg'}
      inputMode={spec.inputMode}
      maxLength={spec.maxLength}
      onChange={(event) => onChange(spec)(event)}
      iconLeft={spec.iconLeft}
      hint={spec.hint}
    />
  );
}

/** Formats a card number as the user types: 4 4 4 4 4. */
export function formatCardNumber(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 19);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

/** Formats an expiry as the user types: MM/YY. */
export function formatExpiry(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

/** Grid wrapper that lets a field span both columns. */
export function Field({ span, children, className }) {
  return (
    <div className={cx(span === 2 && 'sm:col-span-2', className)}>{children}</div>
  );
}

export default Field;