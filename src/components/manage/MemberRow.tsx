import React from "react";
import { ChevronRight, User } from "lucide-react";
import { cn } from "../../utils/cn";
import type { SiteMemberRecord } from "../../types/site";
import { formatMinorWithCurrency } from "../../utils/money";
import { currencyExponent } from "../../utils/currencies";
import { formatJoinedDate, statusLabel, statusTone, tierLabel } from "./memberFilters";

export interface MemberRowProps {
  member: SiteMemberRecord;
  selected: boolean;
  onSelect: (member: SiteMemberRecord) => void;
}

/**
 * One row of the members table. PRD task 2.2, feature F02.
 *
 * A button rather than a div with a click handler, so it is in the tab order,
 * responds to Enter and Space, and is announced as actionable. F02 opens the
 * action flyout from a row click, which makes the row a control.
 *
 * The avatar falls back to a Lucide icon rather than initials. An avatar URL
 * comes from a third-party provider, and a broken image with alt text is worse
 * than a neutral glyph in a 28px circle.
 */
export const MemberRow: React.FC<MemberRowProps> = ({ member, selected, onSelect }) => (
  <button
    type="button"
    className={cn("member-row", selected && "is-selected")}
    onClick={() => onSelect(member)}
    aria-expanded={selected}
  >
    <span className="member-row-avatar">
      {member.avatarUrl ? (
        <img src={member.avatarUrl} alt="" className="member-row-avatar-img" />
      ) : (
        <User aria-hidden={true} />
      )}
    </span>

    <span className="member-row-identity">
      {/*
        Name above email when there is a name, email alone when there is not.
        Not every provider returns a name, and a row reading "Unknown" over an
        address tells the creator less than the address on its own.
      */}
      <span className="member-row-name">{member.name ?? member.email}</span>
      {member.name ? <span className="member-row-email">{member.email}</span> : null}
      <span className="member-row-meta">
        {tierLabel(member.tier)}
        {". Joined "}
        {formatJoinedDate(member.createdAt)}
        {". "}
        {formatMinorWithCurrency(member.lifetimeSpend, member.currency, currencyExponent(member.currency))}
        {" lifetime."}
      </span>
    </span>

    <span className="member-row-trailing">
      <span className={cn("badge", `badge-${statusTone(member.status)}`)}>
        {statusLabel(member.status)}
      </span>
      <ChevronRight aria-hidden={true} className="member-row-chevron" />
    </span>
  </button>
);
