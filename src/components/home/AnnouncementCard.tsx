import React, { useId, useState } from "react";
import { Copy, X } from "lucide-react";
import { countdownShown, countdownText, type AnnouncementCampaign } from "../../utils/announcementRules";

/**
 * Copy `value`: the Clipboard API, then the older copy command. False when
 * neither worked (a blocked clipboard), so the card can offer the code to
 * select by hand.
 */
export async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Refused (permissions, an unfocused frame): try the copy command.
  }
  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.className = "sr-only";
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  } catch {
    return false;
  }
}

/**
 * One press of the card's button. With a code not yet copied: copy it and
 * nothing else (no navigation). Otherwise: open the plans.
 */
export async function runOfferAction(input: {
  code: string | null;
  copied: boolean;
  copy: (value: string) => Promise<boolean>;
  onCopied: () => void;
  onOpenPricing: () => void;
}): Promise<"opened" | "copied" | "copy_failed"> {
  if (input.code === null || input.copied) {
    input.onOpenPricing();
    return "opened";
  }
  if (await input.copy(input.code)) {
    input.onCopied();
    return "copied";
  }
  return "copy_failed";
}

export interface AnnouncementCardProps {
  campaign: AnnouncementCampaign;
  /** The code was copied in this window: the button opens the plans. */
  copied: boolean;
  /** Until the countdown ends; null without one. */
  remainingMs: number | null;
  onCopied: () => void;
  onClose: () => void;
  /** The plans (Account, Subscription): the billing screens decide what can be bought. */
  onOpenPricing: () => void;
  /** Overridable for tests. */
  copy?: (value: string) => Promise<boolean>;
}

/**
 * The Home promo campaign card (37-promo-campaign-card.md, the same card as Hydra Booking): brand blue, the countdown over the
 * title, the line under it, one action, and the animated gift on the right.
 * Every word comes from the backend's env, rendered as text.
 *
 * With a coupon, the first press copies it (nothing else happens); after
 * that the button reads ANNOUNCEMENT_BUTTON_TEXT and opens the plans. Without
 * one, the button opens the plans at once. A copy that fails keeps the copy
 * action and shows the code to select by hand.
 */
export const AnnouncementCard: React.FC<AnnouncementCardProps> = ({ campaign, copied, remainingMs, onCopied, onClose, onOpenPricing, copy = copyText }) => {
  const titleId = useId();
  const manualId = useId();
  const [copyFailed, setCopyFailed] = useState(false);
  const [message, setMessage] = useState("");
  const code = campaign.couponCode;
  const showCode = code !== null && !copied;
  const showTimer = remainingMs !== null && countdownShown(campaign, remainingMs);

  const onAction = async () => {
    const outcome = await runOfferAction({ code, copied, copy, onCopied, onOpenPricing });
    if (outcome === "copied") {
      setCopyFailed(false);
      setMessage(`Code ${code} copied. The button now opens the plans.`);
    } else if (outcome === "copy_failed") {
      setCopyFailed(true);
      setMessage(`Could not copy the code. Select ${code} below and copy it.`);
    }
  };

  return (
    <section className="mf-offer" aria-labelledby={titleId}>
      <div className="mf-offer-body">
        {showTimer ? (
          <p className="mf-offer-countdown" role="timer" aria-live="off">
            Offer closes in <span className="mf-offer-clock">{countdownText(remainingMs)}</span>
          </p>
        ) : null}
        <h2 id={titleId} className="mf-offer-title">
          {campaign.title}
        </h2>
        {campaign.subtitle ? <p className="mf-offer-subtitle">{campaign.subtitle}</p> : null}
        <button type="button" className="mf-offer-action" aria-label={showCode ? `Copy code ${code}` : undefined} onClick={() => void onAction()}>
          {showCode ? (
            <>
              <span className="mf-offer-action-label mf-offer-code">{code}</span>
              <Copy className="mf-offer-action-icon" aria-hidden={true} />
            </>
          ) : (
            <span className="mf-offer-action-label">{campaign.buttonText}</span>
          )}
        </button>
        {copyFailed && showCode ? (
          <div className="mf-offer-manual">
            <label htmlFor={manualId}>Copy did not work. Select the code and copy it.</label>
            <input id={manualId} className="mf-offer-manual-input" type="text" readOnly value={code ?? ""} onFocus={(event) => event.currentTarget.select()} />
          </div>
        ) : null}
        <span className="sr-only" role="status" aria-live="polite">
          {message}
        </span>
      </div>
      <div className="mf-offer-art" aria-hidden={true}>
        <picture>
          <source media="(prefers-reduced-motion: reduce)" srcSet="/announcement-gift-static.webp" type="image/webp" />
          <img className="mf-offer-gift" src="/announcement-gift.webp" alt="" width={196} height={224} decoding="async" />
        </picture>
      </div>
      <button type="button" className="mf-offer-close" aria-label="Close offer" onClick={onClose}>
        <X className="mf-offer-close-icon" aria-hidden={true} />
      </button>
    </section>
  );
};

/** The card's shape while its campaign, account, or project is still loading: no text, no numbers. */
export const AnnouncementSkeleton: React.FC = () => <div className="kit-skeleton mf-offer-skeleton" aria-hidden={true} />;
