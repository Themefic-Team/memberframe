import React from "react";
import { Badge } from "./Badge";
import { InfoTip } from "./InfoTip";

export interface SettingProps {
  title: React.ReactNode;
  /** The id of the control on the right, so the title is its label. */
  htmlFor?: string;
  /** What the setting does: a tooltip on an info icon beside the title. */
  hint?: React.ReactNode;
  /** A PRO badge beside the title. */
  pro?: boolean;
  /** Under the row: what is wrong with it. */
  error?: string | null;
  children: React.ReactNode;
}

/**
 * An on or off row, framefic-ui-kit's `Setting` (design-system.md section 8):
 * the title on the left with its hint in an info tip, the control on the right. For a
 * `Checkbox`, a `Toggle`, or a `Segmented`; a text input or a select goes in
 * a `Field`.
 */
export const Setting: React.FC<SettingProps> = ({ title, htmlFor, hint, pro = false, error, children }) => (
  <div className="kit-setting-wrap">
    <div className="kit-setting">
      <div className="kit-setting-text">
        <span className="kit-setting-title">
          {htmlFor ? <label htmlFor={htmlFor}>{title}</label> : title}
          {hint ? <InfoTip label={typeof title === "string" ? title : "this setting"}>{hint}</InfoTip> : null}
          {pro ? <Badge tone="pro">PRO</Badge> : null}
        </span>
      </div>
      <div className="kit-setting-control">{children}</div>
    </div>
    {error ? (
      <p className="kit-field-error" role="alert">
        {error}
      </p>
    ) : null}
  </div>
);
