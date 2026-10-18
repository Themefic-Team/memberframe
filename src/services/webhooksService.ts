/**
 * Webhooks, the panel's side: `/api/site/webhooks`. Development doc:
 * `docs/development-docs/20-webhooks.md`.
 */

import type { ApiClient, ApiResult } from "./apiClient";
import { apiClient } from "./apiClient";

export const WEBHOOK_EVENTS = ["member.created", "member.updated", "member.tier_changed", "member.deleted"] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENTS)[number];

/** What each event means, in the creator's words. Never the raw event name alone. */
export const WEBHOOK_EVENT_LABELS: Record<WebhookEventType, string> = {
  "member.created": "New member signs up",
  "member.updated": "Member updates their profile or status",
  "member.tier_changed": "Member's plan changes",
  "member.deleted": "Member is deleted",
};

export const MAX_WEBHOOKS = 10;

export interface WebhookDeliverySummary {
  event: string;
  status: "pending" | "delivered" | "failed";
  lastStatus: number | null;
  lastError: string | null;
  createdAt: string;
}

/** One value of the custom body, sent under the creator's own key. */
export interface FieldMapping {
  source: string;
  key: string;
}

export interface SiteWebhook {
  id: string;
  name: string;
  url: string;
  events: WebhookEventType[];
  /** Tier keys. Empty is every plan. */
  tiers: string[];
  enabled: boolean;
  /** Null sends the standard payload. */
  fieldMap: FieldMapping[] | null;
  secret: string;
  lastDelivery: WebhookDeliverySummary | null;
}

export interface WebhookDraft {
  name: string;
  url: string;
  events: WebhookEventType[];
  tiers: string[];
  enabled: boolean;
  fieldMap: FieldMapping[] | null;
}

export interface WebhookDelivery extends WebhookDeliverySummary {
  id: string;
  attempts: number;
  nextAttemptAt: string | null;
  deliveredAt: string | null;
}

export interface TestResult {
  ok: boolean;
  status: number | null;
  error: string | null;
}

export function fetchWebhooks(siteId: string, client: ApiClient = apiClient): Promise<ApiResult<{ webhooks: SiteWebhook[] }>> {
  return client.get("/api/site/webhooks", { siteId });
}

export function createWebhook(
  siteId: string,
  draft: WebhookDraft,
  client: ApiClient = apiClient
): Promise<ApiResult<{ webhook: SiteWebhook }>> {
  return client.post("/api/site/webhooks", { siteId, ...draft });
}

export function updateWebhook(
  siteId: string,
  id: string,
  draft: Partial<WebhookDraft>,
  client: ApiClient = apiClient
): Promise<ApiResult<{ webhook: SiteWebhook }>> {
  return client.patch(`/api/site/webhooks/${encodeURIComponent(id)}`, { siteId, ...draft });
}

export function deleteWebhook(siteId: string, id: string, client: ApiClient = apiClient): Promise<ApiResult<{ deleted: true }>> {
  return client.delete(`/api/site/webhooks/${encodeURIComponent(id)}`, { siteId });
}

export function testWebhook(siteId: string, id: string, client: ApiClient = apiClient): Promise<ApiResult<{ result: TestResult }>> {
  return client.post(`/api/site/webhooks/${encodeURIComponent(id)}/test`, { siteId });
}

export function fetchWebhookDeliveries(
  siteId: string,
  id: string,
  client: ApiClient = apiClient
): Promise<ApiResult<{ deliveries: WebhookDelivery[] }>> {
  return client.get(`/api/site/webhooks/${encodeURIComponent(id)}/deliveries`, { siteId });
}

/** Why a draft cannot be saved, or null. The server checks again, more strictly. */
export function webhookDraftProblem(draft: WebhookDraft): string | null {
  if (draft.name.trim() === "") return "Give this webhook a name.";
  const url = draft.url.trim();
  if (url === "") return "Paste the address the service gave you.";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "The address must start with https://";
  } catch {
    return "That is not a web address.";
  }
  if (draft.events.length === 0) return "Pick at least one event.";
  if (draft.fieldMap !== null) {
    if (draft.fieldMap.length === 0) return "Add at least one field, or send the standard format.";
    return fieldMapProblem(draft.fieldMap);
  }
  return null;
}

/** One line for a delivery's result, in plain words. */
export function deliveryLabel(delivery: WebhookDeliverySummary): string {
  if (delivery.status === "delivered") return delivery.lastStatus ? `Delivered (${delivery.lastStatus})` : "Delivered";
  if (delivery.status === "pending") return delivery.lastError ? `Retrying: ${delivery.lastError}` : "Sending";
  return delivery.lastError ? `Failed: ${delivery.lastError}` : "Failed";
}

export function emptyWebhookDraft(): WebhookDraft {
  return {
    name: "",
    url: "",
    events: ["member.created", "member.updated", "member.tier_changed"],
    tiers: [],
    enabled: true,
    fieldMap: null,
  };
}

// ============================================================================
// FIELD MAPPING
// ============================================================================
// The server's rules, held to them by the same expected bodies in both test
// suites: memberframe-backend/test/webhooks.test.ts and test/webhooksService.test.ts.

/** Every value a field can send, in the creator's words. */
export const FIELD_SOURCE_LABELS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "member.email", label: "Email" },
  { value: "member.name", label: "Full name" },
  { value: "member.firstName", label: "First name" },
  { value: "member.lastName", label: "Last name" },
  { value: "member.tier.name", label: "Plan name" },
  { value: "member.tier.key", label: "Plan key" },
  { value: "previousTier.name", label: "Previous plan name" },
  { value: "previousTier.key", label: "Previous plan key" },
  { value: "member.status", label: "Membership status" },
  { value: "member.emailVerified", label: "Email confirmed" },
  { value: "member.createdAt", label: "Joined at" },
  { value: "member.id", label: "Member ID" },
  { value: "event.type", label: "Event type" },
  { value: "event.id", label: "Event ID" },
  { value: "event.createdAt", label: "Event time" },
  { value: "site.name", label: "Site name" },
];

export const MAX_FIELD_MAP = 50;
export const FIELD_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_.-]{0,63}$/;
const PROFILE_SOURCE = /^profile\.[a-z][a-z0-9_]{0,39}$/;

/** Zoho CRM's Contact fields by API name. Last_Name is the one Zoho requires. */
export const ZOHO_CRM_PRESET: FieldMapping[] = [
  { source: "member.email", key: "Email" },
  { source: "member.firstName", key: "First_Name" },
  { source: "member.lastName", key: "Last_Name" },
];

export function isFieldSource(value: string): boolean {
  return FIELD_SOURCE_LABELS.some((entry) => entry.value === value) || PROFILE_SOURCE.test(value);
}

/** Why a mapping cannot be saved, or null. */
export function fieldMapProblem(map: ReadonlyArray<FieldMapping>): string | null {
  if (map.length > MAX_FIELD_MAP) return `At most ${MAX_FIELD_MAP} fields.`;
  const keys = new Set<string>();
  for (const entry of map) {
    if (!isFieldSource(entry.source)) return "Pick a value for every field.";
    if (entry.key.trim() === "") return "Give every field a key.";
    if (!FIELD_KEY_PATTERN.test(entry.key)) {
      return `"${entry.key}" cannot be a key. Use letters, digits, _ - and ., starting with a letter.`;
    }
    if (keys.has(entry.key)) return `The key ${entry.key} is used twice.`;
    keys.add(entry.key);
  }
  return null;
}

/** First and last name from one name field, the server's rule. */
export function splitName(name: string | null, email: string): { first: string | null; last: string } {
  const words = (name ?? "").trim().split(/\s+/).filter((word) => word !== "");
  if (words.length === 0) return { first: null, last: email.split("@")[0] || email };
  if (words.length === 1) return { first: null, last: words[0]! };
  return { first: words.slice(0, -1).join(" "), last: words[words.length - 1]! };
}

/** The member a preview is built from: the same made-up member Send test sends. */
export interface PreviewMember {
  email: string;
  name: string | null;
  status: string;
  tier: { key: string; name: string };
  previousTier: { key: string; name: string } | null;
  profile: Record<string, unknown>;
}

/** One value for the preview, the server's sourceValue for the fields a creator sees. */
export function previewValue(member: PreviewMember, source: string, event: string, siteName: string): unknown {
  if (source.startsWith("profile.")) return member.profile[source.slice("profile.".length)] ?? null;
  switch (source) {
    case "member.email":
      return member.email;
    case "member.name":
      return member.name;
    case "member.firstName":
      return splitName(member.name, member.email).first;
    case "member.lastName":
      return splitName(member.name, member.email).last;
    case "member.status":
      return member.status;
    case "member.tier.key":
      return member.tier.key;
    case "member.tier.name":
      return member.tier.name;
    case "previousTier.key":
      return member.previousTier?.key ?? null;
    case "previousTier.name":
      return member.previousTier?.name ?? null;
    case "member.emailVerified":
      return true;
    case "member.createdAt":
    case "event.createdAt":
      return "2026-10-17T10:00:00.000Z";
    case "member.id":
      return "00000000-0000-7000-8000-000000000000";
    case "event.id":
      return "0192f0c4-0000-7000-8000-000000000000";
    case "event.type":
      return event;
    case "site.name":
      return siteName;
    default:
      return null;
  }
}

/** The body a mapping sends for this member, as the receiving service will see it. */
export function previewBody(map: ReadonlyArray<FieldMapping>, member: PreviewMember, event: string, siteName: string): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const entry of map) {
    if (entry.key.trim() !== "") body[entry.key] = previewValue(member, entry.source, event, siteName);
  }
  return body;
}
