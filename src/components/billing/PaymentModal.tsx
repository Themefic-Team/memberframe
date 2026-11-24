import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, CreditCard, Loader2, Lock, ShieldCheck, Tag, User, X } from "lucide-react";
// Types only: they load nothing. Stripe.js itself is fetched in stripeFor().
import type { Stripe, StripeElementsOptions } from "@stripe/stripe-js";
import { Elements, LinkAuthenticationElement, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { applyCoupon, startCheckout, type CheckoutResponse, type PlanId } from "../../services/licenseService";
import { notify } from "./billingHelpers";

export interface PaymentModalProps {
  isOpen: boolean;
  publishableKey: string;
  /** The PaymentIntent the backend made (its client secret), the amount due, and the code on it. */
  checkout: CheckoutResponse | null;
  plan: PlanId | null;
  /** The plan's own price, minor units: struck through when a code or a credit lowers it. */
  listAmountMinor: number | null;
  siteId: string;
  defaultEmail: string | null;
  onClose: () => void;
  /** Called with the PaymentIntent id, or null when a code made it free. */
  onSuccess: (paymentIntentId: string | null) => Promise<void>;
  onCheckoutChange: (next: CheckoutResponse) => void;
}

const PLAN_TITLES: Record<PlanId, { name: string; period: string }> = {
  monthly: { name: "Pro Monthly", period: "Billed monthly" },
  yearly: { name: "Pro Yearly", period: "Billed yearly" },
  lifetime: { name: "Lifetime Access", period: "One-time payment" },
};

const money = (minor: number, currency: string): string => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(minor / 100);
  } catch {
    return `$${(minor / 100).toFixed(2)}`;
  }
};

/**
 * Stripe.js, loaded when the payment dialog opens and not before (Marketplace
 * audit C2). The default `@stripe/stripe-js` entry injects js.stripe.com as a
 * side effect of being imported, which loaded Stripe on every panel open. The
 * `pure` entry injects nothing until `loadStripe` is called, and the dynamic
 * import keeps even that module out of the launch bundle. Fraud signals are
 * off: no Stripe background tracking in the panel.
 */
const stripes = new Map<string, Promise<Stripe | null>>();
const stripeFor = (key: string): Promise<Stripe | null> => {
  let found = stripes.get(key);
  if (!found) {
    found = import("@stripe/stripe-js/pure").then(({ loadStripe }) => {
      // Before loadStripe. Calling it again with the same value is a no-op.
      loadStripe.setLoadParameters({ advancedFraudSignals: false });
      return loadStripe(key);
    });
    // A failed load (offline, blocked) is not cached: the next open tries again.
    found.catch(() => stripes.delete(key));
    stripes.set(key, found);
  }
  return found;
};

/** Stripe Elements in the panel's own colors, light and dark. */
function elementsOptions(clientSecret: string, isLight: boolean): StripeElementsOptions {
  return {
    clientSecret,
    appearance: {
      theme: isLight ? "stripe" : "night",
      variables: {
        colorPrimary: "#5271FF",
        colorBackground: isLight ? "#FFFFFF" : "#201F1F",
        colorText: isLight ? "#101828" : "#FCFCFD",
        colorTextSecondary: isLight ? "#5F6B7A" : "#BFBFBF",
        colorDanger: "#F97066",
        colorIcon: isLight ? "#5F6B7A" : "#BFBFBF",
        borderRadius: "8px",
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
}

/**
 * The checkout dialog, Hydra Booking's design (and Social Share's): the plan
 * and its price, struck through when a code or a credit lowers it, the code
 * (removable, or another typed), the account, then the card. The payment
 * itself stays Stripe's: Stripe Elements in the dialog confirm the
 * PaymentIntent the backend made, and only a succeeded (or processing)
 * PaymentIntent reaches `onSuccess`.
 */
export const PaymentModal: React.FC<PaymentModalProps> = (props) => {
  const { isOpen, publishableKey, checkout, plan, listAmountMinor, siteId, defaultEmail, onClose, onSuccess, onCheckoutChange } = props;
  const [framerTheme, setFramerTheme] = useState<string | null>(() => (typeof document !== "undefined" ? document.body.dataset["framerTheme"] ?? null : null));
  const [stripeLoadError, setStripeLoadError] = useState(false);
  const [stripeReady, setStripeReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [showCouponInput, setShowCouponInput] = useState(false);
  const [applying, setApplying] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const stripePromise = useMemo(() => (isOpen && publishableKey ? stripeFor(publishableKey) : null), [isOpen, publishableKey]);

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
    setStripeReady(false);
    stripePromise.then(
      (stripe) => {
        if (cancelled) return;
        if (stripe) setStripeReady(true);
        else setStripeLoadError(true);
      },
      () => {
        // The script was blocked or the network failed: show the fallback.
        if (!cancelled) setStripeLoadError(true);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [stripePromise]);

  useEffect(() => {
    if (!isOpen) {
      setCouponCode("");
      setShowCouponInput(false);
      setCouponError("");
      setAppliedCode(null);
      setStripeLoadError(false);
      setSubmitting(false);
    }
  }, [isOpen]);

  /** A code that leaves nothing to pay turns the plan on at once. */
  const takeCheckout = async (next: CheckoutResponse) => {
    if (next.complete) {
      await notify({ type: "Success", message: "Discount applied! Access is now active." });
      await onSuccess(null);
      onClose();
      return;
    }
    onCheckoutChange(next);
  };

  const handleApplyCoupon = async () => {
    const code = couponCode.trim();
    if (!code) {
      setCouponError("Please enter a discount code.");
      return;
    }
    setApplying(true);
    setCouponError("");
    const result = await applyCoupon(siteId, code);
    setApplying(false);
    if (result.kind !== "ok") {
      setCouponError(result.kind === "unavailable" && result.message ? result.message : "Invalid or expired discount code.");
      return;
    }
    setAppliedCode(result.data.couponCode ?? code.toUpperCase());
    setCouponCode("");
    setShowCouponInput(false);
    await takeCheckout(result.data);
  };

  /** The X on the code: a fresh checkout with no code at all, the plan's own included, at the plan's full price. */
  const handleRemoveCoupon = async () => {
    if (!plan) return;
    setApplying(true);
    setCouponError("");
    const result = await startCheckout(siteId, plan, null);
    setApplying(false);
    if (result.kind !== "ok") {
      setCouponError(result.kind === "unavailable" && result.message ? result.message : "The code could not be removed. Try again.");
      return;
    }
    setAppliedCode(null);
    setCouponCode("");
    await takeCheckout(result.data);
  };

  if (!isOpen || !plan || !checkout?.clientSecret) return null;

  const title = PLAN_TITLES[plan];
  const due = checkout.amountDueMinor;
  const list = listAmountMinor ?? due;
  // Lower than the plan's price: a code, or (an upgrade) the unused time of the current plan.
  const lowered = due < list;
  const saved = list - due;
  // A code belongs to a first purchase; an upgrade's price already carries its credit.
  const couponAllowed = checkout.creditMinor === 0 && !submitting;
  // The code typed here, else the one the checkout carries: the plan's own (env).
  const shownCode = appliedCode ?? checkout.couponCode ?? null;
  const isLight = framerTheme === "light";

  return (
    <div className="ffmf-pm-backdrop" onClick={submitting ? undefined : onClose}>
      <section className="ffmf-pm-card" role="dialog" aria-modal="true" aria-label={`Upgrade to ${title.name}`} onClick={(event) => event.stopPropagation()}>
        <header className="ffmf-pm-header">
          <div className="ffmf-pm-title-wrap">
            <span className="ffmf-pm-icon-badge" aria-hidden={true}>
              <CreditCard />
            </span>
            <div className="ffmf-pm-title-stack">
              <h3 className="ffmf-pm-title">Upgrade to {title.name}</h3>
              <span className="ffmf-pm-subtitle">Secure checkout with Stripe</span>
            </div>
          </div>
          <button type="button" className="ffmf-pm-close" onClick={onClose} aria-label="Close checkout" disabled={submitting}>
            <X />
          </button>
        </header>

        <div className="ffmf-pm-body">
          <div className="ffmf-pm-summary">
            <div className="ffmf-pm-item">
              <span className="ffmf-pm-item-name">{title.name}</span>
              <span className="ffmf-pm-item-period">{checkout.creditMinor > 0 ? `${money(checkout.creditMinor, checkout.currency)} unused time credited` : title.period}</span>
            </div>
            {lowered ? (
              <div className="ffmf-pm-price-stack">
                <span className="ffmf-pm-price-original">{money(list, checkout.currency)}</span>
                <span className="ffmf-pm-price ffmf-pm-price-discounted">{money(due, checkout.currency)}</span>
              </div>
            ) : (
              <span className="ffmf-pm-price">{money(due, checkout.currency)}</span>
            )}
          </div>

          {shownCode ? (
            <div className="ffmf-pm-coupon-pill">
              <div className="ffmf-pm-coupon-left">
                <Check className="ffmf-pm-coupon-check" aria-hidden={true} />
                <span className="ffmf-pm-coupon-code">{shownCode}</span>
                {saved > 0 && checkout.creditMinor === 0 ? <span className="ffmf-pm-coupon-desc">({money(saved, checkout.currency)} OFF)</span> : null}
              </div>
              {couponAllowed ? (
                <button type="button" className="ffmf-pm-coupon-remove" onClick={() => void handleRemoveCoupon()} aria-label="Remove discount" disabled={applying}>
                  <X />
                </button>
              ) : null}
            </div>
          ) : null}
          {couponAllowed ? (
            <div className="ffmf-pm-coupon">
              {!showCouponInput ? (
                <button type="button" className="ffmf-pm-coupon-toggle" onClick={() => setShowCouponInput(true)}>
                  <Tag aria-hidden={true} />
                  <span>{shownCode ? "Have a different code?" : "Have a discount code?"}</span>
                </button>
              ) : (
                <>
                  <div className="ffmf-pm-coupon-field">
                    <Tag aria-hidden={true} />
                    <input
                      type="text"
                      className="ffmf-pm-coupon-input"
                      placeholder="Enter coupon code"
                      aria-label="Coupon code"
                      value={couponCode}
                      onChange={(event) => {
                        setCouponCode(event.target.value);
                        if (couponError) setCouponError("");
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleApplyCoupon();
                        }
                      }}
                      disabled={applying}
                    />
                    <button type="button" className="ffmf-pm-coupon-apply" onClick={() => void handleApplyCoupon()} disabled={applying || !couponCode.trim()}>
                      {applying ? <Loader2 className="ffmf-pm-spin" aria-label="Applying" /> : "Apply"}
                    </button>
                  </div>
                  {couponError ? (
                    <div className="ffmf-pm-coupon-error" role="alert">
                      {couponError}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {defaultEmail ? (
            <div className="ffmf-pm-account">
              <span className="ffmf-pm-account-label">
                <User aria-hidden={true} />
                Account
              </span>
              <strong className="ffmf-pm-account-email" title={defaultEmail}>
                {defaultEmail}
              </strong>
            </div>
          ) : null}

          {stripeLoadError || !publishableKey ? (
            <div className="ffmf-pm-error" role="alert">
              <p className="ffmf-pm-error-text">
                The payment service could not be loaded. Check your connection, or turn off ad blockers and privacy extensions, then reload the plugin.
              </p>
              <a href="https://framefic.com/support/" target="_blank" rel="noreferrer" className="ffmf-pm-support">
                Contact Support
                <ArrowRight aria-hidden={true} />
              </a>
            </div>
          ) : !stripeReady || !stripePromise ? (
            <div className="ffmf-pm-notice" role="status">
              <Loader2 className="ffmf-pm-spin" aria-hidden={true} />
              <p>Connecting to secure Stripe checkout...</p>
            </div>
          ) : (
            <Elements key={checkout.clientSecret} stripe={stripePromise} options={elementsOptions(checkout.clientSecret, isLight)}>
              <StripeForm
                amountLabel={money(due, checkout.currency)}
                defaultEmail={defaultEmail}
                submitting={submitting}
                setSubmitting={setSubmitting}
                onSuccess={onSuccess}
                onClose={onClose}
              />
            </Elements>
          )}
        </div>
      </section>
    </div>
  );
};

interface StripeFormProps {
  amountLabel: string;
  defaultEmail: string | null;
  submitting: boolean;
  setSubmitting: (value: boolean) => void;
  onSuccess: (paymentIntentId: string | null) => Promise<void>;
  onClose: () => void;
}

/** The card (Stripe's Payment Element) and the pay button. The same confirm flow as before, only restyled. */
const StripeForm: React.FC<StripeFormProps> = ({ amountLabel, defaultEmail, submitting, setSubmitting, onSuccess, onClose }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [processingMessage, setProcessingMessage] = useState("");

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
          message: error.message || (error.type === "card_error" ? "Your card was declined. Please try another card." : "Payment authorization failed."),
        });
        return;
      }
      if (!paymentIntent) {
        await notify({ type: "Error", message: "Unable to confirm payment state. Please contact support if your card was charged." });
        return;
      }
      if (paymentIntent.status === "succeeded") {
        await onSuccess(paymentIntent.id);
        onClose();
      } else if (paymentIntent.status === "processing") {
        setProcessingMessage("Your payment is processing. Your plan activates as soon as your bank confirms.");
        await notify({ type: "Info", message: "Your payment is processing. Your plan will be activated automatically once confirmed." });
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
    <form onSubmit={(event) => void handleSubmit(event)} className="ffmf-pm-stripe">
      {/* Signed in, the account above is the receipt address; without one, Stripe asks for it. */}
      {defaultEmail ? null : (
        <div className="ffmf-link-auth">
          <LinkAuthenticationElement onChange={(event) => setEmail(event.value.email)} />
        </div>
      )}
      <PaymentElement
        options={{
          fields: { billingDetails: "auto" },
          terms: { card: "never" },
          wallets: { applePay: "never", googlePay: "never" },
        }}
      />
      {processingMessage ? (
        <div className="ffmf-pm-notice" role="status">
          <ShieldCheck aria-hidden={true} />
          <p>{processingMessage}</p>
        </div>
      ) : null}
      <div className="ffmf-pm-actions">
        <button type="submit" className="ffmf-pm-cta" disabled={submitting || !stripe || !elements}>
          {submitting ? <Loader2 className="ffmf-pm-spin" aria-hidden={true} /> : <Lock aria-hidden={true} />}
          <span>{submitting ? "Processing payment..." : `Pay ${amountLabel}`}</span>
        </button>
        <div className="ffmf-pm-trust">
          <span>256-bit SSL</span>
          <span className="ffmf-pm-dot" aria-hidden={true}>
            •
          </span>
          <span>Cancel Anytime</span>
          <span className="ffmf-pm-dot" aria-hidden={true}>
            •
          </span>
          <span>Stripe Secured</span>
        </div>
      </div>
    </form>
  );
};
