import React, { useEffect, useState } from "react";
import { Link2, ShieldCheck, ShieldOff, Trash2 } from "lucide-react";
import { Badge, Button, ConfirmDialog, Field, Fields, Select, Sheet, SkeletonList } from "../ui";
import type { SiteMemberRecord } from "../../types/site";
import { siteTiers, type TierKey } from "../../types/member";
import { formatJoinedDate, statusLabel, statusTone, tierLabel } from "./memberFilters";
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

  if (!data && !failed) {
    return (
      <MemberSection title="Purchases">
        <SkeletonList label="Loading purchases" count={2} variant="line" />
      </MemberSection>
    );
  }
  const empty = failed ? "Purchases could not be loaded." : null;
  if (empty !== null || !data || (data.subscriptions.length === 0 && data.payments.length === 0)) {
    return (
      <MemberSection title="Purchases">
        <p className="member-section-empty">{empty ?? "No purchases yet."}</p>
      </MemberSection>
    );
  }

  return (
    <MemberSection title="Purchases">
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
    </MemberSection>
  );
};

/** One titled well in the member panel: Sign-in methods, Profile, Purchases. */
const MemberSection: React.FC<{ title: string; meta?: string; children: React.ReactNode }> = ({ title, meta, children }) => (
  <div className="member-profile" role="group" aria-label={title}>
    <div className="member-section-head">
      <span className="member-profile-title">{title}</span>
      {meta ? <span className="member-section-meta">{meta}</span> : null}
    </div>
    {children}
  </div>
);

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
  const answered = visible.filter((field) => displayValue(field, metadata[field.key]) !== "Not answered");
  const unanswered = visible.filter((field) => !answered.includes(field));

  // A wall of "Not answered" hides the few answers there are: list what was
  // answered, and name the rest in one line.
  return (
    <MemberSection title="Profile" meta={`${answered.length} of ${visible.length} answered`}>
      {answered.length === 0 ? <p className="member-section-empty">No answers yet.</p> : null}
      {answered.length > 0 ? (
        <dl className="member-profile-list">
          {answered.map((field) => {
            const value = metadata[field.key];
            return (
              <div className="member-profile-row" key={field.key}>
                <dt className="member-profile-label">{field.label}</dt>
                <dd className="member-profile-value">
                  {field.type === "url" && typeof value === "string" && isSafeUrl(value) ? (
                    <a href={value} target="_blank" rel="noopener noreferrer">
                      {value}
                    </a>
                  ) : (
                    displayValue(field, value)
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      ) : null}
      {answered.length > 0 && unanswered.length > 0 ? (
        <p className="member-section-empty">{`Not answered: ${unanswered.map((field) => field.label).join(", ")}`}</p>
      ) : null}
    </MemberSection>
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
    <MemberSection title="Sign-in methods">
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
              {isSignInProvider(identity.provider) ? <ProviderMark provider={identity.provider} small /> : null}
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
            <dd className="member-profile-value">
              <Badge tone={member.hasPassword ? "success" : "neutral"}>{member.hasPassword ? "Set" : "Not set"}</Badge>
            </dd>
          </div>
        ) : null}
      </dl>
    </MemberSection>
  );
};

/** "SR" for Sydur Rahman, "S" for sydur@example.com. */
function initialsOf(name: string | null, email: string): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0]![0]}${words[words.length - 1]![0]}`.toUpperCase();
  return (words[0]?.[0] ?? email[0] ?? "?").toUpperCase();
}

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
 * Shown in the kit's Sheet, a centered dialog over the list (2026-10-25, the
 * user's request), not inline under the member's row. Delete member is pinned
 * in the footer. No `.primary-cta`: every control here is a secondary or a
 * danger button.
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

  const alreadyRevoked = member.status === "canceled";

  return (
    <>
    <Sheet
      title={member.name ?? member.email}
      description={member.name ? member.email : undefined}
      icon={<span className="member-sheet-initials">{initialsOf(member.name, member.email)}</span>}
      badge={
        <span className="member-flyout-badges">
          <Badge tone="brand">{tierLabel(member.tier)}</Badge>
          <Badge tone={statusTone(member.status)}>{statusLabel(member.status)}</Badge>
        </span>
      }
      onClose={onClose}
      footer={
        <Button variant="danger" size="md" disabled={busy} onClick={() => setConfirming("delete")}>
          <Trash2 aria-hidden={true} />
          Delete member
        </Button>
      }
    >

      <Fields>
        <Field label="Tier" htmlFor={`member-tier-${member.id}`}>
          <Select
            id={`member-tier-${member.id}`}
            value={member.tier}
            options={tierOptions()}
            disabled={busy}
            onChange={(tier) => onAction({ kind: "change_tier", tier })}
            fill
          />
        </Field>
      </Fields>

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
      </div>

      <MemberSignInMethods member={member} />

      {profileFields.length > 0 ? (
        <MemberProfileValues fields={profileFields} metadata={member.metadata} />
      ) : null}

      {siteId ? <MemberPurchasesList siteId={siteId} memberId={member.id} /> : null}

      <p className="member-flyout-note">Changes apply on this member's next session check.</p>
    </Sheet>
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
    </>
  );
};
