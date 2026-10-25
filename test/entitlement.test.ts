/**
 * The entitlement resolver, PRD section 11.3. Task 1.8, landed with 1.1.
 *
 * Layer 1 of the PRD section 16.1 triad: pure logic, node environment, no DOM.
 * These are the highest-value tests in the repo so far. The resolver decides
 * who sees paid content, and PRD section 11.3 calls divergence between its
 * three implementations a security defect, so this file is also the reference
 * the canvas component and the backend are held to.
 *
 * Time is pinned through the resolver's `nowSeconds` argument rather than by
 * faking the clock. The function was given that parameter for this reason.
 */

import { describe, expect, it } from "vitest";
import { isEntitled, lockReason } from "../src/utils/entitlement";
import { buildSimulatedSession } from "../src/hooks/useMemberSession";
import { DEFAULT_SITE_TIERS, type MemberSessionData } from "../src/types/member";

/** A fixed instant, so nothing in this file depends on when it runs. */
const NOW = 1_760_000_000;
const DAY = 86_400;

const guest = buildSimulatedSession("guest", NOW);
const free = buildSimulatedSession("free", NOW);
const silver = buildSimulatedSession("silver", NOW);
const vip = buildSimulatedSession("vip", NOW);
const failed = buildSimulatedSession("failed", NOW);

describe("isEntitled: the anyone and signed_in pseudo-tiers", () => {
  it("lets anyone through, session or not", () => {
    expect(isEntitled(guest, "anyone", DEFAULT_SITE_TIERS, NOW)).toBe(true);
    expect(isEntitled(free, "anyone", DEFAULT_SITE_TIERS, NOW)).toBe(true);
    expect(isEntitled(failed, "anyone", DEFAULT_SITE_TIERS, NOW)).toBe(true);
  });

  it("requires only a valid session for signed_in", () => {
    expect(isEntitled(guest, "signed_in", DEFAULT_SITE_TIERS, NOW)).toBe(false);
    expect(isEntitled(free, "signed_in", DEFAULT_SITE_TIERS, NOW)).toBe(true);
    expect(isEntitled(silver, "signed_in", DEFAULT_SITE_TIERS, NOW)).toBe(true);
  });

  it("still rejects signed_in when the status has lapsed", () => {
    // A session object is not the same as an entitled session. The status check
    // runs before the signed_in short-circuit, deliberately.
    expect(isEntitled(failed, "signed_in", DEFAULT_SITE_TIERS, NOW)).toBe(false);
  });
});

describe("isEntitled: the five simulated states against a Silver gate", () => {
  // This is the table in docs/development-docs/04-live-preview-studio.md
  // section 5.2, asserted. If any two rows ever agree, the five-state switcher
  // has become a four-state control wearing five labels.
  const cases: ReadonlyArray<[string, MemberSessionData | null, boolean]> = [
    ["guest", guest, false],
    ["free", free, false],
    ["silver", silver, true],
    ["vip", vip, true],
    ["failed", failed, false],
  ];

  for (const [name, session, expected] of cases) {
    it(`${name} ${expected ? "passes" : "fails"} a tier_1 gate`, () => {
      expect(isEntitled(session, "tier_1", DEFAULT_SITE_TIERS, NOW)).toBe(expected);
    });
  }

  it("produces at least three distinct outcomes across the five states", () => {
    // Guards the switcher's whole purpose: the states must not collapse.
    const outcomes = cases.map(
      ([, session]) =>
        `${isEntitled(session, "free_member", DEFAULT_SITE_TIERS, NOW)}` +
        `${isEntitled(session, "tier_1", DEFAULT_SITE_TIERS, NOW)}` +
        `${isEntitled(session, "vip", DEFAULT_SITE_TIERS, NOW)}`
    );

    expect(new Set(outcomes).size).toBeGreaterThanOrEqual(3);
  });
});

describe("isEntitled: the hierarchy rule", () => {
  it("lets a VIP through every lower gate with no extra config", () => {
    // PRD section 11.3 behaviour 3. The creator configures nothing for this.
    expect(isEntitled(vip, "free_member", DEFAULT_SITE_TIERS, NOW)).toBe(true);
    expect(isEntitled(vip, "tier_1", DEFAULT_SITE_TIERS, NOW)).toBe(true);
    expect(isEntitled(vip, "tier_2", DEFAULT_SITE_TIERS, NOW)).toBe(true);
    expect(isEntitled(vip, "vip", DEFAULT_SITE_TIERS, NOW)).toBe(true);
  });

  it("does not let a lower tier through a higher gate", () => {
    expect(isEntitled(free, "tier_1", DEFAULT_SITE_TIERS, NOW)).toBe(false);
    expect(isEntitled(silver, "tier_2", DEFAULT_SITE_TIERS, NOW)).toBe(false);
    expect(isEntitled(silver, "vip", DEFAULT_SITE_TIERS, NOW)).toBe(false);
  });

  it("treats an equal rank as entitled, not as strictly greater", () => {
    expect(isEntitled(silver, "tier_1", DEFAULT_SITE_TIERS, NOW)).toBe(true);
  });
});

describe("isEntitled: status and the two time windows", () => {
  const base = silver as MemberSessionData;

  it("keeps a canceled member in until the period they paid for ends", () => {
    // PRD section 11.3 behaviour 1.
    const canceled: MemberSessionData = {
      ...base,
      status: "canceled",
      currentPeriodEnd: NOW + 5 * DAY,
    };

    expect(isEntitled(canceled, "tier_1", DEFAULT_SITE_TIERS, NOW)).toBe(true);
    expect(isEntitled(canceled, "tier_1", DEFAULT_SITE_TIERS, NOW + 6 * DAY)).toBe(false);
  });

  it("keeps a past_due member in through the grace window", () => {
    // PRD section 11.3 behaviour 2, the F18 dunning window.
    const pastDue: MemberSessionData = {
      ...base,
      status: "past_due",
      gracePeriodEndsAt: NOW + 2 * DAY,
    };

    expect(isEntitled(pastDue, "tier_1", DEFAULT_SITE_TIERS, NOW)).toBe(true);
    expect(isEntitled(pastDue, "tier_1", DEFAULT_SITE_TIERS, NOW + 3 * DAY)).toBe(false);
  });

  it("treats a trialing member as fully active", () => {
    expect(
      isEntitled({ ...base, status: "trialing" }, "tier_1", DEFAULT_SITE_TIERS, NOW)
    ).toBe(true);
  });

  it("closes both windows exactly at their boundary, not after", () => {
    // Strictly less than, so the boundary second is already expired. Asserted
    // because an off-by-one here hands out a free day of paid content.
    const canceled: MemberSessionData = {
      ...base,
      status: "canceled",
      currentPeriodEnd: NOW,
    };

    expect(isEntitled(canceled, "tier_1", DEFAULT_SITE_TIERS, NOW)).toBe(false);
    expect(isEntitled(canceled, "tier_1", DEFAULT_SITE_TIERS, NOW - 1)).toBe(true);
  });
});

describe("isEntitled: fails closed on bad data", () => {
  it("refuses when the held tier is not in the site's tier table", () => {
    // Exactly the failure mode that PRD conflict B would have caused in
    // production: a Silver member holding the key `silver` against a tier table
    // keyed `tier_1`. The lookup misses and the gate stays shut. Written up in
    // 04-live-preview-studio.md section 5.1.
    const orphaned = { ...(silver as MemberSessionData), activeTier: "silver" as never };

    expect(isEntitled(orphaned, "tier_1", DEFAULT_SITE_TIERS, NOW)).toBe(false);
  });

  it("refuses when the required tier is not in the site's tier table", () => {
    const sparse = [{ key: "vip" as const, rank: 3, name: "VIP" }];

    expect(isEntitled(silver, "tier_1", sparse, NOW)).toBe(false);
  });

  it("refuses an empty tier table for any real tier gate", () => {
    expect(isEntitled(vip, "vip", [], NOW)).toBe(false);
  });

  it("still honours anyone and signed_in with an empty tier table", () => {
    // Neither pseudo-tier is ranked, so neither needs the table.
    expect(isEntitled(guest, "anyone", [], NOW)).toBe(true);
    expect(isEntitled(vip, "signed_in", [], NOW)).toBe(true);
  });
});

describe("lockReason", () => {
  it("returns null when the session is entitled, so callers can branch on it", () => {
    expect(lockReason(vip, "tier_1", DEFAULT_SITE_TIERS, NOW)).toBeNull();
  });

  it("never leaks a raw enum value into user-facing copy", () => {
    // PRD section 7.6 rule 4. "past_due" must never reach a screen.
    const reasons = [
      lockReason(guest, "tier_1", DEFAULT_SITE_TIERS, NOW),
      lockReason(free, "tier_1", DEFAULT_SITE_TIERS, NOW),
      lockReason(failed, "tier_1", DEFAULT_SITE_TIERS, NOW),
    ];

    for (const reason of reasons) {
      expect(reason).toBeTruthy();
      expect(reason).not.toMatch(/past_due|free_member|tier_1|tier_2|signed_in/);
    }
  });

  it("asks a guest to sign in", () => {
    expect(lockReason(guest, "tier_1", DEFAULT_SITE_TIERS, NOW)).toMatch(/sign in/i);
  });

  it("names the plan a free member is missing", () => {
    expect(lockReason(free, "tier_1", DEFAULT_SITE_TIERS, NOW)).toContain("Silver");
  });

  it("explains a failed payment as a payment problem, not as a tier problem", () => {
    expect(lockReason(failed, "tier_1", DEFAULT_SITE_TIERS, NOW)).toMatch(/payment/i);
  });
});

describe("exact tiers: only:a,b (19-section-locks.md 8)", () => {
  const ladder = [
    { key: "free_member", rank: 0, name: "Free" },
    { key: "standard", rank: 1, name: "Standard" },
    { key: "premium", rank: 2, name: "Premium" },
    { key: "vip", rank: 3, name: "VIP" },
  ];
  const member = (activeTier: string, status = "active") =>
    ({ memberId: "m", email: "a@b.c", activeTier, status, currentPeriodEnd: 0, gracePeriodEndsAt: 0 }) as never;

  it("lets in exactly the listed tiers, not the ones above them", () => {
    expect(isEntitled(member("standard"), "only:standard,vip" as never, ladder as never)).toBe(true);
    expect(isEntitled(member("vip"), "only:standard,vip" as never, ladder as never)).toBe(true);
    expect(isEntitled(member("premium"), "only:standard,vip" as never, ladder as never)).toBe(false);
    expect(isEntitled(member("free_member"), "only:standard,vip" as never, ladder as never)).toBe(false);
    expect(isEntitled(null, "only:standard,vip" as never, ladder as never)).toBe(false);
  });

  it("keeps the status rules, and a deleted tier matches nobody", () => {
    expect(isEntitled(member("standard", "past_due"), "only:standard" as never, ladder as never, 10)).toBe(false);
    expect(isEntitled(member("gone"), "only:gone" as never, ladder as never)).toBe(false);
    expect(isEntitled(member("standard"), "only:" as never, ladder as never)).toBe(false);
  });
});
