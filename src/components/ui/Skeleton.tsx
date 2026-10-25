import React from "react";
import { cn } from "../../utils/cn";

/**
 * The kit's loading placeholder (design-system.md section 8). Every list,
 * panel, and tab that waits on the server shows the shape of what is coming,
 * never "Loading ..." text: the layout does not jump when the content
 * arrives, and the wait reads as progress.
 *
 * - `row`: a 52px data row, the height of a member, tier, or report row.
 * - `card`: a 64px card, such as a gateway or webhook card.
 * - `line`: one line of text; `short` makes it a heading's width.
 * - `block`: a taller area, such as a hero or a chart.
 *
 * Fill is state/skeleton on the surface it sits on, pulsing gently; still for
 * anyone who asked for reduced motion (kit.css).
 */
export type SkeletonVariant = "row" | "card" | "line" | "block";

export interface SkeletonProps {
  variant?: SkeletonVariant;
  /** A heading-width line rather than a full one. */
  short?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({ variant = "row", short = false }) => (
  <div className={cn("kit-skeleton", `is-${variant}`, short && "is-short")} aria-hidden={true} />
);

export interface SkeletonListProps {
  /** What is loading, read out by screen readers: "Loading members". */
  label: string;
  count?: number;
  variant?: SkeletonVariant;
  /** A heading-width line above the items, for a whole section. */
  heading?: boolean;
}

/** A column of placeholders, announced once as busy. */
export const SkeletonList: React.FC<SkeletonListProps> = ({ label, count = 3, variant = "row", heading = false }) => (
  <div className="kit-skeleton-list" role="status" aria-busy={true} aria-label={label}>
    {heading ? <Skeleton variant="line" short /> : null}
    {Array.from({ length: count }, (_, index) => (
      <Skeleton key={index} variant={variant} />
    ))}
  </div>
);
