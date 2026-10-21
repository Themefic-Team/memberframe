/**
 * Tier draft validation. PRD task 2.3, feature F02.
 *
 * The rank uniqueness rule is the most consequential logic in F02, which is why
 * it is a pure module and why these are the tests that matter here.
 *
 * PRD section 11.2 makes `Tier.rank` unique per site because `isEntitled`
 * resolves a gate by `held.rank >= required.rank`. Two tiers sharing a rank
 * means a Gold member and a Silver member are the same member to every gate on
 * the site, and the creator sees no error anywhere: they see Silver subscribers
 * reading Gold content. That is the failure these assertions exist to prevent.
 */

import { describe, expect, it } from "vitest";
import {
  EMPTY_TIER_FORM_DRAFT,
  MAX_TIER_FEATURES,
  MAX_TIER_FEATURE_LENGTH,
  RANK_MAX,
  TIER_NAME_MAX_LENGTH,
  byRankDescending,
  keyFromName,
  resolvedTierKey,
  suggestNextRank,
  tierEditorCta,
  validateTierDraft,
  type TierFormDraft,
} from "../src/components/manage/tierValidation";
import type { SiteTierRecord } from "../src/types/site";

function tier(overrides: Partial<SiteTierRecord> = {}): SiteTierRecord {
  return {
    id: "t1",
    siteId: "s1",
    key: "tier_1",
    name: "Silver",
    monthlyPriceMinor: 999,
    annualPriceMinor: null,
    lifetimePriceMinor: null,
    currency: "USD",
    rank: 1,
    isActive: true,
    ...overrides,
  };
}

function draft(overrides: Partial<TierFormDraft> = {}): TierFormDraft {
  return {
    ...EMPTY_TIER_FORM_DRAFT,
    name: "Gold",
    key: "tier_2",
    rank: "2",
    monthlyPrice: "19.99",
    ...overrides,
  };
}

describe("rank uniqueness, the rule PRD section 11.2 makes load bearing", () => {
  it("rejects a rank another tier already holds", () => {
    const result = validateTierDraft(draft({ rank: "1" }), [tier({ rank: 1 })]);

    expect(result.valid).toBe(false);
    expect(result.errors.rank).toBeTruthy();
  });

  it("names the clashing tier, so the creator knows which one to change", () => {
    const result = validateTierDraft(draft({ rank: "1" }), [tier({ rank: 1, name: "Silver" })]);

    expect(result.errors.rank).toContain("Silver");
  });

  it("explains what a rank is for rather than only that it must be unique", () => {
    // "Rank must be unique" does not tell a creator why they should care.
    const result = validateTierDraft(draft({ rank: "1" }), [tier({ rank: 1 })]);

    expect(result.errors.rank).toMatch(/outranks/i);
  });

  it("accepts a free rank", () => {
    expect(validateTierDraft(draft({ rank: "5" }), [tier({ rank: 1 })]).valid).toBe(true);
  });

  it("does not report a tier colliding with itself when editing it", () => {
    // The obvious bug in this rule. Without excluding the edited record, a
    // creator who renames a tier without touching its rank is told the rank is
    // taken, and can never save anything.
    const existing = tier({ id: "t1", rank: 3, key: "vip", name: "VIP" });
    const editing = draft({ id: "t1", rank: "3", key: "vip", name: "VIP Plus" });

    const result = validateTierDraft(editing, [existing]);

    expect(result.errors.rank).toBeUndefined();
    expect(result.valid).toBe(true);
  });

  it("still catches a collision with a different tier while editing", () => {
    const tiers = [tier({ id: "t1", rank: 1, key: "tier_1" }), tier({ id: "t2", rank: 2, key: "tier_2", name: "Gold" })];
    const editing = draft({ id: "t1", rank: "2", key: "tier_1", name: "Silver" });

    expect(validateTierDraft(editing, tiers).errors.rank).toBeTruthy();
  });
});

describe("rank format", () => {
  it("requires a whole number", () => {
    for (const rank of ["", "1.5", "abc", "-1", "1e2", " "]) {
      expect(validateTierDraft(draft({ rank }), []).errors.rank).toBeTruthy();
    }
  });

  it("keeps level 0 for the Free tier", () => {
    // Rank 0 is the Free tier, where every member starts; a paid tier is 1 and up.
    expect(validateTierDraft(draft({ rank: "0" }), []).errors.rank).toMatch(/Level 0 is the Free tier/);
    expect(validateTierDraft(draft({ kind: "free", rank: "0", monthlyPrice: "" }), []).valid).toBe(true);
  });

  it("rejects a rank beyond the ceiling", () => {
    expect(validateTierDraft(draft({ rank: String(RANK_MAX + 1) }), []).errors.rank).toBeTruthy();
  });
});

describe("tier name", () => {
  it("requires a name", () => {
    expect(validateTierDraft(draft({ name: "" }), []).errors.name).toBeTruthy();
    expect(validateTierDraft(draft({ name: "   " }), []).errors.name).toBeTruthy();
  });

  it("rejects a duplicate name, which no list could tell apart", () => {
    // Not a PRD rule. Two tiers called Silver are indistinguishable in every
    // dropdown the creator will later pick from.
    const result = validateTierDraft(draft({ name: "Silver" }), [tier({ name: "Silver" })]);

    expect(result.errors.name).toBeTruthy();
  });

  it("compares names case insensitively and ignoring padding", () => {
    expect(
      validateTierDraft(draft({ name: "  silver " }), [tier({ name: "Silver" })]).errors.name
    ).toBeTruthy();
  });

  it("rejects a name longer than the limit", () => {
    const long = "a".repeat(TIER_NAME_MAX_LENGTH + 1);

    expect(validateTierDraft(draft({ name: long }), []).errors.name).toBeTruthy();
  });
});

describe("tier ID", () => {
  it("is made from the name for a new tier", () => {
    expect(keyFromName("Gold Plus", [])).toBe("gold_plus");
    expect(keyFromName("  Pro! 2026 ", [])).toBe("pro_2026");
    expect(keyFromName("2026 Pass", [])).toBe("tier_2026_pass");
    expect(resolvedTierKey(draft({ name: "Gold Plus" }), [])).toBe("gold_plus");
  });

  it("gets a number when the ID is taken", () => {
    expect(keyFromName("Gold", ["gold"])).toBe("gold_2");
    expect(keyFromName("Gold", ["gold", "gold_2"])).toBe("gold_3");
  });

  it("keeps a saved tier's ID, whatever its name becomes", () => {
    // Gates and locks name the ID, so renaming must not move it.
    expect(resolvedTierKey(draft({ id: "t1", key: "tier_1", name: "Platinum" }), [])).toBe("tier_1");
  });

  it("makes a valid ID even from a name of symbols", () => {
    expect(keyFromName("!!", [])).toBe("tier");
    expect(validateTierDraft(draft({ name: "!!" }), []).errors.key).toBeUndefined();
  });
});

describe("Free and paid", () => {
  it("allows one Free tier", () => {
    const freeTier = tier({ id: "f", key: "free", name: "Free", rank: 0, monthlyPriceMinor: null });
    const second = draft({ kind: "free", name: "Starter", rank: "0", monthlyPrice: "" });
    expect(validateTierDraft(second, [freeTier]).errors.kind).toMatch(/already has its Free tier/);
    expect(validateTierDraft(second, []).valid).toBe(true);
  });

  it("asks nothing of the Free tier's prices or level", () => {
    const free = draft({ kind: "free", name: "Free", rank: "0", monthlyPrice: "", annualPrice: "abc" });
    expect(validateTierDraft(free, []).valid).toBe(true);
  });
});

describe("prices", () => {
  it("needs at least one on a paid tier", () => {
    // A paid tier with every price blank is a half-filled form, and saving it
    // produces a tier nobody can buy with no indication why.
    const paid = draft({ monthlyPrice: "", annualPrice: "", lifetimePrice: "" });
    expect(validateTierDraft(paid, []).errors.monthlyPrice).toMatch(/at least one price/);
  });

  it("refuses zero, which read as a price and sold nothing", () => {
    expect(validateTierDraft(draft({ monthlyPrice: "0" }), []).errors.monthlyPrice).toMatch(/above zero/);
    expect(validateTierDraft(draft({ monthlyPrice: "0.00" }), []).errors.monthlyPrice).toMatch(/above zero/);
  });

  it("parses in the site currency", () => {
    expect(validateTierDraft(draft({ currency: "JPY", monthlyPrice: "1500" }), []).valid).toBe(true);
    expect(validateTierDraft(draft({ currency: "JPY", monthlyPrice: "9.99" }), []).valid).toBe(false);
  });

  it("accepts any one of the three intervals on its own", () => {
    for (const field of ["monthlyPrice", "annualPrice", "lifetimePrice"] as const) {
      const only = draft({ monthlyPrice: "", annualPrice: "", lifetimePrice: "", [field]: "49.00" });

      expect(validateTierDraft(only, []).valid).toBe(true);
    }
  });

  it("rejects a price with more than two decimal places", () => {
    // Matches `parseMinor`, which refuses rather than truncating because
    // "1,999" is ambiguous and truncating it misprices by 1000x.
    expect(validateTierDraft(draft({ monthlyPrice: "9.999" }), []).errors.monthlyPrice).toBeTruthy();
    expect(validateTierDraft(draft({ monthlyPrice: "1,999" }), []).errors.monthlyPrice).toBeTruthy();
  });

  it("rejects a price that is not a number", () => {
    for (const price of ["abc", "$9.99", "-5", "9 99", "1e5"]) {
      expect(
        validateTierDraft(draft({ monthlyPrice: price }), []).errors.monthlyPrice
      ).toBeTruthy();
    }
  });

  it("accepts a comma separator", () => {
    expect(validateTierDraft(draft({ monthlyPrice: "9,99" }), []).valid).toBe(true);
  });

  it("rejects an absurd price", () => {
    expect(
      validateTierDraft(draft({ monthlyPrice: "99999999999" }), []).errors.monthlyPrice
    ).toBeTruthy();
  });
});

describe("every message is written for a creator", () => {
  it("ends each message in a period and leaks no raw value", () => {
    // PRD section 7.6 rules 4 and 6.
    const broken = draft({
      name: "",
      rank: "x",
      monthlyPrice: "abc",
      annualPrice: "0",
    });

    const { errors } = validateTierDraft(broken, []);
    const messages = Object.values(errors);

    expect(messages.length).toBeGreaterThan(3);

    for (const message of messages) {
      expect(message?.endsWith(".")).toBe(true);
      expect(message).not.toMatch(/tier_1|tier_2|free_member|not_a_number|too_precise/);
    }
  });
});

describe("suggestNextRank", () => {
  it("starts at level 1, above the Free tier", () => {
    expect(suggestNextRank([])).toBe(1);
  });

  it("suggests one above the highest, so the common case cannot collide", () => {
    expect(suggestNextRank([tier({ rank: 0 }), tier({ rank: 3 })])).toBe(4);
  });

  it("produces a rank that actually validates", () => {
    // The property that matters: a suggestion the validator then rejects would
    // make the Create button fail on its own default.
    const tiers = [tier({ id: "a", rank: 0, key: "free", name: "Free", monthlyPriceMinor: null })];
    const suggested = suggestNextRank(tiers);

    const result = validateTierDraft(
      draft({ rank: String(suggested), key: "tier_1", name: "Silver" }),
      tiers
    );

    expect(result.valid).toBe(true);
  });

  it("does not suggest past the ceiling", () => {
    expect(suggestNextRank([tier({ rank: RANK_MAX })])).toBe(RANK_MAX);
  });
});

describe("byRankDescending", () => {
  it("puts the highest tier first, so the top tier reads at the top", () => {
    const ordered = byRankDescending([
      tier({ id: "a", rank: 0 }),
      tier({ id: "c", rank: 3 }),
      tier({ id: "b", rank: 1 }),
    ]);

    expect(ordered.map((entry) => entry.rank)).toEqual([3, 1, 0]);
  });

  it("does not mutate its input", () => {
    const input = [tier({ id: "a", rank: 0 }), tier({ id: "b", rank: 2 })];
    byRankDescending(input);

    expect(input.map((entry) => entry.id)).toEqual(["a", "b"]);
  });
});

describe("tierEditorCta: exactly one primary CTA, by construction", () => {
  const space = [false, true].flatMap((loading) =>
    [0, 1, 5].flatMap((tierCount) =>
      [false, true].map((editing) => ({ loading, tierCount, editing }))
    )
  );

  it("returns exactly one value for every input in the space", () => {
    // PRD section 7.5 allows exactly one `.primary-cta` per view. The Tiers
    // segment has three candidate buttons, and a function returning one value
    // is what makes "only one renders" structural rather than an argument about
    // three JSX guards staying in step.
    expect(space).toHaveLength(12);

    for (const state of space) {
      const result = tierEditorCta(state);
      expect(["none", "empty_create", "form_submit", "list_create"]).toContain(result);
    }
  });

  it("gives an open form the action, whatever is behind it", () => {
    for (const state of space.filter((entry) => entry.editing)) {
      expect(tierEditorCta(state)).toBe("form_submit");
    }
  });

  it("offers nothing over a loading skeleton", () => {
    // A Create button over a skeleton invites a creator to add a tier that may
    // already exist in the list still loading.
    expect(tierEditorCta({ loading: true, tierCount: 0, editing: false })).toBe("none");
    expect(tierEditorCta({ loading: true, tierCount: 5, editing: false })).toBe("none");
  });

  it("puts the action in the empty state when there are no tiers", () => {
    expect(tierEditorCta({ loading: false, tierCount: 0, editing: false })).toBe("empty_create");
  });

  it("puts the action under the list when there are tiers", () => {
    expect(tierEditorCta({ loading: false, tierCount: 1, editing: false })).toBe("list_create");
  });

  it("never returns two values, which is the whole point of the shape", () => {
    // Trivially true for a function returning one string, and that triviality
    // is the guarantee being bought: the alternative was three independent
    // booleans that could all be true at once.
    const results = space.map(tierEditorCta);

    expect(results.every((value) => typeof value === "string")).toBe(true);
  });
});

describe("tier features (28-tier-features.md)", () => {
  const paid: TierFormDraft = { ...EMPTY_TIER_FORM_DRAFT, name: "Gold", rank: "2", monthlyPrice: "19.00" };

  it("starts with no features and accepts a list of lines", () => {
    expect(EMPTY_TIER_FORM_DRAFT.features).toEqual([]);
    const draft = { ...paid, features: [{ text: "All courses", included: true }, { text: "1:1 calls", included: false }] };
    expect(validateTierDraft(draft, [tier()]).errors.features).toBeUndefined();
  });

  it("names an empty line, a long line, and too many lines", () => {
    expect(validateTierDraft({ ...paid, features: [{ text: "  ", included: true }] }, []).errors.features).toMatch(/empty/);
    expect(validateTierDraft({ ...paid, features: [{ text: "x".repeat(MAX_TIER_FEATURE_LENGTH + 1), included: true }] }, []).errors.features).toMatch(
      /characters/
    );
    const many = Array.from({ length: MAX_TIER_FEATURES + 1 }, () => ({ text: "Line", included: true }));
    expect(validateTierDraft({ ...paid, features: many }, []).errors.features).toMatch(/20/);
  });

  it("checks the Free tier's features too", () => {
    const free: TierFormDraft = { ...EMPTY_TIER_FORM_DRAFT, kind: "free", name: "Free", rank: "0", features: [{ text: "", included: true }] };
    expect(validateTierDraft(free, []).errors.features).toBeDefined();
  });
});
