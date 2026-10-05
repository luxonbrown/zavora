import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { cx } from '../../utils/format.js';

/**
 * Password input with a reveal toggle. Marked `autoComplete` appropriately by the
 * caller so browsers can offer saved credentials.
 */
const PasswordField = forwardRef(function PasswordField(
  { label, error, hint, id, className, ...rest },
  ref
) {
  const [revealed, setRevealed] = useState(false);
  const inputId = id || rest.name;

  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={inputId} className="t-small mb-1.5 block font-medium text-ink">
          {label}
        </label>
      ) : null}

      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={revealed ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${inputId}-msg` : undefined}
          className={cx(
            'h-13 w-full rounded-xl border bg-paper pr-12 pl-3.5 text-[15px] text-ink',
            'placeholder:text-muted transition-colors duration-150',
            'focus:ring-2 focus:outline-none',
            error
              ? 'border-danger focus:border-danger focus:ring-danger/10'
              : 'border-line focus:border-ink focus:ring-ink/8',
            className
          )}
          {...rest}
        />

        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          aria-label={revealed ? 'Hide password' : 'Show password'}
          aria-pressed={revealed}
          className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-surface-muted hover:text-ink"
        >
          {revealed ? (
            <EyeOff className="size-[18px]" strokeWidth={1.6} aria-hidden />
          ) : (
            <Eye className="size-[18px]" strokeWidth={1.6} aria-hidden />
          )}
        </button>
      </div>

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

export default PasswordField;