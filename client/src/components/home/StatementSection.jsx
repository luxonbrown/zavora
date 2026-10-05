/**
 * Scene C — karaoke statement blocks on deep navy.
 *
 * Three short paragraphs reveal one after another, word by word, driven purely
 * by each block's own scroll position (see `KaraokeText`).
 */
import KaraokeText from '../brand/KaraokeText.jsx';
import { cx } from '../../utils/format.js';

const BLOCKS = [
  { text: 'Shop the world.', sub: 'Curated, tracked, and delivered to you.' },
  { text: 'Every product is chosen with care.', sub: null },
  { text: 'From click to your door — you can follow every step.', sub: null },
];

export default function StatementSection({ className = '' }) {
  return (
    <section className={cx('on-dark relative overflow-hidden bg-navy py-28', className)}>
      {/* Gradient light shifting through the section. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-[8%] top-[12%] size-[36vw] rounded-full bg-mh-blue/20 blur-[130px]" />
        <div className="absolute right-[6%] top-[48%] size-[32vw] rounded-full bg-mh-teal/16 blur-[130px]" />
        <div className="absolute bottom-[6%] left-[42%] size-[28vw] rounded-full bg-mh-emerald/14 blur-[120px]" />
      </div>

      <div className="container-z relative space-y-20 md:space-y-28">
        {BLOCKS.map((block, i) => (
          <div key={block.text} className="max-w-4xl">
            <KaraokeText
              as="p"
              text={block.text}
              className={cx(
                'font-semibold leading-[1.05] tracking-[-0.03em]',
                i === 0 ? 'h1-hero text-paper' : 'h2-section text-paper/90'
              )}
            />
            {block.sub ? (
              <p className="t-hero-support mt-5 text-paper/55">{block.sub}</p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}