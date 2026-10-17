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
    expect(new Set(imports)).toEqual(new Set(["react", "framer", "lucide-react"]));
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
    const body = /body: JSON\.stringify\(\{ tierKey, interval: chosen, returnPath \}\)/;
    expect(code).toMatch(body);
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
      'const path = checkoutIntentPath() ?? returnPath() ?? (CONFIG.afterLoginPath || "/dashboard");'
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
