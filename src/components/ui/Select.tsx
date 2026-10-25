import React from "react";
import { cn } from "../../utils/cn";

export interface SelectOption<Value extends string> {
  value: Value;
  label: string;
  disabled?: boolean;
  /** Options with a group are shown under its heading, in the order the groups first appear. */
  group?: string;
}

function renderOption<Value extends string>(option: SelectOption<Value>) {
  return (
    <option key={option.value} value={option.value} disabled={option.disabled}>
      {option.label}
    </option>
  );
}

export interface SelectProps<Value extends string> {
  id?: string;
  value: Value;
  options: ReadonlyArray<SelectOption<Value>>;
  onChange: (value: Value) => void;
  disabled?: boolean;
  fill?: boolean;
  /** Sized to its options (90 to 115px), for a toolbar beside a search field. */
  compact?: boolean;
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
  compact = false,
  label,
}: SelectProps<Value>) {
  return (
    <select
      id={id}
      className={cn("framefic-select", fill && "fill", compact && "is-compact")}
      value={value}
      disabled={disabled}
      aria-label={label}
      onChange={(event) => onChange(event.currentTarget.value as Value)}
    >
      {options.some((option) => option.group)
        ? [...new Set(options.map((option) => option.group ?? ""))].map((group) =>
            group === "" ? (
              options.filter((option) => !option.group).map(renderOption)
            ) : (
              <optgroup key={group} label={group}>
                {options.filter((option) => option.group === group).map(renderOption)}
              </optgroup>
            )
          )
        : options.map(renderOption)}
    </select>
  );
}
