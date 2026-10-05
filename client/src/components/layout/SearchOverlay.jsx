import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Search } from 'lucide-react';

import productsService from '../../services/products.js';
import { formatPrice } from '../../utils/format.js';
import { fallbackImage } from '../../services/media.js';

/**
 * Command-style search overlay: large input, debounced suggestions with
 * thumbnails. Closes on Escape, backdrop click, or after navigation.
 */
export default function SearchOverlay({ open, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    setResults([]);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 40);
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const items = await productsService.search(term, { limit: 6 });
        if (!cancelled) setResults(items);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open]);

  if (!open) return null;

  const go = (to) => {
    onClose();
    navigate(to);
  };

  const submit = (e) => {
    e.preventDefault();
    const term = query.trim();
    if (!term) return;
    go(`/search?q=${encodeURIComponent(term)}`);
  };

  return (
    <div className="fixed inset-0 z-100">
      <button
        type="button"
        aria-label="Close search"
        onClick={onClose}
        className="absolute inset-0 bg-ink/50 backdrop-blur-[3px]"
      />

      <div className="page-rise relative mx-auto mt-[12vh] w-[min(720px,calc(100%-2rem))] overflow-hidden rounded-card border border-line bg-paper">
        <form onSubmit={submit} className="flex items-center gap-3 border-b border-line px-5">
          <Search className="size-5 shrink-0 text-muted" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, categories, SKUs"
            aria-label="Search products"
            className="h-16 w-full bg-transparent text-[17px] tracking-[-0.01em] text-ink placeholder:text-muted focus:outline-none"
          />
          {loading ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-muted" aria-hidden />
          ) : null}
          <kbd className="t-caption hidden shrink-0 rounded-md border border-line px-1.5 py-0.5 text-muted sm:block">
            ESC
          </kbd>
        </form>

        <div className="max-h-[52vh] overflow-y-auto overscroll-contain">
          {query.trim().length >= 2 && !loading && results.length === 0 ? (
            <p className="t-small px-5 py-8 text-center text-muted">
              No products found for “{query.trim()}”
            </p>
          ) : null}

          {query.trim().length < 2 ? (
            <div className="px-5 py-6">
              <p className="t-eyebrow">Popular searches</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {['Headphones', 'Wool', 'Ceramic', 'Skincare', 'Automatic watch'].map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => setQuery(term)}
                    className="t-small rounded-full border border-line px-3 py-1.5 text-muted transition-colors duration-150 hover:border-ink hover:text-ink"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <ul className="divide-y divide-line">
            {results.map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => go(`/product/${product.slug}`)}
                  className="flex w-full items-center gap-4 px-5 py-3 text-left transition-colors duration-150 hover:bg-canvas"
                >
                  <img
                    src={product.images?.[0] || fallbackImage(product.id)}
                    alt=""
                    loading="lazy"
                    className="size-14 shrink-0 rounded-lg object-cover"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="t-title block truncate">{product.name}</span>
                    <span className="t-caption text-muted">{product.categoryName}</span>
                  </span>
                  <span className="t-small tnum shrink-0 font-medium">
                    {formatPrice(product.price)}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {query.trim().length >= 2 && results.length > 0 ? (
            <div className="border-t border-line p-3">
              <button
                type="button"
                onClick={() => go(`/search?q=${encodeURIComponent(query.trim())}`)}
                className="t-small w-full rounded-full py-2.5 text-center font-medium transition-colors duration-150 hover:bg-surface-muted"
              >
                See all results for “{query.trim()}”
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
