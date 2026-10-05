import { Truck } from 'lucide-react';

import Button from '../ui/Button.jsx';
import Select from '../ui/Select.jsx';
import StatusDot from '../ui/StatusDot.jsx';
import { COUNTRIES, FREE_SHIPPING_THRESHOLD } from '../../services/shipping.js';
import { cx, formatPrice } from '../../utils/format.js';

function Row({ label, value, muted = false, emphasis = false }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className={cx('text-[14px]', muted ? 'text-muted' : 'text-ink')}>{label}</span>
      <span
        className={cx(
          'tnum shrink-0 transition-colors duration-200',
          emphasis ? 'text-[19px] font-medium tracking-[-0.01em]' : 'text-[14px]'
        )}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Order summary. Totals are derived from cart state, never from anything the
 * browser sends — step 11 recomputes all of this server-side before payment.
 */
export default function CartSummary({
  subtotal,
  shipping,
  total,
  countryCode,
  onCountryChange,
  checkoutDisabled = false,
}) {
  const freeShippingProgress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);

  return (
    <div className="rounded-card border border-line bg-paper p-6">
      <h2 className="t-title">Order summary</h2>

      {/* Destination drives the quoted rate */}
      <div className="mt-6">
        <label htmlFor="cart-country" className="t-small mb-2 block font-medium">
          Deliver to
        </label>
        <Select
          id="cart-country"
          size="sm"
          value={countryCode}
          onChange={(e) => onCountryChange(e.target.value)}
        >
          {COUNTRIES.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </Select>
      </div>

      {/* Free-shipping progress */}
      <div className="mt-5">
        <div className="h-1 w-full overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full rounded-full bg-ink transition-[width] duration-500 ease-out"
            style={{ width: `${freeShippingProgress}%` }}
          />
        </div>
        <p className="t-caption mt-2.5 flex items-center gap-1.5 text-muted">
          <StatusDot tone={shipping.free ? 'success' : 'muted'} size="sm" />
          {shipping.free
            ? 'Free tracked shipping applied'
            : `${formatPrice(shipping.amountToFree)} away from free shipping`}
        </p>
      </div>

      <div className="mt-6 space-y-3 border-t border-line pt-5">
        <Row label="Subtotal" value={formatPrice(subtotal)} />
        <Row
          label="Estimated shipping"
          value={shipping.free ? 'Free' : formatPrice(shipping.fee)}
          muted={shipping.free}
        />
        <div className="border-t border-line pt-4">
          <Row label="Total" value={formatPrice(total)} emphasis />
        </div>
      </div>

      <p className="t-caption mt-3 flex items-start gap-1.5 text-muted">
        <Truck className="mt-px size-3.5 shrink-0" strokeWidth={1.6} aria-hidden />
        Duties and taxes are calculated at checkout. Nothing to pay on delivery.
      </p>

      <Button
        to="/checkout"
        variant="primary-dark"
        size="xl"
        fullWidth
        className="mt-6"
        disabled={checkoutDisabled}
      >
        Proceed to checkout
      </Button>

      <Button to="/shop" variant="outline-dark" size="lg" fullWidth className="mt-3">
        Continue shopping
      </Button>
    </div>
  );
}