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

  it("opens Lemon Squeezy and Razorpay on the page, and falls back to the hosted page", () => {
    expect(pricingSource).toContain('const LEMON_SCRIPT = "https://app.lemonsqueezy.com/js/lemon.js";');
    expect(pricingSource).toContain('const RAZORPAY_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";');
    expect(pricingSource).toContain("(await openEmbedded(body.embed, body.url, body.checkoutId))");
    expect(pricingSource).toContain("window.location.assign(body.url);");
  });

  it("confirms every on-page checkout through the server, like a redirect", () => {
    expect(pricingSource).toContain("handler: () => void confirm(checkoutId),");
    expect(pricingSource).toContain('if (event?.event === "Checkout.Success") {');
  });

  it("sends a test country only as a header the API ignores outside test mode", () => {
    expect(pricingSource).toContain('headers["X-MemberFrame-Test-Country"] = country;');
  });
});
