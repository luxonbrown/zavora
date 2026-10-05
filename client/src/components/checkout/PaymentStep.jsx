import { ArrowLeft, Check, CreditCard, Lock } from 'lucide-react';

import Button from '../ui/Button.jsx';
import Field, { formatCardNumber, formatExpiry, renderField } from './FormField.jsx';
import { cx } from '../../utils/format.js';
import { cardNumber, cvc, expiry, required } from '../../utils/validation.js';

export default function PaymentStep({
  methods,
  method,
  card,
  errors,
  onMethodChange,
  onCardChange,
  onContinue,
  onBack,
  loading,
}) {
  return (
    <div>
      <ul className="space-y-3" role="radiogroup" aria-label="Payment method">
        {methods.map((option) => {
          const selected = method === option.id;
          return (
            <li key={option.id}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onMethodChange(option.id)}
                className={cx(
                  'flex w-full items-center gap-4 rounded-card border px-5 py-4 text-left transition-colors duration-150',
                  selected ? 'border-ink bg-paper' : 'border-line hover:border-line-strong'
                )}
              >
                <span
                  className={cx(
                    'grid size-5 shrink-0 place-items-center rounded-full border transition-colors duration-150',
                    selected ? 'border-ink bg-ink text-paper' : 'border-line-strong'
                  )}
                >
                  {selected ? <Check className="size-3" strokeWidth={3} aria-hidden /> : null}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium">{option.name}</span>
                  <span className="t-caption mt-0.5 block text-muted">{option.description}</span>
                </span>

                {option.id === 'card' ? (
                  <CreditCard className="size-5 shrink-0 text-muted" strokeWidth={1.5} aria-hidden />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      {method === 'card' ? (
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field span={2}>
            {renderField(
              {
                name: 'cardNumber',
                label: 'Card number',
                placeholder: '4242 4242 4242 4242',
                autoComplete: 'cc-number',
                inputMode: 'numeric',
                validate: cardNumber,
              },
              card,
              errors,
              (spec) => (event) =>
                onCardChange({ ...card, cardNumber: formatCardNumber(event.target.value) })
            )}
          </Field>

          <Field>
            {renderField(
              {
                name: 'expiry',
                label: 'Expiry',
                placeholder: 'MM/YY',
                autoComplete: 'cc-exp',
                inputMode: 'numeric',
                maxLength: 5,
                validate: expiry,
              },
              card,
              errors,
              (spec) => (event) =>
                onCardChange({ ...card, expiry: formatExpiry(event.target.value) })
            )}
          </Field>

          <Field>
            {renderField(
              {
                name: 'cvc',
                label: 'Security code',
                placeholder: '123',
                autoComplete: 'cc-csc',
                inputMode: 'numeric',
                maxLength: 4,
                validate: cvc,
              },
              card,
              errors,
              (spec) => (event) =>
                onCardChange({
                  ...card,
                  cvc: event.target.value.replace(/\D/g, '').slice(0, 4),
                })
            )}
          </Field>

          <Field span={2}>
            <label htmlFor="cardName" className="t-small mb-1.5 block font-medium text-ink">
              Name on card
            </label>
            <input
              id="cardName"
              name="cardName"
              autoComplete="cc-name"
              value={card.cardName ?? ''}
              onChange={(e) => onCardChange({ ...card, cardName: e.target.value })}
              placeholder="Alex Moreau"
              aria-invalid={errors.cardName ? true : undefined}
              className="h-13 w-full rounded-xl border border-line bg-paper px-3.5 text-[15px] text-ink transition-colors duration-150 placeholder:text-muted focus:border-ink focus:ring-2 focus:ring-ink/8 focus:outline-none"
            />
            {errors.cardName ? (
              <p className="t-caption mt-1.5 text-danger">{errors.cardName}</p>
            ) : null}
          </Field>
        </div>
      ) : null}

      <p className="t-caption mt-5 flex items-start gap-2 text-muted">
        <Lock className="mt-px size-3.5 shrink-0" strokeWidth={1.6} aria-hidden />
        Encrypted in transit. We never store your full card number.
      </p>

      <div className="mt-7 flex items-center justify-between gap-4">
        <Button
          variant="ghost-dark"
          size="lg"
          iconLeft={<ArrowLeft className="size-4" strokeWidth={1.8} aria-hidden />}
          onClick={onBack}
        >
          Back
        </Button>

        <Button
          variant="primary-dark"
          size="lg"
          onClick={onContinue}
          loading={loading}
          disabled={!method}
        >
          Review order
        </Button>
      </div>
    </div>
  );
}

export { required };