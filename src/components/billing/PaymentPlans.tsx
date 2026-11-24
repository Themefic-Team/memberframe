import React, { useEffect, useState } from "react";
import { Check } from "lucide-react";
import type { PlanId, PlansResponse } from "../../services/licenseService";
import { PLAN_FEATURES } from "./billingHelpers";
import { Skeleton } from "../ui";

export interface PaymentPlansProps {
  plans: PlansResponse | null;
  /** Waiting for the server's plans: a skeleton of the cards, never the built in ones (2026-11-12). */
  loading?: boolean;
  isCreatingPayment: boolean;
  payingPlan: PlanId | null;
  currentPlan: PlanId | "trial" | null;
  onPay: (plan: PlanId) => void;
}

/** BEAF's own prices, used only when the plans could not be loaded. */
const FALLBACK: Record<PlanId, number> = { monthly: 499, yearly: 4999, lifetime: 9999 };

const money = (minor: number, currency = "usd"): string => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(minor / 100);
  } catch {
    return `$${(minor / 100).toFixed(2)}`;
  }
};

/**
 * A year of Monthly, exactly: $4.99 x 12 = $59.88, so a $49.99 year shows
 * $9.89 off. Not rounded up to $59.99 (2026-11-12, before the first Framer
 * submission): a struck price above what twelve months really cost is a
 * misleading reference price.
 */
export const yearOfMonthly = (monthlyMinor: number): number => monthlyMinor * 12;

const CHECK =<Check className="checkmark" aria-hidden={true} />;

/**
 * Monthly or Yearly, then "or, pay once" and Lifetime. F19: a clone of the
 * BEAF plugin's PaymentPlans. Moving down is not offered: a smaller plan reads
 * "Not Available", as in BEAF.
 */
export const PaymentPlans: React.FC<PaymentPlansProps> = ({ plans, loading = false, isCreatingPayment, payingPlan, currentPlan, onPay }) => {
  const [activeInterval, setActiveInterval] = useState<"monthly" | "yearly">(currentPlan === "yearly" ? "yearly" : "monthly");

  useEffect(() => {
    if (currentPlan === "yearly") setActiveInterval("yearly");
    else if (currentPlan === "monthly") setActiveInterval("monthly");
  }, [currentPlan]);

  const offerOf = (id: PlanId) => plans?.plans.find((plan) => plan.id === id);
  const currency = offerOf("monthly")?.currency ?? "usd";
  const listOf = (id: PlanId) => offerOf(id)?.amountMinor ?? FALLBACK[id];

  /**
   * What a card shows (2026-11-12, as Social Share): the name with "$10.00 OFF",
   * then the compared price struck through and the price paid, large.
   *   A plan with its own code (the backend's env): its own price, struck.
   *   Yearly without one: a year of Monthly, $4.99 x 12 = $59.88, so $49.99
   *   shows as $9.89 off.
   * The larger saving is shown. Worked out here from the prices, so the card
   * never depends on the backend's `yearlySavingPercent`.
   */
  const priceOf = (id: PlanId): { pay: number; compare: number | null; off: number } => {
    const list = listOf(id);
    const pay = offerOf(id)?.discount?.amountMinor ?? list;
    const compare = Math.max(list, id === "yearly" ? yearOfMonthly(listOf("monthly")) : 0);
    return compare > pay ? { pay, compare, off: compare - pay } : { pay, compare: null, off: 0 };
  };
  const yearly = priceOf("yearly");
  const saving = yearly.compare ? Math.round((yearly.off / yearly.compare) * 100) : 0;

  /** The name, and a badge beside it ("Best Deal"). */
  const titleRow = (name: string, extra: React.ReactNode = null) => (
    <div className="plan-title-row">
      <span className="plan-name">{name}</span>
      {extra}
    </div>
  );
  /**
   * 2026-11-12: the name and the price paid always share the first line; the
   * compared price, struck through, and "$20.00 OFF" sit under the price.
   * With two badges, all of it on one line did not fit the 360px panel.
   */
  const priceBlock = (id: PlanId, suffix: string | null) => {
    const shown = priceOf(id);
    const cur = offerOf(id)?.currency ?? currency;
    return (
      <>
        <span className="plan-price">
          {money(shown.pay, cur)}
          {suffix ? <span className="plan-suffix">{suffix}</span> : null}
        </span>
        {shown.compare ? (
          <div className="plan-compare-row">
            <s className="plan-compare-price">{money(shown.compare, cur)}</s>
            <span className="plan-off-badge">{money(shown.off, cur)} OFF</span>
          </div>
        ) : null}
      </>
    );
  };

  /**
   * A plan switched off in the backend's env (2026-11-11) is not offered,
   * unless it is the plan this project is on. With one interval left, the
   * toggle goes and the card shows that one.
   */
  const shown = (id: PlanId) => offerOf(id)?.enabled !== false || currentPlan === id;
  const intervals = (["monthly", "yearly"] as const).filter(shown);
  const subKey: "monthly" | "yearly" = intervals.includes(activeInterval) ? activeInterval : (intervals[0] ?? activeInterval);
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

  // The toggle, a card, and a card, the shape of what is coming: a plan switched off in env never shows first.
  if (loading && !plans) {
    return (
      <div className="ffmf-plans-container ffmf-plans-skeleton" role="status" aria-busy={true} aria-label="Loading plans">
        <Skeleton variant="line" />
        <Skeleton variant="block" />
        <Skeleton variant="block" />
      </div>
    );
  }

  return (
    <div className="ffmf-plans-container">
      {intervals.length === 2 ? (
        <div className="ffmf-interval-toggle-container">
          <button type="button" className={`ffmf-interval-btn ${subKey === "monthly" ? "active" : ""}`} onClick={() => setActiveInterval("monthly")}>
            Monthly
          </button>
          <button type="button" className={`ffmf-interval-btn ${subKey === "yearly" ? "active" : ""}`} onClick={() => setActiveInterval("yearly")}>
            Yearly {saving > 0 ? <span className="save-badge">Save {saving}%</span> : null}
          </button>
        </div>
      ) : null}

      {intervals.length > 0 ? (
      <div className={`ffmf-plan-card ${isSubCurrentPlan ? "current" : ""}`}>
        <div className="plan-header">
          {titleRow(subKey === "monthly" ? "Monthly" : "Yearly")}
          {priceBlock(subKey, subKey === "monthly" ? "/m" : "/yr")}
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
      ) : null}

      {shown("lifetime") ? (
      <>
      {intervals.length > 0 ? <div className="ffmf-plans-divider">or, pay once</div> : null}

      <div className={`ffmf-plan-card lifetime ${isLtCurrentPlan ? "current" : ""}`}>
        <div className="plan-header">
          {titleRow("Lifetime", <span className="lifetime-save-badge">Best Deal</span>)}
          {priceBlock("lifetime", null)}
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
      </>
      ) : null}
    </div>
  );
};
