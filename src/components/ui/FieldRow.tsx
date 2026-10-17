import React from "react";
import { cn } from "../../utils/cn";
import { InfoTip } from "./InfoTip";

/**
 * The id of a row's inline error text. The control inside the row must carry
 * `aria-describedby={fieldErrorId(id)}` when it is in an error state, otherwise
 * the message is visible but not announced. FieldRow cannot set this itself
 * because the control is passed in as a child.
 */
export function fieldErrorId(htmlFor: string): string {
  return `${htmlFor}-error`;
}

export interface FieldRowProps {
  label: string;
  /** The id of the control inside the row. Required to link the label and the error. */
  htmlFor?: string;
  /** Stretches the control to the full row instead of the fixed 160px column. */
  fill?: boolean;
  /** Rendered under the row. Never promote a field error to a banner or a toast. */
  error?: string;
  /**
   * What the field is for, shown as a tooltip on an info icon beside the label.
   * Never as a paragraph under the row: that slot is for errors only.
   */
  hint?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Label left, control right, 30px minimum height, 12px gap. The control column
 * is a fixed 160px unless `fill` is set. PRD section 7.5.
 *
 * Hints are a tooltip beside the label (`hint`); errors are text under the row.
 * Field errors belong here, inline under the field. The feedback hierarchy sends
 * finished actions to a toast and persistent state to a banner, so a validation
 * message must never be promoted to either.
 */
export const FieldRow: React.FC<FieldRowProps> = ({
  label,
  htmlFor,
  fill = false,
  error,
  hint,
  children,
}) => (
  <div className="field-row-wrap">
    <div className={cn("field-row", fill && "is-fill")}>
      {hint ? (
        // The icon sits beside the label, not inside it: a button inside a
        // <label> is invalid and would compete with the labelled control.
        <span className="field-row-label-group">
          <label className="field-row-label" htmlFor={htmlFor}>
            {label}
          </label>
          <InfoTip label={label}>{hint}</InfoTip>
        </span>
      ) : (
        <label className="field-row-label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      <div className={cn("field-row-control", fill && "fill")}>{children}</div>
    </div>
    {error ? (
      <span
        className="field-error-message"
        id={htmlFor ? fieldErrorId(htmlFor) : undefined}
        role="alert"
      >
        {error}
      </span>
    ) : null}
  </div>
);

/** Vertical stack of rows, 8px gap. */
export const FieldRows: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="field-rows">{children}</div>
);
