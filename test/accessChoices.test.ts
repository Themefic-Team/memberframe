/**
 * One "who is it for" list for page locks, section locks, and the paywall
 * (19-section-locks.md 9), and the tiles that pick exact tiers.
 */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { accessOptions, accessOptionsFor, accessValue, parseAccess } from "../src/services/accessChoices";
import { Select } from "../src/components/ui/Select";
import { TierChecklist } from "../src/components/settings/TierChecklist";

const TIERS = [
  { key: "free_member", name: "Free", rank: 0 },
  { key: "standard", name: "Standard", rank: 1 },
  { key: "premium", name: "Premium", rank: 2 },
];

describe("the shared list", () => {
  it("gives the paywall only who gets in, the locks both groups", () => {
    expect(accessOptions(TIERS, { others: false }).every((option) => option.value.startsWith("members:"))).toBe(true);
    expect(accessOptions(TIERS).some((option) => option.value === "others:signed_in")).toBe(true);
  });

  it("round-trips a lock, keeping exact ticks and ticking the lowest paid tier when new", () => {
    expect(accessValue({ requiredTier: "premium" })).toBe("members:premium");
    expect(accessValue({ audience: "others", requiredTier: "only:standard" })).toBe("others:__only__");
    expect(parseAccess("others:premium")).toEqual({ audience: "others", requiredTier: "premium" });
    expect(parseAccess("members:__only__", { requiredTier: "signed_in" }, TIERS)).toEqual({ audience: "members", requiredTier: "only:standard" });
    expect(parseAccess("others:__only__", { requiredTier: "only:premium" }, TIERS).requiredTier).toBe("only:premium");
  });

  it("keeps a deleted tier visible in its own lock's picker", () => {
    const options = accessOptionsFor({ requiredTier: "gold" }, accessOptions(TIERS));
    expect(options[options.length - 1]).toEqual({ value: "members:gold", label: "gold (deleted tier)", group: "Who gets in" });
  });
});

describe("the picker and the tiles", () => {
  it("shows the two groups as headings", () => {
    const html = renderToStaticMarkup(
      React.createElement(Select, { value: "members:signed_in", options: accessOptions(TIERS), onChange: () => undefined })
    );
    expect(html).toContain('<optgroup label="Who gets in">');
    expect(html).toContain('<optgroup label="Who is kept out">');
  });

  it("draws a tile per tier, ticked ones checked, with a count and what the ticks mean", () => {
    const html = renderToStaticMarkup(
      React.createElement(TierChecklist, { value: "only:premium", tiers: TIERS, idPrefix: "t", excluding: true, onChange: () => undefined })
    );
    expect(html).toContain("Tiers kept out");
    expect(html).toContain("1 of 3 selected");
    expect(html).toMatch(/aria-checked="true"[^>]*class="tier-option is-checked is-locked"/);
    expect(html).toContain("Members on a ticked tier are kept out.");
  });
});
