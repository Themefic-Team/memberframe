import React from "react";
import { cn } from "../../utils/cn";

export interface ToggleProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Accessible name. Supply it when no visible label is tied to `id`. */
  label?: string;
}

/**
 * 28x16 pill, `role="switch"`. Instant-apply only, per PRD section 7.5: a
 * toggle commits the moment it moves. If the change needs a Save button, use
 * Checkbox instead, otherwise the control lies about when the state took effect.
 */
export const Toggle: React.FC<ToggleProps> = ({
  id,
  checked,
  onChange,
  disabled = false,
  label,
}) => (
  <label className={cn("framefic-toggle", disabled && "is-disabled")}>
    <input
      id={id}
      type="checkbox"
      role="switch"
      checked={checked}
      disabled={disabled}
      aria-label={label}
      aria-checked={checked}
      onChange={(event) => onChange(event.currentTarget.checked)}
    />
    <span className="framefic-toggle-track">
      <span className="framefic-toggle-knob" />
    </span>
  </label>
);
