import Skeleton from '../ui/Skeleton.jsx';

/** Matches CartLineItem geometry so the list doesn't shift when data lands. */
function LineSkeleton() {
  return (
    <li className="flex gap-4 border-b border-line py-6 sm:gap-5">
      <Skeleton className="size-24 shrink-0 rounded-image sm:size-32" />
      <div className="flex flex-1 flex-col justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-2/3 rounded-full" />
          <Skeleton className="h-3 w-20 rounded-full" />
          <Skeleton className="h-3.5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-9 w-32 rounded-full" />
      </div>
    </li>
  );
}

export default function CartSkeleton({ lineCount = 2 }) {
  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_380px] lg:gap-16">
      <div className="min-w-0">
        {Array.from({ length: lineCount }).map((_, i) => (
          <LineSkeleton key={i} />
        ))}
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-card border border-line p-6">
          <Skeleton className="h-4 w-32 rounded-full" />
          <Skeleton className="mt-6 h-9 w-full rounded-xl" />
          <Skeleton className="mt-5 h-1 w-full rounded-full" />
          <div className="mt-6 space-y-3 border-t border-line pt-5">
            <Skeleton className="h-3.5 w-full rounded-full" />
            <Skeleton className="h-3.5 w-2/3 rounded-full" />
            <Skeleton className="mt-2 h-5 w-1/2 rounded-full" />
          </div>
          <Skeleton className="mt-6 h-13 w-full rounded-full" />
          <Skeleton className="mt-3 h-11 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}