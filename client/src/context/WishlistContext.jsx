import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { readStore, writeStore, removeStore } from '../utils/storage.js';
import { USE_MOCK } from '../services/env.js';
import wishlistService from '../services/wishlist.js';
import { useAuth } from './AuthContext.jsx';

const WishlistContext = createContext(null);
const STORAGE_KEY = 'wishlist';

export function WishlistProvider({ children }) {
  /**
   * Mock mode stores a list of product ids in localStorage, which works for
   * anonymous visitors. Real mode uses the `wishlist` table, which is keyed on
   * user_id and therefore needs a session.
   *
   * A guest's local list is uploaded on sign-in rather than discarded, so
   * hearting something before logging in does not lose the selection.
   */
  const [ids, setIds] = useState(() => (USE_MOCK ? readStore(STORAGE_KEY, []) : []));
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (USE_MOCK) writeStore(STORAGE_KEY, ids);
  }, [ids]);

  // Load (or seed) from the server whenever the signed-in state changes.
  useEffect(() => {
    if (USE_MOCK) return undefined;
    let cancelled = false;

    (async () => {
      if (!isAuthenticated) {
        // Signed out: fall back to whatever the guest collected locally.
        if (!cancelled) setIds(readStore(STORAGE_KEY, []));
        return;
      }
      try {
        const items = await wishlistService.list();
        if (cancelled) return;
        const serverIds = items.map((i) => i.id);
        const guestIds = readStore(STORAGE_KEY, []);
        const toAdd = guestIds.filter((id) => !serverIds.includes(id));
        // Push any guest selections the account does not already have.
        await Promise.all(toAdd.map((id) => wishlistService.toggle(id).catch(() => {})));
        if (!cancelled) setIds([...serverIds, ...toAdd]);
        removeStore(STORAGE_KEY);
      } catch {
        if (!cancelled) setIds(readStore(STORAGE_KEY, []));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const toggle = useCallback(
    (productId) => {
      // Optimistic: flip immediately, let the server confirm.
      setIds((prev) =>
        prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
      );
      if (USE_MOCK || !isAuthenticated) return;
      wishlistService.toggle(productId).catch(() => {
        setIds((prev) =>
          prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
        );
      });
    },
    [isAuthenticated]
  );

  const has = useCallback((productId) => ids.includes(productId), [ids]);

  const clear = useCallback(() => setIds([]), []);

  const value = useMemo(
    () => ({ ids, count: ids.length, toggle, has, clear }),
    [ids, toggle, has, clear]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used inside <WishlistProvider>');
  return ctx;
}

export { WishlistContext };