import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, Crown, Globe, LogOut, Mail, User } from "lucide-react";
import { useConnection } from "../../hooks/useConnection";
import { useLicense } from "../../hooks/useLicense";
import { failureMessage } from "../../services/apiClient";
import { addAllowedOrigins } from "../../services/siteSettingsService";
import { describeOrigin, looksLikeOrigin } from "../connect/connectValidation";
import { getPlanName, getStatusLabel, notify } from "./billingHelpers";
import { startTrial } from "../../services/licenseService";

export interface ProfilePageProps {
  onManageSubscription: () => void;
  onSignUp: () => void;
  onSignIn: () => void;
}

const USER_ICON = <User className="beaf-profile-field-icon" aria-hidden={true} />;
const MAIL_ICON = <Mail className="beaf-profile-field-icon" aria-hidden={true} />;
const GLOBE_ICON = <Globe className="beaf-profile-field-icon" aria-hidden={true} />;

/**
 * Profile, behind the account icon. F19: a clone of the BEAF plugin's
 * ProfilePage (avatar ring and PRO or TRIAL badge, Plan Type, Personal Info,
 * Sign Out), plus this project's site key and allowed domains, which a
 * MemberFrame site needs and BEAF does not have.
 */
export const ProfilePage: React.FC<ProfilePageProps> = ({ onManageSubscription, onSignUp, onSignIn }) => {
  const { state, applyConnection, disconnect } = useConnection();
  const { view, apply } = useLicense();
  const [avatarError, setAvatarError] = useState(false);
  const [isStartingTrial, setIsStartingTrial] = useState(false);
  const [newOrigin, setNewOrigin] = useState("");
  const [originProblem, setOriginProblem] = useState<string | null>(null);
  const [savingOrigin, setSavingOrigin] = useState(false);

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

  const addOrigin = useCallback(async () => {
    if (!connection) return;
    if (!looksLikeOrigin(newOrigin)) {
      setOriginProblem("Enter the full address, including https://.");
      return;
    }
    setSavingOrigin(true);
    setOriginProblem(null);
    const result = await addAllowedOrigins(connection.siteId, [newOrigin.trim()]);
    setSavingOrigin(false);
    if (result.kind === "ok") {
      await applyConnection({ ...connection, allowedOrigins: result.data.allowedOrigins });
      setNewOrigin("");
      void notify({ type: "Success", message: "Domain allowed" });
      return;
    }
    setOriginProblem(failureMessage(result).message);
  }, [applyConnection, connection, newOrigin]);

  if (!connection) {
    return (
      <div className="beaf-profile-page">
        <div className="beaf-profile-header">
          <h3>Profile</h3>
        </div>
        <div className="beaf-profile-auth-section">
          <div className="beaf-profile-auth-buttons">
            <button type="button" className="beaf-profile-auth-btn beaf-profile-primary-button" onClick={onSignUp}>
              Sign Up
            </button>
            <button type="button" className="beaf-profile-auth-btn beaf-profile-primary-button" onClick={onSignIn}>
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
    <div className="beaf-profile-page">
      <div className="beaf-profile-header">
        <h3>Profile</h3>
      </div>

      <div className="beaf-profile-hero">
        <div className="beaf-profile-avatar-container">
          {isProUser || isTrialUser ? (
            <svg className="beaf-avatar-segmented-ring" viewBox="0 0 100 100" shapeRendering="geometricPrecision">
              <defs>
                <linearGradient id="beaf-pro-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#5271FF" />
                  <stop offset="50%" stopColor="#708AFF" />
                  <stop offset="100%" stopColor="#3B58FF" />
                </linearGradient>
                <linearGradient id="beaf-trial-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
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
                stroke={isProUser ? "url(#beaf-pro-ring-grad)" : "url(#beaf-trial-ring-grad)"}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="60 8"
                transform="rotate(-60 50 50)"
              />
            </svg>
          ) : null}

          <div className="beaf-profile-avatar-circle">
            {connection.creatorAvatarUrl && !avatarError ? (
              <img src={connection.creatorAvatarUrl} alt={displayName} referrerPolicy="no-referrer" onError={() => setAvatarError(true)} />
            ) : (
              avatarInitials
            )}
          </div>

          {isProUser ? (
            <div className="beaf-avatar-badge beaf-avatar-badge--pro" title="Pro Member">
              <Crown fill="currentColor" aria-hidden={true} />
              <span>PRO</span>
            </div>
          ) : isTrialUser ? (
            <div className="beaf-avatar-badge beaf-avatar-badge--trial" title="7-Day Free Trial Active">
              <Clock aria-hidden={true} />
              <span>TRIAL</span>
            </div>
          ) : null}
        </div>
        <div className="beaf-profile-identity">
          <div className="beaf-profile-name">{displayName}</div>
          <div className="beaf-profile-email">{displayEmail}</div>
        </div>
      </div>

      <div className="beaf-profile-plan-card">
        <div className="beaf-profile-plan-top">
          <div className="beaf-profile-plan-info">
            <span className="beaf-profile-plan-label">Plan Type</span>
            <span className="beaf-profile-plan-name">{planName}</span>
          </div>
          <span className={`beaf-profile-plan-status beaf-profile-plan-status--${hasSubscription ? "active" : "inactive"}`}>{statusLabel}</span>
        </div>
        <div className="beaf-profile-plan-divider" />
        <button type="button" className="beaf-profile-primary-button" onClick={onManageSubscription}>
          Manage Subscription
        </button>
      </div>

      {/* No card until the license is known: a failed read is not a used trial. */}
      {view && !hasSubscription ? (
        <div className="beaf-profile-trial-card">
          <h4 className="beaf-profile-trial-title">Try Pro Free for 7 Days</h4>
          <p className="beaf-profile-trial-desc">
            {view?.state === "trial_claimed_other_site"
              ? `Your free trial is running on ${view.claimedProjectName ?? "another project"}. Upgrade to activate this project.`
              : "Unlock every membership component, payments, and content locks. No credit card required."}
          </p>
          {view.state === "none" ? (
            // BEAF: eligible, so offer it. Attaching a project normally starts
            // the trial already; this covers one attached without it.
            <button
              type="button"
              className="beaf-profile-trial-btn beaf-primary-cta"
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
            <button type="button" disabled className="beaf-profile-trial-btn-claimed">
              Trial already claimed
            </button>
          )}
        </div>
      ) : null}

      <div className="beaf-profile-section">
        <h4 className="beaf-profile-section-title">Personal Info</h4>
        <div className="beaf-profile-fields-card">
          <div className="beaf-profile-field">
            <label>Name</label>
            <div className="beaf-profile-input-wrapper">
              {USER_ICON}
              <input type="text" value={displayName} readOnly />
            </div>
          </div>
          <div className="beaf-profile-field">
            <label>Email</label>
            <div className="beaf-profile-input-wrapper">
              {MAIL_ICON}
              <input type="email" value={displayEmail} readOnly />
            </div>
          </div>
        </div>
      </div>

      <div className="beaf-profile-section beaf-profile-project">
        <h4 className="beaf-profile-section-title">This Project</h4>
        <div className="beaf-profile-fields-card">
          <div className="beaf-profile-field">
            <label>Site Key</label>
            <div className="beaf-profile-input-wrapper">
              <input type="text" value={connection.siteKey} readOnly />
            </div>
          </div>
          <div className="beaf-profile-field">
            <label>Allowed Domains</label>
            {connection.allowedOrigins.length === 0 ? (
              <p className="beaf-profile-hint">No domain yet. Publish the site, then reopen the plugin, or add one below.</p>
            ) : (
              <ul className="beaf-profile-domain-list">
                {connection.allowedOrigins.map((origin) => (
                  <li key={origin}>{describeOrigin(origin)}</li>
                ))}
              </ul>
            )}
            <div className="beaf-profile-input-wrapper">
              {GLOBE_ICON}
              <input
                type="url"
                value={newOrigin}
                placeholder="https://yoursite.com"
                onChange={(event) => {
                  setNewOrigin(event.target.value);
                  setOriginProblem(null);
                }}
              />
            </div>
            {originProblem ? <p className="beaf-profile-error">{originProblem}</p> : null}
            <button type="button" className="beaf-profile-primary-button" disabled={savingOrigin || newOrigin.trim() === ""} onClick={() => void addOrigin()}>
              {savingOrigin ? "Adding..." : "Add Domain"}
            </button>
          </div>
        </div>
      </div>

      <div className="beaf-profile-logout-wrap">
        <button
          type="button"
          className="beaf-profile-logout-btn"
          onClick={() => {
            void disconnect().then(() => notify({ type: "Success", message: "Signed out" }));
          }}
        >
          Sign Out
          <LogOut className="beaf-logout-icon" aria-hidden={true} />
        </button>
      </div>
    </div>
  );
};
