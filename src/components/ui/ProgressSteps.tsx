import React from "react";
import { cn } from "../../utils/cn";

export interface ProgressStepsProps {
  /** Steps finished. */
  done: number;
  total: number;
  /** Read by a screen reader, e.g. "Setup progress". */
  label: string;
  className?: string;
}

/**
 * A segmented progress bar: one segment per step, filled from the left
 * (kit extension, design-system.md section 9). Segments rather than a width
 * keep it free of inline styles.
 */
export const ProgressSteps: React.FC<ProgressStepsProps> = ({ done, total, label, className }) => {
  const filled = Math.max(0, Math.min(total, done));
  return (
    <div
      className={cn("kit-progress", className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={filled}
      aria-valuetext={`${filled} of ${total} done`}
    >
      {Array.from({ length: total }, (_, index) => (
        <span key={index} className={cn("kit-progress-seg", index < filled && "is-done")} />
      ))}
    </div>
  );
};
