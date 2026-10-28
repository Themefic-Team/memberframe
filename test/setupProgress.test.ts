import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { SiteSettingsDocument } from "../src/types/connection";

vi.mock("framer-plugin", () => ({ framer: {} }));

const { memberPagesDone, paidTierDone, signInDone, locksDone, SETUP_STEP_IDS } = await import("../src/hooks/useSetupProgress");
const { membershipPages } = await import("../src/services/pageScaffoldService");

const settings = (patch: Partial<SiteSettingsDocument> = {}) =>
  ({ integrations: {}, gatedPages: [], sectionLocks: [], ...patch }) as unknown as SiteSettingsDocument;

describe("setup progress: each step is ticked by the real state, never by a click", () => {
  it("has the guide's six steps, in order", () => {
    expect(SETUP_STEP_IDS).toEqual(["pages", "tiers", "payments", "signIn", "locks", "publish"]);
  });

  it("member pages: done only when every page the Builder offers exists", () => {
    const required = membershipPages(undefined, { includePricing: true, includeRegistration: true }).map((page) => page.path);
    expect(memberPagesDone(settings(), required)).toBe(true);
    expect(memberPagesDone(settings(), required.slice(1))).toBe(false);
    expect(memberPagesDone(settings(), [])).toBe(false);
  });

  it("tiers: a free tier alone is not done; an active priced tier is", () => {
    const free = { isActive: true, monthlyPriceMinor: null, annualPriceMinor: null, lifetimePriceMinor: null };
    expect(paidTierDone([free])).toBe(false);
    expect(paidTierDone([free, { ...free, monthlyPriceMinor: 900 }])).toBe(true);
    expect(paidTierDone([{ ...free, lifetimePriceMinor: 29900 }])).toBe(true);
    expect(paidTierDone([{ ...free, isActive: false, monthlyPriceMinor: 900 }])).toBe(false);
  });

  it("sign in: only a turned-on sign in provider counts", () => {
    const off = { enabled: false, values: {}, secretsPresent: [] };
    expect(signInDone(settings({ integrations: { google_oauth: off } }))).toBe(false);
    expect(signInDone(settings({ integrations: { stripe: { ...off, enabled: true } } }))).toBe(false);
    expect(signInDone(settings({ integrations: { github_oauth: { ...off, enabled: true } } }))).toBe(true);
  });

  it("locks: an enabled page lock or any section lock", () => {
    const page = { path: "/members", enabled: false, requiredTier: "tier_1", fallbackAction: "redirect" as const };
    expect(locksDone(settings({ gatedPages: [page] }))).toBe(false);
    expect(locksDone(settings({ gatedPages: [{ ...page, enabled: true }] }))).toBe(true);
    expect(locksDone(settings({ sectionLocks: [{} as never] }))).toBe(true);
  });
});

describe("the quick guide and Home", () => {
  const guide = readFileSync("src/components/QuickGuide.tsx", "utf8");
  const home = readFileSync("src/components/tabs/HomeTab.tsx", "utf8");

  it("reopening the guide keeps \"Don't show this again\" as it was saved", () => {
    expect(guide).toContain("useState(quickGuideHidden)");
  });

  it("the footer's checkbox and button are the Sheet footer's own children", () => {
    // Wrapped in a div, the full-width primary squeezed the label onto four lines.
    expect(guide).not.toContain("quick-guide-footer");
  });

  it("a finished step shows a check, and Home reopens the guide with its progress", () => {
    expect(guide).toContain('done[step.id] ? "step-row-icon is-done" : "step-row-icon"');
    expect(home).toContain("onClick={onOpenGuide}");
    expect(home).toContain('<ProgressSteps className="home-setup-progress"');
  });
});
