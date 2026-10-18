/**
 * Webhooks, the panel's side. Development doc: docs/development-docs/20-webhooks.md
 *
 * The backend validates and delivers; what is checked here is what the panel
 * decides on its own: when a draft can be saved, how a delivery reads, and
 * that every call goes to the right route, scoped to the site.
 */

import { describe, expect, it, vi } from "vitest";
import type { ApiClient } from "../src/services/apiClient";
import {
  FIELD_KEY_PATTERN,
  ZOHO_CRM_PRESET,
  fieldMapProblem,
  previewBody,
  splitName,
  type PreviewMember,
  WEBHOOK_EVENTS,
  WEBHOOK_EVENT_LABELS,
  createWebhook,
  deleteWebhook,
  deliveryLabel,
  emptyWebhookDraft,
  fetchWebhookDeliveries,
  fetchWebhooks,
  testWebhook,
  updateWebhook,
  webhookDraftProblem,
} from "../src/services/webhooksService";

describe("webhookDraftProblem", () => {
  const draft = { ...emptyWebhookDraft(), name: "Zoho CRM", url: "https://flow.zoho.com/hook/abc" };

  it("accepts a named https webhook with an event", () => {
    expect(webhookDraftProblem(draft)).toBeNull();
  });

  it("asks for a name, a real address, and an event", () => {
    expect(webhookDraftProblem({ ...draft, name: " " })).toMatch(/name/);
    expect(webhookDraftProblem({ ...draft, url: "" })).toMatch(/address/);
    expect(webhookDraftProblem({ ...draft, url: "zoho" })).toMatch(/web address/);
    expect(webhookDraftProblem({ ...draft, url: "ftp://x.com" })).toMatch(/https/);
    expect(webhookDraftProblem({ ...draft, events: [] })).toMatch(/event/);
  });

  it("starts a new webhook on every plan with the three everyday events", () => {
    expect(emptyWebhookDraft()).toMatchObject({ tiers: [], events: ["member.created", "member.updated", "member.tier_changed"] });
  });
});

describe("wording", () => {
  it("labels every event in plain words", () => {
    for (const event of WEBHOOK_EVENTS) expect(WEBHOOK_EVENT_LABELS[event]).not.toContain(".");
  });

  it("says what happened to a delivery", () => {
    const base = { event: "member.created", lastStatus: null, lastError: null, createdAt: "" };
    expect(deliveryLabel({ ...base, status: "delivered", lastStatus: 200 })).toBe("Delivered (200)");
    expect(deliveryLabel({ ...base, status: "pending", lastError: "The service answered 503." })).toBe("Retrying: The service answered 503.");
    expect(deliveryLabel({ ...base, status: "failed", lastError: "No answer within 10 seconds." })).toBe("Failed: No answer within 10 seconds.");
  });
});

describe("the calls", () => {
  const ok = { kind: "ok", data: {} };
  const client = {
    get: vi.fn(async () => ok),
    post: vi.fn(async () => ok),
    patch: vi.fn(async () => ok),
    delete: vi.fn(async () => ok),
  };
  const api = client as unknown as ApiClient;

  it("scopes every route to the site", async () => {
    const draft = { ...emptyWebhookDraft(), name: "n", url: "https://x.test" };

    await fetchWebhooks("s1", api);
    expect(client.get).toHaveBeenLastCalledWith("/api/site/webhooks", { siteId: "s1" });

    await createWebhook("s1", draft, api);
    expect(client.post).toHaveBeenLastCalledWith("/api/site/webhooks", { siteId: "s1", ...draft });

    await updateWebhook("s1", "w/1", { enabled: false }, api);
    expect(client.patch).toHaveBeenLastCalledWith("/api/site/webhooks/w%2F1", { siteId: "s1", enabled: false });

    await deleteWebhook("s1", "w1", api);
    expect(client.delete).toHaveBeenLastCalledWith("/api/site/webhooks/w1", { siteId: "s1" });

    await testWebhook("s1", "w1", api);
    expect(client.post).toHaveBeenLastCalledWith("/api/site/webhooks/w1/test", { siteId: "s1" });

    await fetchWebhookDeliveries("s1", "w1", api);
    expect(client.get).toHaveBeenLastCalledWith("/api/site/webhooks/w1/deliveries", { siteId: "s1" });
  });
});

describe("field mapping", () => {
  const member: PreviewMember = {
    email: "jordan@example.com",
    name: "Jordan Lee Okafor",
    status: "active",
    tier: { key: "tier_gold", name: "Gold" },
    previousTier: { key: "free_member", name: "Free" },
    profile: { company: "Acme", phone: "+880" },
  };

  it("builds the same body the server sends (memberframe-backend/test/webhooks.test.ts)", () => {
    const map = [
      { source: "member.email", key: "Email" },
      { source: "member.firstName", key: "First_Name" },
      { source: "member.lastName", key: "Last_Name" },
      { source: "member.tier.name", key: "Membership_Plan" },
      { source: "previousTier.name", key: "Old_Plan" },
      { source: "profile.company", key: "Account_Name" },
      { source: "event.type", key: "mf.event" },
    ];
    expect(previewBody(map, member, "member.tier_changed", "Tabfolio")).toEqual({
      Email: "jordan@example.com",
      First_Name: "Jordan Lee",
      Last_Name: "Okafor",
      Membership_Plan: "Gold",
      Old_Plan: "Free",
      Account_Name: "Acme",
      "mf.event": "member.tier_changed",
    });
  });

  it("offers Zoho CRM's Contact fields, Last_Name included", () => {
    expect(ZOHO_CRM_PRESET.map((row) => row.key)).toEqual(["Email", "First_Name", "Last_Name"]);
    expect(previewBody(ZOHO_CRM_PRESET, { ...member, name: null }, "member.created", "S")).toEqual({
      Email: "jordan@example.com",
      First_Name: null,
      Last_Name: "jordan",
    });
  });

  it("splits names the server's way", () => {
    expect(splitName("Jordan", "j@x.com")).toEqual({ first: null, last: "Jordan" });
    expect(splitName("  Ana  Maria  Silva ", "a@x.com")).toEqual({ first: "Ana Maria", last: "Silva" });
  });

  it("refuses a mapping the server would refuse, and an empty custom list", () => {
    const base = { ...emptyWebhookDraft(), name: "Zoho", url: "https://flow.zoho.com/x" };
    expect(webhookDraftProblem({ ...base, fieldMap: [] })).toMatch(/at least one field/);
    expect(webhookDraftProblem({ ...base, fieldMap: [{ source: "member.email", key: "" }] })).toMatch(/key/);
    expect(webhookDraftProblem({ ...base, fieldMap: [{ source: "member.email", key: "has space" }] })).toMatch(/cannot be a key/);
    expect(webhookDraftProblem({ ...base, fieldMap: [{ source: "member.email", key: "E" }, { source: "member.name", key: "E" }] })).toMatch(/twice/);
    expect(webhookDraftProblem({ ...base, fieldMap: [{ source: "profile.company", key: "Account_Name" }] })).toBeNull();
    expect(fieldMapProblem([{ source: "member.password", key: "P" }])).toMatch(/value/);
  });

  it("holds the server's key pattern character for character", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const server = readFileSync(path.join(process.cwd(), "..", "memberframe-backend", "src", "lib", "webhooks.ts"), "utf-8");
    expect(server).toContain(`FIELD_KEY_PATTERN = ${FIELD_KEY_PATTERN.toString()};`);
  });
});
