import ProductCard from './ProductCard.jsx';
import ProductCardSkeleton from './ProductCardSkeleton.jsx';
import { cx } from '../../utils/format.js';

const COLUMNS = {
  4: 'grid-cols-2 lg:grid-cols-4',
  3: 'grid-cols-2 lg:grid-cols-3',
  2: 'grid-cols-2',
};

/** Responsive product grid: 2 cols mobile, 3 tablet, 4 desktop. */
export default function ProductGrid({ products, loading, skeletonCount = 8, columns = 4, className }) {
  const gridClass = cx(
    'grid gap-x-4 gap-y-10 sm:gap-x-6 sm:gap-y-12',
    COLUMNS[columns] ?? COLUMNS[4],
    className
  );

  if (loading) {
    return (
      <div className={gridClass} aria-busy="true" aria-label="Loading products">
        <ProductCardSkeleton count={skeletonCount} />
      </div>
    );
  }

  return (
    <div className={gridClass}>
      {products.map((product, i) => (
        <ProductCard key={product.id} product={product} priority={i < 4} />
      ))}
    </div>
  );
}
