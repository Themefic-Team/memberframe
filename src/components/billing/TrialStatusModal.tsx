import React from "react";
import { Check, Lock, Star } from "lucide-react";

export type TrialModalStatus = "started" | "expired" | "plan_ended" | "trial_claimed_other_site";

export interface TrialStatusModalProps {
  status: TrialModalStatus | null;
  claimedProjectName?: string | null;
  onClose: () => void;
  onUpgrade: () => void;
  onLogout: () => void;
}

const CHECK = <Check aria-hidden={true} />;

const PERKS = [
  { title: "Every Membership Component", text: "Sign in, sign up, dashboard, pricing, paywalls, downloads and bookmarks" },
  { title: "All Pro Settings & Payments", text: "Tiers, Stripe, Lemon Squeezy, Razorpay, page and section locks" },
  { title: "Explore Framefic Plugin", text: "Experience live responsive design and smooth Framer canvas previews" },
];

/**
 * "You're all set!" after the trial starts, and the lock when it or a plan has
 * ended. F19: a clone of the BEAF plugin's TrialStatusModal. The locked kinds
 * cannot be dismissed: Upgrade and Log out are the only ways out, as in BEAF.
 */
export const TrialStatusModal: React.FC<TrialStatusModalProps> = ({ status, claimedProjectName, onClose, onUpgrade, onLogout }) => {
  if (!status) return null;
  const started = status === "started";
  const claimed = status === "trial_claimed_other_site";

  return (
    <div className="beaf-trial-status-overlay" onClick={started ? onClose : undefined}>
      <div className="beaf-trial-status-panel" onClick={(event) => event.stopPropagation()}>
        <div className="beaf-trial-status-header" />
        <div className="beaf-trial-status-content">
          {started ? (
            <>
              <div className="beaf-trial-status-icon-bubble beaf-trial-status-icon-bubble--success">
                <Check aria-hidden={true} />
              </div>
              <h3>You&apos;re all set!</h3>
              <p className="beaf-trial-status-description">Your 7-day free trial has started. Here is what is included:</p>
              <div className="beaf-trial-perks-container">
                {PERKS.map((perk) => (
                  <div key={perk.title} className="beaf-trial-perk-row">
                    <div className="beaf-trial-perk-bullet">{CHECK}</div>
                    <div className="beaf-trial-perk-detail">
                      <strong>{perk.title}</strong>
                      <span>{perk.text}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="beaf-trial-upgrade-callout">
                <Star className="beaf-trial-upgrade-star" aria-hidden={true} />
                <span>
                  Upgrade to PRO anytime to keep <strong>everything running</strong> and remove the watermark.
                </span>
              </div>
              <button type="button" className="beaf-trial-status-btn" onClick={onClose}>
                Start Exploring
              </button>
              <span className="beaf-trial-status-footnote">7-day free trial · No credit card required</span>
            </>
          ) : (
            <>
              <div className="beaf-trial-status-icon-bubble beaf-trial-status-icon-bubble--locked">
                <Lock aria-hidden={true} />
              </div>
              <h3>{claimed ? "Trial Already Claimed" : status === "plan_ended" ? "Your plan has ended" : "Your trial has ended"}</h3>
              <p className="beaf-trial-status-description">
                {claimed
                  ? `Your 7-day free trial was already claimed for another Framer project${claimedProjectName ? ` (${claimedProjectName})` : ""}. A Framer account includes 1 free trial site. Upgrade to PRO to activate on this site.`
                  : "Upgrade now to keep using. Your members and settings are saved and waiting"}
              </p>
              <button type="button" className="beaf-trial-status-btn" onClick={onUpgrade}>
                {claimed ? "Upgrade to PRO" : "Upgrade Now"}
              </button>
              <button type="button" className="beaf-trial-status-logout-link" onClick={onLogout}>
                Log out
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
