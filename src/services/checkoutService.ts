/**
 * Checkout session creation. PRD task 2.6, PRD section 10.4 and section 8 F03.
 *
 * Phase 1 is Stripe. Lemon Squeezy and Razorpay arrive at tasks 3.1 and 3.2,
 * and they arrive on the server: F03 is explicit that gateway routing and the
 * IP country lookup are server side. So this file does not choose a gateway. It
 * asks for a session, and the response says which gateway answered.
 *
 * That is why there is no routing table here and why tasks 3.1 to 3.3 should not
 * add one. A client that picked the gateway would need the creator's key
 * configuration to make the choice, and F03 keeps secrets off the client
 * entirely.
 *
 * ## Zero platform fee
 *
 * F03's last acceptance criterion: "Zero platform fee is applied on every
 * gateway. No fee line item exists in the codebase." There is no fee here, and
 * `test/checkoutService.test.ts` scans this file and its siblings for
 * fee-shaped identifiers so that the criterion keeps being true when someone
 * adds a pricing feature in Phase 3.
 */

import type { ApiClient, ApiResult } from "./apiClient";
import { apiClient } from "./apiClient";
import type { TierKey } from "../types/member";
import type { BillingInterval, GatewayId } from "../types/site";

export interface CheckoutRequest {
  tier: TierKey;
  interval: BillingInterval;
  siteId: string;
  /**
   * ISO 3166-1 alpha-2, when the caller happens to know it.
   *
   * F03's request shape names it. The server decides the gateway regardless,
   * from its own IP lookup, because a country supplied by the client is a
   * country the client can lie about, and the gateway choice carries tax
   * consequences.
   */
  geo?: string;
}

export interface CheckoutSession {
  url: string;
  gateway: GatewayId;
  sessionId: string;
}

/**
 * A checkout session, or a reason there is none.
 *
 * `rejected_url` is this module's own arm, outside the PRD section 10.6 five,
 * because it describes a successful response carrying something unusable.
 */
export type CheckoutOutcome =
  | { kind: "ok"; session: CheckoutSession }
  | { kind: "rejected_url"; url: string }
  | Exclude<ApiResult<never>, { kind: "ok" }>;

/**
 * Is this somewhere we are willing to send a buyer?
 *
 * The URL comes from the network and the caller is about to navigate to it. A
 * `javascript:` URL executes in the page. `data:` can carry a whole document.
 * Plain `http:` is a downgrade on a page where someone is about to type a card
 * number, so it is refused too, which is not paranoia for a checkout flow.
 *
 * Same reasoning as the redirect sanitizer in the task 1.4 code generator: a
 * value that arrives from outside and ends up in a navigation gets a whitelist,
 * never a blacklist.
 */
export function isAcceptableCheckoutUrl(url: string): boolean {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    // Not absolute, so there is no scheme to trust. A relative checkout URL
    // would resolve against the creator's own site, which is never where a
    // gateway session lives.
    return false;
  }

  return parsed.protocol === "https:";
}

/**
 * PRD section 10.4: `POST /api/checkout/create-session`.
 *
 * Returns the routed gateway session. The caller navigates; this function does
 * not, so that a test can assert the outcome without a window.
 */
export async function createCheckoutSession(
  request: CheckoutRequest,
  client: ApiClient = apiClient
): Promise<CheckoutOutcome> {
  const result = await client.post<CheckoutSession>("/api/checkout/create-session", {
    tier: request.tier,
    interval: request.interval,
    siteId: request.siteId,
    geo: request.geo,
  });

  if (result.kind !== "ok") return result;

  const session = result.data;

  if (!session || typeof session.url !== "string" || !isAcceptableCheckoutUrl(session.url)) {
    return { kind: "rejected_url", url: session?.url ?? "" };
  }

  return { kind: "ok", session };
}

/**
 * Plain-language copy for the two outcomes the shared `failureMessage` does not
 * cover. PRD section 7.6 rule 4: never show a visitor a `kind`.
 */
export function checkoutErrorMessage(outcome: Exclude<CheckoutOutcome, { kind: "ok" }>): string {
  if (outcome.kind === "rejected_url") {
    // Deliberately vague to the buyer and specific in the logs. Telling a buyer
    // the server returned an unsafe URL helps nobody and alarms them.
    return "Checkout is not available right now. Please try again shortly.";
  }

  if (outcome.kind === "rate_limited") {
    return outcome.retryAfterSeconds === null
      ? "Too many attempts. Wait a moment and try again."
      : `Too many attempts. Try again in ${outcome.retryAfterSeconds} seconds.`;
  }

  if (outcome.kind === "unauthorized" || outcome.kind === "forbidden") {
    return "Sign in again to continue to checkout.";
  }

  return "Checkout is not available right now. Please try again shortly.";
}
