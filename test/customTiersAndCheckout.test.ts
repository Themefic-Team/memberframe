/**
 * FP-16 follow-ups: custom tiers on the gate (conflict C9), the gate reading
 * the session response correctly, keys made from names, and Member Pricing's
 * switch confirmation and on-site checkout.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_MEMBER_GATE_CONFIG } from "../src/types/canvas";
import { generateMemberGateCode, normalizeGateConfig, type DeployContext } from "../src/services";
import { keyFromName } from "../src/components/manage/tierValidation";

const COMPONENTS = path.join(process.cwd(), "src", "canvas-components");
const gateSource = readFileSync(path.join(COMPONENTS, "MemberGate.tsx"), "utf-8");
const pricingSource = readFileSync(path.join(COMPONENTS, "MemberPricing.tsx"), "utf-8");

const CONTEXT: DeployContext = {
  apiBaseUrl: "https://api.example.test",
  siteKey: "mf_site_test",
  afterLoginPath: "/dashboard",
  loginPath: "/login",
  afterLogoutPath: "/",
};

describe("the gate offers the site's own tiers", () => {
  it("writes custom tiers into Access Tier, by rank, after Any Signed In", () => {
    const { code } = generateMemberGateCode(DEFAULT_MEMBER_GATE_CONFIG, undefined, {
      ...CONTEXT,
      tiers: [
        { key: "pro_plus", name: "Pro Plus", rank: 2 },
        { key: "free_member", name: "Free", rank: 0 },
        { key: "starter", name: "Starter", rank: 1 },
      ],
    });
    expect(code).toContain(`    options: ["signed_in", "free_member", "starter", "pro_plus"],`);
    expect(code).toContain(`    optionTitles: ["Any Signed In", "Free", "Starter", "Pro Plus"],`);
  });

  it("cannot be broken out of by a tier name", () => {
    const { code } = generateMemberGateCode(DEFAULT_MEMBER_GATE_CONFIG, undefined, {
      ...CONTEXT,
      tiers: [{ key: "gold", name: 'Gold"], evil: ["x', rank: 1 }],
    });
    expect(code).toContain(`"Gold\\"], evil: [\\"x"`);
    expect(code).not.toContain(`evil: ["x"`);
  });

  it("keeps the built in list when the panel has no tiers", () => {
    const { code } = generateMemberGateCode(DEFAULT_MEMBER_GATE_CONFIG, undefined, CONTEXT);
    expect(code).toContain(`options: ["signed_in", "free_member", "tier_1", "tier_2", "vip"],`);
  });

  it("accepts a custom required tier, and never anyone", () => {
    expect(normalizeGateConfig({ ...DEFAULT_MEMBER_GATE_CONFIG, requiredTier: "pro_plus" }).requiredTier).toBe("pro_plus");
    expect(normalizeGateConfig({ ...DEFAULT_MEMBER_GATE_CONFIG, requiredTier: "anyone" }).requiredTier).toBe("signed_in");
    expect(normalizeGateConfig({ ...DEFAULT_MEMBER_GATE_CONFIG, requiredTier: "Bad Key" as never }).requiredTier).toBe("signed_in");
  });
});

describe("the gate reads the session response the API actually sends", () => {
  it("takes the member from body.member and the ladder from body.tiers", () => {
    expect(gateSource).toContain("const session = body.member ?? (body as MemberSessionData);");
    expect(gateSource).toContain("const tiers = readLadder(body.tiers);");
  });

  it("compares against the site's ladder, not the built in default", () => {
    expect(gateSource).toContain("isEntitled(result.session, requiredTier, ladderOf(result));");
    expect(gateSource).not.toContain("isEntitled(result.session, requiredTier, DEFAULT_SITE_TIERS)");
  });
});

describe("keyFromName", () => {
  it("makes a lowercase key and avoids taken and built in keys", () => {
    expect(keyFromName("Pro Plus", [])).toBe("pro_plus");
    expect(keyFromName("Pro Plus", ["pro_plus"])).toBe("pro_plus_2");
    expect(keyFromName("2024 Members", [])).toBe("tier_2024_members");
    expect(keyFromName("VIP", [])).toBe("vip_2");
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
