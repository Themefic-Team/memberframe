import React, { useEffect, useMemo, useState } from "react";
import { loadStripe, type Stripe, type StripeElementsOptions } from "@stripe/stripe-js";
import { Elements, LinkAuthenticationElement, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { applyCoupon, type CheckoutResponse, type PlanId } from "../../services/licenseService";
import { notify } from "./billingHelpers";

export interface PaymentModalProps {
  isOpen: boolean;
  publishableKey: string;
  clientSecret: string | null;
  /** In dollars, as BEAF shows it: "Total Amount is: $4.99 (Monthly)". */
  showAmount: number;
  showType: string;
  plan: PlanId | null;
  siteId: string;
  defaultEmail: string | null;
  onClose: () => void;
  /** Called with the PaymentIntent id, or null when a coupon made it free. */
  onSuccess: (paymentIntentId: string | null) => Promise<void>;
  onCheckoutChange: (next: CheckoutResponse) => void;
}

const stripes = new Map<string, Promise<Stripe | null>>();
const stripeFor = (key: string): Promise<Stripe | null> => {
  let found = stripes.get(key);
  if (!found) {
    found = loadStripe(key);
    stripes.set(key, found);
  }
  return found;
};

/**
 * "Complete Payment". F19: a clone of the BEAF plugin's PaymentModal, with
 * Stripe Elements styled exactly as BEAF styles them, light and dark.
 */
export const PaymentModal: React.FC<PaymentModalProps> = (props) => {
  const [framerTheme, setFramerTheme] = useState<string | null>(() =>
    typeof document !== "undefined" ? document.body.dataset["framerTheme"] ?? null : null
  );
  const [stripeLoadError, setStripeLoadError] = useState(false);
  const stripePromise = useMemo(() => (props.isOpen && props.publishableKey ? stripeFor(props.publishableKey) : null), [props.isOpen, props.publishableKey]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    const observer = new MutationObserver(() => setFramerTheme(body.dataset["framerTheme"] ?? null));
    observer.observe(body, { attributes: true, attributeFilter: ["data-framer-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!stripePromise) return;
    let cancelled = false;
    void stripePromise.then((stripe) => {
      if (!cancelled && !stripe) setStripeLoadError(true);
    });
    return () => {
      cancelled = true;
    };
  }, [stripePromise]);

  if (!props.isOpen || !props.clientSecret) return null;
  const isLight = framerTheme === "light";

  if (stripeLoadError || !props.publishableKey) {
    return (
      <div className="beaf-payment-modal">
        <div className="beaf-payment-box">
          <h3>Payment Unavailable</h3>
          <p className="beaf-payment-muted">
            The payment service could not be initialized. This may be caused by a network issue or a browser extension blocking external scripts.
          </p>
          <p className="beaf-payment-muted beaf-payment-muted--small">
            Please check your internet connection and try again. If the problem persists, disable any ad-blockers or privacy extensions and reload the plugin.
          </p>
          <div className="beaf-payment-button beaf-payment-unavailable-actions">
            <a href="https://framefic.com/support/" target="_blank" rel="noreferrer" className="beaf-payment-support">
              Contact Support →
            </a>
            <button
              type="button"
              className="beaf-payment-cancel beaf-payment-cancel--solo"
              onClick={() => {
                setStripeLoadError(false);
                props.onClose();
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!stripePromise) {
    return (
      <div className="beaf-payment-modal">
        <div className="beaf-payment-box beaf-payment-box--center">
          <h3>Connecting to Checkout...</h3>
          <p className="beaf-payment-muted">Initializing secure Stripe connection.</p>
          <div className="beaf-payment-center-actions">
            <button type="button" className="beaf-payment-cancel" onClick={props.onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  const options: StripeElementsOptions = {
    clientSecret: props.clientSecret,
    appearance: {
      theme: isLight ? "stripe" : "night",
      variables: {
        colorPrimary: "#5271FF",
        colorBackground: isLight ? "#FFFFFF" : "#201F1F",
        colorText: isLight ? "#101828" : "#FCFCFD",
        colorTextSecondary: isLight ? "#5F6B7A" : "#BFBFBF",
        colorDanger: "#F97066",
        colorIcon: isLight ? "#5F6B7A" : "#BFBFBF",
        borderRadius: "4px",
        spacingUnit: "4px",
        fontSizeBase: "13px",
        fontFamily: "Mulish, Inter, sans-serif",
      },
      rules: {
        ".Tab": { border: isLight ? "1px solid #CFD7E3" : "1px solid #323131", backgroundColor: isLight ? "#F3F6FB" : "#242323", padding: "10px 12px" },
        ".TabLabel": { fontSize: "13px", fontWeight: "600" },
        ".Tab--selected": { borderColor: "#5271FF", backgroundColor: isLight ? "#E7ECF4" : "#323131", color: isLight ? "#101828" : "#FCFCFD" },
        ".Label": { fontSize: "13px" },
        ".Input": { border: isLight ? "1px solid #CFD7E3" : "1px solid #323131", backgroundColor: isLight ? "#FFFFFF" : "#242323", boxShadow: "none", fontSize: "13px" },
        ".Input:focus": { borderColor: "#5271FF", boxShadow: "0 0 0 1px #5271FF" },
        ".Text": { fontSize: "12px" },
      },
    },
  };

  return (
    <div className="beaf-payment-modal">
      <div className="beaf-payment-box">
        <h3>Complete Payment</h3>
        <p>
          Total Amount is: ${props.showAmount.toFixed(2)} ({props.showType})
        </p>
        <Elements key={props.clientSecret} stripe={stripePromise} options={options}>
          <CheckoutForm {...props} />
        </Elements>
      </div>
    </div>
  );
};

const CheckoutForm: React.FC<PaymentModalProps> = ({ onClose, onSuccess, plan, siteId, defaultEmail, onCheckoutChange }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [couponCode, setCouponCode] = useState("");
  const [showCouponInput, setShowCouponInput] = useState(false);
  const [applying, setApplying] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("");

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setApplying(true);
    setCouponError("");
    const result = await applyCoupon(siteId, couponCode.trim());
    setApplying(false);
    if (result.kind !== "ok") {
      setCouponError(result.kind === "unavailable" && result.message ? result.message : "Invalid coupon code");
      return;
    }
    setCouponApplied(true);
    if (result.data.complete) {
      await notify({ type: "Success", message: "Coupon applied! Access is now active." });
      await onSuccess(null);
      onClose();
      return;
    }
    onCheckoutChange(result.data);
    await notify({ type: "Success", message: "Coupon applied successfully!" });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      await notify({ type: "Error", message: "Please enter a valid email address." });
      return;
    }
    setSubmitting(true);
    setProcessingMessage("");
    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        await notify({ type: "Error", message: submitError.message || "Please complete all payment fields." });
        return;
      }
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: typeof window !== "undefined" ? window.location.href : undefined,
          receipt_email: trimmed,
          payment_method_data: { billing_details: { email: trimmed } },
        },
        redirect: "if_required",
      });
      if (error) {
        await notify({
          type: "Error",
          message:
            error.message ||
            (error.type === "card_error" ? "Your card was declined. Please try another card." : "Payment authorization failed."),
        });
        return;
      }
      if (!paymentIntent) {
        await notify({ type: "Error", message: "Unable to confirm payment state. Please contact support if your card was charged." });
        return;
      }
      if (paymentIntent.status === "succeeded") {
        await notify({ type: "Success", message: "Your Payment Has Been Successful!" });
        await onSuccess(paymentIntent.id);
        onClose();
      } else if (paymentIntent.status === "processing") {
        setProcessingMessage("Your payment is processing! Your subscription will activate as soon as your bank confirms.");
        await notify({ type: "Info", message: "Your payment is currently processing. Your subscription will be activated automatically once confirmed." });
        await onSuccess(paymentIntent.id);
        onClose();
      } else if (paymentIntent.status === "requires_payment_method") {
        await notify({ type: "Error", message: "Payment declined or cancelled. Please try another card or payment method." });
      } else {
        await notify({ type: "Warning", message: `Payment status: ${paymentIntent.status}. Please check your account or contact support.` });
      }
    } catch (error) {
      await notify({ type: "Error", message: error instanceof Error ? error.message : "Payment failed" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="beaf-payment-form">
      {(plan === "monthly" || plan === "lifetime") && !couponApplied ? (
        <div className="beaf-coupon-section">
          {!showCouponInput ? (
            <button type="button" className="beaf-coupon-toggle" onClick={() => setShowCouponInput(true)}>
              Have a coupon code?
            </button>
          ) : (
            <div>
              <div className="beaf-coupon-input-row--spaced">
                <input
                  type="text"
                  className="beaf-coupon-input--large"
                  placeholder="Enter coupon"
                  value={couponCode}
                  onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                  disabled={applying}
                />
                <button type="button" className="beaf-coupon-apply" onClick={() => void handleApplyCoupon()} disabled={applying || !couponCode.trim()}>
                  {applying ? "Applying..." : "Apply"}
                </button>
              </div>
              {couponError ? <div className="beaf-coupon-error">{couponError}</div> : null}
            </div>
          )}
        </div>
      ) : null}

      {couponApplied ? (
        <div className="beaf-coupon-success-badge">
          <span>✓ Coupon applied successfully!</span>
        </div>
      ) : null}

      <div className="beaf-link-auth">
        <LinkAuthenticationElement
          onChange={(event) => setEmail(event.value.email)}
          options={defaultEmail ? { defaultValues: { email: defaultEmail } } : undefined}
        />
      </div>
      <PaymentElement
        options={{
          fields: { billingDetails: "auto" },
          terms: { card: "never" },
          wallets: { applePay: "never", googlePay: "never" },
        }}
      />
      {processingMessage ? (
        <div className="beaf-processing-banner">
          <p>{processingMessage}</p>
        </div>
      ) : null}
      <div className="beaf-payment-button">
        <button type="button" className="beaf-payment-cancel" onClick={onClose} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="beaf-buy-now-button" disabled={submitting}>
          {submitting ? "Processing..." : "Pay Now"}
        </button>
      </div>
    </form>
  );
};
