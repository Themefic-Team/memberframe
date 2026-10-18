import React, { useCallback, useState } from "react";
import { Link2, ShieldOff, Trash2, X } from "lucide-react";
import { Button, FieldRow, FieldRows, IconButton, Select } from "../ui";
import type { SiteMemberRecord } from "../../types/site";
import { siteTiers, type TierKey } from "../../types/member";
import { statusLabel, tierLabel } from "./memberFilters";
import {
  displayValue,
  isFieldVisible,
  isSafeUrl,
  type CustomFieldDefinition,
  type MemberMetadata,
} from "../../utils/customFields";
import { cn } from "../../utils/cn";

export type MemberAction =
  | { kind: "change_tier"; tier: TierKey }
  | { kind: "revoke" }
  | { kind: "delete" }
  | { kind: "magic_link" };

export interface MemberFlyoutProps {
  member: SiteMemberRecord;
  busy: boolean;
  onAction: (action: MemberAction) => void;
  onClose: () => void;
  /** FP-09. Empty hides the profile section entirely. */
  profileFields?: ReadonlyArray<CustomFieldDefinition>;
}

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
 * Each confirm step replaces its button in place rather than opening a
 * second layer. A dialog over a flyout in a 360px panel leaves nowhere to
 * read the thing being confirmed.
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
          disabled={busy}
          onClick={() => onAction({ kind: "magic_link" })}
        >
          <Link2 aria-hidden={true} />
          Send magic link
        </Button>

        {confirming === "revoke" ? (
          <div className="member-flyout-confirm" role="alert">
            <p className="member-flyout-confirm-text">
              Revoke access for this member? They keep their invoice history.
            </p>
            <div className="member-flyout-confirm-buttons">
              <Button
                variant="ghost"
                size="md"
                disabled={busy}
                onClick={() => setConfirming(null)}
              >
                Keep access
              </Button>
              <Button
                variant="danger"
                size="md"
                disabled={busy}
                onClick={() => onAction({ kind: "revoke" })}
              >
                Revoke access
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="secondary"
            size="md"
            className="fill"
            disabled={busy || alreadyRevoked}
            onClick={() => setConfirming("revoke")}
          >
            <ShieldOff aria-hidden={true} />
            {alreadyRevoked ? `Access ${statusLabel(member.status).toLowerCase()}` : "Revoke access"}
          </Button>
        )}

        {confirming === "delete" ? (
          <div className="member-flyout-confirm" role="alert">
            <p className="member-flyout-confirm-text">
              Delete this member for good? Their account, sessions, and bookmarks are removed and they
              can sign up again as new. Payment records are kept. A subscription at your payment
              provider is not cancelled.
            </p>
            <div className="member-flyout-confirm-buttons">
              <Button variant="ghost" size="md" disabled={busy} onClick={() => setConfirming(null)}>
                Keep member
              </Button>
              <Button
                variant="danger"
                size="md"
                disabled={busy}
                onClick={() => onAction({ kind: "delete" })}
              >
                Delete member
              </Button>
            </div>
          </div>
        ) : (
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
        )}
      </div>

      {profileFields.length > 0 ? (
        <MemberProfileValues fields={profileFields} metadata={member.metadata} />
      ) : null}

      <p className="member-flyout-note">
        {`Changes apply on this member's next session check. Currently ${tierLabel(member.tier)}.`}
      </p>
    </div>
  );
};
