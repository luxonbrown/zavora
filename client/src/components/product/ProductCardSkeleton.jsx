import Skeleton from '../ui/Skeleton.jsx';

function CardSkeleton() {
  return (
    <div className="flex flex-col">
      <Skeleton className="aspect-4/5 w-full rounded-image" />
      <div className="mt-3.5 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3.5 w-4/5 rounded-full" />
          <Skeleton className="h-3.5 w-2/5 rounded-full" />
        </div>
        <Skeleton className="h-3.5 w-14 shrink-0 rounded-full" />
      </div>
      <Skeleton className="mt-2.5 h-3 w-24 rounded-full" />
    </div>
  );
}

/** Grid-shaped skeleton — matches ProductCard exactly to avoid layout shift. */
export default function ProductCardSkeleton({ count = 8 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </>
  );
}
