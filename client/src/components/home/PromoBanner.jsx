import Button from '../ui/Button.jsx';
import Container from '../layout/Container.jsx';

/**
 * Typographic promotional band. Deliberately not a "SALE!!!" block — the offer
 * is stated once, quietly, in the same voice as the rest of the site.
 */
export default function PromoBanner() {
  return (
    <section className="bg-paper pb-24 md:pb-32">
      <Container>
        <div className="on-dark relative overflow-hidden rounded-section bg-ink-deep px-6 py-16 md:px-16 md:py-24">
          {/* Soft light bloom, kept subtle */}
          <div className="pointer-events-none absolute -top-32 -right-24 size-[420px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.09)_0%,transparent_70%)]" />

          <div className="relative flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between lg:gap-16">
            <div className="max-w-3xl">
              <p className="t-eyebrow text-paper/45">Shipping</p>
              <h2 className="h2-section mt-4 text-paper">
                Free express delivery{' '}
                <span className="text-muted-on-dark">on every order over $150.</span>
              </h2>
              <p className="t-body mt-5 max-w-lg text-muted-on-dark">
                Tracked, insured and delivered in 3–6 business days to 40+ markets.
                Duties are calculated at checkout, so there is nothing to pay on
                arrival.
              </p>
            </div>

            <Button
              to="/shop"
              variant="primary-light"
              size="xl"
              className="shrink-0 max-md:w-full"
            >
              Start shopping
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
