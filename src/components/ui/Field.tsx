import React from "react";
import { InfoTip } from "./InfoTip";

/**
 * The id of a field's error text, for a control that points
 * `aria-describedby` at it.
 */
export function fieldErrorId(htmlFor: string): string {
  return `${htmlFor}-error`;
}


export interface FieldProps {
  label: React.ReactNode;
  /** The id of the control inside. Links the label, the help text, and the error. */
  htmlFor?: string;
  /** What the field is for: a tooltip on an info icon beside the label (the user's choice, 2026-10-25). */
  hint?: React.ReactNode;
  /** What is wrong, under the field. Never a toast or a banner. */
  error?: string | null;
  /** Something beside the label: a badge, a counter. */
  extra?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * A form field, framefic-ui-kit's `Field` (design-system.md section 8): the
 * label on top, the control full width under it, the error under that. What
 * the field is for sits in an info tip beside the label, not as text under
 * the field (the user kept the tooltips, 2026-10-25). Every text input,
 * select, and text area sits in one; a checkbox, toggle, or segmented control
 * sits in a `Setting`.
 *
 * The control is given `aria-describedby` for the error when it is a single
 * element, so screen readers read it. The tip describes its own icon.
 */
export const Field: React.FC<FieldProps> = ({ label, htmlFor, hint, error, extra, children }) => {
  const describedBy = htmlFor && error ? fieldErrorId(htmlFor) : undefined;
  const control =
    describedBy && React.isValidElement<{ "aria-describedby"?: string }>(children)
      ? React.cloneElement(children, {
          "aria-describedby": [children.props["aria-describedby"], describedBy].filter(Boolean).join(" "),
        })
      : children;

  return (
    <div className="kit-field">
      <div className="kit-field-label-row">
        <label className="kit-field-label" htmlFor={htmlFor}>
          {label}
        </label>
        {hint ? <InfoTip label={typeof label === "string" ? label : "this field"}>{hint}</InfoTip> : null}
        {extra}
      </div>
      <div className="kit-field-control">{control}</div>
      {error ? (
        <p className="kit-field-error" id={htmlFor ? fieldErrorId(htmlFor) : undefined} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
};

/** Fields in a column, 12px apart: the kit's `.stack-l`, the rhythm inside a section. */
export const Fields: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="kit-stack">{children}</div>;
