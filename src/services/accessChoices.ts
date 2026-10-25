/**
 * Who a lock is for: one list, one wording, for page locks, section locks,
 * and the Soft Paywall (19-section-locks.md 9). Three pickers that said the
 * same thing three ways is how a creator ends up unsure what "Standard" meant.
 *
 * A choice is `audience:tier`, the pair a lock stores:
 *   - audience "members": those the tier choice lets in;
 *   - audience "others": everyone it does not, signed-out visitors included;
 *   - tier: "signed_in", "any_paid", a tier key (that tier or higher), or
 *     "only:a,b" (exactly those tiers, ticked below the picker).
 * The paywall asks only "who reads in full", so it gets the first group.
 */

import { ONLY_CHOICE, firstOnlyValue, isOnlyChoice } from "./tierChoice";

export interface AccessTier {
  key: string;
  name: string;
  rank: number;
}

export interface AccessOption {
  value: string;
  label: string;
  group: string;
}

export type AccessAudience = "members" | "others";

export const WHO_GETS_IN = "Who gets in";
export const WHO_IS_KEPT_OUT = "Who is kept out";

/** The paid tiers, lowest first. Free (rank 0) is left out: "Free or higher" is any signed-in member. */
function paidTiers(tiers: ReadonlyArray<AccessTier>): AccessTier[] {
  return [...tiers].filter((tier) => tier.rank !== 0).sort((a, b) => a.rank - b.rank);
}

/** Every choice, in two groups; `others: false` for the paywall's one group. */
export function accessOptions(tiers: ReadonlyArray<AccessTier>, include: { others: boolean } = { others: true }): AccessOption[] {
  const paid = paidTiers(tiers);
  const options: AccessOption[] = [
    { value: "members:signed_in", label: "Any signed-in member", group: WHO_GETS_IN },
    { value: "members:any_paid", label: "Any paid plan", group: WHO_GETS_IN },
    ...paid.map((tier) => ({ value: `members:${tier.key}`, label: `${tier.name} members or higher`, group: WHO_GETS_IN })),
    { value: `members:${ONLY_CHOICE}`, label: "Only chosen tiers…", group: WHO_GETS_IN },
  ];
  if (include.others) {
    options.push(
      { value: "others:signed_in", label: "Signed-out visitors only", group: WHO_IS_KEPT_OUT },
      ...paid.map((tier) => ({ value: `others:${tier.key}`, label: `Everyone without ${tier.name}`, group: WHO_IS_KEPT_OUT })),
      { value: `others:${ONLY_CHOICE}`, label: "Everyone except chosen tiers…", group: WHO_IS_KEPT_OUT }
    );
  }
  return options;
}

/** A lock's choice for the picker. An "only:" lock shows as its group's "chosen tiers" entry. */
export function accessValue(rule: { audience?: AccessAudience; requiredTier: string }): string {
  return `${rule.audience ?? "members"}:${isOnlyChoice(rule.requiredTier) ? ONLY_CHOICE : rule.requiredTier}`;
}

/**
 * A picked choice back into the pair a lock stores. Picking a "chosen tiers"
 * entry keeps the lock's ticks when it already had some, else ticks the
 * lowest paid tier, since an empty list would match nobody.
 */
export function parseAccess(
  value: string,
  current?: { requiredTier: string },
  tiers: ReadonlyArray<AccessTier> = []
): { audience: AccessAudience; requiredTier: string } {
  const [audience, ...rest] = value.split(":");
  const tier = rest.join(":") || "signed_in";
  return {
    audience: audience === "others" ? "others" : "members",
    requiredTier:
      tier === ONLY_CHOICE ? (current && isOnlyChoice(current.requiredTier) ? current.requiredTier : firstOnlyValue(tiers)) : tier,
  };
}

/**
 * The options for one lock: the list, plus the lock's own choice when the
 * list no longer has it (a deleted tier), so the picker never shows blank.
 */
export function accessOptionsFor(rule: { audience?: AccessAudience; requiredTier: string }, options: ReadonlyArray<AccessOption>): AccessOption[] {
  const current = accessValue(rule);
  if (options.some((option) => option.value === current)) return [...options];
  const group = rule.audience === "others" ? WHO_IS_KEPT_OUT : WHO_GETS_IN;
  return [...options, { value: current, label: `${rule.requiredTier} (deleted tier)`, group }];
}
