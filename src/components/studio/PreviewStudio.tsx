import React, { useEffect, useRef } from "react";
import { StateSwitcher } from "./StateSwitcher";
import { MemberGatePreview } from "./previews/MemberGatePreview";
import { PendingPreview } from "./previews/PendingPreview";
import { findComponent, type CanvasComponentId } from "./componentRegistry";
import {
  simulatedStateCaption,
  useMemberSession,
  type SimulatedState,
} from "../../hooks/useMemberSession";
import { MEMBER_STATUS_LABELS, tierName } from "../../types/member";
import type { MemberGateConfig } from "../../types/canvas";

export interface PreviewStudioProps {
  componentId: CanvasComponentId;
  gateConfig: MemberGateConfig;
}

/**
 * The Live Preview Studio. PRD task 1.1, feature F04, layout in section 7.4.
 *
 * Renders the selected component at true scale against the live design tokens,
 * driven by the simulated session from the five-state switcher. No network path
 * exists in this subtree, which is what makes F04's "Preview never issues a
 * network request" structural rather than merely observed.
 */
export const PreviewStudio: React.FC<PreviewStudioProps> = ({ componentId, gateConfig }) => {
  const { session, tiers, simulatedState, setSimulatedState } = useMemberSession();
  const viewportRef = useRef<HTMLDivElement>(null);
  const entry = findComponent(componentId);

  /**
   * The CSS variable bridge. PRD F04 requires "dynamic CSS variable overrides
   * for the customizer values", and blur radius is a number the creator drags,
   * so no static class can express it.
   *
   * `style={{ }}` is prohibited and `npm run lint:css` rejects it, so the one
   * scalar is written straight to the element. This honours the rule rather
   * than dodging it: every declaration still lives in `builder.css` and only a
   * value crosses the boundary, where an inline style would have moved the
   * declaration itself into the markup.
   *
   * Running after paint also satisfies performance target P2, one animation
   * frame, because React batches the state change and this write lands in the
   * same frame.
   */
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    viewport.style.setProperty("--memberframe-preview-blur", `${gateConfig.blurIntensity}px`);
  }, [gateConfig.blurIntensity]);

  const activeState: SimulatedState = simulatedState ?? "guest";

  return (
    <section className="studio" aria-label="Live preview studio">
      <div className="studio-viewport" ref={viewportRef}>
        {entry.previewReady && entry.id === "member_gate" ? (
          <MemberGatePreview config={gateConfig} />
        ) : (
          <PendingPreview entry={entry} />
        )}
      </div>

      <div className="studio-controls">
        <StateSwitcher value={activeState} onChange={setSimulatedState} />

        {/*
          Prose, not an enum. PRD section 7.6 rule 4 forbids surfacing a raw
          value like `past_due`, so the switcher reads "Failed" and this line
          explains the consequence.
        */}
        <p className="studio-caption">{simulatedStateCaption(activeState)}</p>

        <div className="studio-session-meta">
          {session ? (
            <>
              <span className="badge badge-neutral">{tierName(session.activeTier, tiers)}</span>
              <span
                className={
                  session.status === "active" || session.status === "trialing"
                    ? "badge badge-success"
                    : "badge badge-danger"
                }
              >
                {MEMBER_STATUS_LABELS[session.status]}
              </span>
            </>
          ) : (
            <span className="badge badge-neutral">Signed out</span>
          )}
        </div>
      </div>
    </section>
  );
};
