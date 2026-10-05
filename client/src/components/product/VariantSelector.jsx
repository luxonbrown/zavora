import { Check } from 'lucide-react';

import { cx } from '../../utils/format.js';

/**
 * Colour swatches and size pills. Both are single-select and report the chosen
 * option name so the parent can enforce "choose before adding to cart".
 */
function ColorSelector({ options, value, onChange, disabled }) {
  return (
    <fieldset>
      <legend className="sr-only">Colour</legend>
      <div className="flex flex-wrap gap-3">
        {options.map((option) => {
          const selected = value === option.name;
          return (
            <button
              key={option.name}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.name)}
              aria-pressed={selected}
              aria-label={option.name}
              title={option.name}
              className={cx(
                'relative grid size-10 place-items-center rounded-full transition-[outline-color] duration-150',
                'outline-2 outline-offset-2',
                selected ? 'outline-ink' : 'outline-transparent hover:outline-line-strong',
                disabled && 'cursor-not-allowed opacity-40'
              )}
              style={{ backgroundColor: option.hex }}
            >
              {selected ? (
                <Check
                  className="size-4"
                  strokeWidth={2.4}
                  aria-hidden
                  style={{ color: readableInk(option.hex) }}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function SizeSelector({ options, value, onChange, disabled }) {
  return (
    <fieldset>
      <legend className="sr-only">Size</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = value === option.name;
          return (
            <button
              key={option.name}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.name)}
              aria-pressed={selected}
              className={cx(
                't-small min-w-14 rounded-full border px-4 py-2.5 transition-colors duration-150',
                selected
                  ? 'border-ink bg-ink text-paper'
                  : 'border-line text-ink hover:border-ink',
                disabled && 'cursor-not-allowed opacity-40'
              )}
            >
              {option.name}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Pick black or white for the check glyph based on swatch luminance. */
function readableInk(hex) {
  const value = hex.replace('#', '');
  if (value.length < 6) return '#ffffff';
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#0a0a0a' : '#ffffff';
}

export default function VariantSelector({
  colors,
  sizes,
  color,
  size,
  onColorChange,
  onSizeChange,
  disabled = false,
}) {
  if (!colors?.length && !sizes?.length) return null;

  return (
    <div className="space-y-6">
      {colors?.length ? (
        <div>
          <p className="t-small mb-3">
            <span className="text-muted">Colour</span>
            {color ? <span className="ml-2 font-medium">{color}</span> : null}
          </p>
          <ColorSelector
            options={colors}
            value={color}
            onChange={onColorChange}
            disabled={disabled}
          />
        </div>
      ) : null}

      {sizes?.length ? (
        <div>
          <p className="t-small mb-3">
            <span className="text-muted">Size</span>
            {size ? <span className="ml-2 font-medium">{size}</span> : null}
          </p>
          <SizeSelector
            options={sizes}
            value={size}
            onChange={onSizeChange}
            disabled={disabled}
          />
        </div>
      ) : null}
    </div>
  );
}
