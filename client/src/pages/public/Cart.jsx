import { useEffect } from 'react';
import { ArrowRight, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';

import Container from '../../components/layout/Container.jsx';
import Button from '../../components/ui/Button.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import CartLineItem from '../../components/cart/CartLineItem.jsx';
import CartSummary from '../../components/cart/CartSummary.jsx';
import CartRecommendations from '../../components/cart/CartRecommendations.jsx';

import { useCart } from '../../context/CartContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import productsService from '../../services/products.js';
import { formatNumber } from '../../utils/format.js';

export default function Cart() {
  const {
    items,
    saved,
    savedCount,
    count,
    subtotal,
    shipping,
    total,
    countryCode,
    setCountryCode,
    updateQuantity,
    removeItem,
    saveForLater,
    moveToCart,
    removeSaved,
    moveAllSavedToCart,
  } = useCart();

  const recommendations = useAsync(() => productsService.trending(8), []);

  // Keep the document title honest about how full the cart is.
  useEffect(() => {
    document.title = count > 0 ? `Cart (${count}) — MARKETHUB` : 'Your cart — MARKETHUB';
    return () => {
      document.title = 'MARKETHUB — Discover what moves you';
    };
  }, [count]);

  const onRemove = (key) => {
    const line = items.find((i) => i.key === key);
    removeItem(key);
    toast('Removed from cart', { description: line?.name });
  };

  const onSave = (key) => {
    const line = items.find((i) => i.key === key);
    saveForLater(key);
    toast('Saved for later', { description: line?.name });
  };

  const onMoveToCart = (key) => {
    const line = saved.find((i) => i.key === key);
    moveToCart(key);
    toast.success('Moved to cart', { description: line?.name });
  };

  const excludedProductIds = [...items, ...saved].map((i) => i.productId);

  return (
    <div className="bg-paper pt-28 pb-24 md:pt-32 md:pb-32">
      <Container>
        <header className="max-w-2xl">
          <p className="t-eyebrow">Your cart</p>
          <h1 className="h2-section mt-3">
            {count > 0 ? `${formatNumber(count)} ${count === 1 ? 'item' : 'items'}` : 'Your cart'}
          </h1>
          {count > 0 ? (
            <p className="t-body mt-4 text-muted">
              Shipping and duties are calculated at checkout.
            </p>
          ) : null}
        </header>

        {items.length === 0 && saved.length === 0 ? (
          <div className="mx-auto mt-12 max-w-xl">
            <EmptyState
              icon={ShoppingBag}
              title="Your cart is empty"
              description="Nothing here yet. Have a look at what is trending this week."
              action="Browse products"
              actionTo="/shop"
            />
          </div>
        ) : (
          <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_380px] lg:gap-16">
            {/* Lines */}
            <div className="min-w-0">
              {items.length > 0 ? (
                <ul>
                  {items.map((line) => (
                    <CartLineItem
                      key={line.key}
                      line={line}
                      onQuantityChange={updateQuantity}
                      onRemove={onRemove}
                      onSaveForLater={onSave}
                    />
                  ))}
                </ul>
              ) : (
                <div className="rounded-card border border-line px-6 py-12 text-center">
                  <p className="t-title">Your cart is empty</p>
                  <p className="t-small mt-2 text-muted">
                    Anything you save for later will appear here when you are ready.
                  </p>
                  <Button to="/shop" variant="outline-dark" size="md" className="mt-6">
                    Browse products
                  </Button>
                </div>
              )}

              {/* Saved for later */}
              {saved.length > 0 ? (
                <section className="mt-16">
                  <div className="flex items-center justify-between gap-4 border-b border-line pb-4">
                    <h2 className="t-title">
                      Saved for later{' '}
                      <span className="t-caption ml-1.5 text-muted tnum">
                        {formatNumber(savedCount)}
                      </span>
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        moveAllSavedToCart();
                        toast.success('Moved all saved items to your cart');
                      }}
                      className="t-small inline-flex items-center gap-1.5 text-muted transition-colors duration-150 hover:text-ink"
                    >
                      Move all to cart
                      <ArrowRight className="size-3.5" strokeWidth={1.8} aria-hidden />
                    </button>
                  </div>

                  <ul>
                    {saved.map((line) => (
                      <CartLineItem
                        key={line.key}
                        line={line}
                        variant="saved"
                        onRemove={removeSaved}
                        onSaveForLater={onMoveToCart}
                      />
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>

            {/* Summary */}
            <div className="lg:sticky lg:top-24 lg:self-start">
              <CartSummary
                subtotal={subtotal}
                shipping={shipping}
                total={total}
                countryCode={countryCode}
                onCountryChange={setCountryCode}
                checkoutDisabled={items.length === 0}
              />
            </div>
          </div>
        )}

        <CartRecommendations
          products={recommendations.data ?? []}
          loading={recommendations.loading}
          excludeProductIds={excludedProductIds}
        />
      </Container>
    </div>
  );
}