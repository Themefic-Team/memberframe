import React, { useEffect, useMemo, useState } from "react";
import { Clock, Crown, LogOut, Mail, User } from "lucide-react";
import { useConnection } from "../../hooks/useConnection";
import { useLicense } from "../../hooks/useLicense";
import { getPlanName, getStatusLabel, notify } from "./billingHelpers";
import { startTrial } from "../../services/licenseService";
import { failureMessage } from "../../services/apiClient";
import { BRANDING } from "../../config/branding";

export interface ProfilePageProps {
  onManageSubscription: () => void;
  onSignUp: () => void;
  onSignIn: () => void;
}

const USER_ICON = <User className="ffmf-profile-field-icon" aria-hidden={true} />;
const MAIL_ICON = <Mail className="ffmf-profile-field-icon" aria-hidden={true} />;

/**
 * Profile, behind the account icon. F19: a clone of the BEAF plugin's
 * ProfilePage (avatar ring and PRO or TRIAL badge, Plan Type, Personal Info,
 * Sign Out), and nothing more: the site key is internal, and the allowed
 * domains are kept by the plugin itself from Framer's publish info
 * (`syncPublishedOrigins` in useSealGuard), so the page shows neither.
 */
export const ProfilePage: React.FC<ProfilePageProps> = ({ onManageSubscription, onSignUp, onSignIn }) => {
  const { state, disconnect, linkable, linkProject } = useConnection();
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const { view, apply } = useLicense();
  const [avatarError, setAvatarError] = useState(false);
  const [isStartingTrial, setIsStartingTrial] = useState(false);

  const connection = state.status === "connected" ? state.connection : null;
  const displayName = connection?.creatorName || "User";
  const displayEmail = connection?.creatorEmail || "-";

  useEffect(() => setAvatarError(false), [connection?.creatorAvatarUrl]);

  const avatarInitials = useMemo(() => {
    const parts = displayName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "U";
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  }, [displayName]);

  if (!connection) {
    return (
      <div className="ffmf-profile-page">
        <div className="ffmf-profile-header">
          <h3>Profile</h3>
        </div>
        {linkable ? (
          // Signed in on this browser, project not linked yet (Marketplace
          // audit I1): nothing is sent until this click, under the consent line.
          <div className="ffmf-profile-auth-section">
            <p className="ffmf-auth-consent">
              By continuing, you agree to create an account to activate your trial and manage your license.{" "}
              <a href={BRANDING.privacyUrl} target="_blank" rel="noopener noreferrer">
                Privacy
              </a>
            </p>
            <div className="ffmf-profile-auth-buttons">
              <button
                type="button"
                className="ffmf-profile-auth-btn ffmf-profile-primary-button"
                disabled={linking}
                onClick={() => {
                  setLinking(true);
                  setLinkError(null);
                  void linkProject().then((problem) => {
                    setLinking(false);
                    if (problem) setLinkError(failureMessage(problem).message);
                  });
                }}
              >
                {linking ? "Linking..." : "Link This Project"}
              </button>
            </div>
            {linkError ? <div className="ffmf-auth-error">{linkError}</div> : null}
          </div>
        ) : null}
        <div className="ffmf-profile-auth-section">
          <div className="ffmf-profile-auth-buttons">
            <button type="button" className="ffmf-profile-auth-btn ffmf-profile-primary-button" onClick={onSignUp}>
              Sign Up
            </button>
            <button type="button" className="ffmf-profile-auth-btn ffmf-profile-primary-button" onClick={onSignIn}>
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isProUser = view?.state === "active";
  const isTrialUser = view?.state === "trial";
  const hasSubscription = isProUser || isTrialUser;
  const planName = getPlanName(view?.plan ?? null);
  const statusLabel = getStatusLabel(view?.status ?? null, hasSubscription);

  return (
    <div className="ffmf-profile-page">
      <div className="ffmf-profile-header">
        <h3>Profile</h3>
      </div>

      <div className="ffmf-profile-hero">
        <div className="ffmf-profile-avatar-container">
          {isProUser || isTrialUser ? (
            <svg className="ffmf-avatar-segmented-ring" viewBox="0 0 100 100" shapeRendering="geometricPrecision">
              <defs>
                <linearGradient id="ffmf-pro-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#5271FF" />
                  <stop offset="50%" stopColor="#708AFF" />
                  <stop offset="100%" stopColor="#3B58FF" />
                </linearGradient>
                <linearGradient id="ffmf-trial-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#d1a918ff" />
                  <stop offset="50%" stopColor="#a07801ff" />
                  <stop offset="100%" stopColor="#ebce2bff" />
                </linearGradient>
              </defs>
              <circle
                cx="50"
                cy="50"
                r="43"
                fill="none"
                stroke={isProUser ? "url(#ffmf-pro-ring-grad)" : "url(#ffmf-trial-ring-grad)"}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="60 8"
                transform="rotate(-60 50 50)"
              />
            </svg>
          ) : null}

          <div className="ffmf-profile-avatar-circle">
            {connection.creatorAvatarUrl && !avatarError ? (
              <img src={connection.creatorAvatarUrl} alt={displayName} referrerPolicy="no-referrer" onError={() => setAvatarError(true)} />
            ) : (
              avatarInitials
            )}
          </div>

          {isProUser ? (
            <div className="ffmf-avatar-badge ffmf-avatar-badge--pro" title="Pro Member">
              <Crown fill="currentColor" aria-hidden={true} />
              <span>PRO</span>
            </div>
          ) : isTrialUser ? (
            <div className="ffmf-avatar-badge ffmf-avatar-badge--trial" title="7-Day Free Trial Active">
              <Clock aria-hidden={true} />
              <span>TRIAL</span>
            </div>
          ) : null}
        </div>
        <div className="ffmf-profile-identity">
          <div className="ffmf-profile-name">{displayName}</div>
          <div className="ffmf-profile-email">{displayEmail}</div>
        </div>
      </div>

      <div className="ffmf-profile-plan-card">
        <div className="ffmf-profile-plan-top">
          <div className="ffmf-profile-plan-info">
            <span className="ffmf-profile-plan-label">Plan Type</span>
            <span className="ffmf-profile-plan-name">{planName}</span>
          </div>
          <span className={`ffmf-profile-plan-status ffmf-profile-plan-status--${hasSubscription ? "active" : "inactive"}`}>{statusLabel}</span>
        </div>
        <div className="ffmf-profile-plan-divider" />
        <button type="button" className="ffmf-profile-primary-button" onClick={onManageSubscription}>
          Manage Subscription
        </button>
      </div>

      {/* No card until the license is known: a failed read is not a used trial. */}
      {view && !hasSubscription ? (
        <div className="ffmf-profile-trial-card">
          <h4 className="ffmf-profile-trial-title">Try Pro Free for 7 Days</h4>
          <p className="ffmf-profile-trial-desc">
            {view?.state === "trial_claimed_other_site"
              ? `Your free trial is running on ${view.claimedProjectName ?? "another project"}. Upgrade to activate this project.`
              : "Unlock every membership component, payments, and content locks. No credit card required."}
          </p>
          {view.state === "none" ? (
            // BEAF: eligible, so offer it. Attaching a project normally starts
            // the trial already; this covers one attached without it.
            <button
              type="button"
              className="ffmf-profile-trial-btn ffmf-primary-cta"
              disabled={isStartingTrial || !connection}
              onClick={() => {
                if (!connection) return;
                setIsStartingTrial(true);
                void startTrial(connection.siteId).then((result) => {
                  setIsStartingTrial(false);
                  if (result.kind !== "ok") {
                    void notify({ type: "Error", message: "Could not start the trial. Try again." });
                    return;
                  }
                  apply(result.data.license);
                  void notify(
                    result.data.started
                      ? { type: "Success", message: "Your 7-day free trial has started." }
                      : { type: "Error", message: "This account, Framer user, or project already had a trial." }
                  );
                });
              }}
            >
              {isStartingTrial ? "Activating..." : "Start Free Trial"}
            </button>
          ) : (
            <button type="button" disabled className="ffmf-profile-trial-btn-claimed">
              Trial already claimed
            </button>
          )}
        </div>
      ) : null}

      <div className="ffmf-profile-section">
        <h4 className="ffmf-profile-section-title">Personal Info</h4>
        <div className="ffmf-profile-fields-card">
          <div className="ffmf-profile-field">
            <label>Name</label>
            <div className="ffmf-profile-input-wrapper">
              {USER_ICON}
              <input type="text" value={displayName} readOnly />
            </div>
          </div>
          <div className="ffmf-profile-field">
            <label>Email</label>
            <div className="ffmf-profile-input-wrapper">
              {MAIL_ICON}
              <input type="email" value={displayEmail} readOnly />
            </div>
          </div>
        </div>
      </div>

      <div className="ffmf-profile-logout-wrap">
        <button
          type="button"
          className="ffmf-profile-logout-btn"
          onClick={() => {
            void disconnect().then(() => notify({ type: "Success", message: "Signed out" }));
          }}
        >
          Sign Out
          <LogOut className="ffmf-logout-icon" aria-hidden={true} />
        </button>
      </div>
    </div>
  );
};
