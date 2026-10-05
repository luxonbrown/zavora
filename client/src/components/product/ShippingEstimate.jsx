import { Truck } from 'lucide-react';

import Select from '../ui/Select.jsx';
import StatusDot from '../ui/StatusDot.jsx';
import { COUNTRIES, estimateShipping } from '../../services/shipping.js';
import { formatPrice } from '../../utils/format.js';

/**
 * Destination selector with a live estimate. The country here is a *preview*
 * only — the address entered at checkout is what actually governs the rate.
 */
export default function ShippingEstimate({ countryCode, onCountryChange, price }) {
  const estimate = estimateShipping({ countryCode, subtotal: price });

  return (
    <div className="rounded-card border border-line bg-canvas p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-paper text-ink">
          <Truck className="size-4" strokeWidth={1.6} aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <label htmlFor="ship-to" className="t-small block font-medium">
            Estimate delivery
          </label>

          <Select
            id="ship-to"
            size="sm"
            value={countryCode}
            onChange={(e) => onCountryChange(e.target.value)}
            className="mt-2.5"
          >
            {COUNTRIES.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </Select>

          <div className="mt-3.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
            <StatusDot tone={estimate.free ? 'success' : 'info'} size="sm" />
            <span className="font-medium">{estimate.label}</span>
            <span className="text-muted" aria-hidden>
              ·
            </span>
            <span className="text-muted">
              {estimate.free ? 'Free shipping' : formatPrice(estimate.fee)}
            </span>
          </div>

          <p className="t-caption mt-2 text-muted">
            {estimate.free
              ? 'This order qualifies for free tracked shipping.'
              : `Spend ${formatPrice(estimate.amountToFree)} more for free tracked shipping.`}{' '}
            Duties included — nothing to pay on arrival.
          </p>
        </div>
      </div>
    </div>
  );
}
