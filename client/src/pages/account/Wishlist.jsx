import { useEffect, useMemo } from 'react';
import { Heart } from 'lucide-react';

import EmptyState from '../../components/ui/EmptyState.jsx';
import ProductCard from '../../components/product/ProductCard.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import { useWishlist } from '../../context/WishlistContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import productsService from '../../services/products.js';

export default function Wishlist() {
  const { ids } = useWishlist();
  const products = useAsync(() => productsService.list({ pageSize: 24 }), []);

  useEffect(() => {
    document.title = 'Wishlist — MARKETHUB';
  }, []);

  const items = useMemo(() => {
    const list = products.data?.items ?? [];
    const byId = new Map(list.map((p) => [p.id, p]));
    // Preserve wishlist order rather than catalogue order.
    return ids.map((id) => byId.get(id)).filter(Boolean);
  }, [ids, products.data]);

  const loading = products.loading && !products.data;

  return (
    <div>
      <header>
        <h1 className="h3-sub">Wishlist</h1>
        <p className="t-small mt-2 text-muted">
          {loading
            ? 'Loading your saved items…'
            : `${items.length} ${items.length === 1 ? 'item' : 'items'} saved`}
        </p>
      </header>

      <div className="mt-8">
        {loading ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="aspect-4/5 w-full rounded-image" />
                <Skeleton className="mt-3.5 h-3.5 w-4/5 rounded-full" />
              </div>
            ))}
          </div>
        ) : items.length ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 sm:gap-y-12 lg:grid-cols-4">
            {items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Heart}
            title="Nothing saved yet"
            description="Tap the heart on any product to keep it here for later."
            action="Browse products"
            actionTo="/shop"
          />
        )}
      </div>
    </div>
  );
}