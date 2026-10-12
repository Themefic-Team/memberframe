/** Shared type barrel, per the target layout in PRD section 6.3. */

export {
  DEFAULT_SITE_TIERS,
  MEMBER_STATUS_LABELS,
  REQUIRED_TIER_LABELS,
  tierName,
} from "./member";
export type {
  MemberSessionData,
  MemberStatus,
  RequiredTier,
  TierLadderEntry,
  TierKey,
} from "./member";

export {
  BLUR_MAX,
  BLUR_MIN,
  DEFAULT_MEMBER_GATE_CONFIG,
  FALLBACK_ACTION_LABELS,
  visibleGateRows,
} from "./canvas";
export type { GateFallbackAction, MemberGateConfig } from "./canvas";
