import React from "react";
import { cn } from "../../utils/cn";

/**
 * The input types the kit allows.
 *
 * A closed list rather than the full HTML set. `checkbox` and `radio` have
 * their own kit components with their own geometry, `number` renders a stepper
 * that does not match the 30px control standard, and `file` is a different
 * control entirely. Widened in task 2.4, which needed `password` for the
 * gateway key vault: a secret must not sit in a readable input.
 */
export type TextFieldType = "text" | "email" | "password" | "search" | "url" | "tel";

export interface TextFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
  value: string;
  onChange: (value: string) => void;
  type?: TextFieldType;
  /** Stretches to the row instead of the kit's 160px default. */
  fill?: boolean;
  invalid?: boolean;
  /** A value kept but switched off (an excluded tier feature): secondary text. */
  muted?: boolean;
}

/**
 * 30px text input on the kit's `.framefic-input`. PRD section 7.5 control
 * geometry: 30px tall, 8px radius, tertiary background.
 *
 * The class already existed in `components.css` with nothing rendering it. The
 * component is new; the styling is not.
 *
 * `onChange` hands back the string rather than the event. Every caller so far
 * wants the value, and passing the event invites reading `target` instead of
 * `currentTarget`, which is the wrong node once the input is wrapped.
 */
export const TextField: React.FC<TextFieldProps> = ({
  value,
  onChange,
  type = "text",
  fill = false,
  invalid = false,
  muted = false,
  className,
  ...rest
}) => (
  <input
    type={type}
    className={cn("framefic-input", fill && "fill", invalid && "is-invalid", muted && "is-muted", className)}
    value={value}
    aria-invalid={invalid || undefined}
    onChange={(event) => onChange(event.currentTarget.value)}
    {...rest}
  />
);
