import { ArrowLeft, Loader2, Lock } from 'lucide-react';

import Button from '../ui/Button.jsx';
import { getCountry } from '../../services/shipping.js';
import { formatPrice } from '../../utils/format.js';

function Block({ label, onEdit, children }) {
  return (
    <div className="border-b border-line py-4 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <p className="t-caption text-muted">{label}</p>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="t-caption underline underline-offset-4 transition-colors duration-150 hover:text-ink"
          >
            Edit
          </button>
        ) : null}
      </div>
      <div className="mt-2 text-[14px] leading-relaxed text-ink">{children}</div>
    </div>
  );
}

/** Final read-only review, plus the Place Order action. */
export default function ReviewStep({
  contact,
  address,
  quote,
  paymentLabel,
  cardLast4,
  onEdit,
  onPlaceOrder,
  placing,
  error,
}) {
  const country = getCountry(address.country);

  return (
    <div>
      <Block label="Contact" onEdit={() => onEdit(0)}>
        {contact.email}
        <br />
        <span className="text-muted">{contact.phone}</span>
      </Block>

      <Block label="Shipping address" onEdit={() => onEdit(1)}>
        {address.firstName} {address.lastName}
        <br />
        {address.address1}
        {address.address2 ? (
          <>
            <br />
            {address.address2}
          </>
        ) : null}
        <br />
        {address.city}, {address.state} {address.postalCode}
        <br />
        {country.name}
      </Block>

      <Block label="Shipping method" onEdit={() => onEdit(2)}>
        {quote?.shippingMethod?.name}
        {quote?.shippingMethod ? (
          <span className="text-muted">
            {' '}
            · {quote.shippingMethod.minDays}–{quote.shippingMethod.maxDays} business days
          </span>
        ) : null}
      </Block>

      <Block label="Payment" onEdit={() => onEdit(3)}>
        {paymentLabel}
        {cardLast4 ? <span className="text-muted"> ending {cardLast4}</span> : null}
      </Block>

      {/* Authoritative total, restated next to the action */}
      <div className="mt-6 rounded-card border border-line bg-paper px-5 py-4">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-[14px] text-muted">Order total</span>
          <span className="tnum text-[22px] font-medium tracking-[-0.015em]">
            {quote ? formatPrice(quote.total) : '—'}
          </span>
        </div>
        <p className="t-caption mt-1.5 text-muted">
          Includes shipping and any tax due for {country.name}.
        </p>
      </div>

      {error ? (
        <div role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger/6 px-4 py-3">
          <p className="t-small text-danger">{error}</p>
        </div>
      ) : null}

      <div className="mt-7 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="ghost-dark"
          size="lg"
          iconLeft={<ArrowLeft className="size-4" strokeWidth={1.8} aria-hidden />}
          onClick={() => onEdit(2)}
          disabled={placing}
        >
          Back
        </Button>

        <Button
          variant="primary-dark"
          size="xl"
          onClick={onPlaceOrder}
          loading={placing}
          disabled={!quote}
          iconLeft={!placing ? <Lock className="size-4" strokeWidth={1.8} aria-hidden /> : undefined}
        >
          {placing ? 'Placing order…' : `Place order${quote ? ` · ${formatPrice(quote.total)}` : ''}`}
        </Button>
      </div>
    </div>
  );
}

export { Loader2 };