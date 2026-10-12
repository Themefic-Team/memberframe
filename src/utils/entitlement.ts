/**
 * The shared entitlement resolver. PRD section 11.3.
 *
 * PRD section 11.3 is explicit: this function is "implemented identically in the
 * plugin, the canvas components, and the backend. Divergence between the three
 * is a security defect." This file is the plugin's copy and the reference the
 * other two are held to. Do not fork it, do not add a shortcut, do not let a
 * caller pass a pre-computed boolean instead.
 *
 * Written under task 1.8 but landed early, with task 1.1. The Live Preview
 * Studio's first acceptance criterion is that all five simulated states render
 * distinctly, and nothing can tell Silver from VIP from a failed payment
 * without resolving entitlement. Reasoning in
 * `docs/development-docs/04-live-preview-studio.md` section 3.3.
 */

import {
  DEFAULT_SITE_TIERS,
  type MemberSessionData,
  type RequiredTier,
  type TierLadderEntry,
} from "../types/member";

/**
 * Does this session satisfy this gate?
 *
 * Fails closed at every exit. An absent session, an unreadable status, or a
 * tier key missing from the site's table all return false, because a gate that
 * opens on bad data is worse than a gate that stays shut.
 *
 * @param nowSeconds Injectable clock, Unix seconds. Defaults to the real clock.
 *   Present so the tests can pin a moment instead of racing it, and so a
 *   caller comparing many sessions can use one consistent instant.
 */
export function isEntitled(
  session: MemberSessionData | null,
  requiredTier: RequiredTier,
  tiers: ReadonlyArray<TierLadderEntry> = DEFAULT_SITE_TIERS,
  nowSeconds: number = Date.now() / 1000
): boolean {
  if (requiredTier === "anyone") return true;
  if (!session) return false;

  // A canceled member keeps what they paid for until the period actually ends,
  // and a past_due member keeps access through the F18 grace window. Neither is
  // a courtesy: billing already took the money for that time.
  const statusOk =
    session.status === "active" ||
    session.status === "trialing" ||
    (session.status === "past_due" && nowSeconds < session.gracePeriodEndsAt) ||
    (session.status === "canceled" && nowSeconds < session.currentPeriodEnd);

  if (!statusOk) return false;
  if (requiredTier === "signed_in") return true;

  const required = tiers.find((tier) => tier.key === requiredTier);
  const held = tiers.find((tier) => tier.key === session.activeTier);

  // Either key missing means the site's tier table and this gate disagree.
  // Ranks cannot be compared, so the gate stays shut.
  if (!required || !held) return false;

  // Hierarchical by rank, so a VIP passes a Silver gate with no extra config.
  return held.rank >= required.rank;
}

/**
 * Plain-language reason a gate is shut, for the preview studio's caption and
 * for the locked card copy. Never returns a raw enum value, per PRD section
 * 7.6 rule 4.
 *
 * Returns null when the session is entitled, so a caller can branch on it.
 */
export function lockReason(
  session: MemberSessionData | null,
  requiredTier: RequiredTier,
  tiers: ReadonlyArray<TierLadderEntry> = DEFAULT_SITE_TIERS,
  nowSeconds: number = Date.now() / 1000
): string | null {
  if (isEntitled(session, requiredTier, tiers, nowSeconds)) return null;
  if (!session) return "You need to sign in to see this.";

  if (session.status === "past_due") {
    return "Your last payment did not go through.";
  }
  if (session.status === "canceled") {
    return "Your membership has ended.";
  }

  const required = tiers.find((tier) => tier.key === requiredTier);
  if (required) {
    return `This needs the ${required.name} plan or higher.`;
  }

  return "You do not have access to this yet.";
}
