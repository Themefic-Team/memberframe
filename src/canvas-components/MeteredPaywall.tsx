import React, { useEffect, useState } from "react";
import { addPropertyControls, ControlType } from "framer";

export interface MeteredPaywallProps {
  freeArticlesLimit?: number;
  cookieKey?: string;
  paywallTitle?: string;
  ctaText?: string;
  ctaLink?: string;
  children?: React.ReactNode;
}

const METERED_PAYWALL_CSS = `
.mf-metered-pill {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: rgba(24, 24, 27, 0.94);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 9999px;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.4);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  color: #edf0f7;
  z-index: 999;
}

.mf-metered-pill-badge {
  background: rgba(82, 113, 255, 0.2);
  color: #708aff;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
}

.mf-metered-pill-btn {
  background: #5271ff;
  color: #ffffff;
  border: none;
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
}

.mf-metered-locked-card {
  width: 100%;
  padding: 32px 20px;
  background: #201f1f;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  box-sizing: border-box;
}

.mf-metered-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(82, 113, 255, 0.16);
  border: 1px solid rgba(82, 113, 255, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #708aff;
}

.mf-metered-title {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 17px;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
}

.mf-metered-desc {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  color: #a1a1aa;
  max-width: 360px;
  line-height: 1.5;
  margin: 0;
}

.mf-metered-cta {
  background: linear-gradient(180deg, #5271ff 0%, #3b51b8 100%);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 10px 22px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(82, 113, 255, 0.35);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
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

const LockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const BookOpenIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);

const SparklesIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

export default function MeteredPaywall({
  freeArticlesLimit = 3,
  cookieKey = "mf_metered_read_count",
  paywallTitle = "You have reached your free reading limit",
  ctaText = "Subscribe for Unlimited Access",
  ctaLink = "/pricing",
  children,
}: MeteredPaywallProps): React.JSX.Element {
  const [readCount, setReadCount] = useState(1);

  useEffect(() => {
    injectStyles("mf-metered-paywall-styles", METERED_PAYWALL_CSS);

    if (typeof window !== "undefined") {
      const stored = parseInt(localStorage.getItem(cookieKey) || "0", 10);
      const nextCount = stored + 1;
      localStorage.setItem(cookieKey, nextCount.toString());
      setReadCount(nextCount);
    }
  }, [cookieKey]);

  const remaining = Math.max(0, freeArticlesLimit - readCount);
  const isLimitReached = remaining === 0;

  return (
    <>
      {isLimitReached ? (
        <div className="mf-metered-locked-card">
          <div className="mf-metered-icon-wrap">
            <LockIcon />
          </div>
          <h3 className="mf-metered-title">{paywallTitle}</h3>
          <p className="mf-metered-desc">
            You have read all {freeArticlesLimit} free complimentary articles this month. Subscribe
            to continue reading in-depth guides and member stories.
          </p>
          <a href={ctaLink} className="mf-metered-cta">
            <SparklesIcon />
            <span>{ctaText}</span>
            <ArrowRightIcon />
          </a>
        </div>
      ) : (
        <>
          {children}
          <div className="mf-metered-pill">
            <BookOpenIcon />
            <span>
              Free Articles Remaining:{" "}
              <strong className="mf-metered-pill-badge">{remaining}</strong>
            </span>
            <a href={ctaLink} className="mf-metered-pill-btn">
              Upgrade
            </a>
          </div>
        </>
      )}
    </>
  );
}

export { MeteredPaywall };

addPropertyControls(MeteredPaywall, {
  freeArticlesLimit: {
    type: ControlType.Number,
    title: "Monthly Quota",
    min: 1,
    max: 10,
    defaultValue: 3,
  },
  cookieKey: {
    type: ControlType.String,
    title: "Storage Key",
    defaultValue: "mf_metered_read_count",
  },
  paywallTitle: {
    type: ControlType.String,
    title: "Lock Title",
    defaultValue: "You have reached your free reading limit",
  },
  ctaText: {
    type: ControlType.String,
    title: "Button Text",
    defaultValue: "Subscribe for Unlimited Access",
  },
  ctaLink: {
    type: ControlType.String,
    title: "Button Link",
    defaultValue: "/pricing",
  },
  children: {
    type: ControlType.ComponentInstance,
    title: "Page Content",
  },
});
