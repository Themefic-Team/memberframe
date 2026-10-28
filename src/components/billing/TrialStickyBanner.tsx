import React from "react";
import { Crown } from "lucide-react";
import { useLicense } from "../../hooks/useLicense";
import { trialBannerText } from "./billingHelpers";

/**
 * The yellow "Free trial! N days left" bar across the top of the panel, with
 * Upgrade. F19: BEAF's `ffmf-trial-sticky-banner`, counting down to the
 * second on the last day.
 */
export const TrialStickyBanner: React.FC<{ onUpgrade: () => void }> = ({ onUpgrade }) => {
  const { view, now } = useLicense();
  if (view?.state !== "trial" || !view.trialEndsAt) return null;
  const secondsLeft = Math.max(0, (Date.parse(view.trialEndsAt) - now) / 1000);

  return (
    <div className="ffmf-trial-sticky-banner">
      <span>{trialBannerText(secondsLeft)}</span>
      <button type="button" className="ffmf-trial-sticky-upgrade-btn" onClick={onUpgrade}>
        <Crown className="ffmf-crown" aria-hidden={true} />
        Upgrade
      </button>
    </div>
  );
};
