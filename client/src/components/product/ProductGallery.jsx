import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';

import { cx } from '../../utils/format.js';
import { productImages } from './ProductImage.jsx';

/**
 * Gallery with a vertical thumbnail rail on desktop and a swipeable main image
 * with dots on mobile. Hover-to-zoom on desktop follows the cursor.
 */
export default function ProductGallery({ images = [], alt = '', badges = null }) {
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState('50% 50%');
  const frameRef = useRef(null);

  // A product change (client-side navigation) must reset the gallery.
  useEffect(() => {
    setIndex(0);
    setZoomed(false);
  }, [alt]);

  const list = productImages({ images: images ?? [] });
  if (!list.length) {
    return <div className="aspect-4/5 w-full rounded-image bg-surface-muted" />;
  }

  const active = Math.min(index, list.length - 1);
  const go = (delta) => setIndex((i) => (i + delta + list.length) % list.length);

  const onMove = (event) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setOrigin(`${x}% ${y}%`);
  };

  return (
    <div className="flex flex-col-reverse gap-4 lg:flex-row lg:gap-5">
      {/* Thumbnail rail is a desktop affordance; below `lg` the swipe arrows
          and dots are the mobile pattern and a rail would duplicate them. */}
      {list.length > 1 ? (
        <ul className="no-scrollbar hidden shrink-0 gap-3 lg:flex lg:w-20 lg:flex-col">
          {list.map((src, i) => (
            <li key={src + i} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`View image ${i + 1} of `}
                aria-current={i === active}
                className={cx(
                  'block size-16 overflow-hidden rounded-lg transition-[outline-color,opacity] duration-150 lg:size-20',
                  i === active
                    ? 'outline-2 outline-offset-2 outline-ink'
                    : 'opacity-55 hover:opacity-100'
                )}
              >
                <img
                  src={src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="size-full bg-surface-muted object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Main frame */}
      <div className="relative min-w-0 flex-1">
        <div
          ref={frameRef}
          onMouseEnter={() => setZoomed(true)}
          onMouseLeave={() => setZoomed(false)}
          onMouseMove={onMove}
          className="group relative aspect-4/5 w-full cursor-zoom-in overflow-hidden rounded-image bg-surface-muted"
        >
          {list.map((src, i) => (
            <img
              key={src + i}
              src={src}
              alt={i === 0 ? alt : ''}
              aria-hidden={i !== 0}
              loading={i === 0 ? 'eager' : 'lazy'}
              /* Lowercase for React 18; see the note in components/home/Hero.jsx. */
              fetchpriority={i === 0 ? 'high' : undefined}
              decoding="async"
              className={cx(
                'absolute inset-0 size-full object-cover transition-opacity duration-300 ease-out',
                i === active ? 'opacity-100' : 'opacity-0'
              )}
              style={
                zoomed && i === active
                  ? { transform: 'scale(1.7)', transformOrigin: origin, transition: 'transform 200ms cubic-bezier(0.16,1,0.3,1)' }
                  : undefined
              }
            />
          ))}

          {badges ? (
            <div className="pointer-events-none absolute top-4 left-4 flex flex-col items-start gap-1.5">
              {badges}
            </div>
          ) : null}

          <span className="pointer-events-none absolute right-4 bottom-4 hidden size-9 place-items-center rounded-full bg-paper/85 text-ink backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-0 lg:grid">
            <ZoomIn className="size-4" strokeWidth={1.6} aria-hidden />
          </span>
        </div>

        {/* Mobile pager */}
        {list.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous image"
              className="absolute top-1/2 left-3 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-paper/85 text-ink backdrop-blur-sm lg:hidden"
            >
              <ChevronLeft className="size-4" strokeWidth={1.8} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next image"
              className="absolute top-1/2 right-3 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-paper/85 text-ink backdrop-blur-sm lg:hidden"
            >
              <ChevronRight className="size-4" strokeWidth={1.8} aria-hidden />
            </button>

            <div className="mt-4 flex items-center justify-center gap-1.5 lg:hidden">
              {list.map((src, i) => (
                <button
                  key={src + i}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Go to image ${i + 1}`}
                  className={cx(
                    'h-1.5 rounded-full transition-all duration-200',
                    i === active ? 'w-5 bg-ink' : 'w-1.5 bg-line-strong'
                  )}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
