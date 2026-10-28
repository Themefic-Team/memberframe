/**
 * FP-16: `<MemberPricing>`, the payments service, and the hand-off from a
 * signed-out buyer's choice through sign up back to checkout.
 *
 * The component runs on a creator's published site, so most of this file
 * reads its source: what it sends to the API, where it is willing to send the
 * buyer, and what it keeps in storage. Those are the properties that decide
 * whether a buyer can be overcharged, redirected somewhere hostile, or have a
 * credential left behind.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  LOCK_STATE_SIGNATURE,
  MEMBER_PRICING_FILE_NAME,
  generateMemberPricingCode,
  normalizePricingConfig,
  type DeployContext,
} from "../src/services";
import { DEFAULT_MEMBER_PRICING_CONFIG } from "../src/types/canvas";
import { CANVAS_COMPONENTS } from "../src/components/studio/componentRegistry";
import { ApiClient } from "../src/services/apiClient";
import { connectGateway, paymentsFailure } from "../src/services/paymentsService";

const COMPONENTS = path.join(process.cwd(), "src", "canvas-components");
const source = readFileSync(path.join(COMPONENTS, "MemberPricing.tsx"), "utf-8");
const code = source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
const authCode = readFileSync(path.join(COMPONENTS, "MemberAuth.tsx"), "utf-8")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/\/\/[^\n]*/g, " ");

const CONTEXT: DeployContext = {
  apiBaseUrl: "https://api.memberframe.framefic.com",
  siteKey: "mf_site_0123456789abcdef0123456789abcdef",
  afterLoginPath: "/dashboard",
  loginPath: "/login",
  afterLogoutPath: "/",
  signupPath: "/signup",
};

describe("the component file", () => {
  it("imports only what the Framer runtime supplies", () => {
    const imports = [...source.matchAll(/^import\s[^;]*?from\s+"([^"]+)";/gm)].map((match) => match[1]);
    expect(new Set(imports)).toEqual(new Set(["react", "framer"]));
  });

  it("is offered in the Builder and deployable", () => {
    expect(CANVAS_COMPONENTS.find((entry) => entry.id === "member_pricing")).toMatchObject({
      name: "Member Pricing",
      deployable: true,
    });
  });

  it("never uses inline style objects", () => {
    expect(code).not.toMatch(/style=\{\{/);
  });
});

describe("generateMemberPricingCode", () => {
  it("bakes the connection and keeps the lock state", () => {
    const { code: generated, fileName } = generateMemberPricingCode(DEFAULT_MEMBER_PRICING_CONFIG, undefined, CONTEXT);

    expect(fileName).toBe(MEMBER_PRICING_FILE_NAME);
    expect(generated).toContain(`  apiBaseUrl: "${CONTEXT.apiBaseUrl}",`);
    expect(generated).toContain(`  siteKey: "${CONTEXT.siteKey}",`);
    expect(generated).toContain(`  signupPath: "/signup",`);
    for (const line of LOCK_STATE_SIGNATURE) expect(generated).toContain(line);
  });

  it("falls back to the sign in page when the site has no separate sign up page", () => {
    const { code: generated } = generateMemberPricingCode(DEFAULT_MEMBER_PRICING_CONFIG, undefined, {
      ...CONTEXT,
      signupPath: "",
    });
    expect(generated).toContain(`  signupPath: "/login",`);
  });

  it("clamps and whitelists what the panel sends", () => {
    const normalized = normalizePricingConfig({
      ...DEFAULT_MEMBER_PRICING_CONFIG,
      defaultInterval: "weekly" as never,
      accentColor: "red; background: url(x)",
      borderRadius: 999,
    });
    expect(normalized.defaultInterval).toBe("month");
    expect(normalized.accentColor).toBe(DEFAULT_MEMBER_PRICING_CONFIG.accentColor);
    expect(normalized.borderRadius).toBe(40);
  });
});

describe("checkout from the published site", () => {
  it("sends a tier and an interval, never a price", () => {
    // The server prices the purchase from the tier table. An amount from the
    // browser would be an amount the buyer chose.
    // The buyer's chosen method travels too (29-checkout-methods.md): a gateway name, not an amount.
    expect(code).toContain(
      "JSON.stringify(gateway ? { tierKey, interval: chosen, returnPath, gateway } : { tierKey, interval: chosen, returnPath })"
    );
    expect(code).toContain("body: JSON.stringify({ tierKey, interval: chosen }),");
    for (const sent of code.match(/JSON\.stringify\(\{[^}]*\}\)/g) ?? []) {
      expect(sent).not.toMatch(/amount|price|currency/i);
    }
  });

  it("only follows an https checkout URL", () => {
    // Read from the raw source: stripping line comments would cut this line at its own slashes.
    expect(source).toContain("/^https:\\/\\//.test(body.url)");
  });

  it("confirms with the server rather than trusting the return URL", () => {
    expect(code).toContain("STATUS_PATH");
    expect(code).toContain('status.state === "complete"');
  });

  it("strips the return parameters so a refresh cannot confirm twice", () => {
    expect(code).toContain('url.searchParams.delete("mf_checkout")');
  });

  it("keeps a signed-out buyer's choice in session storage only, and only the choice", () => {
    const writes = (code.match(/(?:localStorage|sessionStorage)\.setItem\([^;]*;/g) ?? []).map((write) => write.trim());
    expect(writes.length).toBeGreaterThan(0);
    for (const write of writes) {
      expect([
        "sessionStorage.setItem(INTENT_KEY, JSON.stringify(intent));",
        'localStorage.setItem(HINT_KEY, "1");',
      ]).toContain(write);
    }
    expect(code).toContain("interface CheckoutIntent {\n  tierKey: string;\n  interval: PricingInterval;\n  returnPath: string;\n  ts: number;\n}");
  });
});

describe("MemberAuth returns a buyer to the pricing page", () => {
  it("prefers a fresh checkout intent, then a content component's return page, over the After sign in page", () => {
    expect(authCode).toContain(
      "const path = checkoutIntentPath() ?? returnPath() ?? afterLoginTarget();"
    );
  });

  it("reads the return key the content components write", () => {
    expect(authCode).toContain("memberframe:return-to:${CONFIG.siteKey}");
    for (const name of ["MeteredPaywall", "ProtectedDownload", "BookmarkButton", "BookmarksTray"]) {
      const source = readFileSync(path.join(process.cwd(), "src", "canvas-components", `${name}.tsx`), "utf-8");
      expect(source, name).toContain("memberframe:return-to:${CONFIG.siteKey}");
    }
  });

  it("reads the same key MemberPricing writes", () => {
    expect(authCode).toContain("memberframe:checkout-intent:${CONFIG.siteKey}");
    expect(code).toContain("memberframe:checkout-intent:${CONFIG.siteKey}");
  });
});

describe("paymentsService", () => {
  it("leaves empty fields out of a connect call, so stored values are kept", async () => {
    let sent: unknown = null;
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      sent = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ settings: {}, gateways: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const client = new ApiClient({ getCreatorToken: () => "token", fetchImpl, baseUrl: "https://api.test.invalid" });

    await connectGateway("site_1", "lemonsqueezy", "test", { apiKey: "", storeId: "123", monthlyVariantId: " " }, client);
    expect(sent).toEqual({ siteId: "site_1", mode: "test", values: { storeId: "123" } });
  });

  it("shows the gateway's own words for a rejected key", () => {
    expect(
      paymentsFailure({ kind: "unavailable", status: 400, detail: "", reason: "gateway_rejected", message: "That is a live key." })
    ).toBe("That is a live key.");
    expect(paymentsFailure({ kind: "unavailable", status: 400, detail: "", reason: "no_live_gateway" })).toMatch(/live keys/);
  });
});

describe("tier features on the card (28-tier-features.md)", () => {
  it("takes a card's lines only from the tier's own list; there is no Features property", () => {
    expect(code).toContain("features?: Array<{ text: string; included: boolean }>;");
    expect(code).toContain("function featuresFor(tier: PublicTier): Array<{ text: string; included: boolean }> {");
    expect(code).not.toContain("DEFAULT_FEATURES");
    expect(code).not.toMatch(/^\s{2}features: \{\s*type: ControlType\.Array/m);
  });

  it("marks a line the tier does not include, for sight and for screen readers", () => {
    expect(code).toContain("line.included ? <Check aria-hidden={true} /> : <MfCross />");
    expect(code).toContain("(not included)");
    expect(code).toContain(".mf-pricing-feature.is-excluded");
  });
});

describe("payment method chooser (29-checkout-methods.md)", () => {
  it("asks which methods can sell the price before opening a checkout", () => {
    expect(code).toContain('const OPTIONS_PATH = "/api/checkout/options";');
    expect(code).toContain("const response = await fetch(`${base}${OPTIONS_PATH}`, {");
  });

  it("goes straight on only when exactly one gateway is shown at checkout, else opens the chooser", () => {
    expect(code).toContain("if (methods.length === 0 || (methods.length === 1 && !canUse(methods[0]))) {");
    expect(code).toContain("await openCheckout(tierKey, chosen, methods[0].gateway);");
    expect(code).toMatch(/if \(methods\.length > 1\) \{[\s\S]*?setChoice\(\{ tierKey, interval: chosen, summary: body\.summary, methods, selected \}\);/);
  });

  it("lists a method that cannot sell this price, greyed, with the reason, and never selects it", () => {
    expect(code).toContain("const canUse = (method: PayMethod) => method.available !== false;");
    expect(code).toContain("disabled={!usable}");
    expect(code).toContain('<span className="mf-pay-method-desc">{method.reason || t("unavailable")}</span>');
    expect(code).toContain("const usable = choice.methods.filter(canUse);");
  });

  it("pays in a new tab opened inside the click, and waits on this page for the gateway", () => {
    expect(code).toContain('const tab = window.open("", "_blank");');
    expect(code).toContain("tab.location.href = body.url;");
    expect(code).toContain("void confirm(body.checkoutId, true);");
    expect(code).toContain("const deadline = waitingInTab ? TAB_TIMEOUT_MS : CONFIRM_TIMEOUT_MS;");
    // A tab that ends up unused is closed again, and a failed method says so.
    expect(code).toContain("if (tab && !tab.closed) tab.close();");
    expect(code).toContain('? t("methodFailed")');
  });

  it("keeps a switch made in place, and an older server, on today's path", () => {
    // kind "change" and a 404 from a server without the route both fall through.
    expect(code).toContain("} else if (response.status !== 404) {");
    expect(code).toMatch(/\n      await openCheckout\(tierKey, chosen\);\n    \},/);
  });

  it("is a labelled modal radio group that closes on Escape, the backdrop, and its button", () => {
    expect(code).toContain('role="dialog" aria-modal={true} aria-labelledby={`${scope}-pay-title`}');
    expect(code).toContain('role="radiogroup" aria-label={t("payTitle")}');
    expect(code).toContain('role="radio"');
    expect(code).toContain('if (event.key === "Escape") {');
    expect(code).toContain("if (event.target === event.currentTarget) closeChoice();");
    expect(code).toContain('className="mf-pay-close" aria-label={t("payClose")} onClick={closeChoice}');
  });

  it("declares openCheckout before startCheckout uses it", () => {
    expect(code.indexOf("const openCheckout = useCallback(")).toBeLessThan(code.indexOf("const startCheckout = useCallback("));
  });
});

describe("why a chosen method failed", () => {
  it("adds the gateway's own reason in Test mode only", () => {
    expect(code).toContain('const testing = load.phase === "ready" && load.pricing.mode === "test";');
    expect(code).toContain("const detail = testing && typeof payload.detail === \"string\" ? ` ${payload.detail.slice(0, 300)}` : \"\";");
  });
});

describe("refusals before the chooser (2026-10-20)", () => {
  it("never skips the chooser because the methods call failed, and says why", () => {
    expect(code).toContain('setFlow({ phase: "idle", message: describeFailure(payload), tone: "error" });');
    // The network failing is an error too, not a silent one-click checkout.
    expect(code).toMatch(/\} catch \{\s*setFlow\(\{ phase: "idle", message: t\("error"\), tone: "error" \}\);\s*return;\s*\}\s*await openCheckout\(tierKey, chosen\);/);
  });

  it("says how long to wait when rate limited", () => {
    expect(code).toContain('rateLimited: ["Too many attempts", "Too many checkout attempts. Try again in {minutes} min."]');
    expect(code).toContain('if (payload.reason === "rate_limited") {');
  });
});

describe("upgrade credit in the chooser (30-plan-changes.md)", () => {
  it("shows the credit and what is due today, and a scheduled downgrade as a message", () => {
    expect(code).toContain('t("creditLine", { plan: choice.summary.creditFrom ?? "" })');
    expect(code).toContain("formatPrice(choice.summary.dueMinor ?? choice.summary.amountMinor, choice.summary.currency)");
    expect(code).toContain('if (body.kind === "scheduled") {');
  });
});
