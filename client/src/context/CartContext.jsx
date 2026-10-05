import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { estimateShipping } from '../services/shipping.js';
import { readStore, writeStore, removeStore } from '../utils/storage.js';
import { USE_MOCK } from '../services/env.js';
import cartService from '../services/cart.js';

const CartContext = createContext(null);

const STORAGE_KEYS = {
  items: 'cart-items',
  saved: 'cart-saved',
  country: 'ship-country',
};

/** Cart line identity: product + chosen variant. */
function lineKey(productId, variantId) {
  return `${productId}::${variantId || 'default'}`;
}

function toLine(product, { variantId, quantity = 1, variantLabel } = {}) {
  return {
    key: lineKey(product.id, variantId),
    productId: product.id,
    variantId: variantId ?? null,
    variantLabel: variantLabel ?? null,
    slug: product.slug,
    name: product.name,
    image: product.images?.[0] ?? null,
    price: product.price,
    compareAtPrice: product.compareAtPrice ?? null,
    stock: product.stock ?? null,
    quantity,
  };
}

/**
 * Map a server cart line onto the flat shape the UI already uses. The server's
 * `id` is retained as `serverId` because PATCH/DELETE address the line by that
 * id, not by product/variant.
 */
function fromServerLine(line) {
  return {
    key: lineKey(line.productId, line.variantId),
    serverId: line.id,
    productId: line.productId,
    variantId: line.variantId ?? null,
    variantLabel: line.variantName ?? null,
    slug: line.slug,
    name: line.name,
    image: line.image ?? null,
    price: line.unitPrice,
    compareAtPrice: null,
    stock: line.availableStock ?? null,
    quantity: line.quantity,
    // Surfaced in the UI when stock ran out after the line was added.
    problem: line.problem ?? null,
  };
}

export function CartProvider({ children }) {
  /**
   * Mock mode is local-first and fully synchronous. Real mode hydrates from
   * GET /cart and keeps the database authoritative, applying changes
   * optimistically so these callbacks stay synchronous for every caller.
   */
  const [items, setItems] = useState(() => (USE_MOCK ? readStore(STORAGE_KEYS.items, []) : []));
  const [saved, setSaved] = useState(() => readStore(STORAGE_KEYS.saved, []));
  const [countryCode, setCountryCode] = useState(() => readStore(STORAGE_KEYS.country, 'US'));

  // Saved-for-later has no server table; it stays local in both modes.
  useEffect(() => writeStore(STORAGE_KEYS.saved, saved), [saved]);
  useEffect(() => writeStore(STORAGE_KEYS.country, countryCode), [countryCode]);
  useEffect(() => {
    if (USE_MOCK) writeStore(STORAGE_KEYS.items, items);
  }, [items]);

  /** Replace local lines with the server's, which is the source of truth. */
  const reconcile = useCallback((serverCart) => {
    setItems((serverCart?.items ?? []).map(fromServerLine));
  }, []);

  // Hydrate once from the server in real mode.
  useEffect(() => {
    if (USE_MOCK) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const cart = await cartService.get();
        if (!cancelled) reconcile(cart);
      } catch {
        // A failed hydration leaves an empty cart rather than a broken one.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reconcile]);

  /**
   * Run a cart mutation and re-sync from the response. On failure the local
   * state is rolled back to the last known-good server state, so a rejected
   * add cannot leave a phantom line in the UI.
   */
  const runMutation = useCallback(
    async (work) => {
      if (USE_MOCK) return;
      try {
        const cart = await work();
        reconcile(cart);
      } catch (err) {
        try {
          reconcile(await cartService.get());
        } catch {
          setItems([]);
        }
        throw err;
      }
    },
    [reconcile]
  );

  const addItem = useCallback(
    (product, options = {}) => {
      const quantity = options.quantity ?? 1;
      const variantId = options.variantId ?? null;

      if (USE_MOCK) {
        setItems((prev) => {
          const key = lineKey(product.id, variantId);
          const existing = prev.find((i) => i.key === key);
          if (existing) {
            return prev.map((i) =>
              i.key === key ? { ...i, quantity: Math.min(i.quantity + quantity, 20) } : i
            );
          }
          return [...prev, toLine(product, { ...options, variantId })];
        });
        return;
      }

      setItems((prev) => {
        const key = lineKey(product.id, variantId);
        const existing = prev.find((i) => i.key === key);
        if (existing) {
          return prev.map((i) =>
            i.key === key ? { ...i, quantity: Math.min(i.quantity + quantity, 20) } : i
          );
        }
        return [...prev, toLine(product, { ...options, variantId })];
      });

      // Fire-and-forget: pages treat addItem as synchronous, and the rollback
      // in runMutation handles rejection.
      runMutation(() =>
        cartService.addItem({ productId: product.id, variantId, quantity })
      ).catch(() => {});
    },
    [runMutation]
  );

  const updateQuantity = useCallback(
    (key, quantity) => {
      setItems((prev) =>
        quantity <= 0
          ? prev.filter((i) => i.key !== key)
          : prev.map((i) => (i.key === key ? { ...i, quantity: Math.min(quantity, 20) } : i))
      );

      if (USE_MOCK) return;
      const line = items.find((i) => i.key === key);
      if (!line?.serverId) return;
      runMutation(() => cartService.updateItem(line.serverId, quantity)).catch(() => {});
    },
    [items, runMutation]
  );

  const removeItem = useCallback(
    (key) => {
      setItems((prev) => prev.filter((i) => i.key !== key));
      if (USE_MOCK) return;
      const line = items.find((i) => i.key === key);
      if (!line?.serverId) return;
      runMutation(() => cartService.removeItem(line.serverId)).catch(() => {});
    },
    [items, runMutation]
  );

  /**
   * Move a cart line to saved-for-later.
   *
   * Deliberately reads `items`/`saved` from state rather than nesting one
   * setState inside another's updater: updaters must be pure, and StrictMode
   * double-invokes them to enforce exactly that.
   */
  const saveForLater = useCallback(
    (key) => {
      const line = items.find((i) => i.key === key);
      if (!line) return;
      setItems(items.filter((i) => i.key !== key));
      setSaved(
        saved.some((i) => i.key === key) ? saved : [...saved, { ...line, quantity: 1 }]
      );
      if (USE_MOCK) return;
      if (line.serverId) runMutation(() => cartService.removeItem(line.serverId)).catch(() => {});
    },
    [items, saved, runMutation]
  );

  const moveToCart = useCallback(
    (key) => {
      const line = saved.find((i) => i.key === key);
      if (!line) return;
      setSaved(saved.filter((i) => i.key !== key));
      setItems(
        items.some((i) => i.key === key)
          ? items.map((i) =>
              i.key === key ? { ...i, quantity: Math.min(i.quantity + 1, 20) } : i
            )
          : [...items, { ...line }]
      );
      if (USE_MOCK) return;
      runMutation(() =>
        cartService.addItem({ productId: line.productId, variantId: line.variantId, quantity: 1 })
      ).catch(() => {});
    },
    [items, saved, runMutation]
  );

  const removeSaved = useCallback((key) => {
    setSaved((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const moveAllSavedToCart = useCallback(() => {
    if (!saved.length) return;
    const next = [...items];
    for (const line of saved) {
      const index = next.findIndex((i) => i.key === line.key);
      if (index === -1) next.push({ ...line });
      else next[index] = { ...next[index], quantity: Math.min(next[index].quantity + 1, 20) };
    }
    setItems(next);
    setSaved([]);
    if (USE_MOCK) return;
    runMutation(async () => {
      let cart = null;
      for (const line of saved) {
        cart = await cartService.addItem({
          productId: line.productId,
          variantId: line.variantId,
          quantity: 1,
        });
      }
      return cart;
    }).catch(() => {});
  }, [items, saved, runMutation]);

  const clear = useCallback(() => {
    setItems([]);
    if (USE_MOCK) {
      removeStore(STORAGE_KEYS.items);
      return;
    }
    runMutation(() => cartService.clear()).catch(() => {});
  }, [runMutation]);

  const count = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [items]
  );

  const savedCount = useMemo(() => saved.reduce((sum, i) => sum + i.quantity, 0), [saved]);

  // Derived from the shipping service so cart, checkout and the product page
  // all quote the same rate for the same destination.
  const shipping = useMemo(
    () => estimateShipping({ countryCode, subtotal }),
    [countryCode, subtotal]
  );

  const total = useMemo(() => subtotal + shipping.fee, [subtotal, shipping.fee]);

  const value = useMemo(
    () => ({
      items,
      saved,
      savedCount,
      count,
      subtotal,
      shipping,
      total,
      countryCode,
      setCountryCode,
      addItem,
      updateQuantity,
      removeItem,
      saveForLater,
      moveToCart,
      removeSaved,
      moveAllSavedToCart,
      clear,
    }),
    [
      items,
      saved,
      savedCount,
      count,
      subtotal,
      shipping,
      total,
      countryCode,
      addItem,
      updateQuantity,
      removeItem,
      saveForLater,
      moveToCart,
      removeSaved,
      moveAllSavedToCart,
      clear,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}

export { CartContext, lineKey };