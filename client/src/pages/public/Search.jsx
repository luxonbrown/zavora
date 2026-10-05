import ProductListing from '../../components/product/ProductListing.jsx';
import useProductFilters from '../../hooks/useProductFilters.js';

export default function Search() {
  const { filters } = useProductFilters();
  const term = filters.q.trim();

  return (
    <ProductListing
      eyebrow="Search"
      title={term ? `Results for “${term}”` : 'Search'}
      description={
        term
          ? 'Adjust the filters to narrow these results.'
          : 'Search by product name, category or SKU.'
      }
    />
  );
}
