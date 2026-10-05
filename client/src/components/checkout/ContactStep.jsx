import { Mail, Phone } from 'lucide-react';

import Button from '../ui/Button.jsx';
import Field, { renderField } from './FormField.jsx';
import { validateEmail, validatePhone } from '../../utils/validation.js';

const FIELDS = [
  {
    name: 'email',
    label: 'Email',
    type: 'email',
    placeholder: 'you@example.com',
    autoComplete: 'email',
    iconLeft: <Mail className="size-4" strokeWidth={1.6} aria-hidden />,
    validate: validateEmail,
    span: 2,
  },
  {
    name: 'phone',
    label: 'Phone',
    type: 'tel',
    placeholder: '+1 555 000 1234',
    autoComplete: 'tel',
    iconLeft: <Phone className="size-4" strokeWidth={1.6} aria-hidden />,
    validate: validatePhone,
    span: 2,
    hint: 'Used only for delivery updates.',
  },
];

export default function ContactStep({ values, errors, onChange, onContinue, loading }) {
  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        {FIELDS.map((spec) => (
          <Field key={spec.name} span={spec.span}>
            {renderField(spec, values, errors, onChange)}
          </Field>
        ))}
      </div>

      <div className="mt-7 flex justify-end">
        <Button
          variant="primary-dark"
          size="lg"
          onClick={onContinue}
          loading={loading}
        >
          Continue to address
        </Button>
      </div>
    </div>
  );
}