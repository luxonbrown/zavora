import { cx } from '../../utils/format.js';

/** Checkbox with a label that stays a comfortable tap target. */
export default function Checkbox({
  label,
  hint,
  className,
  id,
  inputClassName,
  ...rest
}) {
  const inputId = id || rest.name;

  return (
    <div className={cx('w-full', className)}>
      <label
        htmlFor={inputId}
        className="flex cursor-pointer items-start gap-3 select-none"
      >
        <input
          id={inputId}
          type="checkbox"
          className={cx(
            'mt-0.5 size-[18px] shrink-0 cursor-pointer rounded accent-ink',
            inputClassName
          )}
          {...rest}
        />
        <span className="text-[14px] leading-snug text-ink">{label}</span>
      </label>
      {hint ? <p className="t-caption mt-1.5 text-muted">{hint}</p> : null}
    </div>
  );
}