/**
 * MemberFrame's own plans, from the panel. F19, 19-pro-lock-and-trial.md.
 *
 * Every call carries the creator's token (apiClient adds it) and names the
 * project by its site id; the backend checks the project is theirs.
 */

import { apiClient, type ApiClient, type ApiResult } from "./apiClient";

export type LicenseState = "trial" | "active" | "expired" | "trial_claimed_other_site" | "none";
export type PlanId = "monthly" | "yearly" | "lifetime";

/** The backend's `LicenseView`. */
export interface LicenseView {
  state: LicenseState;
  plan: PlanId | "trial" | null;
  status: string | null;
  trialEndsAt: string | null;
  startedAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  amountMinor: number | null;
  currency: string | null;
  claimedProjectName: string | null;
  subscriptionId: string | null;
}

export interface PlanOffer {
  id: PlanId;
  amountMinor: number;
  currency: string;
  interval: "month" | "year" | null;
}

export interface PlansResponse {
  plans: PlanOffer[];
  yearlySavingPercent: number;
  lifetime: { total: number; remaining: number };
  publishableKey: string;
}

export interface CheckoutResponse {
  clientSecret: string | null;
  mode: "subscription" | "payment";
  amountDueMinor: number;
  creditMinor: number;
  currency: string;
  complete: boolean;
}

export interface UpgradePreview {
  from: PlanId;
  to: PlanId;
  creditMinor: number;
  amountDueMinor: number;
  currency: string;
  nextRenewal: string | null;
}

export const fetchLicense = (siteId: string, client: ApiClient = apiClient): Promise<ApiResult<{ license: LicenseView }>> =>
  client.get("/api/plugin/license", { siteId });

export const fetchPlans = (client: ApiClient = apiClient): Promise<ApiResult<PlansResponse>> => client.get("/api/plugin/plans");

export const startCheckout = (
  siteId: string,
  plan: PlanId,
  coupon: string | undefined,
  client: ApiClient = apiClient
): Promise<ApiResult<CheckoutResponse>> => client.post("/api/plugin/checkout", { siteId, plan, ...(coupon ? { coupon } : {}) });

export const confirmCheckout = (
  siteId: string,
  paymentIntentId: string,
  client: ApiClient = apiClient
): Promise<ApiResult<{ license: LicenseView }>> => client.post("/api/plugin/checkout/confirm", { siteId, paymentIntentId });

export const fetchUpgradePreview = (
  siteId: string,
  targetPlan: PlanId,
  client: ApiClient = apiClient
): Promise<ApiResult<{ preview: UpgradePreview }>> => client.get("/api/plugin/upgrade-preview", { siteId, targetPlan });

export const upgradePlan = (siteId: string, targetPlan: PlanId, client: ApiClient = apiClient): Promise<ApiResult<CheckoutResponse>> =>
  client.post("/api/plugin/upgrade", { siteId, targetPlan });

export const cancelPlan = (
  siteId: string,
  reason: string,
  client: ApiClient = apiClient
): Promise<ApiResult<{ endsAt: string | null; license: LicenseView }>> => client.post("/api/plugin/cancel", { siteId, reason });

export const resumePlan = (siteId: string, client: ApiClient = apiClient): Promise<ApiResult<{ license: LicenseView }>> =>
  client.post("/api/plugin/resume", { siteId });

export const fetchBillingPortal = (siteId: string, client: ApiClient = apiClient): Promise<ApiResult<{ url: string }>> =>
  client.get("/api/plugin/billing-portal", { siteId });

// ============================================================================
// PURE HELPERS, tested in test/pluginLicense.test.ts
// ============================================================================

/** What the canvas components should draw: the three states the lock lines encode. */
export type CanvasLicense = "trial" | "active" | "locked";

export function canvasLicense(state: LicenseState | null | undefined): CanvasLicense {
  return state === "active" ? "active" : state === "trial" ? "trial" : "locked";
}

/** Whether the panel works, or shows only Account. BEAF: locked when not trial or paid. */
export function panelUnlocked(state: LicenseState | null | undefined): boolean {
  return state === "active" || state === "trial";
}

export const PLAN_LABELS: Record<PlanId | "trial", string> = {
  monthly: "Pro Monthly",
  yearly: "Pro Yearly",
  lifetime: "Lifetime",
  trial: "Free Trial",
};

const PLAN_RANK: Record<PlanId, number> = { monthly: 1, yearly: 2, lifetime: 3 };

/** What a plan card's button says for the project's current plan. */
export function planAction(current: PlanId | null, offer: PlanId): "current" | "upgrade" | "unavailable" | "choose" {
  if (!current) return "choose";
  if (current === offer) return "current";
  return PLAN_RANK[offer] > PLAN_RANK[current] ? "upgrade" : "unavailable";
}

export function formatMoney(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/**
 * The trial countdown. "N days left" while a day or more is left, then a live
 * HH:MM:SS (F19: the format changes at exactly 24 hours).
 */
export function formatCountdown(secondsLeft: number): string {
  const seconds = Math.max(0, Math.floor(secondsLeft));
  if (seconds >= 86_400) {
    const days = Math.floor(seconds / 86_400);
    return `${days} ${days === 1 ? "day" : "days"} left`;
  }
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)} left`;
}

/** Which notice the shell shows, if any. One at a time. */
export type LicenseNotice =
  | { kind: "trial"; secondsLeft: number }
  | { kind: "payment_failed" }
  | { kind: "canceling"; endsAt: string }
  | { kind: "renewing"; renewsAt: string }
  | null;

const DAY_MS = 86_400_000;

export function licenseNotice(view: LicenseView | null, now: number): LicenseNotice {
  if (!view) return null;
  if (view.state === "trial" && view.trialEndsAt) {
    return { kind: "trial", secondsLeft: Math.max(0, (Date.parse(view.trialEndsAt) - now) / 1000) };
  }
  if (view.state !== "active") return null;
  if (view.status === "past_due") return { kind: "payment_failed" };
  if (view.cancelAtPeriodEnd && view.currentPeriodEnd) return { kind: "canceling", endsAt: view.currentPeriodEnd };
  if (view.currentPeriodEnd && (view.plan === "monthly" || view.plan === "yearly")) {
    const window = view.plan === "yearly" ? 7 * DAY_MS : 3 * DAY_MS;
    const left = Date.parse(view.currentPeriodEnd) - now;
    if (left > 0 && left <= window) return { kind: "renewing", renewsAt: view.currentPeriodEnd };
  }
  return null;
}

/** A coupon typed in the payment form, after checkout has started (BEAF's "Have a coupon code?"). */
export const applyCoupon = (siteId: string, coupon: string, client: ApiClient = apiClient): Promise<ApiResult<CheckoutResponse>> =>
  client.post("/api/plugin/apply-coupon", { siteId, coupon });
