import { forwardRef, useId } from 'react';

import { cx } from '../../utils/format.js';

const Select = forwardRef(function Select(
  { label, hint, error, size = 'md', className, id, children, ...rest },
  ref
) {
  const generatedId = useId();
  const selectId = id || generatedId;

  const field = (
    <div className="relative">
      <select
        ref={ref}
        id={selectId}
        aria-invalid={error ? true : undefined}
        className={cx(
          'w-full appearance-none rounded-xl border border-line bg-paper pr-10 pl-3.5 text-ink',
          'transition-colors duration-150 focus:border-ink focus:ring-2 focus:ring-ink/8 focus:outline-none',
          size === 'sm' ? 'h-9 text-[13px]' : size === 'lg' ? 'h-13 text-[15px]' : 'h-11 text-sm',
          error && 'border-danger focus:border-danger',
          className
        )}
        {...rest}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden
      >
        <path
          d="M4 6.5 8 10.5 12 6.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );

  if (!label && !hint && !error) return field;

  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={selectId} className="t-small mb-1.5 block font-medium text-ink">
          {label}
        </label>
      ) : null}
      {field}
      {error || hint ? (
        <p className={cx('t-caption mt-1.5', error ? 'text-danger' : 'text-muted')}>
          {error || hint}
        </p>
      ) : null}
    </div>
  );
});

export default Select;
