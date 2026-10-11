import React, { useEffect, useRef, useState } from "react";
import { addPropertyControls, ControlType } from "framer";

export type AllowedTier = "all_paid" | "silver" | "gold" | "vip" | "free";
export type FallbackMode = "blur" | "hidden" | "redirect";

export interface MemberGateProps {
  children?: React.ReactNode;
  allowedTier?: AllowedTier;
  fallbackMode?: FallbackMode;
  blurAmount?: number;
  lockTitle?: string;
  lockDescription?: string;
  ctaText?: string;
  redirectUrl?: string;
  simulateState?: "auto" | "locked" | "unlocked";
}

const MEMBER_GATE_CSS = `
.mf-gate-container,
.memberframe-gate-container {
  position: relative;
  width: 100%;
  min-height: 120px;
  box-sizing: border-box;
}

.mf-gate-content {
  width: 100%;
  transition: filter 200ms ease, opacity 200ms ease;
}

.mf-gate-content--locked-blur,
.memberframe-blur-overlay {
  filter: blur(var(--mf-blur-radius, 8px));
  user-select: none;
  pointer-events: none;
  opacity: 0.6;
}

.mf-gate-content--locked-hidden {
  display: none !important;
}

.mf-gate-overlay,
.memberframe-lock-card {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  background: rgba(18, 18, 18, 0.82);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  text-align: center;
  z-index: 10;
  box-sizing: border-box;
}

.mf-gate-overlay__icon {
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

.mf-gate-overlay__title {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 17px;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
}

.mf-gate-overlay__desc {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  color: #a1a1aa;
  max-width: 340px;
  line-height: 1.5;
  margin: 0;
}

.mf-gate-overlay__cta {
  background: linear-gradient(180deg, #5271ff 0%, #3b51b8 100%);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 10px 22px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(82, 113, 255, 0.35);
  transition: transform 150ms ease, box-shadow 150ms ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
}

.mf-gate-overlay__cta:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(82, 113, 255, 0.45);
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
const LockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
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

export default function MemberGate({
  children,
  allowedTier = "all_paid",
  fallbackMode = "blur",
  blurAmount = 8,
  lockTitle = "Members Only Content",
  lockDescription = "Subscribe to unlock this premium content and member perks.",
  ctaText = "Sign In to Unlock",
  redirectUrl = "/pricing",
  simulateState = "auto",
}: MemberGateProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sessionTier, setSessionTier] = useState<string | null>(null);

  useEffect(() => {
    injectStyles("mf-member-gate-styles", MEMBER_GATE_CSS);

    if (typeof window !== "undefined") {
      const token = localStorage.getItem("memberframe_session_token");
      const tier = localStorage.getItem("memberframe_tier");
      if (token) {
        setSessionTier(tier || "silver");
      }
    }
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.setProperty("--mf-blur-radius", `${blurAmount}px`);
    }
  }, [blurAmount]);

  const checkEligibility = (reqTier: AllowedTier): boolean => {
    if (!sessionTier) return reqTier === "free";
    if (reqTier === "all_paid") return true;
    if (reqTier === "free") return true;
    if (reqTier === "silver") return ["silver", "gold", "vip"].includes(sessionTier);
    if (reqTier === "gold") return ["gold", "vip"].includes(sessionTier);
    if (reqTier === "vip") return sessionTier === "vip";
    return false;
  };

  const isEligibleMember = checkEligibility(allowedTier);
  const isLocked =
    simulateState === "locked"
      ? true
      : simulateState === "unlocked"
      ? false
      : !isEligibleMember;

  useEffect(() => {
    if (
      isLocked &&
      fallbackMode === "redirect" &&
      simulateState === "auto" &&
      typeof window !== "undefined"
    ) {
      const isCanvasEditor =
        window.location.hostname.includes("framer.com") ||
        window.location.hostname.includes("localhost");
      if (!isCanvasEditor && redirectUrl) {
        window.location.href = redirectUrl;
      }
    }
  }, [isLocked, fallbackMode, simulateState, redirectUrl]);

  if (!isLocked) {
    return (
      <div ref={containerRef} className="mf-gate-container memberframe-gate-container">
        {children}
      </div>
    );
  }

  const contentClass =
    fallbackMode === "blur"
      ? "mf-gate-content memberframe-blur-overlay"
      : "mf-gate-content mf-gate-content--locked-hidden";

  return (
    <div ref={containerRef} className="mf-gate-container memberframe-gate-container">
      <div className={contentClass}>{children}</div>

      <div className="mf-gate-overlay memberframe-lock-card">
        <div className="mf-gate-overlay__icon">
          <LockIcon />
        </div>
        <h3 className="mf-gate-overlay__title">{lockTitle}</h3>
        <p className="mf-gate-overlay__desc">{lockDescription}</p>
        <a href={redirectUrl} className="mf-gate-overlay__cta">
          <SparklesIcon />
          <span>{ctaText}</span>
          <ArrowRightIcon />
        </a>
      </div>
    </div>
  );
}

export { MemberGate };

addPropertyControls(MemberGate, {
  children: {
    type: ControlType.ComponentInstance,
    title: "Protected Slot",
  },
  allowedTier: {
    type: ControlType.Enum,
    title: "Required Tier",
    options: ["all_paid", "silver", "gold", "vip", "free"],
    optionTitles: [
      "All Paid Members",
      "Silver Tier ($10)",
      "Gold Tier ($25)",
      "VIP Gold ($50)",
      "Free Tier",
    ],
    defaultValue: "all_paid",
  },
  fallbackMode: {
    type: ControlType.Enum,
    title: "Fallback View",
    options: ["blur", "hidden", "redirect"],
    optionTitles: ["Frosted Blur", "Hide Completely", "Redirect to Page"],
    defaultValue: "blur",
  },
  blurAmount: {
    type: ControlType.Number,
    title: "Blur Radius (px)",
    min: 2,
    max: 30,
    step: 1,
    defaultValue: 8,
  },
  lockTitle: {
    type: ControlType.String,
    title: "Lock Title",
    defaultValue: "Members Only Content",
  },
  lockDescription: {
    type: ControlType.String,
    title: "Description",
    defaultValue: "Subscribe to unlock this premium content and member perks.",
  },
  ctaText: {
    type: ControlType.String,
    title: "Button Text",
    defaultValue: "Sign In to Unlock",
  },
  redirectUrl: {
    type: ControlType.String,
    title: "Unlock Link",
    defaultValue: "/pricing",
  },
  simulateState: {
    type: ControlType.Enum,
    title: "Canvas Preview",
    options: ["auto", "locked", "unlocked"],
    optionTitles: ["Auto (useMemberSession)", "Force Locked", "Force Unlocked"],
    defaultValue: "locked",
  },
});
