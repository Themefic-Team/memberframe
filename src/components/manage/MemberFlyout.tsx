import React, { useCallback, useEffect, useState } from "react";
import { Link2, ShieldCheck, ShieldOff, Trash2, X } from "lucide-react";
import { Button, ConfirmDialog, FieldRow, FieldRows, IconButton, Select } from "../ui";
import type { SiteMemberRecord } from "../../types/site";
import { siteTiers, type TierKey } from "../../types/member";
import { formatJoinedDate, tierLabel } from "./memberFilters";
import { ProviderMark, SIGN_IN_PROVIDER_NAMES, isSignInProvider } from "../providerMarks";
import {
  displayValue,
  isFieldVisible,
  isSafeUrl,
  type CustomFieldDefinition,
  type MemberMetadata,
} from "../../utils/customFields";
import { cn } from "../../utils/cn";
import { PAYMENT_GATEWAY_LABELS, fetchMemberPurchases, type MemberPurchases, type PaymentGateway } from "../../services/paymentsService";
import { formatMinorWithCurrency } from "../../utils/money";
import { currencyExponent } from "../../utils/currencies";

export type MemberAction =
  | { kind: "change_tier"; tier: TierKey }
  | { kind: "revoke" }
  | { kind: "restore" }
  | { kind: "delete" }
  | { kind: "magic_link" };

export interface MemberFlyoutProps {
  member: SiteMemberRecord;
  busy: boolean;
  onAction: (action: MemberAction) => void;
  onClose: () => void;
  /** FP-09. Empty hides the profile section entirely. */
  profileFields?: ReadonlyArray<CustomFieldDefinition>;
  /** Shows the member's purchases and the method each was paid with. Absent: no purchases section. */
  siteId?: string;
}

/** A subscription status in words, never the raw value. */
const SUBSCRIPTION_STATUS: Record<string, string> = {
  active: "Active",
  canceling: "Ends at period end",
  past_due: "Payment failed",
  canceled: "Ended",
  expired: "Ended",
};

const INTERVAL_WORDS: Record<string, string> = { month: "monthly", year: "yearly", lifetime: "lifetime" };

function gatewayName(gateway: string): string {
  return PAYMENT_GATEWAY_LABELS[gateway as PaymentGateway] ?? gateway;
}

function money(minor: number, currency: string): string {
  return formatMinorWithCurrency(minor, currency, currencyExponent(currency));
}

/**
 * The member's plans and payments, each with the method it was paid with
 * (29-checkout-methods.md: which member paid through which gateway).
 */
const MemberPurchasesList: React.FC<{ siteId: string; memberId: string }> = ({ siteId, memberId }) => {
  const [data, setData] = useState<MemberPurchases | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchMemberPurchases(siteId, memberId).then((result) => {
      if (!active) return;
      if (result.kind === "ok") setData(result.data);
      else setFailed(true);
    });
    return () => {
      active = false;
    };
  }, [memberId, siteId]);

  if (failed) return <p className="member-flyout-note">Purchases could not be loaded.</p>;
  if (!data) return <p className="member-flyout-note">Loading purchases.</p>;
  if (data.subscriptions.length === 0 && data.payments.length === 0) {
    return <p className="member-flyout-note">No purchases yet.</p>;
  }

  return (
    <div className="member-profile" role="group" aria-label="Purchases">
      <span className="member-profile-title">Purchases</span>
      <dl className="member-profile-list">
        {data.subscriptions.map((subscription, index) => (
          <div className="member-profile-row" key={`plan-${index}`}>
            <dt className="member-profile-label">
              {tierLabel(subscription.tierKey as TierKey)}, {INTERVAL_WORDS[subscription.interval] ?? subscription.interval}
            </dt>
            <dd className="member-profile-value">
              {[
                gatewayName(subscription.gateway),
                SUBSCRIPTION_STATUS[subscription.status] ?? "Ended",
                subscription.mode === "test" ? "Test" : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </dd>
          </div>
        ))}
        {data.payments.slice(0, 10).map((payment, index) => (
          <div className="member-profile-row" key={`payment-${index}`}>
            <dt className="member-profile-label">{new Date(payment.paidAt).toLocaleDateString()}</dt>
            <dd className="member-profile-value">
              {[
                money(payment.amountMinor, payment.currency),
                gatewayName(payment.gateway),
                payment.status === "refunded" ? "Refunded" : null,
                payment.mode === "test" ? "Test" : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

/**
 * The member's answers to the site's profile fields. FP-09 section 3.3, PRD
 * F16's "collected metadata appears on the member record in the Manage tab".
 *
 * Read only. A creator editing a member's answers is a different feature with
 * its own endpoint and its own audit question, and nothing has asked for it.
 *
 * A web address is a link only when it passes `isSafeUrl`. The server refuses
 * anything else on the way in, so this is a second check rather than the only
 * one, and it is the one that matters if a value predates the rule: an href of
 * `javascript:` inside the Framer editor would run in the plugin's frame.
 */
const MemberProfileValues: React.FC<{
  fields: ReadonlyArray<CustomFieldDefinition>;
  metadata: MemberMetadata | undefined;
}> = ({ fields, metadata }) => {
  if (!metadata) {
    // A server older than FP-09 sends no metadata at all. Saying "Not answered"
    // eight times would accuse the member of something the server did not say.
    return (
      <p className="member-flyout-note">Profile answers are not available from the server yet.</p>
    );
  }

  const visible = fields.filter((field) => isFieldVisible(field, metadata));

  return (
    <div className="member-profile" role="group" aria-label="Profile">
      <span className="member-profile-title">Profile</span>
      <dl className="member-profile-list">
        {visible.map((field) => {
          const value = metadata[field.key];
          const text = displayValue(field, value);
          const answered = text !== "Not answered";

          return (
            <div className="member-profile-row" key={field.key}>
              <dt className="member-profile-label">{field.label}</dt>
              <dd className={cn("member-profile-value", !answered && "is-empty")}>
                {field.type === "url" && typeof value === "string" && isSafeUrl(value) ? (
                  <a href={value} target="_blank" rel="noopener noreferrer">
                    {value}
                  </a>
                ) : (
                  text
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
};

const SIGNUP_METHOD_LABELS: Record<string, string> = {
  email: "Email and password",
  added: "Added by you",
};

/** How the account was made, in words. */
export function signupMethodLabel(method: string | null | undefined): string {
  if (isSignInProvider(method)) return SIGN_IN_PROVIDER_NAMES[method];
  return (method && SIGNUP_METHOD_LABELS[method]) || "Not recorded";
}

/**
 * How this member signs in (31-sign-in-methods.md): how the account was made,
 * every social sign in linked to it, and whether it has a password. One
 * account per email, so Google and then GitHub on the same address are two
 * lines here, not two members. Read only.
 */
export const MemberSignInMethods: React.FC<{ member: SiteMemberRecord }> = ({ member }) => {
  // A backend older than 31-sign-in-methods.md sends neither: say nothing rather than "Not recorded".
  if (member.signupMethod === undefined && member.identities === undefined) return null;
  const identities = member.identities ?? [];
  const known = member.signupMethod !== null && member.signupMethod !== undefined;

  return (
    <div className="member-profile" role="group" aria-label="Sign-in methods">
      <span className="member-profile-title">Sign-in methods</span>
      <dl className="member-profile-list">
        <div className="member-profile-row">
          <dt className="member-profile-label">Signed up with</dt>
          <dd className={cn("member-profile-value", !known && "is-empty")}>
            {known ? `${signupMethodLabel(member.signupMethod)}, ${formatJoinedDate(member.createdAt)}` : "Not recorded"}
          </dd>
        </div>
        {identities.map((identity) => (
          <div className="member-profile-row" key={`${identity.provider}-${identity.createdAt}`}>
            <dt className="member-profile-label member-signin-provider">
              {isSignInProvider(identity.provider) ? <ProviderMark provider={identity.provider} size={12} /> : null}
              {isSignInProvider(identity.provider) ? SIGN_IN_PROVIDER_NAMES[identity.provider] : identity.provider}
            </dt>
            <dd className="member-profile-value">{`${identity.email}. Last used ${formatJoinedDate(identity.lastUsedAt)}`}</dd>
          </div>
        ))}
        {identities.length === 0 ? (
          <div className="member-profile-row">
            <dt className="member-profile-label">Linked accounts</dt>
            <dd className="member-profile-value is-empty">None</dd>
          </div>
        ) : null}
        {member.hasPassword !== undefined ? (
          <div className="member-profile-row">
            <dt className="member-profile-label">Password</dt>
            <dd className={cn("member-profile-value", !member.hasPassword && "is-empty")}>{member.hasPassword ? "Set" : "Not set"}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
};

/** The site's own tiers, read when the flyout renders, so custom tiers are offered too. */
function tierOptions(): ReadonlyArray<{ value: TierKey; label: string }> {
  return siteTiers().map((tier) => ({ value: tier.key, label: tier.name }));
}

/**
 * The row action flyout. PRD task 2.2, feature F02.
 *
 * Change tier, send magic link, revoke access, and delete member. Revoke and
 * delete are the destructive ones, so they are the only ones with a
 * confirmation step, which F02 requires. Adding a confirmation to the other
 * two would teach the creator to dismiss the ones that matter.
 *
 * Grant VIP was removed: a site has only the tiers its creator made, so a
 * fixed VIP shortcut pointed at a tier most sites do not have. Moving a member
 * to any tier is the Tier picker's job.
 *
 * Revoke also cancels the member's subscription at the payment provider, at
 * once and with no refund, and signs them out (doc 26). Once revoked, the
 * button is Restore access, which needs no confirmation: it only lets the
 * member back in on Free.
 *
 * Revoke and delete confirm in a `<ConfirmDialog>` popup (2026-10-19, the
 * product owner: nothing in the panel deletes on the first click). The dialog
 * names the member, so it still says what is being confirmed.
 *
 * No `.primary-cta` here. The Manage tab's single primary action belongs to the
 * Tiers segment, per PRD section 7.3, so every control in this flyout is a
 * secondary or a danger button.
 */
export const MemberFlyout: React.FC<MemberFlyoutProps> = ({
  member,
  busy,
  onAction,
  onClose,
  profileFields = [],
  siteId,
}) => {
  const [confirming, setConfirming] = useState<"revoke" | "delete" | null>(null);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    },
    [onClose]
  );

  const alreadyRevoked = member.status === "canceled";

  return (
    <div
      className="member-flyout"
      role="group"
      aria-label={`Actions for ${member.name ?? member.email}`}
      onKeyDown={handleKeyDown}
    >
      <div className="member-flyout-head">
        <span className="member-flyout-title">{member.name ?? member.email}</span>
        <IconButton label="Close actions" variant="ghost" onClick={onClose}>
          <X aria-hidden={true} />
        </IconButton>
      </div>

      <FieldRows>
        <FieldRow label="Tier" htmlFor={`member-tier-${member.id}`} fill>
          <Select
            id={`member-tier-${member.id}`}
            value={member.tier}
            options={tierOptions()}
            disabled={busy}
            onChange={(tier) => onAction({ kind: "change_tier", tier })}
            fill
          />
        </FieldRow>
      </FieldRows>

      <div className="member-flyout-actions">
        <Button
          variant="secondary"
          size="md"
          className="fill"
          // The server refuses a link for a revoked member: restore first.
          disabled={busy || alreadyRevoked}
          onClick={() => onAction({ kind: "magic_link" })}
        >
          <Link2 aria-hidden={true} />
          Send magic link
        </Button>

        {alreadyRevoked ? (
          <Button
            variant="secondary"
            size="md"
            className="fill"
            disabled={busy}
            onClick={() => onAction({ kind: "restore" })}
          >
            <ShieldCheck aria-hidden={true} />
            Restore access
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="md"
            className="fill"
            disabled={busy}
            onClick={() => setConfirming("revoke")}
          >
            <ShieldOff aria-hidden={true} />
            Revoke access
          </Button>
        )}

        <Button
          variant="secondary"
          size="md"
          className="fill"
          disabled={busy}
          onClick={() => setConfirming("delete")}
        >
          <Trash2 aria-hidden={true} />
          Delete member
        </Button>
      </div>

      {confirming === "revoke" ? (
        <ConfirmDialog
          title="Revoke this member's access?"
          message={
            <p>
              {member.email} is signed out and moved to Free. Their subscription at your payment provider is
              cancelled now, with no refund. Their invoice history is kept.
            </p>
          }
          confirmLabel="Revoke access"
          cancelLabel="Keep access"
          icon={<ShieldOff aria-hidden={true} />}
          busy={busy}
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            setConfirming(null);
            onAction({ kind: "revoke" });
          }}
        />
      ) : null}

      {confirming === "delete" ? (
        <ConfirmDialog
          title="Delete this member?"
          message={
            <>
              <p>
                {member.email} is removed for good, with their sessions and bookmarks. They can sign up again as
                a new member. This cannot be undone.
              </p>
              <p>Payment records are kept. A subscription at your payment provider is not cancelled.</p>
            </>
          }
          confirmLabel="Delete member"
          cancelLabel="Keep member"
          busy={busy}
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            setConfirming(null);
            onAction({ kind: "delete" });
          }}
        />
      ) : null}

      <MemberSignInMethods member={member} />

      {profileFields.length > 0 ? (
        <MemberProfileValues fields={profileFields} metadata={member.metadata} />
      ) : null}

      {siteId ? <MemberPurchasesList siteId={siteId} memberId={member.id} /> : null}

      <p className="member-flyout-note">
        {`Changes apply on this member's next session check. Currently ${tierLabel(member.tier)}.`}
      </p>
    </div>
  );
};
