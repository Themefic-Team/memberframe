/**
 * F19: the BEAF billing UI's wording and formats (components/billing), which
 * every Framefic plugin shares. Development doc 19-pro-lock-and-trial.md.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("framer-plugin", () => ({ framer: { notify: vi.fn() } }));

const { formatCountdown, getPlanName, getStatusLabel, isAutoRenew, trialBannerText } = await import(
  "../src/components/billing/billingHelpers"
);
import type { LicenseView } from "../src/services/licenseService";

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

describe("the BEAF billing helpers", () => {
  it("counts down as BEAF does: hours, minutes, seconds", () => {
    expect(formatCountdown(5 * 3600 + 3 * 60 + 2)).toBe("5h 3m 2s");
    expect(formatCountdown(65)).toBe("1m 5s");
    expect(formatCountdown(9)).toBe("9s");
    expect(formatCountdown(3600)).toBe("1h 0m 0s");
    expect(formatCountdown(-4)).toBe("0s");
  });

  it("shows days until the last 24 hours, then the live countdown", () => {
    expect(trialBannerText(6 * 86_400 + 5)).toBe("Free trial! 7 days left");
    expect(trialBannerText(86_401)).toBe("Free trial! 2 days left");
    expect(trialBannerText(86_400)).toBe("Free trial! 24h 0m 0s left");
    expect(trialBannerText(86_399)).toBe("Free trial! 23h 59m 59s left");
  });

  it("names the plans as BEAF does", () => {
    expect(getPlanName("monthly")).toBe("Pro Monthly");
    expect(getPlanName("yearly")).toBe("Pro Yearly");
    expect(getPlanName("lifetime")).toBe("Lifetime Deal");
    expect(getPlanName("trial")).toBe("7-Day Free Trial");
    expect(getPlanName(null)).toBe("Free");
  });

  it("labels statuses and renewal", () => {
    expect(getStatusLabel("past_due", true)).toBe("Past due");
    expect(getStatusLabel("canceling", true)).toBe("Scheduled to cancel");
    expect(getStatusLabel("paid", true)).toBe("Active");
    expect(getStatusLabel(null, false)).toBe("Inactive");
    expect(isAutoRenew(view({}))).toBe("Automatically");
    expect(isAutoRenew(view({ cancelAtPeriodEnd: true }))).toBe("No");
    expect(isAutoRenew(view({ plan: "lifetime" }))).toBe("Never");
    expect(isAutoRenew(null)).toBe("-");
  });
});
