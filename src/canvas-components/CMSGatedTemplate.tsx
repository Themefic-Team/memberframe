import React, { useEffect } from "react";
import { addPropertyControls, ControlType } from "framer";

export interface CMSGatedTemplateProps {
  isGatedField?: boolean;
  requiredTier?: "free" | "silver" | "gold" | "vip";
  paywallTitle?: string;
  paywallDescription?: string;
  ctaText?: string;
  ctaLink?: string;
  children?: React.ReactNode;
}

const CMS_GATED_CSS = `
.mf-cms-gate-wrapper {
  position: relative;
  width: 100%;
}

.mf-cms-excerpt-fade {
  position: relative;
  overflow: hidden;
  max-height: 280px;
}

.mf-cms-excerpt-fade::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 120px;
  background: linear-gradient(180deg, rgba(32, 31, 31, 0) 0%, rgba(32, 31, 31, 1) 100%);
  pointer-events: none;
}

.mf-cms-lock-banner {
  margin-top: 16px;
  padding: 24px;
  background: #201f1f;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
}

.mf-cms-icon-box {
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

.mf-cms-lock-title {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 16px;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
}

.mf-cms-lock-desc {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  color: #95a3b2;
  max-width: 380px;
  margin: 0;
  line-height: 1.5;
}

.mf-cms-cta-btn {
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

const FileTextIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M10 9H8" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
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

export default function CMSGatedTemplate({
  isGatedField = true,
  requiredTier = "silver",
  paywallTitle = "This Article Is Exclusive to Members",
  paywallDescription = "The author has marked this complete post as member-only. Upgrade your plan to read the full case study.",
  ctaText = "Unlock Full Article",
  ctaLink = "/pricing",
  children,
}: CMSGatedTemplateProps): React.JSX.Element {
  useEffect(() => {
    injectStyles("mf-cms-gated-styles", CMS_GATED_CSS);
  }, []);

  const isSubscriber =
    typeof window !== "undefined"
      ? Boolean(localStorage.getItem("memberframe_session_token"))
      : false;

  if (!isGatedField || isSubscriber) {
    return <div className="mf-cms-gate-wrapper">{children}</div>;
  }

  return (
    <div className="mf-cms-gate-wrapper">
      <div className="mf-cms-excerpt-fade">{children}</div>

      <div className="mf-cms-lock-banner">
        <div className="mf-cms-icon-box">
          <FileTextIcon />
        </div>
        <h3 className="mf-cms-lock-title">{paywallTitle}</h3>
        <p className="mf-cms-lock-desc">{paywallDescription}</p>
        <a href={ctaLink} className="mf-cms-cta-btn">
          <SparklesIcon />
          <span>{ctaText}</span>
          <ArrowRightIcon />
        </a>
      </div>
    </div>
  );
}

export { CMSGatedTemplate };

addPropertyControls(CMSGatedTemplate, {
  isGatedField: {
    type: ControlType.Boolean,
    title: "Gate This Item",
    defaultValue: true,
  },
  requiredTier: {
    type: ControlType.Enum,
    title: "Required Tier",
    options: ["free", "silver", "gold", "vip"],
    optionTitles: ["Free Member", "Silver Tier", "Gold Tier", "VIP Tier"],
    defaultValue: "silver",
  },
  paywallTitle: {
    type: ControlType.String,
    title: "Banner Title",
    defaultValue: "This Article Is Exclusive to Members",
  },
  paywallDescription: {
    type: ControlType.String,
    title: "Banner Description",
    defaultValue:
      "The author has marked this complete post as member-only. Upgrade your plan to read the full case study.",
  },
  ctaText: {
    type: ControlType.String,
    title: "Button Text",
    defaultValue: "Unlock Full Article",
  },
  ctaLink: {
    type: ControlType.String,
    title: "Button Link",
    defaultValue: "/pricing",
  },
  children: {
    type: ControlType.ComponentInstance,
    title: "CMS Post Body",
  },
});
