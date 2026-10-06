import { cx } from '../../utils/format.js';

export default function StatementSection({ className = '' }) {
  return (
    <section className={cx('on-dark relative overflow-hidden bg-navy', className)}>
      <video
        src="/videos/Kanuma.mp4"
        autoPlay
        muted
        loop
        playsInline
        controls={false}
        className="block w-full h-auto max-h-[100svh] object-contain sm:h-[100svh] sm:object-cover"
      />
    </section>
  );
}
