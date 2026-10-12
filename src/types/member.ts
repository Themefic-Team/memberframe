/**
 * Member and tier data contracts. PRD section 11.
 *
 * These shapes are owned by the backend repository and specified in the PRD so
 * the plugin's types and the server's schema cannot drift. Changing anything
 * here is a schema change, not a refactor.
 *
 * Two conflicts in the PRD were found while writing this file and are resolved
 * below with the reasoning inline. Both are written up in
 * `docs/development-docs/04-live-preview-studio.md` section 5.1 and both still
 * need confirmation.
 */

/**
 * Canonical tier keys.
 *
 * CONFLICT B, resolved in favour of these values. PRD section 8 F01 gives the
 * `requiredTier` property control the options `free_member`, `tier_1`, `tier_2`,
 * `vip`, while the `MemberSessionData` comment on the same page spells the held
 * tier `"free" | "silver" | "gold" | "vip"`. Section 11.3 then compares the two
 * through a single `tiers` array, which no single array can satisfy.
 *
 * Read literally, a Silver subscriber holding `silver` fails a `tier_1` gate:
 * the lookup misses, `held` is undefined, and the resolver returns false. That
 * is a total gating failure, silently.
 *
 * These values win because they are the strings baked into the property control
 * and therefore visible in Framer's sidebar and embedded in generated canvas
 * code. `free` / `silver` / `gold` / `vip` are display names, and they live on
 * `TierLadderEntry.name`.
 */
export type TierKey = "free_member" | "tier_1" | "tier_2" | "vip";

/**
 * What a gate can require.
 *
 * The two pseudo-tiers are not ranked and are deliberately outside `TierKey`:
 * `anyone` short-circuits to entitled, `signed_in` only asks for a valid
 * session. Neither appears in the site's tier table.
 */
export type RequiredTier = "anyone" | "signed_in" | TierKey;

export type MemberStatus = "active" | "trialing" | "past_due" | "canceled";

export interface MemberSessionData {
  memberId: string;
  email: string;
  name: string | null;
  activeTier: TierKey;
  status: MemberStatus;
  /**
   * Unix seconds, UTC. A canceled member keeps access until this moment,
   * because they paid for the period. PRD section 11.3 behaviour 1.
   */
  currentPeriodEnd: number;
  /**
   * Unix seconds, UTC. A `past_due` member keeps access until this moment.
   * PRD section 11.3 behaviour 2, and the F18 dunning window.
   *
   * CONFLICT A, resolved as the superset. PRD section 11.3 reads this field in
   * `isEntitled`, but the `MemberSessionData` interface in F01 declares seven
   * fields and this is not one of them, so the specified resolver does not
   * typecheck against the specified interface. Declared here because section
   * 11.3 is the security-critical contract and F18 cannot exist without a grace
   * window. Omitting it would revoke access the instant a payment fails, which
   * contradicts F18 outright. This is a backend column: confirm before the
   * schema is written.
   */
  gracePeriodEndsAt: number;
  siteId: string;
}

export interface TierLadderEntry {
  key: TierKey;
  /**
   * Unique per site, PRD section 11.2. Higher outranks lower, which is what
   * makes a VIP pass a Silver gate without the creator configuring anything.
   */
  rank: number;
  /** Creator-facing display name. Never show the key to a user. */
  name: string;
}

/**
 * The default tier ladder, used by the preview studio and as the seed for a new
 * site. A real site's tiers come from the backend, which does not exist yet
 * (blocker B1), so for now this is the only tier table in the product.
 */
export const DEFAULT_SITE_TIERS: ReadonlyArray<TierLadderEntry> = [
  { key: "free_member", rank: 0, name: "Free" },
  { key: "tier_1", rank: 1, name: "Silver" },
  { key: "tier_2", rank: 2, name: "Gold" },
  { key: "vip", rank: 3, name: "VIP" },
];

/**
 * Friendly labels for the gate requirement. PRD section 7.6 rule 4 forbids
 * surfacing a raw enum value to a user, so every path from a key to the screen
 * goes through a map like this one.
 *
 * The titles match F01's `optionTitles` so the plugin panel and the Framer
 * sidebar name the same thing the same way.
 */
export const REQUIRED_TIER_LABELS: Record<RequiredTier, string> = {
  anyone: "Anyone",
  signed_in: "Any signed in",
  free_member: "Free member",
  tier_1: "Tier 1: Silver",
  tier_2: "Tier 2: Gold",
  vip: "VIP member",
};

/** Member status, in words a creator can read. Never render the key. */
export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  active: "Active",
  trialing: "In trial",
  past_due: "Payment failed",
  canceled: "Canceled",
};

export function tierName(key: TierKey, tiers = DEFAULT_SITE_TIERS): string {
  return tiers.find((tier) => tier.key === key)?.name ?? REQUIRED_TIER_LABELS[key];
}
