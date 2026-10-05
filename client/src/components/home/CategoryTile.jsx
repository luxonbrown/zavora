import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

import { categoryImage } from '../../services/media.js';

/** Large image tile with a label overlay. Hover zoom, no shadow. */
export default function CategoryTile({ category }) {
  return (
    <Link
      to={`/category/${category.slug}`}
      className="group relative block w-[72vw] shrink-0 snap-start overflow-hidden rounded-2xl bg-surface-muted sm:w-[46vw] lg:w-auto"
    >
      <img
        src={categoryImage(`cat-${category.slug}`, 900, 1125)}
        alt=""
        loading="lazy"
        decoding="async"
        className="aspect-4/5 w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.05]"
      />

      <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(10,10,10,0.78)_0%,rgba(10,10,10,0.18)_45%,transparent_70%)]" />

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-[17px] leading-tight font-medium tracking-[-0.015em] text-paper">
            {category.name}
          </p>
          <p className="t-caption mt-1 text-paper/70">{category.tagline}</p>
        </div>

        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-paper/15 text-paper backdrop-blur-sm transition-[transform,background-color] duration-200 group-hover:bg-paper group-hover:text-ink">
          <ArrowUpRight className="size-4" strokeWidth={1.8} aria-hidden />
        </span>
      </div>
    </Link>
  );
}
