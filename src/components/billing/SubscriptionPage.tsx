import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Ban, X } from "lucide-react";
import { useConnection } from "../../hooks/useConnection";
import { useLicense } from "../../hooks/useLicense";
import { failureMessage, type ApiFailure } from "../../services/apiClient";
import {
  cancelPlan,
  confirmCheckout,
  fetchBillingPortal,
  fetchPlans,
  fetchUpgradePreview,
  resumePlan,
  startCheckout,
  upgradePlan,
  type CheckoutResponse,
  type PlanId,
  type PlansResponse,
  type UpgradePreview,
} from "../../services/licenseService";
import { formatDate, getPlanName, getStatusLabel, isAutoRenew, notify } from "./billingHelpers";
import { PaymentModal } from "./PaymentModal";
import { PaymentPlans } from "./PaymentPlans";
import { PaymentSuccessModal } from "./PaymentSuccessModal";

export interface SubscriptionPageProps {
  onClose: () => void;
  /** Bumped by every "Upgrade" elsewhere, to open the plans (BEAF's forceShowPlans). */
  showPlansRequest: number;
}

const CANCEL_REASONS = ["It's too expensive", "I'm not using it enough", "Missing a feature I need", "Switching to another tool", "Other"];
const CANCEL_WARNINGS = ["Your components will be locked", "Members will not be able to sign in", "No more priority support"];

const money = (minor: number, currency: string): string => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(minor / 100);
  } catch {
    return `$${(minor / 100).toFixed(2)}`;
  }
};

/**
 * Manage Subscription. F19: a clone of the BEAF plugin's SubscriptionPage,
 * PaymentPlans, and its payment flow, so every Framefic plugin sells its plans
 * the same way. The Confirm Plan Change modal also shows the credit for unused
 * time and what is due today (19-pro-lock-and-trial.md 2.3).
 */
export const SubscriptionPage: React.FC<SubscriptionPageProps> = ({ onClose, showPlansRequest }) => {
  const { connection } = useConnection();
  const { view, apply, refresh } = useLicense();
  const siteId = connection?.siteId ?? "";

  const [plans, setPlans] = useState<PlansResponse | null>(null);
  const [showPlans, setShowPlans] = useState(showPlansRequest > 0);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [changing, setChanging] = useState(false);
  const [upgradePreview, setUpgradePreview] = useState<UpgradePreview | null>(null);
  const [cancelStep, setCancelStep] = useState<1 | 2 | 3 | null>(null);
  const [cancelFeedback, setCancelFeedback] = useState("");

  // The payment flow (BEAF's usePaymentFlow).
  const [payingPlan, setPayingPlan] = useState<PlanId | null>(null);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutResponse | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    void fetchPlans().then((result) => {
      if (result.kind === "ok") setPlans(result.data);
    });
  }, []);

  useEffect(() => {
    if (showPlansRequest > 0) setShowPlans(true);
  }, [showPlansRequest]);

  const active = view?.state === "active";
  const trial = view?.state === "trial";
  const hasSubscription = active || trial;
  const currentPlan = active && view?.plan && view.plan !== "trial" ? view.plan : null;
  const canceling = active && view?.cancelAtPeriodEnd === true;
  const busy = loadingPortal || cancelling || changing;

  const reportFailure = useCallback((result: ApiFailure, fallback: string) => {
    const message = result.kind === "unavailable" && result.message ? result.message : failureMessage(result).message || fallback;
    setBillingError(message);
    void notify({ type: "Error", message });
  }, []);

  const handleBack = () => {
    if (hasSubscription && showPlans) setShowPlans(false);
    else onClose();
  };

  const openPayment = (plan: PlanId, result: CheckoutResponse) => {
    setPayingPlan(plan);
    setCheckout(result);
  };

  const finishPayment = useCallback(
    async (paymentIntentId: string | null) => {
      if (paymentIntentId) {
        const result = await confirmCheckout(siteId, paymentIntentId);
        if (result.kind === "ok") apply(result.data.license);
        else window.setTimeout(() => void refresh(), 4000);
      } else {
        await refresh();
      }
      setCheckout(null);
      setPayingPlan(null);
      setShowPlans(false);
      setShowSuccess(true);
      window.setTimeout(() => setShowSuccess(false), 2500);
    },
    [apply, refresh, siteId]
  );

  const makePayment = async (plan: PlanId) => {
    setPayingPlan(plan);
    setIsCreatingPayment(true);
    setBillingError(null);
    const result = await startCheckout(siteId, plan, undefined);
    setIsCreatingPayment(false);
    if (result.kind !== "ok") {
      setPayingPlan(null);
      reportFailure(result, "Could not start the payment.");
      return;
    }
    if (result.data.complete || !result.data.clientSecret) {
      await finishPayment(null);
      return;
    }
    openPayment(plan, result.data);
  };

  const onPay = async (plan: PlanId) => {
    if (active && currentPlan) {
      setChanging(true);
      const result = await fetchUpgradePreview(siteId, plan);
      setChanging(false);
      if (result.kind !== "ok") {
        reportFailure(result, "Could not price the change.");
        return;
      }
      setUpgradePreview(result.data.preview);
      return;
    }
    await makePayment(plan);
  };

  const handleChangePlan = async () => {
    if (!upgradePreview) return;
    setChanging(true);
    setBillingError(null);
    const target = upgradePreview.to;
    const result = await upgradePlan(siteId, target);
    setChanging(false);
    setUpgradePreview(null);
    setShowPlans(false);
    if (result.kind !== "ok") {
      reportFailure(result, "Failed to change plan.");
      return;
    }
    if (result.data.complete || !result.data.clientSecret) {
      await refresh();
      await notify({ type: "Success", message: `Plan changed to ${getPlanName(target)}.` });
      return;
    }
    openPayment(target, result.data);
  };

  const handleManageBilling = async () => {
    setLoadingPortal(true);
    setBillingError(null);
    const result = await fetchBillingPortal(siteId);
    setLoadingPortal(false);
    if (result.kind === "ok") window.open(result.data.url, "_blank", "noopener,noreferrer");
    else reportFailure(result, "Failed to open billing portal. Please try again.");
  };

  const handleCancelSubscription = async (feedback: string) => {
    setCancelling(true);
    setBillingError(null);
    const result = await cancelPlan(siteId, feedback);
    setCancelling(false);
    if (result.kind !== "ok") {
      reportFailure(result, "Failed to cancel subscription.");
      return false;
    }
    apply(result.data.license);
    await notify({
      type: "Success",
      message: result.data.endsAt ? `Subscription will end on ${formatDate(result.data.endsAt)}.` : "Subscription cancellation scheduled.",
    });
    return true;
  };

  const handleResume = async () => {
    setChanging(true);
    const result = await resumePlan(siteId);
    setChanging(false);
    if (result.kind === "ok") {
      apply(result.data.license);
      await notify({ type: "Success", message: "Your subscription will renew." });
    } else reportFailure(result, "Failed to resume subscription.");
  };

  const endDate = view?.plan === "lifetime" ? "Never" : formatDate(view?.currentPeriodEnd ?? view?.trialEndsAt ?? null);
  const showAmount = checkout ? checkout.amountDueMinor / 100 : 0;
  const showType = payingPlan === "monthly" ? "Monthly" : payingPlan === "yearly" ? "Annually" : "One time";

  return (
    <div className="beaf-subscription-page">
      <button type="button" className="beaf-subpage-back-button-wide" onClick={handleBack} aria-label="Back">
        <ArrowLeft aria-hidden={true} />
        <span>Back</span>
      </button>

      <h3 className="beaf-subpage-title-left">Manage Subscription</h3>

      <div className="beaf-subscription-content">
        {!hasSubscription || showPlans ? (
          <PaymentPlans
            plans={plans}
            isCreatingPayment={isCreatingPayment || changing}
            payingPlan={payingPlan}
            currentPlan={currentPlan}
            onPay={(plan) => void onPay(plan)}
          />
        ) : (
          <>
            <div className="beaf-subscription-card">
              <div className="beaf-subscription-detail-item">
                <span className="beaf-subscription-label">PLAN</span>
                <span className="beaf-subscription-value">{getPlanName(view?.plan ?? null)}</span>
              </div>
              <div className="beaf-subscription-divider" />
              <div className="beaf-subscription-detail-item">
                <span className="beaf-subscription-label">STATUS</span>
                <span className="beaf-subscription-status">{getStatusLabel(view?.status ?? null, hasSubscription)}</span>
              </div>
              <div className="beaf-subscription-divider" />
              <div className="beaf-subscription-detail-item">
                <span className="beaf-subscription-label">START DATE</span>
                <span className="beaf-subscription-value">{formatDate(view?.startedAt ?? null)}</span>
              </div>
              <div className="beaf-subscription-divider" />
              <div className="beaf-subscription-detail-item">
                <span className="beaf-subscription-label">END DATE</span>
                <span className="beaf-subscription-value">{endDate}</span>
              </div>
              <div className="beaf-subscription-divider" />
              <div className="beaf-subscription-detail-item">
                <span className="beaf-subscription-label">RENEWS</span>
                <span className="beaf-subscription-value">{isAutoRenew(view)}</span>
              </div>
            </div>

            {billingError ? <div className="beaf-billing-error">{billingError}</div> : null}

            {trial ? (
              <div className="beaf-subscription-actions beaf-subscription-actions--column">
                <button type="button" className="beaf-profile-primary-button" onClick={() => setShowPlans(true)}>
                  Upgrade to Pro Plan
                </button>
              </div>
            ) : view?.plan !== "lifetime" ? (
              <div className="beaf-subscription-actions">
                <button type="button" className="beaf-subscription-secondary-btn" onClick={() => void handleManageBilling()} disabled={busy}>
                  {loadingPortal ? "Loading..." : "Manage Billing"}
                </button>
                {canceling ? (
                  <button type="button" className="beaf-subscription-upgrade-btn" onClick={() => void handleResume()} disabled={busy}>
                    {changing ? "Resuming..." : "Resume Subscription"}
                  </button>
                ) : (
                  <button type="button" className="beaf-subscription-cancel-btn" onClick={() => setCancelStep(1)} disabled={busy}>
                    Cancel Subscription
                  </button>
                )}
                <button type="button" className="beaf-subscription-upgrade-btn" onClick={() => setShowPlans(true)} disabled={busy}>
                  Upgrade Plan
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>

      {upgradePreview ? (
        <div className="beaf-payment-modal">
          <div className="beaf-payment-box beaf-confirm-box">
            <h3 className="beaf-confirm-title">Confirm Plan Change</h3>
            <p className="beaf-confirm-text">
              You are about to switch to the <strong>{getPlanName(upgradePreview.to)}</strong> plan.
            </p>
            <p className="beaf-confirm-text">
              {upgradePreview.to === "yearly"
                ? "Your unused monthly time will be credited, and you'll be billed the prorated yearly amount today."
                : "Your unused subscription time will be calculated as a discount, and you'll be billed the prorated lifetime amount today."}
            </p>
            <div className="beaf-confirm-rows">
              <div className="beaf-confirm-row">
                <span>Unused time credit</span>
                <strong>-{money(upgradePreview.creditMinor, upgradePreview.currency)}</strong>
              </div>
              <div className="beaf-confirm-row">
                <span>Due today</span>
                <strong>{money(upgradePreview.amountDueMinor, upgradePreview.currency)}</strong>
              </div>
              <div className="beaf-confirm-row">
                <span>Renews</span>
                <strong>{upgradePreview.nextRenewal ? formatDate(upgradePreview.nextRenewal) : "Never"}</strong>
              </div>
            </div>
            <div className="beaf-confirm-actions">
              <button type="button" className="beaf-confirm-cancel" onClick={() => setUpgradePreview(null)}>
                Cancel
              </button>
              <button type="button" className="beaf-confirm-pay" disabled={changing} onClick={() => void handleChangePlan()}>
                {changing ? "Processing..." : "Pay Now"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cancelStep ? (
        <div className="beaf-payment-modal">
          <div className="beaf-payment-box beaf-cancel-box">
            {cancelStep === 1 ? (
              <div className="beaf-cancel-step-content">
                <h3>We&apos;re sorry to see you go</h3>
                <p className="beaf-cancel-intro">Mind telling us why? It helps us improve.</p>
                <div className="beaf-cancel-options">
                  {CANCEL_REASONS.map((option) => (
                    <label key={option} className="beaf-cancel-option-label">
                      <input
                        type="radio"
                        name="cancelReason"
                        value={option}
                        checked={cancelFeedback === option}
                        onChange={(event) => setCancelFeedback(event.target.value)}
                        className="beaf-cancel-radio-input"
                      />
                      <span className={`beaf-cancel-radio-custom ${cancelFeedback === option ? "checked" : ""}`}>
                        {cancelFeedback === option ? <span className="beaf-cancel-radio-dot" /> : null}
                      </span>
                      <span className="beaf-cancel-option-text">{option}</span>
                    </label>
                  ))}
                </div>
                <div className="beaf-cancel-actions-row">
                  <button type="button" className="beaf-primary-cta" disabled={!cancelFeedback} onClick={() => setCancelStep(2)}>
                    Continue
                  </button>
                  <button
                    type="button"
                    className="beaf-cancel-text-link"
                    onClick={() => {
                      setCancelFeedback("Skipped");
                      setCancelStep(2);
                    }}
                  >
                    Skip and cancel anyway
                  </button>
                </div>
              </div>
            ) : null}

            {cancelStep === 2 ? (
              <div className="beaf-cancel-step-content">
                <h3>Confirm cancellation</h3>
                <p className="beaf-cancel-intro">
                  You&apos;ll keep full access until your billing period ends on <strong>{formatDate(view?.currentPeriodEnd ?? null)}</strong>. After that:
                </p>
                <div className="beaf-cancel-warnings">
                  {CANCEL_WARNINGS.map((warning) => (
                    <div key={warning} className="beaf-cancel-warning-item">
                      <X className="beaf-cancel-warning-icon" aria-hidden={true} />
                      <span>{warning}</span>
                    </div>
                  ))}
                </div>
                <div className="beaf-cancel-actions-row beaf-cancel-actions-row--spaced">
                  <button
                    type="button"
                    className="beaf-primary-cta"
                    onClick={() => {
                      setCancelStep(null);
                      setCancelFeedback("");
                    }}
                  >
                    Keep My Plan
                  </button>
                  <button
                    type="button"
                    className="beaf-subscription-cancel-btn"
                    disabled={cancelling}
                    onClick={() => {
                      void handleCancelSubscription(cancelFeedback).then((done) => {
                        if (done) setCancelStep(3);
                      });
                    }}
                  >
                    {cancelling ? "Cancelling..." : "Cancel My Subscription"}
                  </button>
                </div>
              </div>
            ) : null}

            {cancelStep === 3 ? (
              <div className="beaf-cancel-step-content beaf-cancel-step-content--center">
                <div className="beaf-cancel-status-icon-wrapper">
                  <Ban aria-hidden={true} />
                </div>
                <h3>Subscription canceled</h3>
                <p className="beaf-cancel-intro">
                  You&apos;ll have full access until <strong>{formatDate(view?.currentPeriodEnd ?? null)}</strong>. We&apos;d love to have you back anytime.
                </p>
                <div className="beaf-cancel-actions-row beaf-cancel-actions-row--spaced">
                  <button
                    type="button"
                    className="beaf-primary-cta beaf-primary-cta--tall"
                    onClick={() => {
                      void refresh();
                      setCancelStep(null);
                      setCancelFeedback("");
                    }}
                  >
                    Go to Dashboard
                  </button>
                  <span className="beaf-cancel-resubscribe-text">Changed your mind? Resubscribe anytime</span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <PaymentModal
        isOpen={checkout !== null}
        publishableKey={plans?.publishableKey ?? ""}
        clientSecret={checkout?.clientSecret ?? null}
        showAmount={showAmount}
        showType={showType}
        plan={payingPlan}
        siteId={siteId}
        defaultEmail={connection?.creatorEmail ?? null}
        onClose={() => {
          setCheckout(null);
          setPayingPlan(null);
        }}
        onSuccess={finishPayment}
        onCheckoutChange={(next) => setCheckout(next)}
      />
      <PaymentSuccessModal isOpen={showSuccess} />
    </div>
  );
};
