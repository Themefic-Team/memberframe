import React, { useCallback, useEffect, useRef, useState } from "react";
import { useConnection } from "../../hooks/useConnection";
import { failureMessage } from "../../services/apiClient";
import { accountPageUrl, newSessionId, pollHandoff } from "../../services/connectService";
import { detectTheme } from "./billingHelpers";

const MAX_ATTEMPTS = 60;

const FEATURES = [
  "Get Member Sign In, Sign Up & Dashboard",
  "Get Pricing Tables & Checkout",
  "Get Page, Section & Content Locks",
  "Get Soft Paywall & Protected Downloads",
  "Get Stripe, Lemon Squeezy & Razorpay",
  "Get Free Support",
  "7 Days Free Trial",
];

export interface AuthModalProps {
  isOpen: boolean;
  initialMode?: "register" | "login";
  onClose: () => void;
  /** Called once the panel holds a session and this project is attached. */
  onAuthenticated?: () => void;
}

/**
 * External sign in and the 7-day free trial. F19: a clone of the BEAF plugin's
 * AuthModal, so every Framefic plugin starts the trial the same way.
 *
 * Collects no credential in the plugin iframe: MemberFrame's account page
 * opens in a browser tab with a one-time session id, and this modal polls for
 * the hand-off, then attaches this Framer project, which starts the trial.
 */
export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, initialMode = "register", onClose, onAuthenticated }) => {
  const { signInWithToken } = useConnection();
  const [authMode, setAuthMode] = useState<"register" | "login">(initialMode);
  const [sessionId, setSessionId] = useState("");
  const [hasOpenedWindow, setHasOpenedWindow] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completed = useRef(false);
  const polling = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAuthMode(initialMode);
      completed.current = false;
      setSessionId(newSessionId());
      setTimedOut(false);
      setError(null);
      setHasOpenedWindow(false);
    } else {
      if (polling.current) window.clearInterval(polling.current);
      polling.current = null;
      setSessionId("");
      setHasOpenedWindow(false);
      setError(null);
    }
  }, [isOpen, initialMode]);

  const openAuthWindow = useCallback(() => {
    const id = sessionId || newSessionId();
    setSessionId(id);
    setTimedOut(false);
    setError(null);
    completed.current = false;
    try {
      window.open(accountPageUrl(authMode, id, detectTheme()), "_blank", "noopener,noreferrer");
      setHasOpenedWindow(true);
    } catch {
      setHasOpenedWindow(false);
    }
  }, [authMode, sessionId]);

  // The hand-off poll: every 2 seconds for 2 minutes, and on focus.
  useEffect(() => {
    if (!isOpen || !sessionId || !hasOpenedWindow) return;
    let attempts = 0;
    let errors = 0;
    let busy = false;

    const check = async () => {
      if (completed.current || busy) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      busy = true;
      const result = await pollHandoff(sessionId);
      busy = false;
      if (result.kind !== "ok") {
        errors += 1;
        if (errors >= 6 && polling.current) window.clearInterval(polling.current);
        return;
      }
      errors = 0;
      if (result.data.status !== "ready" || completed.current) return;
      completed.current = true;
      if (polling.current) window.clearInterval(polling.current);
      const problem = await signInWithToken(result.data.token, result.data.creator);
      if (problem) {
        setError(failureMessage(problem).message);
        return;
      }
      onAuthenticated?.();
      onClose();
    };

    const onFocus = () => {
      if (!completed.current && document.visibilityState === "visible") void check();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const first = window.setTimeout(() => void check(), 500);
    polling.current = window.setInterval(() => {
      attempts += 1;
      if (attempts >= MAX_ATTEMPTS) {
        if (polling.current) window.clearInterval(polling.current);
        setTimedOut(true);
        return;
      }
      void check();
    }, 2000);

    return () => {
      window.clearTimeout(first);
      if (polling.current) window.clearInterval(polling.current);
      polling.current = null;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [hasOpenedWindow, isOpen, onAuthenticated, onClose, sessionId, signInWithToken]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const switchMode = (next: "register" | "login") => {
    setAuthMode(next);
    setHasOpenedWindow(false);
    setTimedOut(false);
    setError(null);
  };

  if (!isOpen) return null;
  const isRegister = authMode === "register";

  return (
    <div className="beaf-auth-overlay" onClick={onClose}>
      <div className="beaf-auth-panel beaf-external-auth-panel" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <button type="button" className="beaf-auth-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div className="beaf-external-auth-icon-wrap">
          <div className="beaf-external-auth-icon">
            <img src="/memberframe-icon.svg" width="44" height="44" alt="MemberFrame" className="beaf-external-favicon-img" />
          </div>
          <div className="beaf-external-auth-pulse-ring" />
        </div>

        <div className="beaf-auth-header">
          <h3>{isRegister ? "You Get 7-Day Free Trial" : "Sign In to Framefic"}</h3>
          <p className="beaf-auth-header-sub">
            {isRegister
              ? "This plugin is full PRO. Start your 7-day free trial to unlock every membership feature."
              : "Sign in to reconnect your account and restore your active subscription."}
          </p>
        </div>

        {isRegister ? (
          <div className="beaf-external-auth-features">
            {FEATURES.map((feature) => (
              <div key={feature} className="beaf-external-feature-item">
                <span className="beaf-external-feature-check">✓</span>
                <span>{feature}</span>
              </div>
            ))}
          </div>
        ) : null}

        {hasOpenedWindow ? (
          <div className="beaf-external-auth-status-card">
            <div className="beaf-external-spinner-row">
              <div className="beaf-social-spinner" />
              <span className="beaf-external-status-text">Waiting for browser completion...</span>
            </div>
            <p className="beaf-external-status-hint">
              Complete your sign-up in the opened browser tab. Your plugin will automatically connect once finished.
            </p>
          </div>
        ) : null}

        {error ? <div className="beaf-auth-error">{error}</div> : null}

        {timedOut ? (
          <div className="beaf-external-timeout-banner">
            <p>Authentication window timed out. Click below to reopen.</p>
          </div>
        ) : null}

        <div className="beaf-external-action-stack">
          <button type="button" className="beaf-auth-submit-btn" onClick={openAuthWindow}>
            {hasOpenedWindow ? "Re-open Browser Window" : isRegister ? "Start 7-Day Free Trial" : "Sign In with Browser"}
          </button>
          <button type="button" className="beaf-external-cancel-btn" onClick={onClose}>
            Cancel
          </button>
        </div>

        <div className="beaf-auth-footer">
          <p>
            {isRegister ? (
              <>
                Already have an account?{" "}
                <button type="button" className="beaf-auth-link-btn" onClick={() => switchMode("login")}>
                  Sign in
                </button>
              </>
            ) : (
              <>
                Don&apos;t have an account?{" "}
                <button type="button" className="beaf-auth-link-btn" onClick={() => switchMode("register")}>
                  Start 7-day free trial
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};
