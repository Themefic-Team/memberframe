import React from "react";
import { PendingPreview } from "./previews/PendingPreview";
import { findComponent, type CanvasComponentId } from "./componentRegistry";

export interface PreviewStudioProps {
  componentId: CanvasComponentId;
}

/**
 * The Live Preview Studio. PRD task 1.1, feature F04, layout in section 7.4.
 *
 * Describes the selected component. No network path exists in this subtree.
 */
export const PreviewStudio: React.FC<PreviewStudioProps> = ({ componentId }) => {
  const entry = findComponent(componentId);

  return (
    <section className="studio" aria-label="Live preview studio">
      <div className="studio-viewport">
        <PendingPreview entry={entry} />
      </div>
    </section>
  );
};
