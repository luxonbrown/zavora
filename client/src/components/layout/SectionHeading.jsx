import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

import { cx } from '../../utils/format.js';

/**
 * Standard section opener. `duotone` reproduces the two-tone headline pattern
 * from the dark statement section.
 *
 * `tone` defaults to "light" because most sections sit on `bg-paper`. Pass
 * tone="dark" explicitly on dark surfaces or the type renders white-on-white.
 */
export default function SectionHeading({
  eyebrow,
  title,
  accent,
  description,
  align = 'left',
  tone = 'light',
  action,
  actionTo,
  className,
}) {
  const dark = tone === 'dark';

  return (
    <div
      className={cx(
        'flex flex-col gap-6 md:flex-row md:items-end md:justify-between',
        align === 'center' && 'md:flex-col md:items-center md:text-center',
        className
      )}
    >
      <div className={cx('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
        {eyebrow ? (
          <p className={cx('t-eyebrow', dark && 'text-paper/45')}>{eyebrow}</p>
        ) : null}

        <h2 className={cx('h2-section mt-3', dark ? 'text-paper' : 'text-ink')}>
          {title}
          {accent ? (
            <>
              {' '}
              <span className={dark ? 'text-muted-on-dark' : 'text-muted'}>{accent}</span>
            </>
          ) : null}
        </h2>

        {description ? (
          <p
            className={cx(
              't-body mt-4',
              dark ? 'text-muted-on-dark' : 'text-muted'
            )}
          >
            {description}
          </p>
        ) : null}
      </div>

      {action ? (
        <Link
          to={actionTo}
          className={cx(
            'group inline-flex shrink-0 items-center gap-1.5 text-[15px] font-medium transition-colors duration-150',
            dark ? 'text-paper hover:text-paper/75' : 'text-ink hover:text-muted'
          )}
        >
          {action}
          <ArrowRight
            className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
            strokeWidth={1.8}
            aria-hidden
          />
        </Link>
      ) : null}
    </div>
  );
}
