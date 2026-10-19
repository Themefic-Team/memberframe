import React from "react";

export type TrialModalStatus = "started" | "expired" | "plan_ended" | "trial_claimed_other_site";

export interface TrialStatusModalProps {
  status: TrialModalStatus | null;
  claimedProjectName?: string | null;
  onClose: () => void;
  onUpgrade: () => void;
  onLogout: () => void;
}

const CHECK = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

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
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
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
                <span>
                  ⭐ Upgrade to PRO anytime to keep <strong>everything running</strong> and remove the watermark.
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
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
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
