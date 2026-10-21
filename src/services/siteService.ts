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
  TierFeature,
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
 * Tier changes, through PRD section 10.3's `PATCH /api/site/members/:id`.
 *
 * Revoke access is no longer a status patch: a status change only touched
 * MemberFrame's record while the member's gateway subscription kept charging
 * them. It has its own route, `revokeMember` below (doc 26). Deleting a member
 * is not a patch either and has its own route.
 */
export interface MemberPatch {
  /**
   * Which site this member belongs to.
   *
   * Carried in the body even though the member id alone would find the row.
   * The server scopes the lookup by both, so a member id guessed or copied from
   * another creator's site is simply not found rather than found and then
   * refused. A find followed by an ownership check is the same thing with a
   * window in between.
   */
  siteId: string;
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

/**
 * `DELETE /api/site/members/:id`. Removes the member for good.
 *
 * The site id travels in the query, because a DELETE body is not reliably
 * forwarded, and the server scopes the lookup by both ids for the same reason
 * `patchMember` does.
 */
/** Delete a paid tier. Refused for the Free tier, and while any member holds the tier. */
export function deleteTier(
  tierId: string,
  siteId: string,
  client: ApiClient = apiClient
): Promise<ApiResult<{ deleted: true; id: string }>> {
  return client.delete(`/api/site/tiers/${encodeURIComponent(tierId)}`, { siteId });
}

export function deleteMember(
  memberId: string,
  siteId: string,
  client: ApiClient = apiClient
): Promise<ApiResult<{ deleted: true; id: string }>> {
  return client.delete(`/api/site/members/${encodeURIComponent(memberId)}`, { siteId });
}

/**
 * Email the member a one-click sign in to the site's login page (doc 26).
 * Refused for a revoked member (409 `member_revoked`) and before the site has
 * an address (409 `no_site_url`); 502 `mail_failed` when the email did not go.
 */
export function sendMagicLink(
  memberId: string,
  siteId: string,
  client: ApiClient = apiClient
): Promise<ApiResult<{ sent: true; expiresInMinutes: number }>> {
  return client.post(`/api/site/members/${encodeURIComponent(memberId)}/magic-link`, { siteId });
}

/**
 * Revoke access for good (doc 26): the member's subscriptions are cancelled
 * at the payment provider now, with no refund, they move to Free with status
 * canceled, and they are signed out. 502 `gateway_cancel_failed` changes nothing.
 */
export function revokeMember(
  memberId: string,
  siteId: string,
  client: ApiClient = apiClient
): Promise<ApiResult<{ member: unknown; canceledSubscriptions: number }>> {
  return client.post(`/api/site/members/${encodeURIComponent(memberId)}/revoke`, { siteId });
}

/** Undo a revoke: active again, on Free. Nothing paid comes back. */
export function restoreMember(
  memberId: string,
  siteId: string,
  client: ApiClient = apiClient
): Promise<ApiResult<{ member: unknown }>> {
  return client.post(`/api/site/members/${encodeURIComponent(memberId)}/restore`, { siteId });
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
  rank: number;
  isActive: boolean;
  features: TierFeature[];
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
  draft: Omit<TierDraft, "key"> & { siteId: string },
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
