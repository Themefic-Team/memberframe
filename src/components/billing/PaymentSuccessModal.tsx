import React, { useEffect, useRef } from "react";
import { CheckCircle2, X } from "lucide-react";
import type { PlanId } from "../../services/licenseService";

const PLAN_NAMES: Record<PlanId, string> = { monthly: "Pro Monthly", yearly: "Pro Yearly", lifetime: "Lifetime" };

/**
 * "Payment Verified!", Hydra Booking's (and Social Share's) end of checkout:
 * a green check, the plan now active, and Continue to Plugin. It stays until
 * the creator closes it, instead of BEAF's dialog that closed itself.
 */
export const PaymentSuccessModal: React.FC<{ plan: PlanId | null; onClose: () => void }> = ({ plan, onClose }) => {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (plan) button.current?.focus();
  }, [plan]);
  if (!plan) return null;
  const name = PLAN_NAMES[plan];
  return (
    <div className="ffmf-pm-backdrop" onClick={onClose}>
      <section className="ffmf-pm-card" role="dialog" aria-modal="true" aria-labelledby="ffmf-pm-success-title" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="ffmf-pm-close ffmf-pm-close--corner" onClick={onClose} aria-label="Close">
          <X />
        </button>
        <div className="ffmf-pm-success">
          <span className="ffmf-pm-success-icon" aria-hidden={true}>
            <CheckCircle2 />
          </span>
          <h3 id="ffmf-pm-success-title" className="ffmf-pm-success-title">
            Payment Verified!
          </h3>
          <p className="ffmf-pm-success-desc">
            Your <strong>{name}</strong> plan is active. Every Pro feature is unlocked and the Made with Framefic mark is removed from your site.
          </p>
          <button ref={button} type="button" className="ffmf-pm-cta" onClick={onClose}>
            Continue to Plugin
          </button>
        </div>
      </section>
    </div>
  );
};
