import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import authService from '../services/auth.js';
import { SESSION_EXPIRED_EVENT } from '../services/api.js';
import { USE_MOCK } from '../services/env.js';
import { readStore, removeStore, writeStore } from '../utils/storage.js';
import { isAdminRole, landingPathFor, normalizeRole } from '../constants/roles.js';

const AuthContext = createContext(null);
const STORAGE_KEY = 'session';

export function AuthProvider({ children }) {
  // Mock mode persists the user to localStorage so a reload keeps you signed in
  // with no server. Real mode must NOT: identity lives in an httpOnly cookie,
  // so persisting a copy would (a) be redundant and (b) leave a stale user
  // object that survives logout in another tab. Real mode boots from the
  // cookie via GET /auth/me instead.
  const [user, setUser] = useState(() => (USE_MOCK ? readStore(STORAGE_KEY, null) : null));
  const [loading, setLoading] = useState(!USE_MOCK);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    if (USE_MOCK) {
      if (user) writeStore(STORAGE_KEY, user);
      else removeStore(STORAGE_KEY);
    } else {
      // Never leave a session copy behind once the API is in charge.
      removeStore(STORAGE_KEY);
    }
  }, [user]);

  // Real mode: ask the server who we are on first paint. Without this the app
  // renders as signed-out on every reload until something 401s.
  useEffect(() => {
    if (USE_MOCK) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const current = await authService.me();
        if (!cancelled) setUser(current || null);
      } catch {
        // A failed bootstrap just means "not signed in".
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    setLoading(true);
    setSessionExpired(false);
    try {
      const nextUser = await authService.login(credentials);
      setUser(nextUser);
      return nextUser;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (details) => {
    setLoading(true);
    setSessionExpired(false);
    try {
      const nextUser = await authService.register(details);
      setUser(nextUser);
      return nextUser;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setSessionExpired(false);
    }
  }, []);

  /**
   * Re-read the session. In real mode this hits the server; in mock mode it
   * simply re-reads local state. Note this is not a plain `setUser` of stored
   * data any more — in real mode the cookie is the only source of truth.
   */
  const refresh = useCallback(async () => {
    if (USE_MOCK) {
      const stored = readStore(STORAGE_KEY, null);
      setUser(stored);
      return stored;
    }
    try {
      const current = await authService.me();
      setUser(current || null);
      return current || null;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  // An expired session must clear local state, but only the API layer knows it
  // happened — hence the event rather than a prop.
  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      setSessionExpired(true);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const clearSessionExpired = useCallback(() => setSessionExpired(false), []);

  const value = useMemo(
    () => ({
      user,
      loading,
      sessionExpired,
      clearSessionExpired,
      isAuthenticated: Boolean(user),
      isAdmin: isAdminRole(user?.role),
      role: normalizeRole(user?.role),
      login,
      register,
      logout,
      refresh,
    }),
    [user, loading, sessionExpired, clearSessionExpired, login, register, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export { AuthContext };