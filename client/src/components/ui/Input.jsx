import { forwardRef, useId } from 'react';

import { cx } from '../../utils/format.js';

const FIELD_BASE =
  'w-full rounded-xl border border-line bg-paper text-ink placeholder:text-muted ' +
  'transition-colors duration-150 focus:border-ink focus:outline-none ' +
  'focus:ring-2 focus:ring-ink/8 disabled:cursor-not-allowed disabled:bg-surface-muted';

const SIZES = {
  sm: 'h-9 px-3 text-[13px]',
  md: 'h-11 px-3.5 text-sm',
  lg: 'h-13 px-4 text-[15px]',
};

const Input = forwardRef(function Input(
  { label, hint, error, size = 'md', iconLeft, className, id, ...rest },
  ref
) {
  const generatedId = useId();
  const inputId = id || generatedId;

  const field = (
    <div className="relative">
      {iconLeft ? (
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted">
          {iconLeft}
        </span>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${inputId}-msg` : undefined}
        className={cx(
          FIELD_BASE,
          SIZES[size],
          iconLeft && 'pl-10',
          error && 'border-danger focus:border-danger focus:ring-danger/10',
          className
        )}
        {...rest}
      />
    </div>
  );

  if (!label && !hint && !error) return field;

  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={inputId} className="t-small mb-1.5 block font-medium text-ink">
          {label}
        </label>
      ) : null}
      {field}
      {error || hint ? (
        <p
          id={`${inputId}-msg`}
          className={cx('t-caption mt-1.5', error ? 'text-danger' : 'text-muted')}
        >
          {error || hint}
        </p>
      ) : null}
    </div>
  );
});

export default Input;
