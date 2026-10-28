import React, { useEffect, useState } from "react";
import { Check } from "lucide-react";
import type { PlanId, PlansResponse } from "../../services/licenseService";
import { PLAN_FEATURES } from "./billingHelpers";

export interface PaymentPlansProps {
  plans: PlansResponse | null;
  isCreatingPayment: boolean;
  payingPlan: PlanId | null;
  currentPlan: PlanId | "trial" | null;
  onPay: (plan: PlanId) => void;
}

/** BEAF's own prices, shown until Stripe's answer arrives. */
const FALLBACK: Record<PlanId, number> = { monthly: 499, yearly: 4999, lifetime: 9999 };

const money = (minor: number, currency = "usd"): string => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(minor / 100);
  } catch {
    return `$${(minor / 100).toFixed(2)}`;
  }
};

const CHECK = <Check className="checkmark" aria-hidden={true} />;

/**
 * Monthly or Yearly, then "or, pay once" and Lifetime. F19: a clone of the
 * BEAF plugin's PaymentPlans. Moving down is not offered: a smaller plan reads
 * "Not Available", as in BEAF.
 */
export const PaymentPlans: React.FC<PaymentPlansProps> = ({ plans, isCreatingPayment, payingPlan, currentPlan, onPay }) => {
  const [activeInterval, setActiveInterval] = useState<"monthly" | "yearly">(currentPlan === "yearly" ? "yearly" : "monthly");

  useEffect(() => {
    if (currentPlan === "yearly") setActiveInterval("yearly");
    else if (currentPlan === "monthly") setActiveInterval("monthly");
  }, [currentPlan]);

  const price = (id: PlanId) => {
    const offer = plans?.plans.find((plan) => plan.id === id);
    return money(offer?.amountMinor ?? FALLBACK[id], offer?.currency);
  };
  const saving = plans?.yearlySavingPercent ?? 17;

  const subKey = activeInterval;
  const isSubProcessing = isCreatingPayment && payingPlan === subKey;
  const isSubCurrentPlan = currentPlan === subKey;
  const isSubDowngradeDisabled = (currentPlan === "yearly" && subKey === "monthly") || currentPlan === "lifetime";
  const isSubDisabled = isCreatingPayment || isSubCurrentPlan || isSubDowngradeDisabled;

  const total = plans?.lifetime.total ?? null;
  const spotsRemaining = plans ? plans.lifetime.remaining : null;
  const isLtSoldOut = spotsRemaining === 0;
  const isLtProcessing = isCreatingPayment && payingPlan === "lifetime";
  const isLtCurrentPlan = currentPlan === "lifetime";
  const isLtDisabled = isCreatingPayment || isLtSoldOut || isLtCurrentPlan;

  const features = PLAN_FEATURES.map((feature) => (
    <div key={feature} className="feature-item">
      {CHECK}
      <span>{feature}</span>
    </div>
  ));

  return (
    <div className="ffmf-plans-container">
      <div className="ffmf-interval-toggle-container">
        <button type="button" className={`ffmf-interval-btn ${activeInterval === "monthly" ? "active" : ""}`} onClick={() => setActiveInterval("monthly")}>
          Monthly
        </button>
        <button type="button" className={`ffmf-interval-btn ${activeInterval === "yearly" ? "active" : ""}`} onClick={() => setActiveInterval("yearly")}>
          Yearly {saving > 0 ? <span className="save-badge">Save {saving}%</span> : null}
        </button>
      </div>

      <div className={`ffmf-plan-card ${isSubCurrentPlan ? "current" : ""}`}>
        <div className="plan-header">
          <span className="plan-name">{activeInterval === "monthly" ? "Monthly" : "Yearly"}</span>
          <span className="plan-price">
            {price(subKey)}
            <span className="plan-suffix">{activeInterval === "monthly" ? "/m" : "/yr"}</span>
          </span>
        </div>
        <div className="plan-features">{features}</div>
        <button
          type="button"
          onClick={() => !isSubDisabled && onPay(subKey)}
          disabled={isSubDisabled}
          className={`plan-action-btn ${isSubProcessing ? "loading" : ""} ${isSubCurrentPlan ? "current" : ""}`}
        >
          {isSubCurrentPlan ? "Current Plan" : isSubDowngradeDisabled ? "Not Available" : isSubProcessing ? "Loading..." : "Upgrade Subscription"}
        </button>
      </div>

      <div className="ffmf-plans-divider">or, pay once</div>

      <div className={`ffmf-plan-card lifetime ${isLtCurrentPlan ? "current" : ""}`}>
        <div className="plan-header">
          <div className="lifetime-title-row">
            <span className="plan-name">Lifetime</span>
            <span className="lifetime-save-badge">Best Deal</span>
          </div>
          <span className="plan-price">{price("lifetime")}</span>
        </div>
        <div className="plan-features">
          {features}
          {spotsRemaining !== null ? (
            <div className="feature-item spots-remaining">
              {CHECK}
              <span>{isLtSoldOut ? "All spots taken!" : `${spotsRemaining}/${total} spots left`}</span>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => !isLtDisabled && onPay("lifetime")}
          disabled={isLtDisabled}
          className={`plan-action-btn ${isLtProcessing ? "loading" : ""} ${isLtCurrentPlan ? "current" : ""}`}
        >
          {isLtCurrentPlan ? "Current Plan" : isLtSoldOut ? "Sold Out" : isLtProcessing ? "Loading..." : "Get Lifetime Access"}
        </button>
      </div>
    </div>
  );
};
