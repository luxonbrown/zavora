import { cx } from '../../utils/format.js';

/**
 * Page heading with an optional action slot, shared by every admin screen.
 *
 * Extracted rather than repeated because fifteen pages all need the same
 * rhythm: title, one line of context, and at most a couple of actions on the
 * right. The `as` prop lets a page supply its own heading level if it ever sits
 * inside another landmark.
 */
export default function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  as: Heading = 'h1',
  className,
  children,
}) {
  return (
    <div className={cx('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="t-caption text-muted">{eyebrow}</p> : null}
        <Heading className="mt-1 text-[22px] leading-tight font-medium text-ink md:text-[26px]">
          {title}
        </Heading>
        {description ? (
          <p className="mt-2 max-w-[70ch] text-[14px] text-muted">{description}</p>
        ) : null}
        {children}
      </div>

      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
