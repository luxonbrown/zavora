/**
 * The single source of truth for who a user is.
 *
 * These values are stored in `users.role` and returned by the API on every
 * `/auth/me` response, so they must match the server enum exactly. They were
 * previously bare `'admin'` / `'customer'` strings inline in the auth context,
 * the mock service and the route guards, which meant a typo in one place would
 * silently lock an admin out of /admin with no type or lint error.
 */
export const ROLES = Object.freeze({
  CUSTOMER: 'customer',
  ADMIN: 'admin',
});

export const ROLE_LIST = Object.freeze(Object.values(ROLES));

/** Roles that may reach /admin. Extend here rather than at each check. */
export const ADMIN_ROLES = Object.freeze([ROLES.ADMIN]);

export function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

/** Coerces anything unexpected (null, undefined, legacy rows) to a real role. */
export function normalizeRole(role) {
  return isAdminRole(role) ? ROLES.ADMIN : ROLES.CUSTOMER;
}

export function roleLabel(role) {
  return normalizeRole(role) === ROLES.ADMIN ? 'Administrator' : 'Customer';
}

/**
 * Where a user belongs after signing in. Admins land on the dashboard rather
 * than the customer account, which is the behaviour the admin login expects.
 */
export function landingPathFor(role) {
  return normalizeRole(role) === ROLES.ADMIN ? '/admin' : '/account';
}