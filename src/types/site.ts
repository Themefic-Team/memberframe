/**
 * Site-scoped entities. PRD sections 8 F02, 8 F03, and 11.
 *
 * These are the shapes the backend owns. They are declared here so the plugin's
 * types and the server's schema cannot drift, which is the whole purpose of PRD
 * section 11. Changing a field here is a schema change.
 *
 * `types/member.ts` holds the member session and the tier ladder the entitlement
 * resolver compares. This file holds the records the Manage tab and the Settings
 * tab read and write.
 */

import type { MemberStatus, TierKey, TierLadderEntry } from "./member";
import type { MemberMetadata } from "../utils/customFields";

/**
 * The currencies PRD section 8 F03 names on `SiteGatewayConfig.defaultCurrency`.
 *
 * All four have two-decimal minor units, which is why `utils/money.ts` can
 * default its exponent to 2. Adding JPY, which has none, or KWD, which has
 * three, means revisiting every call site that relies on that default.
 */
export type CurrencyCode = "USD" | "EUR" | "GBP" | "INR";

/** PRD section 8 F03. The three gateways, and the only three. */
export type GatewayId = "stripe" | "lemonsqueezy" | "razorpay";

export const GATEWAY_LABELS: Record<GatewayId, string> = {
  stripe: "Stripe",
  lemonsqueezy: "Lemon Squeezy",
  razorpay: "Razorpay",
};

/** PRD section 12.2. A tier may be sold on any of these. */
export type BillingInterval = "monthly" | "annual" | "lifetime";

export const BILLING_INTERVAL_LABELS: Record<BillingInterval, string> = {
  monthly: "Monthly",
  annual: "Annual",
  lifetime: "Lifetime",
};

/**
 * One member of one site. PRD section 8 F02, reproduced field for field.
 *
 * Two fields are narrowed from F02's declaration. `tier` is `TierKey` rather
 * than `string`, and `status` is the existing `MemberStatus` rather than an
 * inline repeat of the same four strings. The second matters: a member table
 * that disagreed with the entitlement resolver about what a status is would be
 * a defect that typechecked.
 *
 * `tier` being narrowed is conflict C9, written up in
 * `docs/development-docs/02-member-tier-cockpit.md` section 5.1. F02 allows
 * custom tier keys and F01's property control cannot offer them, so Phase 1
 * holds the four known keys.
 */
export interface SiteMemberRecord {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  tier: TierKey;
  status: MemberStatus;
  /** ISO 8601, UTC. PRD section 11.2 stores every timestamp in UTC. */
  createdAt: string;
  /** Integer minor units. PRD section 11.2 forbids floating point money. */
  lifetimeSpend: number;
  currency: CurrencyCode;
  gateway: GatewayId;
  /**
   * FP-09. The member's custom field values, keyed by field key, already
   * filtered by the server to fields that exist and apply. Optional because a
   * backend older than FP-09 does not send it, and the flyout must render
   * either way.
   */
  metadata?: MemberMetadata;
}

/**
 * One tier of one site. PRD section 8 F02.
 *
 * CONFLICT C8, resolved in favour of this shape keeping the name. PRD section
 * 11.3's resolver takes a tier table of `key`, `rank`, and `name`, and F02
 * declares a ten-field `SiteTierRecord` that includes all three. Two different
 * interfaces with one name is a defect waiting to be tripped over, so this is
 * the entity and `TierLadderEntry` in `types/member.ts` is what the resolver
 * narrows to. Every `SiteTierRecord` is assignable to a `TierLadderEntry`, so
 * callers pass real tiers to `isEntitled` unchanged.
 */
export interface SiteTierRecord {
  id: string;
  siteId: string;
  key: TierKey;
  /** Creator-facing, for example "Silver". Never show the key to anyone. */
  name: string;
  /** Integer minor units, or null when the tier is not sold on that interval. */
  monthlyPriceMinor: number | null;
  annualPriceMinor: number | null;
  lifetimePriceMinor: number | null;
  currency: CurrencyCode;
  /**
   * Unique per site, PRD section 11.2. Higher outranks lower, and this is the
   * field hierarchical entitlement compares, which is why task 2.3 validates
   * uniqueness before a write rather than letting the server reject it.
   */
  rank: number;
  isActive: boolean;
}

/** Compile-time proof of the C8 narrowing, so a future field change cannot break it. */
const _tierRecordIsALadderEntry: (record: SiteTierRecord) => TierLadderEntry = (record) => record;
void _tierRecordIsALadderEntry;

/**
 * What the creator is editing in the gateway vault.
 *
 * Secrets are present here and this shape exists only in React state, for as
 * long as the unsaved edit lives. Nothing writes it to `localStorage`,
 * `sessionStorage`, or plugin data. Reasoning in
 * `docs/development-docs/03-tri-gateway-payments.md` section 3.2.
 */
export interface GatewayVaultDraft {
  stripePublishableKey: string;
  stripeSecretKey: string;
  lemonSqueezyStoreId: string;
  lemonSqueezyApiKey: string;
  razorpayKeyId: string;
  razorpayKeySecret: string;
  defaultCurrency: CurrencyCode;
  autoDetectGeolocation: boolean;
}

export const EMPTY_GATEWAY_VAULT_DRAFT: GatewayVaultDraft = {
  stripePublishableKey: "",
  stripeSecretKey: "",
  lemonSqueezyStoreId: "",
  lemonSqueezyApiKey: "",
  razorpayKeyId: "",
  razorpayKeySecret: "",
  defaultCurrency: "USD",
  autoDetectGeolocation: true,
};

/** Whether a key is a live or a test key, from its own prefix. */
export type GatewayMode = "live" | "test";

export interface GatewayKeyStatus {
  configured: boolean;
  verified: boolean;
  /** Last four characters of the key and nothing else. Never the key. */
  maskedSuffix: string | null;
  mode: GatewayMode | null;
}

/**
 * What the server returns about the vault.
 *
 * CONFLICT C14, resolved by splitting the read shape from the write shape. F03
 * declares one `SiteGatewayConfig` carrying `stripeSecretKeyEncrypted` and its
 * two siblings, and in the same breath requires that "a secret key is never
 * present in any client-side response payload". A client type with a slot for a
 * returned secret invites one to be put there, so this shape has no such field.
 */
export interface SiteGatewayStatus {
  stripe: GatewayKeyStatus;
  lemonsqueezy: GatewayKeyStatus;
  razorpay: GatewayKeyStatus;
  defaultCurrency: CurrencyCode;
  autoDetectGeolocation: boolean;
}

export const UNCONFIGURED_KEY_STATUS: GatewayKeyStatus = {
  configured: false,
  verified: false,
  maskedSuffix: null,
  mode: null,
};

export const UNCONFIGURED_GATEWAY_STATUS: SiteGatewayStatus = {
  stripe: UNCONFIGURED_KEY_STATUS,
  lemonsqueezy: UNCONFIGURED_KEY_STATUS,
  razorpay: UNCONFIGURED_KEY_STATUS,
  defaultCurrency: "USD",
  autoDetectGeolocation: true,
};

/** A page of members. PRD section 10.3 paginates at 25. */
export interface MemberPage {
  members: ReadonlyArray<SiteMemberRecord>;
  page: number;
  pageSize: number;
  totalCount: number;
}

export const MEMBER_PAGE_SIZE = 25;
