import React from "react";

export interface SliderProps {
  id?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** Suffix on the readout, for example "px". Not the value itself. */
  unit?: string;
  /** Accessible name. Supply it when no visible label is tied to `id`. */
  label?: string;
}

/**
 * Range control with a numeric readout, matching the PRD section 7.4 mockup
 * row `Blur amount [====O=========] 8px`.
 *
 * The only kit control whose CSS is genuinely new. `components.css` has an
 * input, a select, a segmented control, a toggle, and a checkbox, but no range
 * input and no `.crest-switch-slider` that fits. Its styling therefore lives in
 * `src/styles/builder.css`, because `components.css` is a verbatim slice of the
 * reference design system and hand-editing it would break the drift check.
 *
 * Native `<input type="range">` on purpose: arrow keys, Home, End, and
 * `aria-valuenow` all come free, and a div-plus-drag reimplementation gets none
 * of them without deliberate work.
 */
export const Slider: React.FC<SliderProps> = ({
  id,
  value,
  min,
  max,
  step = 1,
  onChange,
  unit,
  label,
}) => (
  <span className="framefic-slider">
    <input
      id={id}
      type="range"
      className="framefic-slider-input"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={label}
      onChange={(event) => onChange(Number(event.currentTarget.value))}
    />
    {/* aria-hidden: the range input already announces its value, so reading the
        readout too would say the number twice. */}
    <span className="framefic-slider-value" aria-hidden={true}>
      {value}
      {unit}
    </span>
  </span>
);
