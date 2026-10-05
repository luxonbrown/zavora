import { ArrowLeft } from 'lucide-react';

import Button from '../ui/Button.jsx';
import Field, { renderField } from './FormField.jsx';
import { COUNTRIES } from '../../services/shipping.js';
import { validateEmail, validatePhone, postalCode, required } from '../../utils/validation.js';

export default function AddressStep({
  values,
  errors,
  onChange,
  onContinue,
  onBack,
  loading,
  contactPhone,
  onEditPhone,
}) {
  const FIELDS = [
    {
      name: 'firstName',
      label: 'First name',
      placeholder: 'Alex',
      autoComplete: 'given-name',
      validate: required('Enter your first name.'),
    },
    {
      name: 'lastName',
      label: 'Last name',
      placeholder: 'Moreau',
      autoComplete: 'family-name',
      validate: required('Enter your last name.'),
    },
    {
      name: 'country',
      label: 'Country / region',
      as: 'select',
      options: COUNTRIES.map((c) => ({ value: c.code, label: c.name })),
      validate: required('Choose a destination.'),
    },
    {
      name: 'state',
      label: 'State / province',
      placeholder: 'California',
      autoComplete: 'address-level1',
      validate: required('Enter your state or province.'),
    },
    {
      name: 'city',
      label: 'City',
      placeholder: 'San Francisco',
      autoComplete: 'address-level2',
      validate: required('Enter your city.'),
    },
    {
      name: 'address1',
      label: 'Address',
      placeholder: '1200 Market Street',
      autoComplete: 'address-line1',
      validate: required('Enter your street address.'),
    },
    {
      name: 'address2',
      label: 'Apartment, suite (optional)',
      placeholder: 'Apt 4B',
      autoComplete: 'address-line2',
    },
    {
      name: 'postalCode',
      label: 'Postal code',
      placeholder: '94103',
      autoComplete: 'postal-code',
      validate: postalCode,
    },
  ];

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        {FIELDS.map((spec) => (
          <Field key={spec.name} span={spec.span}>
            {renderField(spec, values, errors, onChange)}
          </Field>
        ))}
      </div>

      {/* Phone is captured once in Contact; don't ask for it twice. */}
      <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-line bg-paper px-4 py-3">
        <span className="t-small text-muted">Phone for delivery updates</span>
        <span className="t-small font-medium">{contactPhone || 'Not set'}</span>
        <button
          type="button"
          onClick={onEditPhone}
          className="t-caption ml-auto underline underline-offset-4 transition-colors duration-150 hover:text-ink"
        >
          {contactPhone ? 'Edit' : 'Add'}
        </button>
      </div>

      <div className="mt-7 flex items-center justify-between gap-4">
        <Button variant="ghost-dark" size="lg" iconLeft={<ArrowLeft className="size-4" strokeWidth={1.8} aria-hidden />} onClick={onBack}>
          Back
        </Button>

        <Button variant="primary-dark" size="lg" onClick={onContinue} loading={loading}>
          Continue to shipping
        </Button>
      </div>
    </div>
  );
}

export { validateEmail, validatePhone };