/**
 * The Member Dashboard's subscription popup (2026-10-20): Manage billing opens
 * it in the page, with the plan and its gateway, plan changes, and every
 * payment from every gateway.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(__dirname, "..", "src", "canvas-components", "MemberDashboard.tsx"), "utf8");
const backend = readFileSync(join(__dirname, "..", "..", "memberframe-backend", "src", "services", "payments", "checkoutService.ts"), "utf8");

describe("Manage billing", () => {
  it("opens the subscription popup instead of the gateway's portal", () => {
    expect(source).toContain("onClick={() => setBillingOpen(true)}");
    expect(source).toContain('role="dialog"');
    // A failed payment still goes straight to updating the card.
    expect(source).toMatch(/\{pastDue && plan\.canManage \? \(/);
  });

  it("names the gateway the plan is paid through, and each payment's", () => {
    expect(source).toContain('t("paidWith").split("{gateway}").join(gatewayName(plan.gateway))');
    expect(source).toContain("gatewayName(payment.gateway)");
    expect(backend).toContain("gateway: subscription.gateway,");
    expect(backend).toContain("planName: plan ? tierName(plan.tierKey) : null,");
  });

  it("previews a change's cost first, then confirms it; a new checkout goes to the pricing page", () => {
    // 30-plan-changes.md: the numbers (or the downgrade date) before anything happens.
    expect(source).toContain("onClick={() => void previewChange(option.key, option.name, period)}");
    expect(source).toContain('setSwitchTo({ key, name, kind: body.kind, summary: body.summary, effectiveAt: body.effectiveAt ?? null });');
    expect(source).toContain("onClick={() => void confirmChange(summary.pricingPath)}");
    expect(source).toMatch(/if \(switchTo\.kind === "choose"\) \{\s*if \(safePath\(pricingPath\)\) navigate\(pricingPath\);/);
  });

  it("shows an upgrade's credit and what is due today, and a downgrade's date with nothing charged", () => {
    expect(source).toContain('t("creditLine").split("{plan}")');
    expect(source).toContain("formatMoney(switchTo.summary.dueMinor ?? switchTo.summary.amountMinor, switchTo.summary.currency)");
    expect(source).toContain('t("downgradeNote").split("{tier}").join(switchTo.name)');
  });

  it("shows a scheduled downgrade with Undo, and the plans held in the history", () => {
    expect(source).toContain('onClick={() => void billingAction("undo-change")}');
    expect(source).toContain("summary.history!.plans.map((entry, index) => (");
    expect(source).toContain("summary.history!.credits.map((credit, index) => (");
  });

  it("closes on its button, the backdrop, and Escape", () => {
    expect(source).toContain('aria-label={t("closeBilling")} onClick={closeBilling}');
    expect(source).toContain("if (event.target === event.currentTarget) closeBilling();");
    expect(source).toContain('if (event.key === "Escape") {');
  });
});

describe("cancel plan in the popup", () => {
  it("is a clear button that opens an in-place confirmation with Keep plan and Cancel plan", () => {
    expect(source).toContain('className="mf-dash-button mf-dash-button-danger"');
    expect(source).toContain("onClick={() => setConfirmingCancel(true)}");
    expect(source).toContain('t("cancelKeeps").split("{date}").join(formatDate(plan.currentPeriodEnd))');
    expect(source).toContain("onClick={() => setConfirmingCancel(false)}");
    expect(source).toContain('className="mf-dash-button mf-dash-button-danger is-solid"');
  });
});

describe("an auto-renewing plan past its date", () => {
  it("says the renewal is being processed, not that it renews on a past date", () => {
    expect(source).toContain("function renewalOverdue(periodEnd: string | null): boolean {");
    expect(source).toContain('? t("renewalPending")');
  });
});
