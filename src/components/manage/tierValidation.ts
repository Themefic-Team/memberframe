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

import { REQUIRED_TIER_LABELS, requiredTierLabel, type TierKey } from "../../types/member";
import type { CurrencyCode, SiteTierRecord } from "../../types/site";
import { MAX_MINOR_AMOUNT } from "../../utils/money";

/**
 * The built in tier keys, offered first in the editor.
 *
 * CONFLICT C9, resolved 2026-10-16. Custom keys are allowed now: the generator
 * writes the site's real tiers into the gate's Access Tier list, and gates
 * compare ranks from the site's tier table. A custom key is made from the
 * tier's name by `keyFromName`.
 */
export const SELECTABLE_TIER_KEYS: ReadonlyArray<TierKey> = [
  "free_member",
  "tier_1",
  "tier_2",
  "vip",
];

export const TIER_KEY_OPTIONS: ReadonlyArray<{ value: TierKey; label: string }> =
  SELECTABLE_TIER_KEYS.map((key) => ({ value: key, label: REQUIRED_TIER_LABELS[key] }));

/** The editor's "make a key from the name" choice. Never stored. */
export const CUSTOM_TIER_KEY = "__custom__";

/** Lowercase, digits, underscore, starting with a letter. Matches the API. */
export const TIER_KEY_PATTERN = /^[a-z][a-z0-9_]{1,49}$/;

/**
 * A key from a tier's name: "Pro Plus" becomes `pro_plus`, and a clash with
 * a key already in use gets a number, `pro_plus_2`.
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
  for (let suffix = 2; taken.includes(key) || SELECTABLE_TIER_KEYS.includes(key); suffix++) {
    key = `${base}_${suffix}`;
  }
  return key;
}

/** The key a draft will be saved under. */
export function resolvedTierKey(draft: TierFormDraft, siblings: ReadonlyArray<SiteTierRecord>): string {
  if (draft.key !== CUSTOM_TIER_KEY) return draft.key;
  const others = siblings.filter((tier) => tier.id !== draft.id).map((tier) => tier.key);
  return keyFromName(draft.name, others);
}

/**
 * The Tier type choices: built in keys no other tier uses, then the custom
 * choice. An existing tier's key is fixed, so editing shows just its own.
 */
export function tierKeyOptions(
  draft: TierFormDraft,
  siblings: ReadonlyArray<SiteTierRecord>
): ReadonlyArray<{ value: string; label: string }> {
  if (draft.id !== null) return [{ value: draft.key, label: requiredTierLabel(draft.key) }];
  const used = siblings.map((tier) => tier.key);
  return [
    ...SELECTABLE_TIER_KEYS.filter((key) => !used.includes(key)).map((key) => ({
      value: key,
      label: REQUIRED_TIER_LABELS[key] ?? key,
    })),
    { value: CUSTOM_TIER_KEY, label: "Custom, from the name" },
  ];
}

/** One extra currency's prices as typed, FP-16 section 6.2. */
export interface ExtraPriceDraft {
  currency: CurrencyCode;
  monthly: string;
  annual: string;
  lifetime: string;
}

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
  /** Prices in other currencies. Each currency once, never the base one. */
  extraPrices: ExtraPriceDraft[];
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
  extraPrices: [],
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

  const key = resolvedTierKey(draft, siblings);
  if (draft.key === CUSTOM_TIER_KEY && name === "") {
    errors.key = "Enter a name first. The key is made from it.";
  } else if (!TIER_KEY_PATTERN.test(key)) {
    errors.key = "Choose one of the available tier types.";
  } else if (others.some((tier) => tier.key === key)) {
    // A key maps to one tier. Two tiers sharing a key means a gate naming it
    // resolves against whichever the lookup finds first.
    errors.key = "A tier with that type already exists.";
  }

  const rankError = validateRank(draft, others);
  if (rankError) errors.rank = rankError;

  const priceErrors = validatePrices(draft);
  Object.assign(errors, priceErrors);

  const extraError = validateExtraPrices(draft);
  if (extraError) errors.extraPrices = extraError;

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

/** Other currencies: each once, not the base currency, each price a valid amount. */
function validateExtraPrices(draft: TierFormDraft): string | null {
  const seen = new Set<string>();
  for (const extra of draft.extraPrices) {
    if (extra.currency === draft.currency) return `${extra.currency} is this tier's own currency. Use the prices above.`;
    if (seen.has(extra.currency)) return `${extra.currency} is listed twice.`;
    seen.add(extra.currency);

    const values = [extra.monthly, extra.annual, extra.lifetime].map((value) => value.trim());
    if (values.every((value) => value === "")) return `Set at least one ${extra.currency} price, or remove it.`;
    for (const value of values) {
      if (value === "") continue;
      if (!/^\d+(?:[.,]\d{0,2})?$/.test(value)) return `${extra.currency} prices use digits and up to two decimal places.`;
      const minor = toMinorUnsafe(value);
      if (minor === null || minor > MAX_MINOR_AMOUNT) return `An ${extra.currency} price is too high.`;
    }
  }
  return null;
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
