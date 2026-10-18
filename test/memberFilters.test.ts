/**
 * Member list filtering, labels, and counts. PRD task 2.2, feature F02.
 *
 * Also covers the search debounce from `hooks/useDebouncedValue.ts`. The hook
 * itself cannot be tested while `jsdom` is absent (blocker B5), so the timing
 * rule was pulled out as a pure function and the hook is the wiring around it.
 */

import { describe, expect, it } from "vitest";
import {
  NO_MEMBER_FILTERS,
  STATUS_FILTERS,
  filterMembers,
  formatJoinedDate,
  hasActiveFilters,
  matchesQuery,
  matchesStatus,
  matchesTier,
  memberCountLabel,
  pageCount,
  pluralize,
  statusLabel,
  statusTone,
  tierFilters,
  tierLabel,
} from "../src/components/manage/memberFilters";
import {
  SEARCH_DEBOUNCE_MS,
  debounceDeadline,
  shouldSettle,
} from "../src/hooks/useDebouncedValue";
import { MEMBER_PAGE_SIZE, type SiteMemberRecord } from "../src/types/site";
import { FREE_TIER, rememberSiteTiers, siteTiers, type MemberStatus, type TierKey } from "../src/types/member";

function member(overrides: Partial<SiteMemberRecord> = {}): SiteMemberRecord {
  return {
    id: "m1",
    email: "maya@example.com",
    name: "Maya Okafor",
    avatarUrl: null,
    tier: "tier_1",
    status: "active",
    createdAt: "2026-03-04T10:00:00Z",
    lifetimeSpend: 2997,
    currency: "USD",
    gateway: "stripe",
    ...overrides,
  };
}

describe("matchesQuery", () => {
  it("matches on email and on name", () => {
    expect(matchesQuery(member(), "maya@")).toBe(true);
    expect(matchesQuery(member(), "Okafor")).toBe(true);
  });

  it("is case insensitive", () => {
    expect(matchesQuery(member(), "MAYA")).toBe(true);
    expect(matchesQuery(member({ name: "ALEX" }), "alex")).toBe(true);
  });

  it("matches a substring, not just a prefix", () => {
    // A creator searching for a customer often remembers the domain, not the
    // local part.
    expect(matchesQuery(member(), "example.com")).toBe(true);
    expect(matchesQuery(member(), "kafo")).toBe(true);
  });

  it("matches everything on an empty or whitespace query", () => {
    expect(matchesQuery(member(), "")).toBe(true);
    expect(matchesQuery(member(), "   ")).toBe(true);
  });

  it("still finds a member with no name, by email alone", () => {
    // Not every provider returns a name, and a nameless member is still one
    // the creator needs to be able to find.
    expect(matchesQuery(member({ name: null }), "maya")).toBe(true);
  });

  it("does not match an unrelated string", () => {
    expect(matchesQuery(member(), "zzz")).toBe(false);
  });
});

describe("matchesTier and matchesStatus", () => {
  it("lets everything through on the all filter", () => {
    expect(matchesTier(member(), "all")).toBe(true);
    expect(matchesStatus(member(), "all")).toBe(true);
  });

  it("filters to one tier and one status", () => {
    expect(matchesTier(member({ tier: "vip" }), "vip")).toBe(true);
    expect(matchesTier(member({ tier: "vip" }), "tier_1")).toBe(false);
    expect(matchesStatus(member({ status: "past_due" }), "past_due")).toBe(true);
    expect(matchesStatus(member({ status: "past_due" }), "active")).toBe(false);
  });
});

describe("filterMembers", () => {
  const roster: ReadonlyArray<SiteMemberRecord> = [
    member({ id: "a", email: "a@example.com", name: "Ada", tier: "free_member", status: "active" }),
    member({ id: "b", email: "b@example.com", name: "Bo", tier: "tier_1", status: "past_due" }),
    member({ id: "c", email: "c@other.com", name: "Cy", tier: "vip", status: "active" }),
  ];

  it("applies all three filters together", () => {
    const result = filterMembers(roster, { query: "example.com", tier: "all", status: "active" });

    expect(result.map((entry) => entry.id)).toEqual(["a"]);
  });

  it("returns everything with no filters", () => {
    expect(filterMembers(roster, NO_MEMBER_FILTERS)).toHaveLength(3);
  });

  it("returns nothing rather than throwing when nothing matches", () => {
    expect(filterMembers(roster, { query: "zzz", tier: "all", status: "all" })).toHaveLength(0);
  });
});

describe("hasActiveFilters", () => {
  it("is false only when nothing is narrowing the list", () => {
    // Drives "no matches" versus "no members yet", which are different empty
    // states with different next actions.
    expect(hasActiveFilters(NO_MEMBER_FILTERS)).toBe(false);
    expect(hasActiveFilters({ query: "  ", tier: "all", status: "all" })).toBe(false);
    expect(hasActiveFilters({ query: "a", tier: "all", status: "all" })).toBe(true);
    expect(hasActiveFilters({ query: "", tier: "vip", status: "all" })).toBe(true);
    expect(hasActiveFilters({ query: "", tier: "all", status: "canceled" })).toBe(true);
  });
});

describe("labels never leak a raw value", () => {
  it("gives every tier and status a friendly label", () => {
    // PRD section 7.6 rule 4: never expose free_member or past_due.
    for (const tier of ["free_member", "tier_1", "tier_2", "vip"] as const satisfies ReadonlyArray<TierKey>) {
      expect(tierLabel(tier)).not.toContain("_");
    }

    for (const status of ["active", "trialing", "past_due", "canceled"] as const satisfies ReadonlyArray<MemberStatus>) {
      expect(statusLabel(status)).not.toContain("_");
    }
  });

  it("renders past_due as a payment problem, not as a status code", () => {
    expect(statusLabel("past_due")).toBe("Payment failed");
  });

  it("labels every filter option without a raw value", () => {
    const tiers = [FREE_TIER, { key: "tier_1", rank: 1, name: "Silver" }];
    for (const option of [...tierFilters(tiers), ...STATUS_FILTERS]) {
      expect(option.label).not.toContain("_");
      expect(option.label.length).toBeGreaterThan(0);
    }
  });

  it("offers only the site's own tiers, so a new site filters on Free alone", () => {
    expect(tierFilters([FREE_TIER]).map((option) => option.value)).toEqual(["all", "free_member"]);
    expect(tierFilters([FREE_TIER]).map((option) => option.label)).not.toContain("VIP");
  });
});

describe("site tier ladder", () => {
  it("always keeps Free, and adds only the tiers the site has", () => {
    rememberSiteTiers([{ key: "tier_gold", rank: 2, name: "Gold" }]);
    expect(siteTiers().map((tier) => tier.key)).toEqual(["free_member", "tier_gold"]);

    rememberSiteTiers([]);
    expect(siteTiers()).toEqual([FREE_TIER]);
  });
});

describe("statusTone", () => {
  it("gives each status its own tone, with trialing distinct from active", () => {
    // A trial is a good state and a temporary one. Showing it in the same green
    // as a paying member hides the thing the creator wants to see at a glance.
    expect(statusTone("active")).toBe("success");
    expect(statusTone("trialing")).toBe("brand");
    expect(statusTone("past_due")).toBe("warning");
    expect(statusTone("canceled")).toBe("neutral");
  });

  it("produces four distinct tones, so no two statuses look alike", () => {
    const tones = (["active", "trialing", "past_due", "canceled"] as const).map(statusTone);

    expect(new Set(tones).size).toBe(4);
  });
});

describe("pluralize", () => {
  it("never produces the member(s) form PRD section 7.6 rule 5 forbids", () => {
    expect(pluralize(0, "member")).toBe("0 members");
    expect(pluralize(1, "member")).toBe("1 member");
    expect(pluralize(2, "member")).toBe("2 members");
    expect(pluralize(1, "member")).not.toContain("(s)");
  });

  it("takes an irregular plural when the default is wrong", () => {
    expect(pluralize(1, "entry", "entries")).toBe("1 entry");
    expect(pluralize(3, "entry", "entries")).toBe("3 entries");
  });
});

describe("memberCountLabel", () => {
  it("shows a plain count when no filter is on", () => {
    expect(memberCountLabel(48, 48, NO_MEMBER_FILTERS)).toBe("48 members");
  });

  it("shows the shown count against the total when a filter is on", () => {
    // A bare "3 members" would read as a site with three members. Naming both
    // numbers tells the creator their filter is doing something.
    expect(memberCountLabel(3, 48, { query: "ada", tier: "all", status: "all" })).toBe(
      "3 of 48 members"
    );
  });

  it("pluralizes the total, not the shown count", () => {
    expect(memberCountLabel(1, 1, { query: "a", tier: "all", status: "all" })).toBe("1 of 1 member");
  });
});

describe("pageCount", () => {
  it("rounds up, because a partial page is still a page", () => {
    expect(pageCount(0, MEMBER_PAGE_SIZE)).toBe(1);
    expect(pageCount(1, MEMBER_PAGE_SIZE)).toBe(1);
    expect(pageCount(25, MEMBER_PAGE_SIZE)).toBe(1);
    expect(pageCount(26, MEMBER_PAGE_SIZE)).toBe(2);
    expect(pageCount(50, MEMBER_PAGE_SIZE)).toBe(2);
    expect(pageCount(51, MEMBER_PAGE_SIZE)).toBe(3);
  });

  it("never returns zero, so the pager cannot read page 1 of 0", () => {
    expect(pageCount(0, 25)).toBe(1);
  });

  it("survives a nonsense page size rather than dividing by zero", () => {
    expect(pageCount(10, 0)).toBe(1);
    expect(pageCount(10, -5)).toBe(1);
  });

  it("paginates at the size PRD section 10.3 sets", () => {
    expect(MEMBER_PAGE_SIZE).toBe(25);
  });
});

describe("formatJoinedDate", () => {
  it("renders a real date without the raw ISO string", () => {
    const formatted = formatJoinedDate("2026-03-04T10:00:00Z");

    expect(formatted).not.toContain("T");
    expect(formatted).toMatch(/2026/);
  });

  it("falls back to the permitted placeholder on a bad timestamp", () => {
    // A row with a broken date still has to render. The writing rules forbid
    // em and en dashes; the lone hyphen placeholder is the stated exception.
    expect(formatJoinedDate("not a date")).toBe("-");
    expect(formatJoinedDate("")).toBe("-");
  });
});

describe("the 300ms search debounce", () => {
  it("uses the interval F02 names", () => {
    expect(SEARCH_DEBOUNCE_MS).toBe(300);
  });

  it("settles at the boundary and not one millisecond before", () => {
    // An off-by-one on a debounce boundary is the classic bug in this code, so
    // the assertion states which side it falls on.
    expect(shouldSettle(1000, 1000 + 299)).toBe(false);
    expect(shouldSettle(1000, 1000 + 300)).toBe(true);
    expect(shouldSettle(1000, 1000 + 301)).toBe(true);
  });

  it("does not settle immediately, which would be a leading edge", () => {
    // Firing on the first keystroke would query for "m".
    expect(shouldSettle(1000, 1000)).toBe(false);
  });

  it("reports a deadline consistent with its own settle check", () => {
    const deadline = debounceDeadline(5000);

    expect(deadline).toBe(5300);
    expect(shouldSettle(5000, deadline)).toBe(true);
    expect(shouldSettle(5000, deadline - 1)).toBe(false);
  });
});
