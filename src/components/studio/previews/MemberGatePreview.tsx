import React from "react";
import { ArrowRight, EyeOff, Lock } from "lucide-react";
import { useMemberSession } from "../../../hooks/useMemberSession";
import { isEntitled, lockReason } from "../../../utils/entitlement";
import type { MemberGateConfig } from "../../../types/canvas";

export interface MemberGatePreviewProps {
  config: MemberGateConfig;
}

/**
 * The `<MemberGate>` preview. Feature F01, previewed under F04.
 *
 * This is a preview, not the component. The real `<MemberGate>` is authored in
 * task 1.7 as canvas code with its styling consolidated into a `cssContent`
 * string. The two share class names deliberately, both prefixed `memberframe-`
 * per PRD section 9.3 rule 2, so what a creator sees here is what the canvas
 * renders. They do not share code: one runs in the panel against the kit's
 * stylesheet, the other in a published site against injected CSS.
 *
 * Entitlement comes from the shared resolver, never from a local shortcut.
 * PRD section 11.3 calls divergence between the three copies a security defect,
 * and a preview that lied about who gets in would be the worst of the three.
 */
export const MemberGatePreview: React.FC<MemberGatePreviewProps> = ({ config }) => {
  const { session, tiers } = useMemberSession();
  const unlocked = isEntitled(session, config.requiredTier, tiers);
  const reason = lockReason(session, config.requiredTier, tiers);

  // The protected frame. On canvas this is whatever the creator drops into
  // `contentSlot`, so the preview stands in with a labelled block rather than
  // pretending to know their content.
  const content = (
    <div className="memberframe-slot-stub">
      <span className="memberframe-slot-stub-label">Protected frame</span>
      <span className="memberframe-slot-stub-hint">
        Connect any frame to the content slot on the canvas.
      </span>
    </div>
  );

  if (unlocked) {
    return (
      <div className="memberframe-gate-container is-unlocked">
        {content}
        <p className="memberframe-gate-note">
          Unlocked. This member meets the tier requirement.
        </p>
      </div>
    );
  }

  if (config.fallbackAction === "hide") {
    return (
      <div className="memberframe-gate-container is-hidden-state">
        <span className="memberframe-gate-hidden-icon">
          <EyeOff aria-hidden={true} />
        </span>
        <p className="memberframe-gate-note">
          Hidden. The section leaves no gap on the page.
        </p>
      </div>
    );
  }

  if (config.fallbackAction === "redirect") {
    return (
      <div className="memberframe-gate-container is-redirect-state">
        <span className="memberframe-gate-hidden-icon">
          <ArrowRight aria-hidden={true} />
        </span>
        <p className="memberframe-gate-note">
          Redirects to {config.redirectUrl ? config.redirectUrl : "a page you have not picked yet"}.
        </p>
      </div>
    );
  }

  const lockCard = (
    <div className="memberframe-lock-card">
      <span className="memberframe-lock-icon">
        <Lock aria-hidden={true} />
      </span>
      <p className="memberframe-lock-title">{config.cardTitle}</p>
      <p className="memberframe-lock-description">{config.cardDescription}</p>
      {reason ? <p className="memberframe-lock-reason">{reason}</p> : null}
      {/*
        A real button here would be a second `.primary-cta` in the Builder tab,
        which PRD section 7.5 forbids outright. It is a non-interactive span
        wearing the canvas component's own class, which is also more honest:
        clicking inside a preview should not start a checkout.
      */}
      <span className="memberframe-lock-cta">Sign in to unlock</span>
    </div>
  );

  if (config.fallbackAction === "custom_card") {
    return <div className="memberframe-gate-container is-card-state">{lockCard}</div>;
  }

  // Frosted blur, the default. The radius is a creator-dragged number, so it
  // arrives as --memberframe-preview-blur, written by PreviewStudio.
  return (
    <div className="memberframe-gate-container is-blur-state">
      <div className="memberframe-blur-overlay">{content}</div>
      {lockCard}
    </div>
  );
};
