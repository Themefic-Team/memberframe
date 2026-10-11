import React, { useEffect, useState } from "react";
import { addPropertyControls, ControlType } from "framer";

export interface MemberDashboardProps {
  portalTitle?: string;
  showSubscriptionDetails?: boolean;
  showPaymentHistory?: boolean;
  allowCancellation?: boolean;
  manageBillingText?: string;
}

const MEMBER_DASHBOARD_CSS = `
.mf-dashboard-card {
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
  padding: 24px;
  background: #201f1f;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #ffffff;
  box-sizing: border-box;
}

.mf-dashboard-user-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 18px;
}

.mf-dashboard-user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mf-dashboard-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #3b3a3a;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #edf0f7;
  font-weight: 600;
  font-size: 16px;
}

.mf-dashboard-name {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 2px 0;
  color: #ffffff;
}

.mf-dashboard-email {
  font-size: 12px;
  color: #95a3b2;
  margin: 0;
}

.mf-dashboard-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  background: rgba(82, 113, 255, 0.18);
  color: #708aff;
  border: 1px solid rgba(82, 113, 255, 0.3);
}

.mf-dashboard-sub-panel {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.mf-dashboard-tier-title {
  font-size: 14px;
  font-weight: 600;
  color: #edf0f7;
  margin: 0 0 4px 0;
}

.mf-dashboard-tier-desc {
  font-size: 12px;
  color: #95a3b2;
  margin: 0;
}

.mf-dashboard-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mf-dashboard-btn-manage {
  width: 100%;
  height: 38px;
  background: linear-gradient(180deg, #5271ff 0%, #3b51b8 100%);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-sizing: border-box;
}

.mf-dashboard-btn-cancel {
  width: 100%;
  height: 36px;
  background: transparent;
  color: #f87171;
  border: 1px solid rgba(248, 113, 113, 0.2);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-sizing: border-box;
  transition: background 150ms ease;
}

.mf-dashboard-btn-cancel:hover {
  background: rgba(248, 113, 113, 0.1);
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

const UserIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const ShieldCheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

const CreditCardIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#708aff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="14" x="2" y="5" rx="2" />
    <line x1="2" x2="22" y1="10" y2="10" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#95a3b2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h6v6" />
    <path d="M10 14 21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </svg>
);

const AlertCircleIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" x2="12" y1="8" y2="12" />
    <line x1="12" x2="12.01" y1="16" y2="16" />
  </svg>
);

export default function MemberDashboard({
  portalTitle = "Member Account Portal",
  showSubscriptionDetails = true,
  showPaymentHistory = true,
  allowCancellation = true,
  manageBillingText = "Manage Stripe Billing",
}: MemberDashboardProps): React.JSX.Element {
  const [isCanceled, setIsCanceled] = useState(false);

  useEffect(() => {
    injectStyles("mf-member-dashboard-styles", MEMBER_DASHBOARD_CSS);
  }, []);

  return (
    <div className="mf-dashboard-card">
      <div className="mf-dashboard-user-header">
        <div className="mf-dashboard-user-info">
          <div className="mf-dashboard-avatar">
            <UserIcon />
          </div>
          <div>
            <h3 className="mf-dashboard-name">{portalTitle}</h3>
            <p className="mf-dashboard-email">alex.creator@example.com</p>
          </div>
        </div>
        <span className="mf-dashboard-badge">
          <ShieldCheckIcon />
          <span>PRO MEMBER</span>
        </span>
      </div>

      {showSubscriptionDetails && (
        <div className="mf-dashboard-sub-panel">
          <div>
            <h4 className="mf-dashboard-tier-title">Pro Creator Annual ($49.99/yr)</h4>
            <p className="mf-dashboard-tier-desc">
              {isCanceled
                ? "Subscription ends on Dec 31, 2026 (Canceled)"
                : "Next renewal scheduled for Dec 31, 2026"}
            </p>
          </div>
          <CreditCardIcon />
        </div>
      )}

      {showPaymentHistory && (
        <div className="mf-dashboard-sub-panel">
          <div>
            <h4 className="mf-dashboard-tier-title">Latest Invoice Paid</h4>
            <p className="mf-dashboard-tier-desc">Invoice #INV-2026-004 · $49.99 USD</p>
          </div>
          <CalendarIcon />
        </div>
      )}

      <div className="mf-dashboard-actions">
        <button
          type="button"
          className="mf-dashboard-btn-manage"
          onClick={() => {
            alert("Redirecting to secure Stripe Customer Portal...");
          }}
        >
          <ExternalLinkIcon />
          <span>{manageBillingText}</span>
        </button>

        {allowCancellation && !isCanceled && (
          <button
            type="button"
            className="mf-dashboard-btn-cancel"
            onClick={() => {
              if (confirm("Are you sure you want to cancel your recurring subscription?")) {
                setIsCanceled(true);
              }
            }}
          >
            <AlertCircleIcon />
            <span>Cancel Subscription</span>
          </button>
        )}
      </div>
    </div>
  );
}

export { MemberDashboard };

addPropertyControls(MemberDashboard, {
  portalTitle: {
    type: ControlType.String,
    title: "Portal Title",
    defaultValue: "Member Account Portal",
  },
  showSubscriptionDetails: {
    type: ControlType.Boolean,
    title: "Subscription Info",
    defaultValue: true,
  },
  showPaymentHistory: {
    type: ControlType.Boolean,
    title: "Billing History",
    defaultValue: true,
  },
  allowCancellation: {
    type: ControlType.Boolean,
    title: "Allow Cancel",
    defaultValue: true,
  },
  manageBillingText: {
    type: ControlType.String,
    title: "Button Text",
    defaultValue: "Manage Stripe Billing",
  },
});
