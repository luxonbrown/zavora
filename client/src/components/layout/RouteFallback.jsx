import { Loader2 } from 'lucide-react';

/** Route-level Suspense fallback — never show a blank screen. */
export default function RouteFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper">
      <Loader2 className="size-5 animate-spin text-muted" aria-hidden />
      <span className="sr-only">Loading</span>
    </div>
  );
}
