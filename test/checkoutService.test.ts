/**
 * Checkout session creation. PRD task 2.6, feature F03.
 *
 * Two things are worth testing here and the second is unusual.
 *
 * The first is that a session URL arriving from the network is checked before
 * anybody navigates to it. The caller's next move is a navigation, so a
 * `javascript:` URL in that field executes in the page.
 *
 * The second is F03's last acceptance criterion: "Zero platform fee is applied
 * on every gateway. No fee line item exists in the codebase." That is a
 * criterion about absence, which needs a check that fires when someone adds the
 * thing. The last block scans the service sources, which is a grep dressed as a
 * test and the only mechanism that will notice in Phase 3.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  checkoutErrorMessage,
  createCheckoutSession,
  isAcceptableCheckoutUrl,
  type CheckoutOutcome,
} from "../src/services/checkoutService";
import { ApiClient } from "../src/services/apiClient";

function clientReturning(status: number, body: unknown): ApiClient {
  const fetchImpl = vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  ) as unknown as typeof fetch;

  return new ApiClient({
    getCreatorToken: () => null,
    fetchImpl,
    baseUrl: "https://api.test.invalid",
  });
}

const request = {
  tier: "tier_1",
  interval: "monthly",
  siteId: "site_1",
} as const;

describe("isAcceptableCheckoutUrl", () => {
  it("accepts an https URL", () => {
    expect(isAcceptableCheckoutUrl("https://checkout.stripe.com/c/pay/cs_test_123")).toBe(true);
  });

  it("refuses javascript:, which would execute in the page", () => {
    expect(isAcceptableCheckoutUrl("javascript:fetch('https://evil.example.com')")).toBe(false);
  });

  it("refuses data:, which can carry a whole document", () => {
    expect(isAcceptableCheckoutUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  it("refuses plain http, which is a downgrade on a card form", () => {
    // Not paranoia on a page where someone is about to type a card number.
    expect(isAcceptableCheckoutUrl("http://checkout.example.com/pay")).toBe(false);
  });

  it("refuses a relative path, which would resolve against the creator's own site", () => {
    expect(isAcceptableCheckoutUrl("/pay")).toBe(false);
    expect(isAcceptableCheckoutUrl("checkout.stripe.com/pay")).toBe(false);
  });

  it("refuses an empty or malformed value", () => {
    expect(isAcceptableCheckoutUrl("")).toBe(false);
    expect(isAcceptableCheckoutUrl("https://")).toBe(false);
    expect(isAcceptableCheckoutUrl("::::")).toBe(false);
  });

  it("refuses file: and every other scheme", () => {
    for (const url of ["file:///etc/passwd", "ftp://x.example.com", "vbscript:x"]) {
      expect(isAcceptableCheckoutUrl(url)).toBe(false);
    }
  });
});

describe("createCheckoutSession", () => {
  it("returns the session when the server answers with an https URL", async () => {
    const client = clientReturning(200, {
      url: "https://checkout.stripe.com/c/pay/cs_test_123",
      gateway: "stripe",
      sessionId: "cs_test_123",
    });

    const outcome = await createCheckoutSession(request, client);

    expect(outcome.kind).toBe("ok");
    if (outcome.kind !== "ok") return;
    expect(outcome.session.gateway).toBe("stripe");
  });

  it("rejects a session whose URL is not https, rather than handing it on", async () => {
    const client = clientReturning(200, {
      url: "javascript:alert(document.cookie)",
      gateway: "stripe",
      sessionId: "cs_1",
    });

    const outcome = await createCheckoutSession(request, client);

    expect(outcome.kind).toBe("rejected_url");
  });

  it("rejects a 200 with no URL at all", async () => {
    const outcome = await createCheckoutSession(request, clientReturning(200, { gateway: "stripe" }));

    expect(outcome.kind).toBe("rejected_url");
  });

  it("passes every API failure straight through", async () => {
    // So the caller handles the PRD section 10.6 five, not a flattened version.
    const cases: ReadonlyArray<[number, CheckoutOutcome["kind"]]> = [
      [401, "unauthorized"],
      [403, "forbidden"],
      [429, "rate_limited"],
      [500, "unavailable"],
    ];

    for (const [status, kind] of cases) {
      const outcome = await createCheckoutSession(request, clientReturning(status, {}));
      expect(outcome.kind).toBe(kind);
    }
  });

  it("does not choose a gateway, because F03 puts routing on the server", async () => {
    // The response says which gateway answered. A client that picked one would
    // need the creator's key configuration, and F03 keeps secrets off clients.
    const client = clientReturning(200, {
      url: "https://pay.razorpay.test/x",
      gateway: "razorpay",
      sessionId: "r1",
    });

    const outcome = await createCheckoutSession({ ...request, geo: "IN" }, client);

    expect(outcome.kind).toBe("ok");
    if (outcome.kind !== "ok") return;
    expect(outcome.session.gateway).toBe("razorpay");
  });
});

describe("checkoutErrorMessage", () => {
  it("tells a buyer nothing alarming about a rejected URL", () => {
    // Telling a buyer the server returned an unsafe URL helps nobody.
    const message = checkoutErrorMessage({ kind: "rejected_url", url: "javascript:x" });

    expect(message).not.toContain("javascript");
    expect(message).not.toMatch(/unsafe|invalid|url/i);
    expect(message.endsWith(".")).toBe(true);
  });

  it("writes every outcome as a sentence with no raw value", () => {
    const outcomes: ReadonlyArray<Exclude<CheckoutOutcome, { kind: "ok" }>> = [
      { kind: "rejected_url", url: "" },
      { kind: "unauthorized" },
      { kind: "forbidden" },
      { kind: "rate_limited", retryAfterSeconds: null },
      { kind: "rate_limited", retryAfterSeconds: 20 },
      { kind: "unavailable", status: 500, detail: "x" },
    ];

    for (const outcome of outcomes) {
      const message = checkoutErrorMessage(outcome);

      expect(message.endsWith(".")).toBe(true);
      expect(message).not.toContain(outcome.kind);
      expect(message).not.toContain("_");
    }
  });

  it("names the wait when the server gave one", () => {
    expect(checkoutErrorMessage({ kind: "rate_limited", retryAfterSeconds: 20 })).toContain("20");
  });
});

describe("zero platform fee, asserted by absence", () => {
  /**
   * F03: "Zero platform fee is applied on every gateway. No fee line item
   * exists in the codebase."
   *
   * Scanning for the identifiers a fee would be implemented with is the only
   * check that fires when someone adds one. The Stripe-specific names matter
   * most: `application_fee_amount` and `transfer_data` are how a platform fee
   * is actually taken on Stripe Connect, so their absence is the real
   * assertion rather than the absence of the word "fee".
   */
  const FEE_IDENTIFIERS = [
    "applicationFee",
    "application_fee",
    "platformFee",
    "platform_fee",
    "feePercent",
    "feeBps",
    "transfer_data",
    "transferData",
    "on_behalf_of",
    "stripeAccount",
  ];

  function serviceSources(): ReadonlyArray<[string, string]> {
    const dir = path.join(process.cwd(), "src", "services");

    return readdirSync(dir)
      .filter((name) => name.endsWith(".ts"))
      .map((name) => [name, readFileSync(path.join(dir, name), "utf-8")] as [string, string]);
  }

  const sources = serviceSources();

  it("found the service files it claims to be scanning", () => {
    // A scan over an empty list passes forever and proves nothing.
    expect(sources.length).toBeGreaterThanOrEqual(4);
    expect(sources.map(([name]) => name)).toContain("checkoutService.ts");
  });

  it("finds no fee identifier in any service", () => {
    for (const [name, code] of sources) {
      for (const identifier of FEE_IDENTIFIERS) {
        expect(code, `${name} must not reference ${identifier}`).not.toContain(identifier);
      }
    }
  });

  it("sends only the four fields F03's request shape names", () => {
    // A fee would most likely arrive as an extra field on this body, so the
    // body is pinned rather than only scanned for.
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({ url: "https://x.test/p", gateway: "stripe", sessionId: "s" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    ) as unknown as typeof fetch;

    const client = new ApiClient({
      getCreatorToken: () => null,
      fetchImpl,
      baseUrl: "https://api.test.invalid",
    });

    return createCheckoutSession({ ...request, geo: "GB" }, client).then(() => {
      const init = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
        .calls[0][1] as RequestInit;
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;

      expect(Object.keys(body).sort()).toEqual(["geo", "interval", "siteId", "tier"]);
    });
  });
});
