import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Plus } from 'lucide-react';
import { toast } from 'sonner';

import ProductImage from './ProductImage.jsx';
import Rating from '../ui/Rating.jsx';
import Badge from '../ui/Badge.jsx';
import { useCart } from '../../context/CartContext.jsx';
import { useWishlist } from '../../context/WishlistContext.jsx';
import { cx, discountPercent, formatPrice } from '../../utils/format.js';

/**
 * The storefront's most repeated object.
 *
 * Now uses the shared `ProductImage`, which is the whole point: this card
 * previously read `product.images[0]` directly and assumed an array of URL
 * strings. The API is not consistent about that — `normaliseProduct` produces
 * objects with `url`, wishlist rows expose a bare `image`, and some rows have
 * neither — so the card rendered broken images in more than one place.
 */
function ProductCard({ product, priority = false, className }) {
  const { addItem } = useCart();
  const { has, toggle } = useWishlist();

  const saved = has(product.id);
  const discount = discountPercent(product.price, product.compareAtPrice);
  // `stock` can arrive as a number, as a string from SQL, or be absent
  // entirely — `inStock` is the server's own derived flag when it is.
  const stock = Number(product.stock ?? 0) || 0;
  const soldOut = product.inStock === false || stock <= 0;
  const lowStock = !soldOut && stock > 0 && stock <= 10;

  // Single-variant products can be added straight from the grid. Anything with
  // a real choice routes to the detail page instead of guessing.
  const optionCount =
    (Array.isArray(product.colors) ? product.colors.length : 0) +
    (Array.isArray(product.sizes) ? product.sizes.length : 0);
  const hasRealChoice = optionCount > 1;

  const quickAdd = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (hasRealChoice) {
      toast('Choose an option', { description: 'Open the product to pick a variant.' });
      return;
    }
    addItem(product, { quantity: 1 });
    toast.success('Added to cart', { description: product.name });
  };

  const toggleSave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggle(product.id);
    toast(saved ? 'Removed from wishlist' : 'Saved to wishlist', { description: product.name });
  };

  return (
    <article className={cx('group relative flex flex-col', className)}>
      <Link
        to={`/product/${product.slug}`}
        className="relative block overflow-hidden rounded-[20px] bg-surface-muted"
      >
        <ProductImage
          product={product}
          ratio="4/5"
          eager={priority}
          imgClassName="transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.05]"
        />

        {/* Badges. */}
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {soldOut ? (
            <Badge tone="neutral">Sold out</Badge>
          ) : discount > 0 ? (
            <Badge tone="gradient">-{discount}%</Badge>
          ) : product.badge ? (
            <Badge tone="ink">{product.badge}</Badge>
          ) : null}
          {lowStock ? <Badge tone="neutral">Only {stock} left</Badge> : null}
        </div>

        {/* Wishlist. */}
        <button
          type="button"
          onClick={toggleSave}
          aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          aria-pressed={saved}
          className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-paper/85 text-ink backdrop-blur-md transition hover:bg-paper active:scale-95"
        >
          <Heart
            className={cx('size-[17px]', saved && 'fill-mh-blue text-mh-blue')}
            strokeWidth={1.6}
            aria-hidden
          />
        </button>

        {/* Quick add — hover on desktop. */}
        <div className="pointer-events-none absolute inset-x-3 bottom-3 hidden translate-y-2 opacity-0 transition-[transform,opacity] duration-200 ease-out group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 md:block">
          <button
            type="button"
            onClick={quickAdd}
            disabled={soldOut}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-gradient text-[14px] font-medium text-white shadow-glow-blue transition hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          >
            <Plus className="size-4" strokeWidth={1.8} aria-hidden />
            {hasRealChoice ? 'Select options' : 'Quick add'}
          </button>
        </div>

        {/* Quick add — always visible on mobile. */}
        <div className="absolute inset-x-3 bottom-3 md:hidden">
          <button
            type="button"
            onClick={quickAdd}
            disabled={soldOut}
            aria-label={`Add ${product.name} to cart`}
            className="grid size-10 place-items-center rounded-full bg-paper/90 text-ink backdrop-blur-md active:scale-95 disabled:opacity-50"
          >
            <Plus className="size-5" strokeWidth={1.8} aria-hidden />
          </button>
        </div>
      </Link>

      {/* Meta. In the 2-column mobile grid a name and price side by side get
          ~90px each and wrap to three lines, so below `sm` the price drops
          under the name instead. */}
      <div className="mt-3.5 flex flex-1 flex-col">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <h3 className="t-title leading-snug text-ink">
            <Link to={`/product/${product.slug}`} className="transition hover:text-mh-blue">
              {product.name}
            </Link>
          </h3>

          <div className="flex shrink-0 items-baseline gap-2 sm:block sm:text-right">
            <p className="t-small tnum font-medium text-ink">{formatPrice(product.price)}</p>
            {product.compareAtPrice ? (
              <p className="t-caption tnum text-muted line-through sm:mt-0.5">
                {formatPrice(product.compareAtPrice)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <Rating value={product.rating} count={product.reviewCount} size={13} />
        </div>
      </div>
    </article>
  );
}

export default memo(ProductCard);