/**
 * Tier draft validation. PRD task 2.3, feature F02; dynamic tiers,
 * `docs/development-docs/23-dynamic-tiers.md`.
 *
 * The most consequential logic in F02, which is why it is a separate pure
 * module and not a submit handler.
 *
 * PRD section 11.2: "`Tier.rank` is unique per site. Drives hierarchical
 * entitlement. Duplicates make comparison ambiguous." That is not a tidiness
 * rule. `isEntitled` resolves a gate by `held.rank >= required.rank`, so two
 * tiers sharing a rank means a Gold member and a Silver member are the same
 * member as far as every gate on the site is concerned.
 *
 * ## Free and paid
 *
 * A site has exactly one Free tier, the tier at rank 0: every sign-up starts on
 * it and a member whose paid plan ends returns to it. It has no prices. Every
 * other tier is paid: rank 1 and up, with at least one price, in the site
 * currency set in Payments. A tier's ID is made from its name when it is
 * created and never changes after, because gates and locks name it.
 */

import type { TierKey } from "../../types/member";
import type { CurrencyCode, SiteTierRecord, TierFeature } from "../../types/site";
import { moneyErrorMessage, parseMinor } from "../../utils/money";
import { currencyExponent } from "../../utils/currencies";

/** The Free tier's rank. Ranks are unique, so a site has one. */
export const FREE_TIER_RANK = 0;

export type TierKind = "free" | "paid";

/** Is this the site's Free tier? By rank, never by key: keys are the creator's own. */
export function isFreeTier(tier: Pick<SiteTierRecord, "rank">): boolean {
  return tier.rank === FREE_TIER_RANK;
}

/** Lowercase, digits, underscore, starting with a letter. Matches the API. */
export const TIER_KEY_PATTERN = /^[a-z][a-z0-9_]{1,49}$/;

/**
 * An ID from a tier's name: "Pro Plus" becomes `pro_plus`, and a clash with an
 * ID already in use gets a number, `pro_plus_2`.
 */
export function keyFromName(name: string, taken: ReadonlyArray<string>): string {
  let base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  if (!/^[a-z]/.test(base)) base = `tier_${base}`.replace(/_+$/, "");
  if (base.length < 2) base = "tier";

  let key = base;
  for (let suffix = 2; taken.includes(key); suffix++) {
    key = `${base}_${suffix}`;
  }
  return key;
}

/** The ID a draft is saved under: its own once saved, made from the name before. */
export function resolvedTierKey(draft: TierFormDraft, siblings: ReadonlyArray<SiteTierRecord>): string {
  if (draft.id !== null) return draft.key;
  return keyFromName(
    draft.name,
    siblings.map((tier) => tier.key)
  );
}

export const TIER_NAME_MAX_LENGTH = 40;
export const RANK_MAX = 999;

/**
 * What the editor holds. Prices are the raw strings the creator typed, not
 * minor units, because validation has to be able to say "use digits and one
 * decimal point" about the actual input.
 */
export interface TierFormDraft {
  /** Absent when creating. Present when editing, and excluded from its own uniqueness check. */
  id: string | null;
  /** The saved ID. Empty while creating: it is made from the name. */
  key: TierKey;
  kind: TierKind;
  name: string;
  monthlyPrice: string;
  annualPrice: string;
  lifetimePrice: string;
  /** The site currency, from Payments. Not editable here; it parses the prices. */
  currency: CurrencyCode;
  rank: string;
  isActive: boolean;
  /** The pricing card lines, in order (28-tier-features.md). */
  features: TierFeature[];
}

/** The server's limits on a tier's feature list. */
export const MAX_TIER_FEATURES = 20;
export const MAX_TIER_FEATURE_LENGTH = 120;

export const EMPTY_TIER_FORM_DRAFT: TierFormDraft = {
  id: null,
  key: "",
  kind: "paid",
  name: "",
  monthlyPrice: "",
  annualPrice: "",
  lifetimePrice: "",
  currency: "USD",
  rank: "1",
  isActive: true,
  features: [],
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
  } else if (others.some((tier) => tier.name.trim().toLowerCase() === name.toLowerCase())) {
    // Two tiers called "Silver" are indistinguishable to the creator in every
    // list and every dropdown they will later pick from.
    errors.name = "Another tier already uses that name.";
  }

  if (draft.id === null && name !== "") {
    const key = resolvedTierKey(draft, siblings);
    if (!TIER_KEY_PATTERN.test(key)) errors.key = "Use a name with at least two letters or digits.";
  }

  const featuresError = validateFeatures(draft.features);
  if (featuresError) errors.features = featuresError;

  if (draft.kind === "free") {
    // One Free tier per site: it is where every member starts.
    if (others.some(isFreeTier)) errors.kind = "This site already has its Free tier. Make this one paid.";
    return { errors, valid: Object.keys(errors).length === 0 };
  }

  const rankError = validateRank(draft, others);
  if (rankError) errors.rank = rankError;

  Object.assign(errors, validatePrices(draft));

  return { errors, valid: Object.keys(errors).length === 0 };
}

/** Every line has text, none is too long, and there are not too many. One message for the list. */
function validateFeatures(features: ReadonlyArray<TierFeature>): string | null {
  if (features.length > MAX_TIER_FEATURES) return `Keep it to ${MAX_TIER_FEATURES} features.`;
  if (features.some((feature) => feature.text.trim() === "")) return "Write each feature, or remove the empty one.";
  if (features.some((feature) => feature.text.trim().length > MAX_TIER_FEATURE_LENGTH)) {
    return `Keep each feature under ${MAX_TIER_FEATURE_LENGTH} characters.`;
  }
  return null;
}

/** A paid tier's level: 1 and up, unique, since ranks decide which tier outranks which. */
function validateRank(draft: TierFormDraft, others: ReadonlyArray<SiteTierRecord>): string | null {
  const raw = draft.rank.trim();
  if (raw === "") return "Enter a level.";
  if (!/^\d+$/.test(raw)) return "Use a whole number, 1 or higher.";

  const rank = Number.parseInt(raw, 10);
  if (rank < FREE_TIER_RANK + 1 || rank > RANK_MAX) {
    return `Use a level between 1 and ${RANK_MAX}. Level 0 is the Free tier.`;
  }

  const clash = others.find((tier) => tier.rank === rank);
  if (clash) {
    // The message names the consequence, because "rank must be unique" does
    // not tell a creator why they should care.
    return `${clash.name} already has level ${rank}. Levels decide which tier outranks which.`;
  }

  return null;
}

/**
 * A paid tier needs at least one price, and every price is a real amount above
 * zero in the site currency. Zero is not a price: it read "$0.00 monthly" and
 * sold nothing.
 */
function validatePrices(draft: TierFormDraft): TierFieldErrors {
  const errors: TierFieldErrors = {};
  const fields: ReadonlyArray<[keyof TierFormDraft, string]> = [
    ["monthlyPrice", draft.monthlyPrice],
    ["annualPrice", draft.annualPrice],
    ["lifetimePrice", draft.lifetimePrice],
  ];

  let anyPriceSet = false;
  const exponent = currencyExponent(draft.currency);

  for (const [field, value] of fields) {
    if (value.trim() === "") continue;
    anyPriceSet = true;

    const parsed = parseMinor(value, exponent);
    if (!parsed.ok) errors[field] = moneyErrorMessage(parsed.reason, exponent);
    else if (parsed.minor === 0) errors[field] = "Use a price above zero, or leave it empty.";
  }

  if (!anyPriceSet) errors.monthlyPrice = "Set at least one price. A tier with no price is the Free tier.";

  return errors;
}

/**
 * The next free level, for a new paid tier: one above the highest in use, so
 * the common case of adding a tier at the top needs no thought and cannot
 * collide. Never 0, which is the Free tier's.
 */
export function suggestNextRank(siblings: ReadonlyArray<SiteTierRecord>): number {
  const highest = siblings.reduce((max, tier) => Math.max(max, tier.rank), FREE_TIER_RANK);
  return Math.min(RANK_MAX, highest + 1);
}

/** Ladder order for display: highest rank first, so the top tier reads at the top. */
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
 * Deciding between them in one function makes the rule structural, and
 * `test/tierValidation.test.ts` enumerates the whole input space.
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
