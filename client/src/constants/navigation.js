/** Storefront navigation model. Single source of truth for Navbar + Footer. */

export const NAV_LINKS = [
  { label: 'Shop', to: '/shop' },
  {
    label: 'Categories',
    to: '/category/electronics',
    hasMenu: true,
    children: [
      { label: 'Electronics', to: '/category/electronics' },
      { label: 'Fashion', to: '/category/fashion' },
      { label: 'Home & Living', to: '/category/home-living' },
      { label: 'Beauty', to: '/category/beauty' },
      { label: 'Accessories', to: '/category/accessories' },
      { label: 'Lifestyle', to: '/category/lifestyle' },
    ],
  },
  { label: 'New Arrivals', to: '/shop?sort=newest' },
  { label: 'About', to: '/about' },
];

/**
 * Routes whose first screen is a full-bleed dark hero. The Navbar renders in
 * its transparent variant on these routes until the user scrolls.
 * Declared statically so the nav never flashes the wrong state on first paint.
 *
 * Empty until Step 4 lands the homepage hero — a route is only listed here once
 * it actually renders a dark hero behind the navbar.
 */
export const IMMERSIVE_ROUTES = ['/'];

export function isImmersiveRoute(pathname) {
  return IMMERSIVE_ROUTES.some((route) =>
    route.endsWith('/') ? pathname === route.slice(0, -1) || pathname === route : pathname === route
  );
}
