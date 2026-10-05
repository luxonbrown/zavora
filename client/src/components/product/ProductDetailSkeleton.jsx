import Skeleton from '../ui/Skeleton.jsx';
import Container from '../layout/Container.jsx';

/** Mirrors the product page geometry so the layout doesn't shift on load. */
export default function ProductDetailSkeleton() {
  return (
    <div className="bg-paper pt-28 pb-24 md:pt-32">
      <Container>
        <div className="flex flex-col gap-10 lg:flex-row lg:gap-16">
          {/* Gallery */}
          <div className="flex flex-col-reverse gap-4 lg:w-[58%] lg:flex-row lg:gap-5">
            <div className="flex shrink-0 gap-3 lg:w-20 lg:flex-col">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="size-16 shrink-0 rounded-lg lg:size-20" />
              ))}
            </div>
            <Skeleton className="aspect-4/5 w-full rounded-image" />
          </div>

          {/* Info */}
          <div className="flex-1">
            <Skeleton className="h-3 w-24 rounded-full" />
            <Skeleton className="mt-4 h-8 w-4/5 rounded-full" />
            <Skeleton className="mt-3 h-3.5 w-40 rounded-full" />

            <div className="mt-7 flex items-baseline gap-3">
              <Skeleton className="h-7 w-28 rounded-full" />
              <Skeleton className="h-4 w-20 rounded-full" />
            </div>

            <Skeleton className="mt-6 h-4 w-full rounded-full" />
            <Skeleton className="mt-2.5 h-4 w-11/12 rounded-full" />

            <div className="mt-8 space-y-6">
              <div>
                <Skeleton className="h-3.5 w-24 rounded-full" />
                <div className="mt-3 flex gap-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="size-10 rounded-full" />
                  ))}
                </div>
              </div>
              <div>
                <Skeleton className="h-3.5 w-16 rounded-full" />
                <div className="mt-3 flex gap-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-16 rounded-full" />
                  ))}
                </div>
              </div>
            </div>

            <Skeleton className="mt-8 h-24 w-full rounded-card" />
            <Skeleton className="mt-4 h-11 w-full rounded-full" />
            <Skeleton className="mt-3 h-13 w-full rounded-full" />
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-24">
          <Skeleton className="h-5 w-96 rounded-full" />
          <div className="mt-8 space-y-3">
            <Skeleton className="h-3.5 w-full rounded-full" />
            <Skeleton className="h-3.5 w-11/12 rounded-full" />
            <Skeleton className="h-3.5 w-9/12 rounded-full" />
          </div>
        </div>
      </Container>
    </div>
  );
}
