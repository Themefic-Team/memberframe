import React, { useState } from "react";
import { Banner, useToast } from "../ui";
import { useConnection } from "../../hooks/useConnection";
import { useLicense } from "../../hooks/useLicense";
import { fetchBillingPortal, formatDate, licenseNotice, resumePlan } from "../../services/licenseService";

/**
 * One notice at a time above a tab: failed payment, cancellation, renewal.
 * F19, 19-pro-lock-and-trial.md 2.1. The trial countdown is BEAF's sticky bar
 * (billing/TrialStickyBanner) and the lock is BEAF's TrialStatusModal, so
 * neither is drawn here.
 */
export const LicenseBanner: React.FC = () => {
  const { view, now, apply } = useLicense();
  const { connection } = useConnection();
  const showToast = useToast();
  const [working, setWorking] = useState(false);
  const notice = licenseNotice(view, now);
  if (!notice || notice.kind === "trial" || !connection) return null;

  if (notice.kind === "payment_failed") {
    return (
      <Banner
        tone="danger"
        title="Your payment failed"
        message="Update your card so your plan keeps running. Stripe will try again over the next few days."
        action={{
          label: "Update card",
          onClick: () => {
            void fetchBillingPortal(connection.siteId).then((result) => {
              if (result.kind === "ok") window.open(result.data.url, "_blank", "noopener,noreferrer");
              else showToast({ tone: "error", message: "Could not open billing" });
            });
          },
        }}
      />
    );
  }

  if (notice.kind === "canceling") {
    return (
      <Banner
        tone="info"
        title={`Your plan ends on ${formatDate(notice.endsAt)}`}
        message="Everything keeps working until then. Resume to keep it renewing."
        action={{
          label: working ? "Resuming" : "Resume",
          onClick: () => {
            if (working) return;
            setWorking(true);
            void resumePlan(connection.siteId).then((result) => {
              setWorking(false);
              if (result.kind === "ok") {
                apply(result.data.license);
                showToast({ tone: "success", message: "Your plan will renew" });
              } else showToast({ tone: "error", message: "Could not resume the plan" });
            });
          },
        }}
      />
    );
  }

  return <Banner tone="info" title={`Your plan renews on ${formatDate(notice.renewsAt)}`} message="Nothing to do. Change or cancel it in Account, Manage subscription." />;
};
