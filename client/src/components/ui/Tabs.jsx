import { useId, useRef, useState } from 'react';

import { cx } from '../../utils/format.js';

/**
 * Tab list with roving focus. The tab bar scrolls horizontally on narrow
 * screens rather than wrapping or truncating.
 */
export default function Tabs({ tabs, value, onChange, className }) {
  const baseId = useId();
  const listRef = useRef(null);

  const activeIndex = tabs.findIndex((tab) => tab.id === value);

  const onKeyDown = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();

    let next = activeIndex;
    if (event.key === 'ArrowRight') next = (activeIndex + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (activeIndex - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;

    onChange(tabs[next].id);
    listRef.current?.querySelectorAll('[role="tab"]')[next]?.focus();
  };

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label="Product information"
        onKeyDown={onKeyDown}
        ref={listRef}
        className="no-scrollbar -mb-px flex gap-6 overflow-x-auto border-b border-line"
      >
        {tabs.map((tab) => {
          const selected = tab.id === value;
          return (
            <button
              key={tab.id}
              id={`${baseId}-tab-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              className={cx(
                'relative shrink-0 pb-4 text-[15px] whitespace-nowrap transition-colors duration-150',
                selected ? 'text-ink' : 'text-muted hover:text-ink'
              )}
            >
              {tab.label}
              <span
                className={cx(
                  'absolute inset-x-0 -bottom-px h-0.5 rounded-full transition-colors duration-150',
                  selected ? 'bg-ink' : 'bg-transparent'
                )}
              />
            </button>
          );
        })}
      </div>

      {tabs.map((tab) =>
        tab.id === value ? (
          <div
            key={tab.id}
            id={`${baseId}-panel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-${tab.id}`}
            tabIndex={0}
            className="page-rise pt-8 focus:outline-none"
          >
            {tab.content}
          </div>
        ) : null
      )}
    </div>
  );
}
