import React from "react";
import { Badge, type BadgeTone } from "./Badge";

export interface HeroCardProps {
  title: string;
  description: string;
  /** Short pill above the title, for example "AI drafts included". */
  badgeLabel?: string;
  badgeTone?: Extract<BadgeTone, "brand" | "pro">;
  /** Optional decorative illustration on the right of the title block. */
  illustration?: React.ReactNode;
  /** The Home tab's one primary action, a full-width Medium `<Button variant="primary">`. */
  action: React.ReactNode;
}

/**
 * The Home tab hero. Foundations Content: Hero card (node 13124:638).
 *
 * Plain raised card: bg/raised, hairline, Shadow/Card, radius 20, padding 20.
 * Title is Title/Large 20/26, description Body/Large 14/21. Carries the tab's
 * single `.primary-cta`, full width.
 */
export const HeroCard: React.FC<HeroCardProps> = ({
  title,
  description,
  badgeLabel,
  badgeTone = "brand",
  illustration,
  action,
}) => (
  <section className="hero-card">
    <div className="hero-card-top">
      <div className="hero-card-content">
        {badgeLabel ? <Badge tone={badgeTone}>{badgeLabel}</Badge> : null}
        <h2 className="hero-card-title">{title}</h2>
        <p className="hero-card-desc">{description}</p>
      </div>
      {illustration ? (
        <span className="hero-card-illustration" aria-hidden={true}>
          {illustration}
        </span>
      ) : null}
    </div>
    {action}
  </section>
);
