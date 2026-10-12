import React from "react";
import { cn } from "../../utils/cn";

export interface SelectOption<Value extends string> {
  value: Value;
  label: string;
  disabled?: boolean;
}

export interface SelectProps<Value extends string> {
  id?: string;
  value: Value;
  options: ReadonlyArray<SelectOption<Value>>;
  onChange: (value: Value) => void;
  disabled?: boolean;
  fill?: boolean;
  /** Accessible name. Supply it when no visible label is tied to `id`. */
  label?: string;
}

/**
 * 30px select on the kit's `.framefic-select`, which carries the option
 * contrast fix PRD section 7.5 requires. Native `<select>` on purpose: it gets
 * keyboard behaviour, screen reader support, and the platform dropdown free,
 * none of which a custom listbox gets without real work.
 *
 * The cast in `onChange` is safe because the rendered options are the only
 * values the element can hold, and they all come from `options`.
 */
export function Select<Value extends string>({
  id,
  value,
  options,
  onChange,
  disabled = false,
  fill = false,
  label,
}: SelectProps<Value>) {
  return (
    <select
      id={id}
      className={cn("framefic-select", fill && "fill")}
      value={value}
      disabled={disabled}
      aria-label={label}
      onChange={(event) => onChange(event.currentTarget.value as Value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
