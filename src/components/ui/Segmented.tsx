import React from "react";
import { cn } from "../../utils/cn";

export interface SegmentedOption<Value extends string> {
  value: Value;
  label: string;
  disabled?: boolean;
}

export interface SegmentedProps<Value extends string> {
  /** Accessible name for the group, for example "Manage view". */
  label: string;
  options: ReadonlyArray<SegmentedOption<Value>>;
  value: Value;
  onChange: (value: Value) => void;
}

/**
 * 30px tall, 8px radius, 2px inset track. Used by the Manage tab to swap
 * Members and Tiers, and by the Builder tab's five-state switcher.
 */
export function Segmented<Value extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedProps<Value>) {
  return (
    <div className="framefic-segmented" role="tablist" aria-label={label}>
      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={option.disabled}
            className={cn("framefic-segment", isActive && "is-active")}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
