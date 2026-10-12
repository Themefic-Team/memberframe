/**
 * Member list filtering, labels, and counts. PRD task 2.2, feature F02.
 *
 * Everything in the members table that makes a decision lives here, pure, so
 * that it can be tested. `jsdom` is not installed (blocker B5), so logic left
 * inside a component is logic nothing in this repository can check.
 *
 * The filtering functions do double duty. The real list is filtered server
 * side, by `GET /api/site/members?search=&tier=&status=`, because PRD section
 * 10.3 paginates at 25 and the panel never holds the whole list. `matchesQuery`
 * exists for the page currently in hand: a creator who types another character
 * should see the visible rows narrow immediately rather than wait a round trip,
 * and the server's answer then replaces them.
 */

import { MEMBER_STATUS_LABELS, REQUIRED_TIER_LABELS, type MemberStatus, type TierKey } from "../../types/member";
import type { SiteMemberRecord } from "../../types/site";

/** The tier filter pills, in ladder order, plus the unfiltered state. */
export type TierFilter = "all" | TierKey;

/** The status filter, same shape. */
export type StatusFilter = "all" | MemberStatus;

export const TIER_FILTERS: ReadonlyArray<{ value: TierFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "free_member", label: "Free" },
  { value: "tier_1", label: "Silver" },
  { value: "tier_2", label: "Gold" },
  { value: "vip", label: "VIP" },
];

export const STATUS_FILTERS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "Any status" },
  { value: "active", label: MEMBER_STATUS_LABELS.active },
  { value: "trialing", label: MEMBER_STATUS_LABELS.trialing },
  { value: "past_due", label: MEMBER_STATUS_LABELS.past_due },
  { value: "canceled", label: MEMBER_STATUS_LABELS.canceled },
];

/**
 * Does this member match what the creator typed?
 *
 * F02: "Member search filters by email and name". Case insensitive, and
 * substring rather than prefix, because a creator searching for a customer
 * often remembers the domain and not the local part.
 *
 * A member with a null name is matched on email alone rather than skipped. Not
 * every provider returns a name, and a nameless member is still findable.
 */
export function matchesQuery(member: SiteMemberRecord, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === "") return true;

  if (member.email.toLowerCase().includes(needle)) return true;
  if (member.name && member.name.toLowerCase().includes(needle)) return true;

  return false;
}

export function matchesTier(member: SiteMemberRecord, filter: TierFilter): boolean {
  return filter === "all" || member.tier === filter;
}

export function matchesStatus(member: SiteMemberRecord, filter: StatusFilter): boolean {
  return filter === "all" || member.status === filter;
}

export interface MemberFilters {
  query: string;
  tier: TierFilter;
  status: StatusFilter;
}

export const NO_MEMBER_FILTERS: MemberFilters = { query: "", tier: "all", status: "all" };

/** All three filters, applied to the page in hand. */
export function filterMembers(
  members: ReadonlyArray<SiteMemberRecord>,
  filters: MemberFilters
): ReadonlyArray<SiteMemberRecord> {
  return members.filter(
    (member) =>
      matchesQuery(member, filters.query) &&
      matchesTier(member, filters.tier) &&
      matchesStatus(member, filters.status)
  );
}

/** Is any filter narrowing the list? Drives "no matches" versus "no members". */
export function hasActiveFilters(filters: MemberFilters): boolean {
  return filters.query.trim() !== "" || filters.tier !== "all" || filters.status !== "all";
}

/**
 * The badge tone for a status.
 *
 * `trialing` is brand rather than success: a trial is a good state and a
 * temporary one, and showing it in the same green as an active paying member
 * hides the thing the creator wants to see at a glance.
 */
export function statusTone(status: MemberStatus): "success" | "brand" | "warning" | "neutral" {
  switch (status) {
    case "active":
      return "success";
    case "trialing":
      return "brand";
    case "past_due":
      return "warning";
    case "canceled":
      return "neutral";
  }
}

/** PRD section 7.6 rule 4. The key never reaches a screen. */
export function tierLabel(tier: TierKey): string {
  return REQUIRED_TIER_LABELS[tier];
}

export function statusLabel(status: MemberStatus): string {
  return MEMBER_STATUS_LABELS[status];
}

/**
 * Count with its noun, pluralized properly.
 *
 * PRD section 7.6 rule 5: "Pluralize counts properly: 1 member, 2 members.
 * Never member(s)." Worth a function because the rule applies to tiers and
 * pages too, and three hand-written ternaries is where one of them ends up
 * wrong.
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  const noun = count === 1 ? singular : (plural ?? `${singular}s`);
  return `${count} ${noun}`;
}

/**
 * What the row count line says.
 *
 * Filters change the sentence rather than the number: "3 of 48 members" tells
 * the creator their filter is on, where a bare "3 members" reads as a site with
 * three members.
 */
export function memberCountLabel(
  shownCount: number,
  totalCount: number,
  filters: MemberFilters
): string {
  if (!hasActiveFilters(filters)) return pluralize(totalCount, "member");
  return `${shownCount} of ${pluralize(totalCount, "member")}`;
}

/** Total pages at the PRD's page size, never fewer than one. */
export function pageCount(totalCount: number, pageSize: number): number {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(totalCount / pageSize));
}

/** Short, local date for a row. Never a raw ISO string. */
export function formatJoinedDate(iso: string): string {
  const parsed = Date.parse(iso);
  // A row with a bad timestamp still has to render. An em dash is forbidden by
  // the writing rules; the lone hyphen placeholder is the permitted exception.
  if (Number.isNaN(parsed)) return "-";

  return new Date(parsed).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
