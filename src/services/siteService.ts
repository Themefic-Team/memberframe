/**
 * The site configuration endpoints. PRD tasks 2.2, 2.3, 2.4, PRD section 10.3.
 *
 * A thin typed layer over `apiClient`. Every function here is one call from PRD
 * section 10.3 with its request and response shapes pinned, and nothing else:
 * no caching, no retry, no optimistic update. Those are decisions for the
 * surfaces that call these, because only they know what to show while a write
 * is in flight.
 *
 * The client is injected rather than imported so the tests can drive a stubbed
 * one. Production call sites use the exported singletons.
 *
 * Every function returns `ApiResult`, so a caller handles all five PRD section
 * 10.6 cases or fails the typecheck when it switches exhaustively.
 *
 * ## None of this has reached a server
 *
 * Ledger blocker B1: the backend is out of repo and does not exist. Combined
 * with conflict C10, no creator token exists either, so every call below
 * resolves `unauthorized` today. That is the correct behaviour and it is why
 * each consuming surface has a signed-out state.
 */

import type { ApiClient, ApiResult } from "./apiClient";
import { apiClient } from "./apiClient";
import type { MemberStatus, TierKey } from "../types/member";
import type {
  CurrencyCode,
  GatewayId,
  GatewayVaultDraft,
  MemberPage,
  SiteGatewayStatus,
  SiteTierRecord,
} from "../types/site";
import { MEMBER_PAGE_SIZE } from "../types/site";

export interface MemberQuery {
  siteId: string;
  page: number;
  search?: string;
  tier?: TierKey;
  status?: MemberStatus;
}

/** PRD section 10.3: `GET /api/site/members`, paginated at 25. */
export function fetchMembers(
  query: MemberQuery,
  client: ApiClient = apiClient
): Promise<ApiResult<MemberPage>> {
  return client.get<MemberPage>("/api/site/members", {
    siteId: query.siteId,
    page: query.page,
    pageSize: MEMBER_PAGE_SIZE,
    search: query.search,
    tier: query.tier,
    status: query.status,
  });
}

/**
 * The four row actions, all three write ones through one endpoint.
 *
 * PRD section 10.3 has `PATCH /api/site/members/:id` for "change tier, grant, or
 * revoke" and no separate grant or revoke route. "Grant VIP" is therefore a
 * tier change with a fixed argument, and "Revoke access" is a status change.
 * Inventing routes for the two shortcut buttons would be a contract change made
 * for the convenience of a menu.
 */
export interface MemberPatch {
  tier?: TierKey;
  status?: MemberStatus;
}

export function patchMember(
  memberId: string,
  patch: MemberPatch,
  client: ApiClient = apiClient
): Promise<ApiResult<{ member: unknown }>> {
  return client.patch(`/api/site/members/${encodeURIComponent(memberId)}`, patch);
}

export function sendMagicLink(
  memberId: string,
  client: ApiClient = apiClient
): Promise<ApiResult<{ ok: true }>> {
  return client.post(`/api/site/members/${encodeURIComponent(memberId)}/magic-link`);
}

/** PRD section 10.3: `GET /api/site/tiers`. */
export function fetchTiers(
  siteId: string,
  client: ApiClient = apiClient
): Promise<ApiResult<{ tiers: ReadonlyArray<SiteTierRecord> }>> {
  return client.get("/api/site/tiers", { siteId });
}

/**
 * What a creator may change about a tier.
 *
 * `id` and `siteId` are absent because the server owns them, and `key` is
 * absent on update because changing a tier's key would orphan every gate on the
 * canvas that names it: the key is embedded in generated component code. That
 * is a migration, not an edit.
 */
export interface TierDraft {
  key: TierKey;
  name: string;
  monthlyPriceMinor: number | null;
  annualPriceMinor: number | null;
  lifetimePriceMinor: number | null;
  currency: CurrencyCode;
  rank: number;
  isActive: boolean;
}

export function createTier(
  siteId: string,
  draft: TierDraft,
  client: ApiClient = apiClient
): Promise<ApiResult<{ tier: SiteTierRecord }>> {
  return client.post("/api/site/tiers", { siteId, ...draft });
}

export function updateTier(
  tierId: string,
  draft: Omit<TierDraft, "key">,
  client: ApiClient = apiClient
): Promise<ApiResult<{ tier: SiteTierRecord }>> {
  return client.patch(`/api/site/tiers/${encodeURIComponent(tierId)}`, draft);
}

/**
 * PRD section 10.3: `POST /api/site/gateway/validate`, which validates "a pasted
 * key without storing it".
 *
 * This is the only honest validator for a key. Client-side prefix detection in
 * `components/settings/gatewayKeys.ts` guides the creator towards the right
 * field; it does not and cannot decide whether a key works.
 */
export interface GatewayValidation {
  gateway: GatewayId;
  valid: boolean;
  mode: "live" | "test" | null;
  /** Last four characters, when the server chooses to echo them. Never the key. */
  maskedSuffix: string | null;
  /** Plain language, from the server, shown inline under the field. */
  message: string | null;
}

export function validateGatewayKey(
  siteId: string,
  gateway: GatewayId,
  key: string,
  client: ApiClient = apiClient
): Promise<ApiResult<GatewayValidation>> {
  // The key travels in the body. Never in a query string: a URL reaches server
  // access logs and browser history, and this value is a live credential.
  return client.post("/api/site/gateway/validate", { siteId, gateway, key });
}

/**
 * PRD section 10.3: `POST /api/site/config`, which writes "encrypted tier and
 * gateway configuration".
 *
 * The draft carries plaintext secrets, which is the only moment in this
 * repository where that is true. Nothing persists it client side. See
 * `docs/development-docs/03-tri-gateway-payments.md` section 3.2.
 *
 * Empty strings are stripped before sending, so a creator who edits only their
 * Razorpay key does not blank their Stripe secret by submitting the form.
 */
export function saveGatewayConfig(
  siteId: string,
  draft: GatewayVaultDraft,
  client: ApiClient = apiClient
): Promise<ApiResult<SiteGatewayStatus>> {
  const body: Record<string, unknown> = {
    siteId,
    defaultCurrency: draft.defaultCurrency,
    autoDetectGeolocation: draft.autoDetectGeolocation,
  };

  const keys: ReadonlyArray<[keyof GatewayVaultDraft, string]> = [
    ["stripePublishableKey", "stripePublishableKey"],
    ["stripeSecretKey", "stripeSecretKey"],
    ["lemonSqueezyStoreId", "lemonSqueezyStoreId"],
    ["lemonSqueezyApiKey", "lemonSqueezyApiKey"],
    ["razorpayKeyId", "razorpayKeyId"],
    ["razorpayKeySecret", "razorpayKeySecret"],
  ];

  for (const [field, wireName] of keys) {
    const value = draft[field];
    if (typeof value === "string" && value.trim() !== "") {
      body[wireName] = value.trim();
    }
  }

  return client.post("/api/site/config", body);
}

export function fetchGatewayStatus(
  siteId: string,
  client: ApiClient = apiClient
): Promise<ApiResult<SiteGatewayStatus>> {
  return client.get("/api/site/config", { siteId });
}
