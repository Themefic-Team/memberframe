import React, { useEffect, useRef } from "react";
import { MemberGatePreview } from "./previews/MemberGatePreview";
import { PendingPreview } from "./previews/PendingPreview";
import { findComponent, type CanvasComponentId } from "./componentRegistry";
import type { MemberGateConfig } from "../../types/canvas";

export interface PreviewStudioProps {
  componentId: CanvasComponentId;
  gateConfig: MemberGateConfig;
}

/**
 * The Live Preview Studio. PRD task 1.1, feature F04, layout in section 7.4.
 *
 * Renders the selected component at true scale against the live design tokens.
 * No network path exists in this subtree.
 */
export const PreviewStudio: React.FC<PreviewStudioProps> = ({ componentId, gateConfig }) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const entry = findComponent(componentId);

  /**
   * The CSS variable bridge.
   */
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    viewport.style.setProperty("--memberframe-preview-blur", `${gateConfig.blurIntensity}px`);
  }, [gateConfig.blurIntensity]);

  return (
    <section className="studio" aria-label="Live preview studio">
      <div className="studio-viewport" ref={viewportRef}>
        {entry.previewReady && entry.id === "member_gate" ? (
          <MemberGatePreview config={gateConfig} />
        ) : (
          <PendingPreview entry={entry} />
        )}
      </div>
    </section>
  );
};
