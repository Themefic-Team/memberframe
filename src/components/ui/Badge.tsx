import React from "react";
import { cn } from "../../utils/cn";

export type BadgeTone = "pro" | "brand" | "new" | "neutral" | "success" | "warning" | "danger";

export interface BadgeProps {
  tone: BadgeTone;
  /** Optional leading icon, sized to 10px by the badge CSS. */
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/**
 * Status and tier label. Foundations Content: Badge.
 *
 * One or two words, sentence case, never clickable. PRO next to gated
 * features, New for fresh items, the status tones for Connected, Limit
 * reached, Failed. Never build a one-off pill in feature CSS; add a tone here.
 */
export const Badge: React.FC<BadgeProps> = ({ tone, icon, className, children }) => (
  <span className={cn("badge", `badge-${tone}`, className)}>
    {icon}
    {children}
  </span>
);
