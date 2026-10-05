import { Mark } from '../brand/Logo.jsx';
import NewsletterForm from '../layout/NewsletterForm.jsx';

/**
 * Closing newsletter band on deep navy, with the brand gradient as the only
 * fill. Sits directly above the footer so the two dark surfaces read as one.
 */
export default function NewsletterBand() {
  return (
    <section className="on-dark relative overflow-hidden bg-navy py-24 md:py-28">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="animate-drift absolute left-[10%] top-[10%] size-[34vw] rounded-full bg-mh-blue/22 blur-[120px]" />
        <div
          className="animate-drift absolute -right-[6%] bottom-[8%] size-[30vw] rounded-full bg-mh-emerald/18 blur-[120px]"
          style={{ animationDelay: '-8s' }}
        />
      </div>

      <div className="container-z relative">
        <div className="mx-auto max-w-xl text-center">
          <Mark className="mx-auto size-12" title={undefined} />

          <p className="t-eyebrow mt-6 text-paper/55">Stay in the loop</p>
          <h2 className="h2-section mt-3 text-paper">
            One email a week. <span className="text-gradient-brand">Worth opening.</span>
          </h2>
          <p className="t-body mt-4 text-paper/60">
            New arrivals and the occasional good idea. No noise, and you can
            leave whenever you like.
          </p>
        </div>

        <div className="mx-auto mt-9 max-w-md text-left">
          <NewsletterForm />
        </div>
      </div>
    </section>
  );
}