import { Compass } from 'lucide-react';

/**
 * Honest empty state for a route with no backend endpoint yet.
 *
 * Per the brief: when the server does not expose the data, say so plainly
 * rather than inventing numbers. This is deliberately NOT a "coming soon" tease
 * — it names the missing capability so it can be turned into a real endpoint.
 */
export default function PagePlaceholder({ title, description, note }) {
  return (
    <section className="page-rise flex min-h-[70dvh] items-center justify-center px-6 py-32">
      <div className="w-full max-w-xl rounded-[28px] border border-dashed border-line-strong bg-canvas px-8 py-14 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-gradient text-white shadow-glow-blue">
          <Compass className="size-6" strokeWidth={1.8} aria-hidden />
        </span>

        <p className="t-eyebrow mt-6">MARKETHUB admin</p>
        <h1 className="h3-sub mt-2 text-ink">{title}</h1>
        <p className="t-body mx-auto mt-3 max-w-md text-muted">{description}</p>

        {note ? <p className="t-caption mt-7 text-muted/80">{note}</p> : null}
      </div>
    </section>
  );
}