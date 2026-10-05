import ProductGrid from '../product/ProductGrid.jsx';
import SectionHeading from '../layout/SectionHeading.jsx';

/**
 * Trending products, minus anything already in the cart or saved.
 *
 * Exclusion is by product id, not by cart line key: a line added with a variant
 * has the key `zv_0001::v2`, which would never match a `zv_0001::default`
 * comparison and would let the product be recommended straight back to the
 * customer.
 */
export default function CartRecommendations({
  products = [],
  loading = false,
  excludeProductIds = [],
}) {
  const excluded = new Set(excludeProductIds);
  const suggestions = products.filter((p) => !excluded.has(p.id)).slice(0, 4);

  if (!loading && suggestions.length === 0) return null;

  return (
    <section className="mt-24 border-t border-line pt-16 md:mt-32">
      <SectionHeading
        eyebrow="You might also like"
        title="Complete the order"
        action="Shop all"
        actionTo="/shop"
      />
      <div className="mt-12">
        <ProductGrid products={suggestions} loading={loading} skeletonCount={4} />
      </div>
    </section>
  );
}