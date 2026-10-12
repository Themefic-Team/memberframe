import React from "react";
import { Hammer } from "lucide-react";
import type { CanvasComponentEntry } from "../componentRegistry";

export interface PendingPreviewProps {
  entry: CanvasComponentEntry;
}

/**
 * Stands in for a component that is not authored yet.
 *
 * It names the PRD task that will build it, which is the whole reason it exists.
 * An unexplained empty viewport reads as a bug; "Preview arrives with task 3.4"
 * reads as a schedule. The alternative was hiding unbuilt components from the
 * picker, which would have hidden 14 of 15 and made the Builder tab look like a
 * one-component plugin.
 */
export const PendingPreview: React.FC<PendingPreviewProps> = ({ entry }) => (
  <div className="studio-pending">
    <span className="studio-pending-icon">
      <Hammer aria-hidden={true} />
    </span>
    <p className="studio-pending-title">{entry.name}</p>
    <p className="studio-pending-body">
      {entry.previewNote ?? `Not built yet. This preview arrives with task ${entry.task}.`}
    </p>
    <span className="badge badge-neutral">{entry.features}</span>
  </div>
);
