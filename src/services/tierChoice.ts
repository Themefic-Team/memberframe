/**
 * A lock's tier choice as one string (19-section-locks.md 8): "signed_in", a
 * tier key ("that tier or higher"), or "only:a,b" ("exactly these tiers").
 * One string, so page locks, section locks, and the paywall store and send it
 * as before; `isEntitled` and the Route Shield read the "only:" form.
 */

export const ONLY_PREFIX = "only:";

/** The select's value for "Only chosen tiers…", never stored. */
export const ONLY_CHOICE = "__only__";

export function isOnlyChoice(value: string): boolean {
  return value.startsWith(ONLY_PREFIX);
}

/** The tier keys in an "only:" choice, in order, without repeats. */
export function onlyKeys(value: string): string[] {
  if (!isOnlyChoice(value)) return [];
  return [...new Set(value.slice(ONLY_PREFIX.length).split(",").filter(Boolean))];
}

/** An "only:" choice from tier keys. */
export function onlyValue(keys: ReadonlyArray<string>): string {
  return `${ONLY_PREFIX}${[...new Set(keys)].join(",")}`;
}

/**
 * The first tick when a creator switches to "Only chosen tiers…": the lowest
 * paid tier, else the first tier. An empty list would match nobody.
 */
export function firstOnlyValue(tiers: ReadonlyArray<{ key: string; rank: number }>): string {
  const ordered = [...tiers].sort((a, b) => a.rank - b.rank);
  const first = ordered.find((tier) => tier.rank !== 0) ?? ordered[0];
  return onlyValue(first ? [first.key] : []);
}

/** "Only Standard, VIP", for a summary. A deleted tier shows its key. */
export function onlyLabel(value: string, tiers: ReadonlyArray<{ key: string; name: string }>): string {
  const names = onlyKeys(value).map((key) => tiers.find((tier) => tier.key === key)?.name ?? key);
  return names.length > 0 ? `Only ${names.join(", ")}` : "Only chosen tiers";
}
