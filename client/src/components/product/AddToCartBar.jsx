import { useEffect, useState } from 'react';
import { ShoppingBag } from 'lucide-react';

import Button from '../ui/Button.jsx';
import { formatPrice } from '../../utils/format.js';

/**
 * Sticky add-to-cart bar for mobile. Appears only once the main purchase block
 * has scrolled out of view, so it never covers the primary button while the
 * customer is still looking at it.
 */
export default function AddToCartBar({ price, quantity, disabled, disabledLabel, onAdd, selectorRef }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = selectorRef?.current;
    if (!target) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [selectorRef]);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-80 border-t border-line bg-paper/95 backdrop-blur-xl transition-transform duration-300 ease-out lg:hidden ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center gap-4 px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <p className="t-caption text-muted">
            {quantity > 1 ? `${quantity} × ` : ''}Total
          </p>
          <p className="t-title tnum">{formatPrice(price * quantity)}</p>
        </div>

        <Button
          variant="primary-dark"
          size="lg"
          onClick={onAdd}
          disabled={disabled}
          iconLeft={<ShoppingBag className="size-4" strokeWidth={1.7} aria-hidden />}
          className="shrink-0"
        >
          {disabled ? disabledLabel : 'Add to cart'}
        </Button>
      </div>
    </div>
  );
}
