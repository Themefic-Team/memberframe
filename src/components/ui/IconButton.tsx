import React from "react";
import { cn } from "../../utils/cn";

export type IconButtonVariant = "secondary" | "ghost";

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "title"> {
  /** Required. Doubles as the tooltip, per PRD section 7.5. */
  label: string;
  variant?: IconButtonVariant;
  children: React.ReactNode;
}

/**
 * 30x30, 8px radius, 16px glyph. `label` is mandatory because an icon-only
 * control with no accessible name is unusable with a screen reader, and the
 * standard requires both `aria-label` and `title`.
 */
export const IconButton: React.FC<IconButtonProps> = ({
  label,
  variant = "ghost",
  className,
  type = "button",
  children,
  ...rest
}) => (
  <button
    type={type}
    className={cn("icon-button", variant, className)}
    aria-label={label}
    title={label}
    {...rest}
  >
    {children}
  </button>
);
