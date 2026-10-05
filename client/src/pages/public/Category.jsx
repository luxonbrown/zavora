import { Navigate, useParams } from 'react-router-dom';

import ProductListing from '../../components/product/ProductListing.jsx';
import useAsync from '../../hooks/useAsync.js';
import productsService from '../../services/products.js';
import { mockCategories } from '../../services/mockCatalogue.js';

export default function Category() {
  const { slug } = useParams();

  // Fetch just this branch rather than the whole category list: the live
  // catalogue has hundreds of nodes, and all this page needs is the display
  // name for the heading plus the children for the drill-down filter.
  const branch = useAsync(() => productsService.categoryBranch(slug), [slug]);

  // Fall back to the seed catalogue so the heading never flashes empty, and so
  // an unknown slug can still be resolved before the request completes.
  const fallback = mockCategories.find((c) => c.slug === slug);
  const category = branch.data ?? fallback;

  if (branch.loading && !category) {
    return <ProductListing lockedCategory={slug} lockedCategoryName={slug} showSearch={false} />;
  }

  if (branch.data === null && !fallback) {
    return <Navigate to="/shop" replace />;
  }

  return (
    <ProductListing
      lockedCategory={slug}
      lockedCategoryName={category?.name ?? slug}
      eyebrow="Category"
      description={category?.tagline}
      showSearch={false}
    />
  );
}
