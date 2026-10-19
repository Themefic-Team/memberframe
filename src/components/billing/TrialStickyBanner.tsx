import React from "react";
import { Crown } from "lucide-react";
import { useLicense } from "../../hooks/useLicense";
import { trialBannerText } from "./billingHelpers";

/**
 * The yellow "Free trial! N days left" bar across the top of the panel, with
 * Upgrade. F19: BEAF's `beaf-trial-sticky-banner`, counting down to the
 * second on the last day.
 */
export const TrialStickyBanner: React.FC<{ onUpgrade: () => void }> = ({ onUpgrade }) => {
  const { view, now } = useLicense();
  if (view?.state !== "trial" || !view.trialEndsAt) return null;
  const secondsLeft = Math.max(0, (Date.parse(view.trialEndsAt) - now) / 1000);

  return (
    <div className="beaf-trial-sticky-banner">
      <span>{trialBannerText(secondsLeft)}</span>
      <button type="button" className="beaf-trial-sticky-upgrade-btn" onClick={onUpgrade}>
        <Crown size={12} className="beaf-crown" />
        Upgrade
      </button>
    </div>
  );
};
