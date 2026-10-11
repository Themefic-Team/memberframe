import React from "react";
import { cn } from "../../utils/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/**
 * The `primary` variant renders `.primary-cta`. Exactly one per view, never two,
 * per PRD section 7.5. The gradient fill lives in components.css; never give a
 * button a flat brand fill, it fails WCAG AA at 4.07:1.
 *
 * `.primary-cta` is deliberately NOT combined with `.btn`. Both set a height and
 * `.btn` is declared later in components.css, so adding it would win the cascade
 * and shrink the medium CTA from 36px to 30px.
 */
export const Button: React.FC<ButtonProps> = ({
  variant = "secondary",
  size = "sm",
  className,
  type = "button",
  children,
  ...rest
}) => {
  const classes =
    variant === "primary"
      ? cn("primary-cta", size === "sm" && "btn-sm", className)
      : cn("btn", `btn-${variant}`, `btn-${size}`, className);

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
};
