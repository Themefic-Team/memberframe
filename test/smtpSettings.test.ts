/**
 * Settings, Config, Email sending. Development doc: 25-custom-smtp.md.
 *
 * The card's rules are pure and live here; the server checks the same values
 * again and is the authority on private hosts. Pinned: the form round trips a
 * saved entry, a password is only sent when typed, the badge says which sender
 * members get, and the two requests reach the routes the backend serves.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "../src/services/apiClient";
import { fetchEmailStatus, sendTestEmail } from "../src/services/emailSettingsService";
import {
  lastSendFailure,
  smtpBadge,
  smtpDraftFrom,
  smtpDraftProblems,
  smtpValues,
  suggestedPort,
  type SmtpDraft,
} from "../src/utils/smtpSettings";

const STORED = {
  enabled: true,
  values: {
    host: "smtp.example.com",
    port: "465",
    security: "ssl",
    username: "apikey",
    fromName: "Tabfolio",
    fromAddress: "hello@tabfolio.com",
    replyTo: "",
  },
  secretsPresent: ["password"],
};

const draft = (overrides: Partial<SmtpDraft> = {}): SmtpDraft => ({ ...smtpDraftFrom(STORED), ...overrides });

describe("the form", () => {
  it("fills from a saved entry, with the password left empty", () => {
    expect(smtpDraftFrom(STORED)).toMatchObject({ host: "smtp.example.com", port: "465", security: "ssl", password: "" });
  });

  it("starts empty on STARTTLS and its usual port", () => {
    expect(smtpDraftFrom(undefined)).toMatchObject({ host: "", security: "starttls", port: "587" });
    expect(suggestedPort("ssl")).toBe("465");
  });

  it("accepts a saved entry with its stored password", () => {
    expect(smtpDraftProblems(draft(), true)).toEqual({});
  });

  it("asks for a password when a username has none", () => {
    expect(smtpDraftProblems(draft(), false)).toHaveProperty("password");
    expect(smtpDraftProblems(draft({ password: "secret" }), false)).toEqual({});
    expect(smtpDraftProblems(draft({ username: "" }), false)).toEqual({});
  });

  it("names each bad value", () => {
    const problems = smtpDraftProblems(
      draft({ host: "https://smtp.example.com", port: "99999", fromAddress: "nope", replyTo: "x" }),
      true
    );
    expect(Object.keys(problems).sort()).toEqual(["fromAddress", "host", "port", "replyTo"]);
  });
});

describe("saving", () => {
  it("sends every public value, and the password only when typed", () => {
    expect(smtpValues(draft())).not.toHaveProperty("password");
    expect(smtpValues(draft({ password: "new-secret" }))).toMatchObject({ password: "new-secret", host: "smtp.example.com" });
  });
});

describe("what the card says", () => {
  it("names the sender members get", () => {
    expect(smtpBadge(false, null).label).toBe("Not connected");
    expect(smtpBadge(true, null).label).toBe("Connected");
    expect(smtpBadge(true, { enabled: true, configured: true, last: { at: "2026-10-18T10:00:00Z", sent: false, error: "535" } })).toEqual({
      tone: "warning",
      label: "Send failed",
    });
  });

  it("explains a failed send and the fallback, and says nothing after a success", () => {
    const last = (sent: boolean) => ({ enabled: true, configured: true, last: { at: "2026-10-18T10:00:00Z", sent, error: sent ? null : "535 Authentication failed" } });
    expect(lastSendFailure(last(false))).toBe("535 Authentication failed The email went out from MemberFrame instead.");
    expect(lastSendFailure(last(true))).toBeNull();
    expect(lastSendFailure({ ...last(false), enabled: false })).toBeNull();
  });

  it("keeps every badge to two words, so it never wraps", () => {
    const failed = { enabled: true, configured: true, last: { at: "x", sent: false, error: "e" } };
    for (const badge of [smtpBadge(false, null), smtpBadge(true, null), smtpBadge(true, failed)]) {
      expect(badge.label.split(" ").length).toBeLessThanOrEqual(2);
    }
  });
});

describe("the requests", () => {
  const client = () => {
    const fetchImpl = vi.fn(async (_input: unknown, _init?: RequestInit) => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }));
    return { fetchImpl, api: new ApiClient({ getCreatorToken: () => "token", fetchImpl, baseUrl: "https://api.example.com" }) };
  };

  it("asks for the status by site", async () => {
    const { fetchImpl, api } = client();
    await fetchEmailStatus("site_1", api);
    expect(String(fetchImpl.mock.calls[0]![0])).toBe("https://api.example.com/api/site/email/status?siteId=site_1");
  });

  it("posts a test to the address typed", async () => {
    const { fetchImpl, api } = client();
    await sendTestEmail("site_1", "me@example.com", api);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe("https://api.example.com/api/site/email/test");
    expect(JSON.parse(String(init?.body))).toEqual({ siteId: "site_1", to: "me@example.com" });
  });
});

describe("the card", () => {
  const source = readFileSync(path.join(process.cwd(), "src", "components", "settings", "EmailSettings.tsx"), "utf-8");

  it("keeps Save settings the Config view's only primary button", () => {
    expect(source).not.toContain('variant="primary"');
  });

  it("follows the kit: a Select for a setting, help in info tips, no help paragraphs", () => {
    expect(source).toContain("<Select id=\"smtp-security\"");
    expect(source).not.toContain("<Segmented");
    expect(source).not.toContain("settings-help");
    expect(source).not.toContain("integration-input");
  });

  it("sits in Settings, Config", () => {
    const config = readFileSync(path.join(process.cwd(), "src", "components", "settings", "ConfigPanel.tsx"), "utf-8");
    expect(config).toContain("<EmailSettings {...email} />");
  });
});
