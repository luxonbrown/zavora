/**
 * Karaoke text: each word starts dim and lights up as the block scrolls.
 *
 * The active word gets the brand gradient (blue → teal → green) so the reveal
 * reads as a highlight travelling through the sentence, not just a fade-in.
 *
 * Accessibility — words are real text in the DOM (screen readers and Ctrl-F both
 * work) and a single `aria-label` carries the whole sentence, which would
 * otherwise be announced as 40 separate spans. Reduced motion renders the block
 * fully lit, because the reveal *is* the content.
 */
import { useEffect, useRef } from 'react';

import { useInView, usePrefersReducedMotion } from '../../hooks/useMotionPrefs.js';
import { cx } from '../../utils/format.js';

export default function KaraokeText({
  text,
  as: Tag = 'p',
  className = '',
  wordClassName = '',
  /** Scroll progress at which the first / last word is fully lit. */
  from = 0.14,
  to = 0.7,
  dimOpacity = 0.2,
  /** Set false when the block sits on a light background. */
  gradient = true,
}) {
  const [ref, inView] = useInView({ rootMargin: '0px', threshold: 0.2 });
  const reduced = usePrefersReducedMotion();
  const activeRef = useRef(-1);

  const words = String(text).trim().split(/\s+/);

  /**
   * Progress comes from the element's own position in the viewport rather than
   * a scroll listener, so it stays correct inside Lenis' transform loop.
   */
  const paint = () => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    // 0 when the block's top enters the bottom edge, 1 when its bottom clears
    // the top edge.
    const raw = (vh - rect.top) / (vh + rect.height);
    const p = Math.min(1, Math.max(0, (raw - from) / (to - from)));

    const spans = el.querySelectorAll('[data-mh-word]');
    // One word of lead, so the current word finishes lighting as it arrives.
    const lit = Math.round(p * (words.length + 1));

    spans.forEach((span, i) => {
      const on = i < lit;
      span.style.opacity = on ? '1' : String(dimOpacity);
      // Keep dim words desaturated so the lit ones pop.
      span.style.filter = on ? 'none' : 'blur(0.35px)';
      if (gradient) {
        span.style.backgroundImage = on ? 'var(--mh-karaoke-grad)' : 'none';
        span.style.webkitBackgroundClip = on ? 'text' : '';
        span.style.backgroundClip = on ? 'text' : '';
        span.style.color = on ? 'transparent' : '';
      }
    });

    const next = Math.min(lit, words.length - 1);
    if (activeRef.current !== next) activeRef.current = next;
  };

  // Paint on mount and whenever the block first enters the viewport, so a
  // section that is already partly visible on load is not stuck dim.
  useEffect(() => {
    if (reduced) return;
    paint();
    if (inView) paint();
  }, [inView, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Tag
      ref={ref}
      aria-label={text}
      className={cx('leading-[1.06]', className)}
      onScroll={paint}
    >
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          data-mh-word
          className={cx(
            'inline-block transition-[opacity,filter] duration-300 ease-out',
            wordClassName,
            reduced && 'opacity-100'
          )}
          style={
            reduced
              ? undefined
              : {
                  opacity: dimOpacity,
                  backgroundImage: gradient ? 'var(--mh-karaoke-grad)' : undefined,
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                }
          }
          aria-hidden
        >
          {word}
          {i < words.length - 1 ? '\u00A0' : ''}
        </span>
      ))}
    </Tag>
  );
}