# ZAVORA

Premium international e-commerce platform — customer storefront + admin
dashboard, served by an Express/MySQL API with a server-side CJdropshipping
integration.

> Supplier data (cost, CJ product ids, fulfilment) is **never** exposed to the
> storefront or to any non-admin API response.

---

## Status

Built step by step; the app is verified running at each step.

| Step | Scope | State |
| --- | --- | --- |
| 1 | Design system (tokens, type scale, component inventory) | done |
| 2 | Vite + React + Tailwind v4 scaffold, routing, layout shells | done |
| 3 | Store chrome (Navbar, Footer, mobile nav, search overlay), UI kit, ProductCard | done |
| 4 | Homepage — hero, statement band, categories, trending, collection, trust, promo, newsletter | done |
| 5 | Shop / Search / Category — shared listing, filter panel, toolbar, pagination | done |
| 6 | Product detail — gallery, variants, shipping estimate, tabs, related | done |
| 7 | Cart — line items, save for later, destination, summary, recommendations | done |
| 8 | Auth — Login, Register, Forgot Password, route guards, session expiry | done |
| 9 | Checkout — 5 accordion steps, server-priced order summary, confirmation | done |
| 10 | Customer dashboard — Reference B shell, orders, tracking, wishlist, addresses | done |
| 11 | Express + MySQL schema, seed, REST API, frontend wired to it | done |
| 12 | CJdropshipping integration — two-stage auth, rate-limited client, catalogue sync | done |
| 13 | Admin-triggered sync UI, supplier-cost diagnostics | done |
| 14 | Order fulfilment — zone shipping rules, lifecycle state machine, admin order ops | done |
| 15 | Admin dashboard — shell, overview, orders, catalogue, CJ sync | done |

Steps 1–10 ran on a mock catalogue so the whole UI was testable before the
backend existed. Step 11 adds the real API; the mock is still the default so a
fresh clone runs with no database. Switch it on with `VITE_USE_MOCK=false`.

---

## Requirements

- Node.js 20+ (developed on 22.22.2)
- npm 10+
- MySQL 8 **or** MariaDB 10.4+ — only needed when running against the real API

The schema deliberately avoids MySQL-only syntax so the same DDL runs on
either engine.

## Getting started

```bash
# storefront — works immediately, no database needed (mock mode)
cd client
npm install
npm run dev          # http://localhost:5173
```

### Running against the real API

```bash
# 1. create the schema and seed the catalogue
cd server
npm install
npm run db:reset     # db:schema + db:seed  (db:schema is destructive: it DROPs)

# 2. start the API
npm run dev          # http://localhost:5000

# 3. point the storefront at it (separate terminal)
cd ../client
$env:VITE_USE_MOCK = 'false'    # PowerShell
npm run dev
```

The Vite dev server proxies `/api` → `http://localhost:5000`, so requests stay
same-origin and the session cookie works without any CORS setup. The API also
enables CORS for `http://localhost:5173` with credentials, so pointing
`VITE_API_BASE_URL` straight at the API works too.

### Demo logins (seeded)

| Role | Email | Password |
| --- | --- | --- |
| Customer | `demo@zavora.com` | `zavora1234` |
| Admin | `admin@zavora.com` | `zavora-admin-2026` |

### Tests

```bash
cd client && npm test        # rating-distribution invariants
cd server && npm test        # money units, SQL arity, client/server contract, API e2e
cd server && npm run test:unit   # everything except the API suite (no HTTP)
```

`server` test breakdown:

| Script | Asserts |
| --- | --- |
| `test/money.js` | cents/decimal conversions never mix units |
| `test/sql-arity.js` | every statement binds one value per placeholder |
| `test/contract.js` | every client endpoint matches a registered server route |
| `test/smoke.js` | 202 end-to-end API checks incl. account, admin-insights blocks and an oversell race |
| `test/cj.js` | CJ mapper, envelope parsing, error codes, token exchange |
| `test/orders.js` | Order state machine, shipping rules, cancel/restock |

`test/smoke.js` boots the API in-process on a free port, so no server has to be
running first. It is now **idempotent** — it creates and destroys its own
fixtures (including the oversell race, which builds a throwaway product rather
than borrowing seeded stock), so it can be re-run against a database that has
already been synced and ordered against.

`test/cj.js` stubs `fetch`, so it spends nothing from CJ's request budget and
needs no network. It snapshots the stored CJ credential and restores it
afterwards, so running the suite cannot force the next real sync to re-authorise.

### Importing the CJ catalogue

```bash
cd server
npm run cj:sync                  # up to 60 pages x 100 products, 25 variant fetches
npm run cj:sync -- --pages=2     # quick smoke run
npm run cj:sync -- --variants=0  # list import only
```

Or trigger it from the admin API (fire-and-forget; poll `/status`):

```bash
curl -X POST http://localhost:5000/api/admin/cj/sync -b cookies.txt
```

> **The rate limit is the design constraint.** CJ allows **one request per
> second** (error `1600200`) across the whole API, so every call goes through a
> serialising gate in `services/cj/client.js`. A full list import is 60 requests
> (~1 minute); fetching variants costs one request *per product*, so enrichment
> is deliberately capped per run and resumed on the next one.

---

## Configuration

There is deliberately **no `.env` file** for the server. All configuration lives
in `server/config.js` with clearly marked `REPLACE_ME` placeholders:

- `session.secret` — long random string
- `db.*` — MySQL credentials. `password` defaults to `''` (empty) because local
  XAMPP/MariaDB ships a blank root password; set `DB_PASSWORD` for anything real.
  Note this could not be expressed as an empty *environment* variable: Windows
  deletes env vars set to `''`, so an `'X' in process.env` check would always
  fall through to the placeholder instead.
- `cj.apiKey` — the CJdropshipping **apiKey** (`CJ<userNum>@api@<secret>`),
  server-only. It is exchanged for an access token at runtime and never bundled
  into the React app. Override with `CJ_API_KEY`.
- `pricing.*` — default markup, sellable-stock cap, shipping estimate,
  free-shipping threshold

Environment variables may be used to override any of them without editing the
file.

The **client** does use an env file — `client/.env.example` documents
`VITE_USE_MOCK` and `VITE_API_BASE_URL`. Copy it to `.env.local`. Anything in a
`VITE_*` variable is readable by the browser, so no secret ever belongs there.

### Build

```bash
cd client
npm run build        # -> client/dist
npm run preview
```

---

## Project structure

```text
ZAVORA/
├── client/
│   ├── public/
│   └── src/
│       ├── components/   ui/ layout/ product/ cart/ admin/ account/
│       ├── constants/    navigation model
│       ├── context/      Auth, Cart, Wishlist, Settings
│       ├── hooks/
│       ├── layouts/      StoreLayout, AccountLayout, AdminLayout
│       ├── pages/        public/ account/ admin/
│       ├── services/     api.js (axios), products.js, media.js, mockCatalogue.js
│       ├── utils/        format.js, storage.js
│       ├── App.jsx       routes
│       ├── index.css     design tokens (@theme) + base + type scale
│       └── main.jsx
├── server/
│   ├── config.js
│   ├── app.js
│   ├── controllers/  products, categories, auth, cart, addresses, orders, checkout, wishlist, admin.cj
│   ├── database/     pool.js, schema.sql, schema-runner.js, seed-data.js, seed.js, cj-sync-cli.js
│   ├── lib/          catalog.js (all public product SQL), money.js, validate.js
│   ├── middleware/   auth.js, error.js
│   ├── routes/       index.js, products, categories, auth, addresses, orders, wishlist, admin
│   ├── services/cj/  client.js (rate-limited HTTP), token.js (auth), mapper.js, sync.js
│   └── test/         money.js, sql-arity.js, cj.js, contract.js, smoke.js
└── README.md
```

---

## Architecture notes

**Mock → real API swap.** Every service reads one flag from
`client/src/services/env.js`:

```js
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
```

It defaults to mock, so a fresh clone runs with no database; `VITE_USE_MOCK=false`
sends every call to the REST API. `products.js`, `auth.js`, `cart.js`,
`checkout.js`, `orders.js`, `addresses.js` and `wishlist.js` each branch on it.
No component imports the mock catalogue directly.

The API returns products with the category nested (`category: { slug, name }`),
while the components read flat `categorySlug` / `categoryName` / `image`. That
translation happens once in `products.js` (`normaliseProduct`), so switching
mock off required **zero** component changes.

**Supplier isolation is structural, not conventional.** All public product SQL
lives in one file, `server/lib/catalog.js`. It builds an explicit column list
(`PRODUCT_FIELDS`) rather than `SELECT *`, and it never references
`product_supplier` — so adding a cost column to `products` later cannot leak,
and no careless join can drag supplier data into a storefront response. Sort
keys go through a `SORTABLE` allowlist and are never interpolated from input.
`test/smoke.js` recursively scans every public response for cost/supplier field
names and fails if one appears.

**CJ authentication is two-stage, and the obvious thing fails.** The credential
in `config.cj.apiKey` is an **apiKey** of the form `CJ<userNum>@api@<secret>`,
not an access token. It is POSTed once to `/authentication/getAccessToken` to
obtain a ~566-character `accessToken`, which then travels in the
`CJ-Access-Token` header. Sending the apiKey directly as the header returns
**401** — that was the first thing tried. Tokens last ~180 days and are cached
in `store_settings` (never exposed by any endpoint) so restarts don't spend the
1 req/s budget re-authorising.

**The CJ response envelope is not HTTP status.** A rate-limited or
bad-parameter call still returns HTTP 200 with `result: false` and a `code`.
Trusting the status line would record "0 products" instead of failing, so
`services/cj/client.js` decides success on `result` and `code`. The product
list is also double-wrapped: the products are at
`data.content[0].productList`, **not** `data.content`, while the variant
endpoint returns a bare array.

**Markup, not margin.** `pricing.defaultMarkupPercent` is applied to *cost*
(`sell = cost × (1 + markup/100)`). A 35% markup is a **26%** margin, because
`margin = markup / (1 + markup)`. This was originally named `marginPercent`,
which is a large pricing error waiting to happen. `GET /api/admin/cj/preview`
reports both so the real number is visible rather than assumed.

**Money never touches floating point.** DECIMAL columns are read as strings
(`decimalNumbers: false`). All arithmetic happens in integer cents via
`server/lib/money.js`; `toCents`/`fromCents` cross the boundary, and `applyPercent`
rounds half-up. The distinction between `decimal()` (a raw DECIMAL column,
already in currency units) and `centsToNumber()` (an integer-cent value computed
in code) is a real footgun: mixing them reports a $147.95 order as $1.48. It
slipped through once and is now pinned by `test/money.js`.

**Watch the two mysql2 return shapes.** The pool helpers in `database/pool.js`
resolve to `rows`, but a raw transaction connection resolves to
`[rows, fields]`. Code that mixes them reads `undefined` instead of a value —
`const [{ n }] = conn.query(...)` destructures the rows *array* as if it were a
row. This silently disabled two real behaviours (default-address promotion, and
"first address becomes the default") before it was caught. `txQuery`/`txExecute`
exist so transaction code cannot reach for the raw connection directly.

**Images.** `client/src/services/media.js` is the single place image URLs are
produced. It returns deterministic placeholder photography in mock mode; in real
mode the URL comes from `product_images` via the API.

**Listing pages.** `/shop`, `/search` and `/category/:slug` are thin wrappers
around one `ProductListing` component. All filter state (query, category, sort,
price band, stock, rating, page) lives in the URL via `useProductFilters`, so
every filtered view is shareable and the three routes can never drift apart.
Below `lg` the filter panel moves into a bottom sheet and sorting moves into
that sheet, because three controls in the toolbar row truncates the category
value at 390px.

**Variant gating.** A product with colour or size options cannot be added to
the cart until one is chosen — the CTA reads "Choose a colour" / "Choose a size"
and the cart is untouched. The chosen variant is stored on the cart line.

**Dashboard shell.** `components/layout/DashboardShell.jsx` implements
Reference B — a near-black sidebar framing a white rounded canvas — and is
shared by the customer dashboard and (from step 15) the admin. It collapses
220px → 68px on desktop and becomes a 272px off-canvas drawer on mobile. The
customer dashboard passes no `groups`, which is what makes it read lighter than
the admin's collapsible "Sales channels" / "Apps" sections.

**Orders.** `services/orders.js` stores product *snapshots* per line — name,
image, price, variant at purchase time — so editing or delisting a product later
never rewrites order history. `constants/orders.js` owns the lifecycle, shared by
the dashboard, the public tracking page and the admin, so a status can never
mean two things. Public tracking requires the order number **and** a matching
email; a wrong email returns "no matching order" without revealing whether the
order exists.

**Checkout pricing is server-authoritative.** The client sends a product id, a
variant id and a quantity — never a price. `POST /api/checkout/quote` and
`POST /api/checkout/place-order` both re-read every line from the catalogue,
resolve the variant, re-check stock and recompute the money, so the figures
charged are the figures the server calculated. `placeOrder` re-prices at the
moment of purchase inside a transaction rather than trusting the last quote.

Mock mode additionally rejects a line whose price disagrees with the catalogue
with `PRICE_CHANGED`. The real API does not: it ignores any client-sent price
and charges its own. That is the safer default, because the comparison key
itself would be client-controlled. Stock is decremented with a conditional
`UPDATE … WHERE stock >= ?`, so two simultaneous checkouts for the last unit
produce one order and one `409`, never an oversell — asserted directly in
`test/smoke.js`.

**Shipping tiers.** `estimateShipping()` returns both `fee` (zeroed when the
basket qualifies for free shipping) and `zoneFee` (the raw zone rate). Free
shipping is a basket-level benefit, not a property of the zone — so a paid
upgrade like Express must charge `zoneFee × multiplier`. Using the discounted
`fee` made Express free on qualifying baskets.

**Auth.** `services/auth.js` is the only module that knows whether auth is
mocked. Real mode is a cookie session — no JWT is issued and nothing is kept in
`localStorage`, so there is no token to steal via XSS. Passwords are never
hashed client-side; bcrypt is server-side only.

`AuthContext` therefore branches at boot: mock mode rehydrates from
`localStorage`, while real mode starts signed out and resolves identity from
`GET /api/auth/me`, which is the only source of truth. Leaving a stored copy of
the user in `localStorage` would survive a logout in another tab, so real mode
actively clears that key.

`login` and `register` call `session.regenerate()` on the server to rotate the
session id and prevent session fixation. `attachUser` re-resolves
`req.session.userId` to a fresh row on every request, so deactivating an account
takes effect immediately instead of persisting to the cookie's expiry. Login
runs a bcrypt comparison even when the email does not exist, so a missing
account and a wrong password take the same time and the endpoint cannot be used
to enumerate registered addresses.

Guest carts merge into the account's cart on sign-in rather than being
discarded. `requireAuth` is mounted per path prefix, never as a bare
`router.use(requireAuth)` — a blanket guard also runs for paths that match no
route, which turns every unknown URL into a 401 instead of a 404.

A 401 from anywhere raises `SESSION_EXPIRED_EVENT` (see `services/api.js`).
`AuthContext` listens for it, clears local state and records *why*, so the login
page can say "your session expired" instead of showing a bare error.

Forgot-password always confirms the same thing whether or not the address
exists — otherwise the page becomes an account-enumeration oracle.

**Cart.** `CartContext` owns items, the saved-for-later list, and the shipping
destination, and derives `subtotal` / `shipping` / `total` from
`services/shipping.js`. State updaters stay pure — the save-for-later and
move-to-cart actions read state directly instead of nesting one `setState`
inside another's updater, which StrictMode double-invokes. Recommendations are
excluded by **product id**, not by cart line key: a line added with a variant
has the key `zv_0001::v2`, which never matches a `zv_0001::default` comparison
and would recommend the item straight back.

**Shipping.** `services/shipping.js` owns the destination list and estimates.
Cart, checkout and the product page all read from it so destination lists cannot
diverge. Step 11 replaces the estimates with server-issued rates.

**Tests.**

```bash
cd client
npm test    # utils/rating.js invariants
```

`buildStarDistribution` has to produce a star breakdown whose weighted mean
equals the displayed average and whose rows sum exactly to the review total — a
naive exponential falloff produces a plausible shape that contradicts the
headline figure. The test covers every catalogue product, an average sweep from
1.0 to 5.0 across several totals, and edge cases.

**Immersive navbar.** Routes that open with a full-bleed dark hero are listed in
`IMMERSIVE_ROUTES` (`client/src/constants/navigation.js`). The navbar renders
transparent over them and commits to solid white with a blur after 24px of
scroll. A route is only listed once it actually renders a dark hero, otherwise
the nav would be white-on-white.

**Tailwind v4 gotcha.** The stylesheet emits `.hidden` *before* `.inline-flex`.
A component whose base class sets a display utility (e.g. `Button`) will defeat
a caller passing a bare `hidden`. Use max-width variants instead —
`max-md:hidden` — which are emitted later and win deterministically.

---

## The catalogue comes from CJdropshipping

CJ is the **sole source of products**. Nothing is authored locally: there is no
seed catalogue in the storefront path, and `npm run catalogue:wipe` empties the
shop without touching customers or orders.

Current state:

| | |
| --- | --- |
| Products pulled from CJ | 6,000 |
| Live (sellable) | 4,390 |
| Archived — no usable CJ price | 1,610 |
| Categories built from CJ's 3 levels | 561 (14 → 86 → 461) |
| Variants fetched so far | 729 |

### Why 1,610 products are archived

Some CJ listings carry no `sellPrice`, `nowPrice` or `discountPrice` at all —
quote-only, or awaiting pricing upstream. The first import took them at face
value and produced **1,610 products priced $0.00**, which a storefront will
offer for free and a customer can check out. The sync now refuses any product
whose effective cost is zero (`mapper.isImportable`) and archives it if it was
previously imported. `test/smoke.js` asserts the live catalogue has no $0 rows.

### Categories are a real tree

CJ exposes three levels (`oneCategoryName` / `twoCategoryName` /
`threeCategoryName`). Each level becomes a row in `categories` linked by
`parent_id`, and **products attach to the most specific level**. That means a
parent category holds no products of its own, so:

- counts are **rolled up** the tree in `lib/catalog.js`, or every branch would
  read as zero;
- `GET /api/products?category=<any slug>` matches that category **and its whole
  subtree** via a recursive CTE, so a top-level filter returns its descendants;
- `GET /api/categories` is **depth-limited** (`?depth=2` by default). The full
  tree serialises to 354 KB, which is far too much to send on every homepage
  render; two levels is 13 KB, and `/categories/:slug` serves deeper levels on
  demand.

The invariant that matters is asserted directly: the top-level rollups sum to
exactly the number of live products, so nothing is double-counted or orphaned.

### Variants are fetched in bounded batches

Each variant costs one CJ request, and CJ allows one request per second, so
enriching 6,000 products would take ~100 minutes. Enrichment is therefore capped
per run (`maxVariantFetchesPerRun`) and resumes on the next run. A product with
no variants is marked `variants_synced_at` anyway — otherwise it would look
"not yet enriched" forever and be re-fetched on every sync, spending the budget
on nothing.

### The suite must not depend on catalogue contents

Products change with every sync, so `test/smoke.js` picks its fixtures by
**shape** — a product with variants, one without, a cheap one, a well-stocked
one — rather than hardcoding slugs. Hardcoded slugs failed the moment the
catalogue switched from seed data to CJ.

---

## Order fulfilment (step 14)

**Status changes are a state machine**, not a free-text field
(`lib/orderStatus.js`). Without it an admin can mark a delivered order
"processing" again, or ship a cancelled one, and the customer dashboard and
public tracking page then disagree with the warehouse.

- Every transition is validated server-side; an illegal move is a **409** that
  names the legal alternatives.
- The admin UI renders its action buttons from the server's `allowedNext`, not
  from a client-side copy of the table, so the two cannot drift.
- `shipped` / `in_transit` / `delivered` **require a tracking number** —
  otherwise a customer gets a "shipped" order they cannot follow.
- Cancelling restores stock and refunds a captured payment **in one
  transaction**, and is refused once an order has shipped. Cancelling twice is a
  409, so stock cannot be credited twice.

**Shipping is zone-based** (`lib/shipping.js`) rather than a table inside the
checkout controller. Only *standard* shipping qualifies for free delivery; a paid
upgrade always charges, because free-shipping is a basket-level benefit and
using the discounted rate made express free on qualifying baskets. A quote
without a destination falls back to a higher international multiplier, so a
quote always matches the order that follows when the destination is supplied.

---

## Admin dashboard (step 15)

`DashboardShell` is shared with the customer dashboard so the two cannot drift
apart; the admin passes `groups` (collapsible sections), which is what makes it
read as denser.

| Screen | What it does |
| --- | --- |
| `/admin` | KPIs, recent orders, low stock, top categories |
| `/admin/orders` | Filterable table (status / payment / search), pagination |
| `/admin/orders/:orderNumber` | Fulfilment actions from `allowedNext`, tracking, cancel |
| `/admin/products` | Catalogue with **supplier cost and margin** (admin-only) |
| `/admin/cj-sync` | Connection state, trigger a sync, run history (polls only while running) |

Supplier cost and margin are computed here and **nowhere else** — they are
admin-only by design, and `test/smoke.js` scans public responses to prove it.

---

## Verification helpers

The temporary in-repo harnesses (`__shot.html`, `__probe.html`,
`__navprobe.html`, `__scrollprobe.html`) **have been deleted** — Vite copies
everything in `public/` into `dist/`, so leaving them would ship test pages in a
production build. `client/public/` now contains only `favicon.svg`.

Viewport/overflow verification was done with a CDP driver kept **outside** the
repository, so it can never end up in a build. The technique matters if it needs
repeating: Chrome's `--screenshot` and `--dump-dom` flags run under
`--virtual-time-budget`, which **suppresses scroll events entirely** — a
transparent→solid navbar can never be verified that way, and scripts that wait
on `scrollY` hang. Drive a real Chrome over the DevTools Protocol instead
(`Emulation.setDeviceMetricsOverride` + `Page.captureScreenshot`), which also
avoids Chrome's ~780px minimum window size clamping narrow viewports.

Note that the pages were checked at 390 / 768 / 1440px with zero horizontal
overflow at each step. Re-run that pass after any layout change.

---

© ZAVORA
