/**
 * The plugin's half of FP-16 payments: settings, gateway keys, a member's purchases.
 *
 * Mirrors `memberframe-backend/src/routes/payments.ts`. A secret goes up once,
 * in the body of a connect call, and never comes back: every response is a
 * status shape with a masked suffix at most.
 */

import type { ApiClient, ApiResult } from "./apiClient";
import { apiClient } from "./apiClient";

export type PaymentGateway = "stripe" | "lemonsqueezy" | "razorpay";
export type PaymentMode = "test" | "live";

export const PAYMENT_GATEWAYS: ReadonlyArray<PaymentGateway> = ["stripe", "lemonsqueezy", "razorpay"];

export const PAYMENT_GATEWAY_LABELS: Record<PaymentGateway, string> = {
  stripe: "Stripe",
  lemonsqueezy: "Lemon Squeezy",
  razorpay: "Razorpay",
};

export interface PaymentSettings {
  mode: PaymentMode;
  defaultGateway: PaymentGateway | "";
  autoDetectGeolocation: boolean;
  defaultCurrency: string;
  graceDays: number;
  afterPurchasePath: string;
  pricingPath: string;
}

export interface GatewayStatus {
  gateway: PaymentGateway;
  mode: PaymentMode;
  connected: boolean;
  accountName: string | null;
  publicId: string | null;
  maskedSuffix: string | null;
  options: Record<string, unknown>;
  webhookUrl: string;
  webhookConfigured: boolean;
  webhookAutomatic: boolean;
  lastWebhookAt: string | null;
  events: ReadonlyArray<string>;
}

export interface PaymentsOverview {
  settings: PaymentSettings;
  gateways: GatewayStatus[];
  secretsAvailable: boolean;
  publicApi: boolean;
  activeSubscriptions: { test: number; live: number };
  /** Set by a connect call: e.g. why a webhook could not be registered. */
  notice?: string | null;
  endedTestSubscriptions?: number;
}

export function fetchPayments(siteId: string, client: ApiClient = apiClient): Promise<ApiResult<PaymentsOverview>> {
  return client.get("/api/site/payments", { siteId });
}

export function savePaymentSettings(
  siteId: string,
  patch: Partial<PaymentSettings>,
  client: ApiClient = apiClient
): Promise<ApiResult<PaymentsOverview>> {
  return client.put("/api/site/payments/settings", { siteId, ...patch });
}

export function connectGateway(
  siteId: string,
  gateway: PaymentGateway,
  mode: PaymentMode,
  values: Record<string, string>,
  client: ApiClient = apiClient
): Promise<ApiResult<PaymentsOverview>> {
  // Empty fields are left out, so an update keeps what is stored for them.
  const filled = Object.fromEntries(Object.entries(values).filter(([, value]) => value.trim() !== ""));
  return client.put(`/api/site/payments/gateways/${gateway}`, { siteId, mode, values: filled });
}

export function disconnectGateway(
  siteId: string,
  gateway: PaymentGateway,
  mode: PaymentMode,
  client: ApiClient = apiClient
): Promise<ApiResult<PaymentsOverview>> {
  return client.delete(`/api/site/payments/gateways/${gateway}`, { siteId, mode });
}

export interface MemberPurchases {
  subscriptions: Array<{
    tierKey: string;
    interval: string;
    gateway: string;
    mode: string;
    status: string;
    currentPeriodEnd: string | null;
    amountMinor: number;
    currency: string;
    createdAt: string;
  }>;
  payments: Array<{ amountMinor: number; currency: string; status: string; paidAt: string; gateway: string; mode: string }>;
}

export function fetchMemberPurchases(
  siteId: string,
  memberId: string,
  client: ApiClient = apiClient
): Promise<ApiResult<MemberPurchases>> {
  return client.get(`/api/site/payments/members/${encodeURIComponent(memberId)}`, { siteId });
}

/** The fields each gateway's form asks for, in order. */
export interface GatewayField {
  key: string;
  label: string;
  placeholder: string;
  secret: boolean;
  required: boolean;
  hint: string;
}

export const GATEWAY_FIELDS: Record<PaymentGateway, ReadonlyArray<GatewayField>> = {
  stripe: [
    {
      key: "secretKey",
      label: "Secret key",
      placeholder: "sk_test_...",
      secret: true,
      required: true,
      hint: "Stripe Dashboard, Developers, API keys. A restricted key (rk_) works too. MemberFrame registers its webhook with it, so there is nothing else to set up.",
    },
  ],
  lemonsqueezy: [
    {
      key: "apiKey",
      label: "API key",
      placeholder: "eyJ0eXAi...",
      secret: true,
      required: true,
      hint: "Lemon Squeezy, Settings, API. Make it in the same mode as this form: test mode keys for Test.",
    },
    {
      key: "storeId",
      label: "Store ID",
      placeholder: "12345",
      secret: false,
      required: true,
      hint: "Settings, Stores. The number next to your store name.",
    },
    {
      key: "monthlyVariantId",
      label: "Monthly variant",
      placeholder: "Variant ID",
      secret: false,
      required: false,
      hint: "Make one product with a monthly subscription variant, a yearly one, and a single payment one. Each tier is charged its own price on these, so one product covers every tier.",
    },
    {
      key: "yearlyVariantId",
      label: "Yearly variant",
      placeholder: "Variant ID",
      secret: false,
      required: false,
      hint: "The yearly subscription variant of the same product.",
    },
    {
      key: "oneTimeVariantId",
      label: "One-time variant",
      placeholder: "Variant ID",
      secret: false,
      required: false,
      hint: "The single payment variant, used for lifetime prices.",
    },
  ],
  razorpay: [
    {
      key: "keyId",
      label: "Key ID",
      placeholder: "rzp_test_...",
      secret: false,
      required: true,
      hint: "Razorpay Dashboard, Account and Settings, API keys.",
    },
    {
      key: "keySecret",
      label: "Key secret",
      placeholder: "Shown once when the key is made",
      secret: true,
      required: true,
      hint: "Shown only when the key is generated. Regenerate it if you no longer have it.",
    },
    {
      key: "webhookSecret",
      label: "Webhook secret",
      placeholder: "The secret you typed in Razorpay",
      secret: true,
      required: false,
      hint: "Razorpay, Webhooks, Add new webhook. Paste the URL below, tick the events listed, choose a secret, and paste the same secret here.",
    },
  ],
};

/** Plain words for a failed payments call. */
export function paymentsFailure(result: Exclude<ApiResult<unknown>, { kind: "ok" }>): string {
  if (result.kind !== "unavailable") {
    return result.kind === "unauthorized"
      ? "Connect this project first."
      : result.kind === "rate_limited"
        ? "Too many attempts. Wait a minute and try again."
        : "This account cannot change payments for this site.";
  }

  switch (result.reason) {
    case "gateway_rejected":
      return result.message ?? "The gateway did not accept those keys.";
    case "payments_not_configured":
      return "The server has no encryption key, so it cannot store gateway keys. Set PAYMENTS_ENCRYPTION_KEY.";
    case "no_live_gateway":
      return "Connect a gateway with live keys before switching to Live.";
    case "gateway_in_use":
      return "Members still renew through this gateway. It can be removed once their plans end.";
    case "unsafe_path":
      return "Use a page path that starts with a slash, like /pricing.";
    default:
      return "Could not save. Check your connection and try again.";
  }
}
