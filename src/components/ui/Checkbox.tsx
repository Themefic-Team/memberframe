import React, { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { cn } from "../../utils/cn";

export interface CheckboxProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Tri-state. Renders the dash and leaves `checked` alone. */
  indeterminate?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}

/**
 * 16x16, 4px radius. Use when a Save step applies the change, per PRD section
 * 7.5. For instant-apply use Toggle.
 */
export const Checkbox: React.FC<CheckboxProps> = ({
  id,
  checked,
  onChange,
  indeterminate = false,
  disabled = false,
  children,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // `indeterminate` is a DOM property with no HTML attribute, so React cannot
  // set it declaratively.
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <label
      className={cn(
        "framefic-checkbox",
        indeterminate && "is-indeterminate",
        disabled && "is-disabled"
      )}
    >
      <input
        ref={inputRef}
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span className="framefic-checkbox-box">
        {indeterminate ? (
          <span className="framefic-checkbox-dash" />
        ) : (
          <Check className="framefic-checkbox-icon" aria-hidden="true" />
        )}
      </span>
      {children}
    </label>
  );
};
