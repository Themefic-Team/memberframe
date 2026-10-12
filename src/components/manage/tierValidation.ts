/**
 * Tier draft validation. PRD task 2.3, feature F02.
 *
 * The most consequential logic in F02, which is why it is a separate pure
 * module and not a submit handler.
 *
 * PRD section 11.2: "`Tier.rank` is unique per site. Drives hierarchical
 * entitlement. Duplicates make comparison ambiguous." That is not a tidiness
 * rule. `isEntitled` resolves a gate by `held.rank >= required.rank`, so two
 * tiers sharing a rank means a Gold member and a Silver member are the same
 * member as far as every gate on the site is concerned. The creator would see
 * no error anywhere: they would see Silver subscribers reading Gold content.
 *
 * F02's acceptance criterion says rank "cannot be duplicated across tiers", so
 * it is caught here, before the write, rather than left to a server rejection
 * the creator has to interpret.
 */

import { REQUIRED_TIER_LABELS, type TierKey } from "../../types/member";
import type { CurrencyCode, SiteTierRecord } from "../../types/site";
import { MAX_MINOR_AMOUNT } from "../../utils/money";

/**
 * The tier keys a creator may choose.
 *
 * CONFLICT C9: F02 types `SiteTierRecord.key` as `string` and comments it
 * `"tier_1" | "tier_2" | "vip" | custom`, so custom keys are intended. F01's
 * `requiredTier` property control is a fixed `Enum` of five options, so a
 * custom key could never be selected on a gate. Phase 1 therefore offers the
 * four known keys and says so in the UI.
 *
 * The fix is already available and is worth recording: the gate's component
 * file is generated per creator, so the generator can emit the site's own tier
 * keys as the `Enum` options once `GET /api/site/tiers` exists. Written up in
 * `docs/development-docs/02-member-tier-cockpit.md` section 5.1.
 */
export const SELECTABLE_TIER_KEYS: ReadonlyArray<TierKey> = [
  "free_member",
  "tier_1",
  "tier_2",
  "vip",
];

export const TIER_KEY_OPTIONS: ReadonlyArray<{ value: TierKey; label: string }> =
  SELECTABLE_TIER_KEYS.map((key) => ({ value: key, label: REQUIRED_TIER_LABELS[key] }));

export const TIER_NAME_MAX_LENGTH = 40;
export const RANK_MIN = 0;
export const RANK_MAX = 999;

/**
 * What the editor holds. Prices are the raw strings the creator typed, not
 * minor units, because validation has to be able to say "use digits and one
 * decimal point" about the actual input.
 */
export interface TierFormDraft {
  /** Absent when creating. Present when editing, and excluded from its own uniqueness check. */
  id: string | null;
  key: TierKey;
  name: string;
  monthlyPrice: string;
  annualPrice: string;
  lifetimePrice: string;
  currency: CurrencyCode;
  rank: string;
  isActive: boolean;
}

export const EMPTY_TIER_FORM_DRAFT: TierFormDraft = {
  id: null,
  key: "tier_1",
  name: "",
  monthlyPrice: "",
  annualPrice: "",
  lifetimePrice: "",
  currency: "USD",
  rank: "1",
  isActive: true,
};

/** One message per field, keyed by field name, for inline rendering. */
export type TierFieldErrors = Partial<Record<keyof TierFormDraft, string>>;

export interface TierValidationResult {
  errors: TierFieldErrors;
  valid: boolean;
}

/**
 * Validate a draft against its siblings.
 *
 * `siblings` is every tier the site already has. The draft's own record is
 * filtered out by id before the uniqueness checks, which is the bug this rule
 * invites: without it, editing a tier's name reports that its rank collides
 * with itself, and the creator cannot save anything.
 */
export function validateTierDraft(
  draft: TierFormDraft,
  siblings: ReadonlyArray<SiteTierRecord>
): TierValidationResult {
  const errors: TierFieldErrors = {};
  const others = draft.id === null ? siblings : siblings.filter((tier) => tier.id !== draft.id);

  const name = draft.name.trim();
  if (name === "") {
    errors.name = "Enter a tier name.";
  } else if (name.length > TIER_NAME_MAX_LENGTH) {
    errors.name = `Keep the name under ${TIER_NAME_MAX_LENGTH} characters.`;
  } else if (
    others.some((tier) => tier.name.trim().toLowerCase() === name.toLowerCase())
  ) {
    // Not a PRD rule. Two tiers called "Silver" are indistinguishable to the
    // creator in every list and every dropdown they will later pick from.
    errors.name = "Another tier already uses that name.";
  }

  if (!SELECTABLE_TIER_KEYS.includes(draft.key)) {
    errors.key = "Choose one of the available tier types.";
  } else if (others.some((tier) => tier.key === draft.key)) {
    // A key maps to one tier. Two tiers sharing a key means a gate naming it
    // resolves against whichever the lookup finds first.
    errors.key = "A tier with that type already exists.";
  }

  const rankError = validateRank(draft, others);
  if (rankError) errors.rank = rankError;

  const priceErrors = validatePrices(draft);
  Object.assign(errors, priceErrors);

  return { errors, valid: Object.keys(errors).length === 0 };
}

function validateRank(
  draft: TierFormDraft,
  others: ReadonlyArray<SiteTierRecord>
): string | null {
  const raw = draft.rank.trim();
  if (raw === "") return "Enter a rank.";

  if (!/^\d+$/.test(raw)) return "Use a whole number, 0 or higher.";

  const rank = Number.parseInt(raw, 10);

  if (rank < RANK_MIN || rank > RANK_MAX) {
    return `Use a rank between ${RANK_MIN} and ${RANK_MAX}.`;
  }

  if (others.some((tier) => tier.rank === rank)) {
    // PRD section 11.2. The message names the consequence, because "rank must
    // be unique" does not tell a creator why they should care.
    const clash = others.find((tier) => tier.rank === rank);
    return `${clash?.name ?? "Another tier"} already has rank ${rank}. Ranks decide which tier outranks which.`;
  }

  return null;
}

/**
 * Prices are optional individually and not collectively.
 *
 * PRD section 12.2 lists a free member tier, so a tier with no price at all is
 * legitimate. But a paid tier with every price blank is almost certainly a
 * half-finished form, and a creator who saves it gets a tier nobody can buy
 * with no indication why. So: any price may be blank, and a non-free tier must
 * have at least one.
 */
function validatePrices(draft: TierFormDraft): TierFieldErrors {
  const errors: TierFieldErrors = {};

  const fields: ReadonlyArray<[keyof TierFormDraft, string]> = [
    ["monthlyPrice", draft.monthlyPrice],
    ["annualPrice", draft.annualPrice],
    ["lifetimePrice", draft.lifetimePrice],
  ];

  let anyPriceSet = false;

  for (const [field, value] of fields) {
    const raw = value.trim();
    if (raw === "") continue;

    anyPriceSet = true;

    if (!/^\d+(?:[.,]\d{0,2})?$/.test(raw)) {
      errors[field] = "Use digits and up to two decimal places.";
      continue;
    }

    const minor = toMinorUnsafe(raw);

    if (minor === null) {
      errors[field] = "Use digits and up to two decimal places.";
    } else if (minor > MAX_MINOR_AMOUNT) {
      errors[field] = "That price is too high.";
    }
  }

  if (!anyPriceSet && draft.key !== "free_member") {
    errors.monthlyPrice = "Set at least one price, or make this the free tier.";
  }

  return errors;
}

/**
 * String to minor units, for the bounds check only.
 *
 * Deliberately a local helper rather than a second implementation of
 * `parseMinor`: it shares the no-float rule and returns null instead of a
 * reason, because the caller has already decided its own message. `utils/money`
 * owns the real conversion and is what the submit path uses.
 */
function toMinorUnsafe(raw: string): number | null {
  const separator = raw.search(/[.,]/);
  const whole = separator === -1 ? raw : raw.slice(0, separator);
  const fraction = (separator === -1 ? "" : raw.slice(separator + 1)).slice(0, 2).padEnd(2, "0");
  const minor = Number.parseInt(`${whole === "" ? "0" : whole}${fraction}`, 10);

  return Number.isFinite(minor) ? minor : null;
}

/**
 * The next free rank, for a new tier.
 *
 * One above the highest in use, so the common case of adding a tier at the top
 * of the ladder needs no thought from the creator and cannot collide.
 */
export function suggestNextRank(siblings: ReadonlyArray<SiteTierRecord>): number {
  if (siblings.length === 0) return 0;
  const highest = siblings.reduce((max, tier) => Math.max(max, tier.rank), 0);
  return Math.min(RANK_MAX, highest + 1);
}

/** Ladder order for display: highest rank first, so VIP reads at the top. */
export function byRankDescending(
  tiers: ReadonlyArray<SiteTierRecord>
): ReadonlyArray<SiteTierRecord> {
  return [...tiers].sort((a, b) => b.rank - a.rank);
}

/* ==========================================================================
   WHICH PRIMARY CTA THE EDITOR SHOWS
   ========================================================================== */

/**
 * The one primary action available in the Tiers segment.
 *
 * PRD section 7.5: exactly one `.primary-cta` per view, never two. The editor
 * has three candidate buttons, in the empty state, in the open form, and under
 * a populated list, and they are mutually exclusive by their render guards.
 *
 * "Mutually exclusive by their guards" is an argument, not a guarantee, and the
 * guards are three separate boolean expressions in JSX that a later edit can
 * desynchronise. So the decision is a function that returns one value. One
 * value means one button, by construction rather than by reasoning, and
 * `test/tierValidation.test.ts` enumerates the whole input space to prove the
 * function is total.
 */
export type TierEditorCta = "none" | "empty_create" | "form_submit" | "list_create";

export function tierEditorCta(state: {
  loading: boolean;
  tierCount: number;
  editing: boolean;
}): TierEditorCta {
  // An open form owns the action, whatever else is on screen behind it.
  if (state.editing) return "form_submit";

  // Nothing to act on until the list has loaded. A Create button over a
  // skeleton invites a creator to add a tier that may already exist.
  if (state.loading) return "none";

  return state.tierCount === 0 ? "empty_create" : "list_create";
}
