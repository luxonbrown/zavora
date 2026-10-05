import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Heart, PackageX, ShieldCheck, Truck, Undo2 } from 'lucide-react';
import { toast } from 'sonner';

import Container from '../../components/layout/Container.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Rating from '../../components/ui/Rating.jsx';
import StatusDot from '../../components/ui/StatusDot.jsx';
import Tabs from '../../components/ui/Tabs.jsx';
import QuantityStepper from '../../components/ui/QuantityStepper.jsx';
import ProductGallery from '../../components/product/ProductGallery.jsx';
import ProductGrid from '../../components/product/ProductGrid.jsx';
import ProductDetailSkeleton from '../../components/product/ProductDetailSkeleton.jsx';
import VariantSelector from '../../components/product/VariantSelector.jsx';
import ShippingEstimate from '../../components/product/ShippingEstimate.jsx';
import AddToCartBar from '../../components/product/AddToCartBar.jsx';
import RatingSummary from '../../components/product/RatingSummary.jsx';

import { useCart } from '../../context/CartContext.jsx';
import { useWishlist } from '../../context/WishlistContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import productsService from '../../services/products.js';
import { discountPercent, formatDate, formatPrice } from '../../utils/format.js';

const SHIPPING_COPY = [
  'Tracked and insured on every order, cleared through customs before it reaches you.',
  'Delivered in 3–9 business days depending on destination, with a real carrier tracking number issued when the parcel leaves the warehouse.',
  'Duties and taxes are calculated at checkout, so there is nothing to pay on delivery.',
];

const RETURNS_COPY = [
  '30 days from delivery — return anything unused and in its original packaging.',
  'Start a return from your account, and print the prepaid label we email you.',
  'Refunds are issued to the original payment method within 5 business days of the parcel arriving back with us.',
];

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const { addItem } = useCart();
  const { has: isSaved, toggle: toggleSaved } = useWishlist();

  const [color, setColor] = useState(null);
  const [size, setSize] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [countryCode, setCountryCode] = useState('US');
  const [tab, setTab] = useState('description');
  const purchaseRef = useRef(null);

  const product = useAsync(() => productsService.getBySlug(slug), [slug]);
  const item = product.data;

  const reviews = useAsync(
    () => (item ? productsService.reviews(item.slug) : Promise.resolve([])),
    [item?.slug]
  );
  const related = useAsync(
    () => (item ? productsService.related(item, 4) : Promise.resolve([])),
    [item?.id]
  );

  const variant = useMemo(() => {
    if (!item?.variants?.length) return null;
    if (!color) return null;
    return item.variants.find((v) => v.name === color) ?? null;
  }, [item, color]);

  // A new product means the previous colour/size/quantity no longer applies.
  // Must sit before the early returns below so hooks stay unconditional.
  useEffect(() => {
    setColor(null);
    setSize(null);
    setQuantity(1);
    setTab('description');
  }, [item?.id]);

  if (product.loading && !item) return <ProductDetailSkeleton />;

  if (product.error) {
    return (
      <div className="bg-paper pt-32 pb-24">
        <Container>
          <div className="mx-auto max-w-md text-center">
            <h1 className="h2-section">We couldn't load this product</h1>
            <p className="t-body mt-4 text-muted">Check your connection and try again.</p>
            <Button
              variant="primary-dark"
              size="lg"
              className="mt-8"
              onClick={product.reload}
            >
              Try again
            </Button>
          </div>
        </Container>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="bg-paper pt-32 pb-24">
        <Container>
          <div className="mx-auto max-w-md text-center">
            <span className="mx-auto mb-6 grid size-14 place-items-center rounded-full bg-surface-muted text-muted">
              <PackageX className="size-6" strokeWidth={1.5} aria-hidden />
            </span>
            <p className="t-eyebrow">Error 404</p>
            <h1 className="h2-section mt-3">Product not found</h1>
            <p className="t-body mt-4 text-muted">
              This product may have sold out or been replaced. Have a look at what is
              in stock instead.
            </p>
            <Button to="/shop" variant="primary-dark" size="lg" className="mt-8">
              Browse all products
            </Button>
          </div>
        </Container>
      </div>
    );
  }

  const price = variant?.price ?? item.price;
  const stock = variant?.stock ?? item.stock;
  const soldOut = stock <= 0;
  const lowStock = !soldOut && stock <= 10;
  const discount = discountPercent(price, item.compareAtPrice);
  const saved = isSaved(item.id);

  const needsColor = Boolean(item.colors?.length) && !color;
  const needsSize = Boolean(item.sizes?.length) && !size;
  const missingVariant = needsColor || needsSize;

  const disabledLabel = soldOut
    ? 'Sold out'
    : needsColor && needsSize
      ? 'Choose colour and size'
      : needsColor
        ? 'Choose a colour'
        : needsSize
          ? 'Choose a size'
          : 'Add to cart';

  const variantLabel = [color, size].filter(Boolean).join(' / ');

  const addToCart = () => {
    if (soldOut) return;
    if (missingVariant) {
      toast.error('Choose your options first', {
        description: needsColor && needsSize ? 'Pick a colour and a size.' : needsColor ? 'Pick a colour.' : 'Pick a size.',
      });
      return;
    }
    addItem(
      { ...item, price },
      { variantId: variant?.id ?? null, variantLabel, quantity }
    );
    toast.success('Added to cart', {
      description: `${quantity > 1 ? `${quantity} × ` : ''}${item.name}${variantLabel ? ` (${variantLabel})` : ''}`,
    });
  };

  const buyNow = () => {
    if (soldOut) return;
    if (missingVariant) {
      toast.error('Choose your options first', { description: 'Pick an option to continue.' });
      return;
    }
    addItem(
      { ...item, price },
      { variantId: variant?.id ?? null, variantLabel, quantity }
    );
    navigate('/checkout');
  };

  const toggleSave = () => {
    toggleSaved(item.id);
    toast(saved ? 'Removed from wishlist' : 'Saved to wishlist', { description: item.name });
  };

  const tabs = [
    {
      id: 'description',
      label: 'Description',
      content: (
        <div className="max-w-2xl">
          <p className="t-title">{item.shortDescription}</p>
          <p className="t-body mt-5 text-muted">{item.description}</p>
        </div>
      ),
    },
    {
      id: 'specifications',
      label: 'Specifications',
      content: (
        <dl className="max-w-2xl divide-y divide-line border-y border-line">
          {(item.specifications ?? []).map(([label, value]) => (
            <div key={label} className="flex gap-6 py-3.5">
              <dt className="t-small w-40 shrink-0 text-muted">{label}</dt>
              <dd className="t-small min-w-0 flex-1">{value}</dd>
            </div>
          ))}
        </dl>
      ),
    },
    {
      id: 'shipping',
      label: 'Shipping',
      content: (
        <div className="max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full border border-line">
              <Truck className="size-4" strokeWidth={1.6} aria-hidden />
            </span>
            <p className="t-title">Tracked, insured delivery</p>
          </div>
          <ul className="mt-5 space-y-3">
            {SHIPPING_COPY.map((line) => (
              <li key={line} className="flex gap-3 text-[15px] text-muted">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-line-strong" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ),
    },
    {
      id: 'returns',
      label: 'Returns',
      content: (
        <div className="max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full border border-line">
              <Undo2 className="size-4" strokeWidth={1.6} aria-hidden />
            </span>
            <p className="t-title">30-day returns</p>
          </div>
          <ul className="mt-5 space-y-3">
            {RETURNS_COPY.map((line) => (
              <li key={line} className="flex gap-3 text-[15px] text-muted">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-line-strong" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ),
    },
    {
      id: 'reviews',
      label: `Reviews (${item.reviewCount.toLocaleString()})`,
      content: (
        <div className="max-w-2xl">
          <RatingSummary rating={item.rating} reviewCount={item.reviewCount} />

          <ul className="mt-10 divide-y divide-line border-t border-line">
            {reviews.loading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <li key={i} className="space-y-2.5 py-6">
                    <div className="skeleton h-3.5 w-40 rounded-full" />
                    <div className="skeleton h-3 w-full rounded-full" />
                    <div className="skeleton h-3 w-10/12 rounded-full" />
                  </li>
                ))
              : (reviews.data ?? []).map((review) => (
                  <li key={review.id} className="py-6">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <Rating value={review.rating} size={13} />
                      <p className="t-title">{review.title}</p>
                    </div>
                    <p className="t-small mt-2.5 text-muted">{review.body}</p>
                    <p className="t-caption mt-3 flex flex-wrap items-center gap-x-2 text-muted">
                      <span className="font-medium text-ink">{review.author}</span>
                      <span aria-hidden>·</span>
                      <span>{review.country}</span>
                      <span aria-hidden>·</span>
                      <span>{formatDate(new Date(Date.now() - review.daysAgo * 86400000))}</span>
                      {review.verified ? (
                        <>
                          <span aria-hidden>·</span>
                          <span className="inline-flex items-center gap-1 text-success">
                            <ShieldCheck className="size-3.5" strokeWidth={1.8} aria-hidden />
                            Verified purchase
                          </span>
                        </>
                      ) : null}
                    </p>
                  </li>
                ))}
          </ul>
        </div>
      ),
    },
  ];

  return (
    <div className="bg-paper pt-28 pb-24 md:pt-32 md:pb-32">
      <Container>
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="t-caption mb-8 flex flex-wrap items-center gap-2 text-muted">
          <Link to="/" className="transition-colors duration-150 hover:text-ink">
            Home
          </Link>
          <span aria-hidden>/</span>
          <Link
            to={`/category/${item.categorySlug}`}
            className="transition-colors duration-150 hover:text-ink"
          >
            {item.categoryName}
          </Link>
          <span aria-hidden>/</span>
          <span className="truncate text-ink">{item.name}</span>
        </nav>

        <div className="flex flex-col gap-10 lg:flex-row lg:gap-16 xl:gap-24">
          {/* Gallery */}
          <div className="lg:w-[56%]">
            <ProductGallery
              images={item.images}
              alt={item.name}
              badges={
                <>
                  {soldOut ? (
                    <Badge tone="neutral">Sold out</Badge>
                  ) : discount > 0 ? (
                    <Badge tone="ink">-{discount}%</Badge>
                  ) : item.badge ? (
                    <Badge tone="ink">{item.badge}</Badge>
                  ) : null}
                  {lowStock ? <Badge tone="neutral">Only {stock} left</Badge> : null}
                </>
              }
            />
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="lg:sticky lg:top-24">
              <h1 className="h3-sub">{item.name}</h1>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <Rating value={item.rating} count={item.reviewCount} showValue size={15} />
                <span className="h-3.5 w-px bg-line" aria-hidden />
                <span className="t-caption text-muted">SKU {item.sku}</span>
              </div>

              {/* Price */}
              <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-[30px] leading-none font-medium tracking-[-0.02em] tnum">
                  {formatPrice(price)}
                </span>
                {item.compareAtPrice ? (
                  <span className="t-small tnum text-muted line-through">
                    {formatPrice(item.compareAtPrice)}
                  </span>
                ) : null}
                {discount > 0 ? (
                  <span className="t-caption tnum text-muted">Save {formatPrice(item.compareAtPrice - price)}</span>
                ) : null}
              </div>

              <p className="t-body mt-5 text-muted">{item.shortDescription}</p>

              {/* Variants */}
              <div className="mt-8">
                <VariantSelector
                  colors={item.colors}
                  sizes={item.sizes}
                  color={color}
                  size={size}
                  onColorChange={setColor}
                  onSizeChange={setSize}
                  disabled={soldOut}
                />
              </div>

              {/* Stock */}
              <div className="mt-6 flex items-center gap-2">
                <StatusDot tone={soldOut ? 'danger' : lowStock ? 'warning' : 'success'} size="sm" />
                <p className="t-small">
                  {soldOut ? (
                    'Out of stock'
                  ) : lowStock ? (
                    <span className="text-[#96650a]">Low stock — only {stock} left</span>
                  ) : (
                    <span className="text-muted">In stock, ready to ship</span>
                  )}
                </p>
              </div>

              {/* Purchase block — also the mobile sticky bar's trigger */}
              <div ref={purchaseRef} className="mt-7">
                <div className="flex flex-wrap items-center gap-4">
                  <QuantityStepper
                    value={quantity}
                    onChange={setQuantity}
                    max={Math.max(1, Math.min(20, stock))}
                    disabled={soldOut}
                  />
                  <p className="t-caption text-muted">
                    {formatPrice(price)} each
                  </p>
                </div>

                <div className="mt-5 flex flex-col gap-3">
                  <Button
                    variant="primary-dark"
                    size="xl"
                    fullWidth
                    onClick={addToCart}
                    disabled={soldOut}
                  >
                    {soldOut ? 'Sold out' : missingVariant ? disabledLabel : 'Add to cart'}
                  </Button>

                  <div className="flex gap-3">
                    <Button
                      variant="outline-dark"
                      size="xl"
                      onClick={buyNow}
                      disabled={soldOut}
                      className="flex-1"
                    >
                      Buy now
                    </Button>
                    <button
                      type="button"
                      onClick={toggleSave}
                      aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
                      aria-pressed={saved}
                      className="grid size-13 shrink-0 place-items-center rounded-full border-[1.5px] border-ink/70 text-ink transition-colors duration-150 hover:bg-ink/5"
                    >
                      <Heart
                        className={`size-5 ${saved ? 'fill-ink' : ''}`}
                        strokeWidth={1.6}
                        aria-hidden
                      />
                    </button>
                  </div>
                </div>

                {missingVariant && !soldOut ? (
                  <p className="t-caption mt-3 text-center text-muted">
                    Select {needsColor && needsSize ? 'a colour and a size' : needsColor ? 'a colour' : 'a size'} to continue
                  </p>
                ) : null}
              </div>

              {/* Shipping estimate */}
              <div className="mt-6">
                <ShippingEstimate
                  countryCode={countryCode}
                  onCountryChange={setCountryCode}
                  price={price * quantity}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Info tabs */}
        <div className="mt-24 md:mt-32">
          <Tabs tabs={tabs} value={tab} onChange={setTab} />
        </div>

        {/* Related */}
        {related.loading || (related.data ?? []).length > 0 ? (
          <section className="mt-24 border-t border-line pt-16 md:mt-32">
            <h2 className="h3-sub">You might also like</h2>
            <div className="mt-10">
              <ProductGrid
                products={related.data ?? []}
                loading={related.loading}
                skeletonCount={4}
              />
            </div>
          </section>
        ) : null}
      </Container>

      {/* Space so the sticky bar never covers the last row of content */}
      <div className="h-16 lg:hidden" aria-hidden />

      <AddToCartBar
        price={price}
        quantity={quantity}
        disabled={soldOut || missingVariant}
        disabledLabel={soldOut ? 'Sold out' : disabledLabel}
        onAdd={addToCart}
        selectorRef={purchaseRef}
      />
    </div>
  );
}
