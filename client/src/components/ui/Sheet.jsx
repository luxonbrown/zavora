import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import { cx } from '../../utils/format.js';

const WIDTHS = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
};

/**
 * One modal surface for the whole app.
 * Mobile: bottom sheet. Desktop: centred dialog.
 */
export default function Sheet({
  open,
  onClose,
  title,
  description,
  size = 'md',
  footer,
  children,
  className,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'page-rise relative flex max-h-[88dvh] w-full flex-col overflow-hidden bg-paper',
          'rounded-t-[24px] sm:rounded-card',
          WIDTHS[size] ?? WIDTHS.md,
          className
        )}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-6 border-b border-line px-6 py-5">
            <div className="min-w-0">
              {title ? <h2 className="h3-sub truncate">{title}</h2> : null}
              {description ? (
                <p className="t-small mt-1 text-muted">{description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mt-1 -mr-1 grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-surface-muted hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6">
          {children}
        </div>

        {footer ? (
          <div className="border-t border-line px-6 py-4">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
