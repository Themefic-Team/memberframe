/**
 * Dynamic tiers in the plugin. Development doc: 23-dynamic-tiers.md.
 *
 * The Free tier is found by rank 0, never by the key `free_member`: a new
 * site's Free tier is `free`, and an old site's keeps `free_member`. Anything
 * that looked for the key would show a second, phantom Free tier, or treat
 * the real one as paid.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { rememberSiteTiers, siteTiers } from "../src/types/member";
import { whoSeesOptions } from "../src/services/sectionLocks";
import { isFreeTier } from "../src/components/manage/tierValidation";

describe("the Free tier is rank 0, whatever its key", () => {
  it("adds no phantom Free tier to a site whose Free tier is keyed free", () => {
    rememberSiteTiers([
      { key: "free", rank: 0, name: "Free" },
      { key: "gold", rank: 1, name: "Gold" },
    ]);
    expect(siteTiers().map((tier) => tier.key)).toEqual(["free", "gold"]);
  });

  it("still adds Free to a ladder that has none", () => {
    rememberSiteTiers([{ key: "gold", rank: 1, name: "Gold" }]);
    expect(siteTiers().map((tier) => tier.rank)).toEqual([0, 1]);
  });

  it("leaves a renamed Free tier out of the paid section lock choices", () => {
    const labels = whoSeesOptions([
      { key: "starter", rank: 0, name: "Starter" },
      { key: "gold_plus", rank: 1, name: "Gold Plus" },
    ]).map((option) => option.label);
    expect(labels).toContain("Gold Plus members or higher");
    expect(labels.some((label) => label.includes("Starter"))).toBe(false);
  });

  it("is what the editor calls Free", () => {
    expect(isFreeTier({ rank: 0 })).toBe(true);
    expect(isFreeTier({ rank: 1 })).toBe(false);
  });
});

describe("one site currency in the panel", () => {
  const editor = readFileSync(path.join(process.cwd(), "src", "components", "manage", "TierEditor.tsx"), "utf-8");
  const payments = readFileSync(path.join(process.cwd(), "src", "components", "manage", "PaymentsPanel.tsx"), "utf-8");

  it("has no currency picker and no extra prices in the tier editor", () => {
    expect(editor).not.toMatch(/Add currency|CURRENCY_OPTIONS|extraPrices/);
    expect(editor).toContain("label={`${label}, ${currency}`}");
  });

  it("opens each tier, and a new one, in a sheet, like a payment gateway", () => {
    expect(editor).toContain('aria-haspopup="dialog"');
    expect(editor).not.toContain("aria-expanded");
    expect(editor).toContain("setDraft(draftFromRecord(tier, currency));");
    // One sheet at a time: the one draft drives it.
    expect(editor).toMatch(/\{draft \? \(\s*<TierSheet/);
    expect(editor).toContain("<Sheet");
  });

  it("closes the sheet after a save, so the saved tier is never checked against itself", () => {
    // The bug: a created tier stayed open, the list reloaded with it, and the
    // form said its own name was taken.
    expect(editor).toMatch(/if \(await onSave\(draft\)\) \{\s*setDraft\(null\);/);
    expect(editor).toContain("if (!draft || !validation?.valid || saving) return;");
  });

  it("deletes a saved paid tier only after the popup, and never the Free tier", () => {
    expect(editor).toContain('draft.id !== null && draft.kind === "paid"');
    expect(editor).toContain("onClick={() => setConfirmDelete(true)}");
    expect(editor).toContain("<ConfirmDialog");
  });

  it("pins Delete tier and the save in the sheet's footer, the save busy while saving", () => {
    const footer = editor.slice(editor.indexOf("footer={"), editor.indexOf("<Fields>"));
    expect(footer).toContain("Delete tier");
    expect(footer).toContain('variant="primary"');
    expect(footer).toContain("loading={saving}");
    // A save in flight cannot be dismissed half done.
    expect(editor).toContain("onClose={saving ? undefined : onClose}");
  });

  it("sets the site currency in Payments, searchable, with a warning before it moves every tier", () => {
    expect(payments).toContain('label="Site currency"');
    expect(payments).toContain("<SearchSelect");
    expect(payments).toContain("draft.defaultCurrency !== overview.settings.defaultCurrency");
  });
});
