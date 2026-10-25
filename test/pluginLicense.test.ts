/**
 * F19 in the panel: the license helpers, the lock patcher, the generator's
 * baked state, and the account page link. Development doc 19-pro-lock-and-trial.md.
 */

import { describe, expect, it, vi } from "vitest";
import {
  canvasLicense,
  canvasStateFor,
  signedOutOfPlugin,
  formatCountdown,
  licenseNotice,
  panelUnlocked,
  planAction,
  type LicenseView,
} from "../src/services/licenseService";
import { LICENSED_FILE_NAMES, enforceLockState, patchLockState, readLockState } from "../src/utils/lockPatcher";
import { accountPageUrl, newSessionId } from "../src/services/connectService";
import { AUTH_SCREEN_DESCRIPTORS, generateComponentCode, MEMBER_PRICING_DESCRIPTOR, BOOKMARK_BUTTON_DESCRIPTOR } from "../src/services/canvasComponentCodeGenerator";
import { DEFAULT_BOOKMARK_BUTTON_CONFIG, DEFAULT_MEMBER_PRICING_CONFIG } from "../src/types/canvas";

const NOW = Date.parse("2026-10-18T12:00:00Z");
const DAY = 86_400_000;
const view = (overrides: Partial<LicenseView>): LicenseView => ({
  state: "active",
  plan: "monthly",
  status: "active",
  trialEndsAt: null,
  startedAt: null,
  currentPeriodStart: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  amountMinor: 499,
  currency: "usd",
  claimedProjectName: null,
  subscriptionId: "s",
  ...overrides,
});

describe("the license in the panel", () => {
  it("locks the panel and the canvas for everything but a trial or a plan", () => {
    expect(panelUnlocked("active")).toBe(true);
    expect(panelUnlocked("trial")).toBe(true);
    for (const state of ["expired", "none", "trial_claimed_other_site", null] as const) {
      expect(panelUnlocked(state)).toBe(false);
      expect(canvasLicense(state)).toBe("locked");
    }
    expect(canvasLicense("trial")).toBe("trial");
  });

  it("locks the canvas when the plugin is signed out, but not while loading or offline", () => {
    expect(signedOutOfPlugin("disconnected", false, false)).toBe(true);
    // Waiting for the emailed code is still signed out.
    expect(signedOutOfPlugin("code_sent", false, false)).toBe(true);
    expect(signedOutOfPlugin("loading", false, false)).toBe(false);
    expect(signedOutOfPlugin("connected", false, false)).toBe(false);
    // The server could not be reached: a paid canvas is not locked for that.
    expect(signedOutOfPlugin("disconnected", true, false)).toBe(false);
    // The browser preview has no project.
    expect(signedOutOfPlugin("disconnected", false, true)).toBe(false);

    expect(canvasStateFor("active", true)).toBe("locked");
    expect(canvasStateFor(null, true)).toBe("locked");
    expect(canvasStateFor(null, false)).toBeNull();
    expect(canvasStateFor("trial", false)).toBe("trial");
    expect(canvasStateFor("expired", false)).toBe("locked");
  });

  it("switches the countdown format at exactly 24 hours", () => {
    expect(formatCountdown(86_400)).toBe("1 day left");
    expect(formatCountdown(86_399)).toBe("23:59:59 left");
    expect(formatCountdown(6 * 86_400 + 5)).toBe("6 days left");
    expect(formatCountdown(-5)).toBe("00:00:00 left");
  });

  it("offers upgrades only, as BEAF", () => {
    expect(planAction(null, "monthly")).toBe("choose");
    expect(planAction("monthly", "yearly")).toBe("upgrade");
    expect(planAction("monthly", "lifetime")).toBe("upgrade");
    expect(planAction("yearly", "monthly")).toBe("unavailable");
    expect(planAction("lifetime", "yearly")).toBe("unavailable");
    expect(planAction("yearly", "yearly")).toBe("current");
  });

  it("shows one notice: trial, failed payment, cancellation, then renewal", () => {
    expect(licenseNotice(view({ state: "trial", plan: "trial", trialEndsAt: new Date(NOW + DAY).toISOString() }), NOW)).toEqual({ kind: "trial", secondsLeft: 86_400 });
    expect(licenseNotice(view({ status: "past_due" }), NOW)).toEqual({ kind: "payment_failed" });
    expect(licenseNotice(view({ cancelAtPeriodEnd: true, currentPeriodEnd: "2026-11-01T00:00:00Z" }), NOW)?.kind).toBe("canceling");
  });

  it("reminds a yearly plan 7 days ahead and a monthly one 3 days ahead", () => {
    const inDays = (days: number) => new Date(NOW + days * DAY).toISOString();
    expect(licenseNotice(view({ plan: "yearly", currentPeriodEnd: inDays(6) }), NOW)?.kind).toBe("renewing");
    expect(licenseNotice(view({ plan: "monthly", currentPeriodEnd: inDays(6) }), NOW)).toBeNull();
    expect(licenseNotice(view({ plan: "monthly", currentPeriodEnd: inDays(2) }), NOW)?.kind).toBe("renewing");
    expect(licenseNotice(view({ plan: "lifetime", currentPeriodEnd: null }), NOW)).toBeNull();
  });
});

describe("the lock patcher", () => {
  const AUTHORED = "import x\nconst IS_LOCKED = false;\nconst IS_TRIAL = false;\n// @plugin-lock-state: unlocked\n// @plugin-trial-state: paid\nrest\n";

  it("writes each state into the four lines", () => {
    expect(readLockState(patchLockState(AUTHORED, "trial")!)).toBe("trial");
    expect(readLockState(patchLockState(AUTHORED, "locked")!)).toBe("locked");
    expect(patchLockState(AUTHORED, "locked")).toContain("// @plugin-lock-state: locked\n// @plugin-trial-state: expired");
    expect(patchLockState(patchLockState(AUTHORED, "locked")!, "active")).toBe(AUTHORED);
  });

  it("leaves a hand-edited file alone rather than guess", () => {
    expect(patchLockState(AUTHORED.replace("const IS_TRIAL = false;\n", ""), "trial")).toBeNull();
    expect(patchLockState(AUTHORED + "const IS_LOCKED = true;\n", "trial")).toBeNull();
  });

  it("rewrites only the licensed files that disagree", async () => {
    const file = (name: string, content: string) => ({ name, content, setFileContent: vi.fn(async () => undefined) });
    const files = [
      file("MemberAuth.tsx", AUTHORED),
      file("MemberPricing.tsx", patchLockState(AUTHORED, "trial")!),
      file("BookmarkButton.tsx", AUTHORED),
      file("MemberDashboard.tsx", "edited by hand"),
      file("SomeoneElses.tsx", AUTHORED),
    ];
    const result = await enforceLockState("trial", async () => files);
    expect(result).toEqual({ patched: ["MemberAuth.tsx", "BookmarkButton.tsx"], skipped: ["MemberDashboard.tsx"] });
    expect(files[0]!.setFileContent).toHaveBeenCalledWith(patchLockState(AUTHORED, "trial"));
    expect(files[4]!.setFileContent).not.toHaveBeenCalled();
  });

  it("covers every canvas component, the bookmarks included", () => {
    for (const name of ["BookmarkButton.tsx", "BookmarksTray.tsx", "MemberAuth.tsx", "MemberDashboard.tsx", "MemberPricing.tsx", "MeteredPaywall.tsx", "ProtectedDownload.tsx"]) {
      expect(LICENSED_FILE_NAMES).toContain(name);
    }
  });
});

describe("the generator", () => {
  const context = { apiBaseUrl: "https://api.example.com", siteKey: "mf_site_x", afterLoginPath: "", loginPath: "/login", afterLogoutPath: "/" };

  it("bakes the project's license into a licensed component as it writes it", () => {
    const trial = generateComponentCode(MEMBER_PRICING_DESCRIPTOR, DEFAULT_MEMBER_PRICING_CONFIG, undefined, { ...context, license: "trial" });
    expect(readLockState(trial.code)).toBe("trial");
    const login = generateComponentCode(AUTH_SCREEN_DESCRIPTORS.member_login, AUTH_SCREEN_DESCRIPTORS.member_login.normalize({} as never), undefined, { ...context, license: "locked" });
    expect(readLockState(login.code)).toBe("locked");
  });

  it("locks the bookmarks like every other component", () => {
    const bookmark = generateComponentCode(BOOKMARK_BUTTON_DESCRIPTOR, DEFAULT_BOOKMARK_BUTTON_CONFIG, undefined, { ...context, license: "locked" });
    expect(readLockState(bookmark.code)).toBe("locked");
  });
});

describe("the account page link", () => {
  it("opens the hosted page with this panel's session id and theme", () => {
    const url = new URL(accountPageUrl("register", "abc-123", "light", "https://api.example.com/"));
    expect(url.origin + url.pathname).toBe("https://api.example.com/auth");
    expect(Object.fromEntries(url.searchParams)).toEqual({ mode: "register", sessionId: "abc-123", theme: "light" });
  });

  it("makes session ids the backend accepts", () => {
    for (let i = 0; i < 5; i += 1) expect(newSessionId()).toMatch(/^[A-Za-z0-9-]{16,100}$/);
  });
});
