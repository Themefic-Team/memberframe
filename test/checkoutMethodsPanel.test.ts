/**
 * Manage, Payments for checkout methods (29-checkout-methods.md). Read from
 * source, like the other panel structure tests: there is no DOM environment.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { paymentsFailure, setGatewayEnabled } from "../src/services/paymentsService";
import type { ApiClient } from "../src/services/apiClient";

const panel = readFileSync(join(__dirname, "..", "src", "components", "manage", "PaymentsPanel.tsx"), "utf8");

describe("the gateway cards", () => {
  it("show a Show at checkout Toggle on a connected gateway only, and Off when hidden", () => {
    expect(panel).toMatch(/\{status\.connected \? \(\s*<Toggle/);
    expect(panel).toContain("label={`Show ${label} at checkout`}");
    expect(panel).toContain('{shown ? "Connected" : "Off"}');
    // A click on the Toggle must not open or close the card.
    expect(panel).toContain('<div className="integration-card-bar-right" onClick={(event) => event.stopPropagation()}>');
  });

  it("let the creator word the method, with the default as the placeholder", () => {
    expect(panel).toContain('label="Checkout title"');
    expect(panel).toContain('label="Checkout description"');
    expect(panel).toContain("placeholder={defaultLabel?.title ?? label}");
  });
});

describe("Checkout Settings", () => {
  it("no longer has Default gateway or Route by buyer location: buyers choose", () => {
    expect(panel).not.toContain('label="Default gateway"');
    expect(panel).not.toContain('label="Route by buyer location"');
    expect(panel).toContain("Buyers choose from the gateways shown at checkout");
  });
});

describe("paymentsService", () => {
  it("turns a gateway on or off for one mode", async () => {
    const put = vi.fn(async () => ({ kind: "ok" as const, data: {} }));
    await setGatewayEnabled("site_1", "stripe", "live", false, { put } as unknown as ApiClient);
    expect(put).toHaveBeenCalledWith("/api/site/payments/gateways/stripe/enabled", { siteId: "site_1", mode: "live", enabled: false });
  });

  it("names the refusal to turn off the last live gateway", () => {
    expect(paymentsFailure({ kind: "unavailable", status: 400, reason: "last_live_method" } as never)).toBe(
      "Keep one gateway on while payments are live."
    );
  });
});

describe("which member paid through which method", () => {
  const flyout = readFileSync(join(__dirname, "..", "src", "components", "manage", "MemberFlyout.tsx"), "utf8");

  it("lists each plan and payment with its gateway, in words", () => {
    expect(flyout).toContain("void fetchMemberPurchases(siteId, memberId)");
    expect(flyout).toContain("gatewayName(subscription.gateway)");
    expect(flyout).toContain("gatewayName(payment.gateway)");
    expect(flyout).toContain('past_due: "Payment failed"');
  });
});

describe("checkout wording on each gateway card", () => {
  it("is prefilled with the gateway's name and default line, and saves exactly what the fields say", () => {
    expect(panel).toContain("title: methodLabel.title || defaultLabel?.title || label,");
    expect(panel).toContain('description: methodLabel.description || defaultLabel?.description || "",');
    expect(panel).toContain("defaultLabel={DEFAULT_METHOD_LABELS[gateway]}");
    // Saved as written, so the chooser shows exactly what the fields say.
    expect(panel).toContain("const nextWording = { title: wording.title.trim(), description: wording.description.trim() };");
    expect(panel).toContain("if (wordingChanged && !(await onSaveLabel(nextWording))) return;");
  });

  it("has one Save at the bottom for the keys and the wording, reconnecting only when a key changed", () => {
    expect(panel).not.toContain("Save wording");
    expect(panel).toContain('{busy ? "Saving" : status.connected ? "Save changes" : `Connect ${label}`}');
    expect(panel).toMatch(/if \(keysChanged\) \{\s*const message = await onConnect\(values\);/);
    // The button row comes after the checkout wording.
    expect(panel.indexOf('label="Checkout description"')).toBeLessThan(panel.indexOf('"Save changes"'));
  });
});

describe("default checkout wording", () => {
  it("matches the server's, word for word", async () => {
    const { DEFAULT_METHOD_LABELS } = await import("../src/services/paymentsService");
    const server = readFileSync(join(__dirname, "..", "..", "memberframe-backend", "src", "lib", "methodLabels.ts"), "utf8");
    for (const [gateway, label] of Object.entries(DEFAULT_METHOD_LABELS)) {
      expect(server, gateway).toContain(`${gateway}: { title: "${label.title}", description: "${label.description}" }`);
    }
  });
});
