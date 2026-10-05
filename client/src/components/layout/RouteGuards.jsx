import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext.jsx';
import { landingPathFor } from '../../constants/roles.js';

/** Sends signed-in users away from /login, /register, /forgot-password.
 *
 *  This must be role-aware: the instant `login()` succeeds, `isAuthenticated`
 *  flips and this guard renders its own <Navigate>, which wins the race against
 *  the navigate() the login form issues. While it hard-coded '/account', an
 *  admin was bounced to the customer account the moment they signed in.
 */
export function RedirectIfAuthenticated({ children }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (isAuthenticated) {
    const from = location.state?.from;
    return <Navigate to={from && from !== '/login' ? from : landingPathFor(user?.role)} replace />;
  }

  return children;
}

/**
 * Gates customer-only routes, remembering where they were headed.
 *
 * `loading` matters: on a hard refresh `AuthContext` starts with `user === null`
 * and resolves `/auth/me` asynchronously. Without waiting for that, the guard
 * sees `isAuthenticated === false` during the bootstrap and bounces a
 * perfectly valid session to /login. It looked intermittent because it is a
 * race — it passed or failed depending on how fast the request came back.
 */
export function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AuthSkeleton />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

/** Gates admin-only routes.
 *
 *  Signed out -> /login (remembering the target). Signed in but not an admin ->
 *  /account. The role test comes from constants/roles.js so it cannot drift
 *  from the value the API actually stores. Same `loading` gate as RequireAuth.
 */
export function RequireAdmin({ children }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AuthSkeleton />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (!isAdmin) {
    return <Navigate to="/account" replace />;
  }
  return children;
}

/**
 * Shown while the session is being checked. Deliberately chrome-free: the shell
 * is unknown at this point, since we do not yet know whether this is the
 * customer canvas or the admin one.
 */
function AuthSkeleton() {
  return (
    <div className="grid min-h-dvh place-items-center bg-navy" role="status" aria-busy="true">
      <span className="sr-only">Checking your session…</span>
      <span className="size-10 animate-pulse rounded-full bg-brand-gradient opacity-40" />
    </div>
  );
}