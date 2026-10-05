/**
 * The single image component for every product/category surface.
 *
 * Centralised because image data is genuinely inconsistent across the API:
 * `productsService.normaliseProduct` produces `image` (string|null) and
 * `images` (array of `{ url, alt, isPrimary }`), while wishlist rows expose a
 * bare `image` string and admin rows expose `images` differently again. Doing
 * this once means no surface has to re-implement "what if the URL is relative".
 *
 * Guarantees:
 *  - fixed aspect box, so no layout shift while loading
 *  - blur-up placeholder, then the real image
 *  - graceful branded fallback when the URL is missing or 404s
 *  - hover swap to the second image when one exists
 *  - always has alt text (decorative when the product name is adjacent)
 */

const FALLBACK =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#F5F8FB"/>
          <stop offset="100%" stop-color="#E3EAF2"/>
        </linearGradient>
        <linearGradient id="m" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1D6BFF" stop-opacity="0.20"/>
          <stop offset="100%" stop-color="#10B981" stop-opacity="0.20"/>
        </linearGradient>
      </defs>
      <rect width="400" height="500" fill="url(#g)"/>
      <rect x="150" y="196" width="100" height="108" rx="26" fill="url(#m)"/>
      <path d="M172 258V232c0-2.6 3.2-4 5.1-1.9l10.9 12.1 10.9-12.1c1.9-2.1 5.1-.7 5.1 1.9v26"
            stroke="#5B6B7C" stroke-opacity="0.5" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>`,
  );

/** Turns anything the API might hand us into a usable absolute-ish URL. */
export function normalizeImageUrl(input) {
  if (!input) return null;

  // Wishlist/address rows give a bare string.
  const raw = typeof input === 'string' ? input : input.url ?? input.src ?? null;
  if (!raw || typeof raw !== 'string') return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  // The API can hand back a JSON-encoded array of strings.
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      return normalizeImageUrl(JSON.parse(trimmed));
    } catch {
      // Not JSON after all — fall through and use it literally.
    }
  }

  if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith('data:')) return trimmed;

  // Protocol-relative and site-relative paths both need the origin.
  if (trimmed.startsWith('//')) return `${window.location.protocol}${trimmed}`;
  if (trimmed.startsWith('/')) return trimmed;

  // Bare upstream hosts like "cdn.example.com/x.jpg".
  if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(trimmed)) return `https://${trimmed}`;

  return trimmed;
}

/** All usable images for a product, primary first. Never returns an empty array. */
export function productImages(product) {
  if (!product) return [];

  const fromArray = Array.isArray(product.images)
    ? product.images.map((i) => (typeof i === 'string' ? { url: i } : i)).filter(Boolean)
    : [];

  const ordered = [...fromArray].sort((a, b) => {
    // Primary first, but never let an explicit isPrimary reorder a bare array.
    if (a.isPrimary === b.isPrimary) return 0;
    return a.isPrimary ? -1 : 1;
  });

  const urls = ordered.map((i) => normalizeImageUrl(i)).filter(Boolean);

  const single = normalizeImageUrl(product.image);
  if (single && !urls.includes(single)) urls.push(single);

  return urls.length ? urls : [FALLBACK];
}

const RATIOS = {
  '1/1': 'aspect-square',
  '4/5': 'aspect-[4/5]',
  '3/4': 'aspect-[3/4]',
  '16/9': 'aspect-video',
  // 'fill' lets the caller own the box size (e.g. a fixed-height slot).
  'none': '',
};


export default function ProductImage({
  product,
  src,
  alt,
  ratio = '4/5',
  // Whole-image by default so a product is never cropped to half its height on
  // smaller screens; callers that want the cropped look opt in with fit="cover".
  fit = 'contain',
  hoverSwap = true,
  className = '',
  imgClassName = '',
  eager = false,
  sizes,
}) {
  const images = product ? productImages(product) : [normalizeImageUrl(src) || FALLBACK];
  const primary = images[0];
  const secondary = hoverSwap && images.length > 1 ? images[1] : null;
  const isFallback = primary === FALLBACK;

  // Contain by default (see the prop comment) so products show in full rather
  // than being cropped; the fallback also stays contained.
  const objectFit = fit === 'cover' ? 'object-cover' : 'object-contain';
  const boxBg = fit === 'cover' && !isFallback ? 'bg-surface-muted' : 'bg-white';

  const label = alt ?? product?.name ?? '';

  return (
    <div
      className={[
        'relative overflow-hidden',
        RATIOS[ratio] ?? RATIOS['4/5'],
        boxBg,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Placeholder sits under the image and is revealed on load. */}
      <div className="skeleton absolute inset-0" aria-hidden />

      <img
        src={primary}
        alt={label}
        loading={eager ? 'eager' : 'lazy'}
        decoding={eager ? 'sync' : 'async'}
        // Lowercase on purpose: React 18 does not recognise the camelCase
        // `fetchPriority` prop and warns about it on every image. The DOM
        // attribute itself is all-lowercase.
        fetchpriority={eager ? 'high' : 'auto'}
        sizes={sizes}
        onLoad={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
        onError={(e) => {
          // A dead upstream URL must not leave a torn image icon.
          if (e.currentTarget.src !== FALLBACK) e.currentTarget.src = FALLBACK;
        }}
        className={[
          'absolute inset-0 size-full transition-opacity duration-500',
          'opacity-0',
          objectFit,
          imgClassName,
        ].join(' ')}
      />

      {secondary ? (
        <img
          src={secondary}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
          className={[
            'absolute inset-0 size-full opacity-0 transition-opacity duration-500',
            'group-hover:opacity-100',
            objectFit,
          ].join(' ')}
        />
      ) : null}
    </div>
  );
}

export { FALLBACK as FALLBACK_IMAGE };