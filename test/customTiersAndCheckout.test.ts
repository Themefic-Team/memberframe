/**
 * FP-16 follow-ups: keys made from names, and Member Pricing's switch
 * confirmation and on-site checkout.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { keyFromName } from "../src/components/manage/tierValidation";

const COMPONENTS = path.join(process.cwd(), "src", "canvas-components");
const pricingSource = readFileSync(path.join(COMPONENTS, "MemberPricing.tsx"), "utf-8");

describe("keyFromName", () => {
  it("makes a lowercase key and avoids taken keys", () => {
    expect(keyFromName("Pro Plus", [])).toBe("pro_plus");
    expect(keyFromName("Pro Plus", ["pro_plus"])).toBe("pro_plus_2");
    expect(keyFromName("2024 Members", [])).toBe("tier_2024_members");
    // No reserved built in keys since tiers became dynamic (23-dynamic-tiers.md).
    expect(keyFromName("VIP", [])).toBe("vip");
    expect(keyFromName("VIP", ["vip"])).toBe("vip_2");
  });
});

describe("Member Pricing", () => {
  it("asks before switching a paying member's plan", () => {
    expect(pricingSource).toContain("if (onPaidPlan && !switching) {");
    expect(pricingSource).toContain('t("confirmSwitch", { tier: tier.name })');
  });

  it("finishes an in-place switch without a checkout page", () => {
    expect(pricingSource).toContain('if (body.kind === "changed") {');
  });

  it("opens every gateway on its own page, never an overlay on this one (2026-10-20)", () => {
    // Lemon Squeezy's overlay and Razorpay's in-page window were removed: each
    // gateway opens its hosted checkout, in the chooser's new tab or this tab.
    expect(pricingSource).not.toContain("lemon.js");
    expect(pricingSource).not.toContain("checkout.razorpay.com");
    expect(pricingSource).not.toContain("openEmbedded");
    expect(pricingSource).toContain("tab.location.href = body.url;");
    expect(pricingSource).toContain("window.location.assign(body.url);");
  });

  it("confirms every checkout through the server when the buyer comes back", () => {
    expect(pricingSource).toContain('const checkoutId = readParam("mf_checkout");');
    expect(pricingSource).toContain("void confirm(body.checkoutId, true);");
  });

  it("sends a test country only as a header the API ignores outside test mode", () => {
    expect(pricingSource).toContain('headers["X-MemberFrame-Test-Country"] = country;');
  });
});
