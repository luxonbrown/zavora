/**
 * Scene F — "Why MARKETHUB": five trust items as glass cards.
 *
 * Deliberately free of sourcing language. The brief forbids "dropshipping"
 * and "supplier" in customer-facing copy, and more broadly a customer does not
 * care *how* stock reaches the warehouse — they care that it arrives, on time,
 * and can be traced. Everything here is a promise we can actually keep.
 */
import {
  Globe2,
  Headphones,
  Lock,
  PackageCheck,
  Truck,
} from 'lucide-react';

import { useReveal } from '../../hooks/useMotionPrefs.js';
import { cx } from '../../utils/format.js';

const ITEMS = [
  {
    icon: Globe2,
    title: 'Global selection',
    body: 'A catalogue built from makers around the world, brought into one place so you do not have to hunt.',
  },
  {
    icon: Lock,
    title: 'Secure checkout',
    body: 'Encrypted payment and no card details stored on our side. You stay in control of your data.',
  },
  {
    icon: Truck,
    title: 'Reliable shipping',
    body: 'Dispatched with carriers we track, with clear delivery estimates before you pay.',
  },
  {
    icon: PackageCheck,
    title: 'Order tracking',
    body: 'Follow every step of your order in real time, from confirmation to your front door.',
  },
  {
    icon: Headphones,
    title: 'Customer support',
    body: 'A real person answers when something goes wrong — not a ticket queue that goes nowhere.',
  },
];

export default function WhySection({ className = '' }) {
  const [ref, shown] = useReveal();

  return (
    <section
      ref={ref}
      className={cx('on-dark relative overflow-hidden bg-navy py-24', className)}
    >
      {/* Ambient brand light. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="animate-drift absolute -left-[12%] top-[6%] size-[42vw] rounded-full bg-mh-blue/22 blur-[130px]" />
        <div
          className="animate-drift absolute -right-[10%] bottom-[4%] size-[38vw] rounded-full bg-mh-emerald/18 blur-[130px]"
          style={{ animationDelay: '-9s' }}
        />
      </div>

      <div className="container-z relative">
        <header className="mx-auto max-w-2xl text-center">
          <p className="t-eyebrow text-paper/60">Why MARKETHUB</p>
          <h2 className="h2-section mt-3 text-paper">
            Built on trust, <span className="text-gradient-brand">not promises</span>
          </h2>
        </header>

        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map((item, i) => {
            const Icon = item.icon;
            // Five items across three columns: the last two span evenly.
            const isLastRow = i >= 3;
            return (
              <li
                key={item.title}
                className={cx(
                  'glass rounded-[26px] p-7 transition-all duration-500 hover:-translate-y-1',
                  'hover:border-mh-sky/40 hover:shadow-glow-blue',
                  isLastRow && 'lg:col-span-1'
                )}
                style={{
                  opacity: shown ? 1 : 0,
                  transform: shown ? undefined : 'translateY(18px)',
                  transitionDelay: shown ? `${i * 90}ms` : '0ms',
                }}
              >
                <span className="grid size-12 place-items-center rounded-2xl bg-brand-gradient text-white shadow-glow-blue">
                  <Icon className="size-5" strokeWidth={1.9} aria-hidden />
                </span>
                <h3 className="h3-sub mt-5 text-[19px] text-paper">{item.title}</h3>
                <p className="t-small mt-2.5 leading-relaxed text-muted-on-dark">{item.body}</p>
              </li>
            );
          })}

          {/* Fills the sixth cell on a 3-column grid with a brand moment. */}
          <li
            className={cx(
              'glass relative overflow-hidden rounded-[26px] p-7',
              'flex flex-col justify-center'
            )}
          >
            <div className="absolute inset-0 bg-brand-gradient opacity-20" aria-hidden />
            <div className="relative">
              <p className="wordmark text-[15px] text-paper">MARKETHUB</p>
              <p className="t-small mt-3 leading-relaxed text-paper/80">
                Thousands of products, one calm place to find them.
              </p>
              <a
                href="/shop"
                className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-4 py-2 text-[12.5px] font-semibold text-ink transition hover:bg-white"
              >
                Start exploring
              </a>
            </div>
          </li>
        </ul>
      </div>
    </section>
  );
}