import React from "react";
import "./ui.css";

export type BadgeVariant = "brand" | "success" | "warning" | "danger" | "neutral";

export interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = "brand",
  children,
  icon,
  className = "",
}) => {
  return (
    <span className={`mf-badge mf-badge--${variant} ${className}`.trim()}>
      {icon && <span className="mf-badge__icon">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
