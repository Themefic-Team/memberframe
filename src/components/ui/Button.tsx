import React from "react";
import "./ui.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "secondary",
  size = "md",
  fullWidth = false,
  loading = false,
  iconLeft,
  iconRight,
  children,
  className = "",
  disabled,
  ...rest
}) => {
  // Primary variant MUST strictly use company-standard .primary-cta
  const isPrimary = variant === "primary";
  const primaryClass = isPrimary ? "primary-cta" : `mf-btn mf-btn--${variant}`;
  const sizeClass = `mf-btn--${size}`;
  const widthClass = fullWidth ? "mf-btn--full" : "";

  return (
    <button
      className={`${primaryClass} ${sizeClass} ${widthClass} ${className}`.trim()}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="mf-btn-spinner">Loading...</span>
      ) : (
        <>
          {iconLeft && <span className="mf-btn__icon">{iconLeft}</span>}
          <span>{children}</span>
          {iconRight && <span className="mf-btn__icon">{iconRight}</span>}
        </>
      )}
    </button>
  );
};
