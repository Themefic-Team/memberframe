import React, { useState, useEffect } from "react";
import { addPropertyControls, ControlType } from "framer";

export interface MemberAuthProps {
  title?: string;
  subtitle?: string;
  enableGoogleSso?: boolean;
  buttonText?: string;
  redirectOnSuccess?: string;
}

const MEMBER_AUTH_CSS = `
.mf-auth-card {
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
  padding: 28px 24px;
  background: #201f1f;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.4);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #ffffff;
  box-sizing: border-box;
}

.mf-auth-header {
  text-align: center;
  margin-bottom: 22px;
}

.mf-auth-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 6px 0;
  color: #ffffff;
}

.mf-auth-subtitle {
  font-size: 13px;
  color: #95a3b2;
  margin: 0;
  line-height: 1.4;
}

.mf-auth-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.mf-auth-input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mf-auth-label {
  font-size: 12px;
  font-weight: 500;
  color: #edf0f7;
}

.mf-auth-input {
  height: 40px;
  padding: 0 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: #ffffff;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
  width: 100%;
  transition: border-color 150ms ease;
}

.mf-auth-input:focus {
  border-color: #5271ff;
  box-shadow: 0 0 0 3px rgba(82, 113, 255, 0.25);
}

.mf-auth-btn-submit {
  height: 42px;
  background: linear-gradient(180deg, #5271ff 0%, #3b51b8 100%);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-decoration: none;
  box-sizing: border-box;
  transition: opacity 150ms ease, transform 150ms ease;
}

.mf-auth-btn-submit:hover {
  opacity: 0.95;
  transform: translateY(-1px);
}

.mf-auth-btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.mf-auth-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
  color: #6f7b87;
  font-size: 11px;
  text-transform: uppercase;
}

.mf-auth-divider::before,
.mf-auth-divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
}

.mf-auth-btn-google {
  height: 40px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: #ffffff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition: background 150ms ease;
}

.mf-auth-btn-google:hover {
  background: rgba(255, 255, 255, 0.1);
}

.mf-auth-otp-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.mf-auth-otp-digit {
  width: 44px;
  height: 52px;
  text-align: center;
  font-size: 20px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  color: #ffffff;
  box-sizing: border-box;
}

.mf-auth-otp-digit:focus {
  border-color: #5271ff;
  box-shadow: 0 0 0 3px rgba(82, 113, 255, 0.25);
}

.mf-auth-success-icon {
  margin: 0 auto 12px auto;
  color: #34d399;
}
`;

function injectStyles(id: string, cssText: string): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(id)) return;
  const styleEl = document.createElement("style");
  styleEl.id = id;
  styleEl.textContent = cssText;
  document.head.appendChild(styleEl);
}

// Inlined standalone SVGs for 100% dependency-free Framer canvas rendering
const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const KeyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" />
    <path d="m21 2-9.6 9.6" />
    <circle cx="7.5" cy="15.5" r="5.5" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mf-auth-success-icon">
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export default function MemberAuth({
  title = "Welcome to Member Portal",
  subtitle = "Enter your email to receive a secure 6-digit sign-in code.",
  enableGoogleSso = true,
  buttonText = "Send Access Code",
  redirectOnSuccess = "/members",
}: MemberAuthProps): React.JSX.Element {
  const [step, setStep] = useState<"email" | "otp" | "success">("email");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    injectStyles("mf-member-auth-styles", MEMBER_AUTH_CSS);
  }, []);

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep("otp");
    }, 800);
  };

  const handleOtpChange = (index: number, val: string) => {
    if (val.length > 1) return;
    const newOtp = [...otpCode];
    newOtp[index] = val;
    setOtpCode(newOtp);

    // If 6 digits filled, verify
    if (newOtp.every((d) => d.length === 1)) {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        setStep("success");
        if (typeof window !== "undefined") {
          localStorage.setItem("memberframe_session_token", "mf_jwt_active_session");
        }
      }, 1000);
    }
  };

  return (
    <div className="mf-auth-card">
      <div className="mf-auth-header">
        <h3 className="mf-auth-title">{title}</h3>
        <p className="mf-auth-subtitle">{subtitle}</p>
      </div>

      {step === "email" && (
        <form onSubmit={handleSendOtp} className="mf-auth-form">
          <div className="mf-auth-input-group">
            <label htmlFor="mf-auth-email" className="mf-auth-label">
              Email Address
            </label>
            <input
              id="mf-auth-email"
              type="email"
              className="mf-auth-input"
              placeholder="you@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="mf-auth-btn-submit" disabled={loading}>
            <MailIcon />
            <span>{loading ? "Sending Code..." : buttonText}</span>
            <ArrowRightIcon />
          </button>

          {enableGoogleSso && (
            <>
              <div className="mf-auth-divider">Or continue with</div>
              <button
                type="button"
                className="mf-auth-btn-google"
                onClick={() => setStep("success")}
              >
                <ShieldIcon />
                <span>Continue with Google</span>
              </button>
            </>
          )}
        </form>
      )}

      {step === "otp" && (
        <div className="mf-auth-form">
          <div className="mf-auth-input-group">
            <label className="mf-auth-label">Enter 6-Digit Code Sent to {email}</label>
            <div className="mf-auth-otp-row">
              {otpCode.map((digit, idx) => (
                <input
                  key={idx}
                  type="text"
                  maxLength={1}
                  className="mf-auth-otp-digit"
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  autoFocus={idx === 0}
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            className="mf-auth-btn-submit"
            onClick={() => setStep("email")}
          >
            <KeyIcon />
            <span>Change Email</span>
          </button>
        </div>
      )}

      {step === "success" && (
        <div className="mf-auth-form">
          <div className="mf-auth-header">
            <CheckCircleIcon />
            <h3 className="mf-auth-title">Authentication Verified</h3>
            <p className="mf-auth-subtitle">Welcome back! Redirecting to members portal...</p>
          </div>
          <a href={redirectOnSuccess} className="mf-auth-btn-submit">
            <span>Continue to Content</span>
            <ArrowRightIcon />
          </a>
        </div>
      )}
    </div>
  );
}

export { MemberAuth };

addPropertyControls(MemberAuth, {
  title: {
    type: ControlType.String,
    title: "Card Title",
    defaultValue: "Welcome to Member Portal",
  },
  subtitle: {
    type: ControlType.String,
    title: "Card Subtitle",
    defaultValue: "Enter your email to receive a secure 6-digit sign-in code.",
  },
  enableGoogleSso: {
    type: ControlType.Boolean,
    title: "Google SSO",
    defaultValue: true,
  },
  buttonText: {
    type: ControlType.String,
    title: "Button Text",
    defaultValue: "Send Access Code",
  },
  redirectOnSuccess: {
    type: ControlType.String,
    title: "Success Redirect",
    defaultValue: "/members",
  },
});
