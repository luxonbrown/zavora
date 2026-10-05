import { cx } from '../../utils/format.js';
import Button from './Button.jsx';

/** Calm empty state — never a bare blank area. */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  actionTo,
  className,
  compact = false,
}) {
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center rounded-card border border-line bg-paper text-center',
        compact ? 'px-6 py-12' : 'px-6 py-20',
        className
      )}
    >
      {Icon ? (
        <span className="mb-5 grid size-12 place-items-center rounded-full bg-surface-muted text-muted">
          <Icon className="size-5" aria-hidden />
        </span>
      ) : null}

      <h3 className="t-title">{title}</h3>
      {description ? (
        <p className="t-small mt-2 max-w-sm text-muted">{description}</p>
      ) : null}

      {action ? (
        <Button to={actionTo} variant="outline-dark" size="md" className="mt-6">
          {action}
        </Button>
      ) : null}
    </div>
  );
}

/** Error state — same geometry as EmptyState, tinted by a danger hairline. */
export function ErrorState({ title = 'Something went wrong', description, action, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-danger/25 bg-paper px-6 py-16 text-center">
      <h3 className="t-title">{title}</h3>
      {description ? (
        <p className="t-small mt-2 max-w-sm text-muted">{description}</p>
      ) : null}
      {onRetry ? (
        <Button variant="outline-dark" size="md" onClick={onRetry} className="mt-6">
          Try again
        </Button>
      ) : null}
    </div>
  );
}
