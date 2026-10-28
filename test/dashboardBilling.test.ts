/**
 * The Member Dashboard's plan and payments. Until 2026-10-27 they lived in a
 * subscription popup opened from Manage billing; the account area
 * (docs/development-docs/33-member-account.md) shows them in place, in the
 * Membership and Billing sections. The rules each check guards are unchanged.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(__dirname, "..", "src", "canvas-components", "MemberDashboard.tsx"), "utf8");
const backend = readFileSync(join(__dirname, "..", "..", "memberframe-backend", "src", "services", "payments", "checkoutService.ts"), "utf8");

describe("Membership and Billing", () => {
  it("shows the plan in its own section, with no popup, and Overview links to it", () => {
    expect(source).not.toContain("setBillingOpen");
    expect(source).toContain("const membershipSection = () => {");
    expect(source).toContain("const billingSection = () => {");
    expect(source).toContain('onClick={() => goTo("membership")}');
    // A failed payment still goes straight to updating the card.
    expect(source).toMatch(/\{pastDue && subscription\.canManage \? \(/);
  });

  it("names the gateway the plan is paid through, and each payment's", () => {
    expect(source).toContain('t("paidWith").split("{gateway}").join(gatewayName(subscription.gateway))');
    expect(source).toContain("gatewayName(payment.gateway)");
    expect(backend).toContain("gateway: subscription.gateway,");
    expect(backend).toContain("planName: plan ? tierName(plan.tierKey) : null,");
  });

  it("previews a change's cost first, then confirms it; a new checkout goes to the pricing page", () => {
    // 30-plan-changes.md: the numbers (or the downgrade date) before anything happens.
    expect(source).toContain("onClick={() => void previewChange(option.key, option.name, period)}");
    expect(source).toContain('setSwitchTo({ key, name, kind: body.kind, summary: body.summary, effectiveAt: body.effectiveAt ?? null });');
    expect(source).toContain("onClick={() => void confirmChange(current.pricingPath)}");
    expect(source).toMatch(/if \(switchTo\.kind === "choose"\) \{\s*if \(safePath\(pricingPath\)\) navigate\(pricingPath\);/);
  });

  it("shows an upgrade's credit and what is due today, and a downgrade's date with nothing charged", () => {
    expect(source).toContain('t("creditLine").split("{plan}")');
    expect(source).toContain("formatMoney(switchTo.summary.dueMinor ?? switchTo.summary.amountMinor, switchTo.summary.currency)");
    expect(source).toContain('t("downgradeNote").split("{tier}").join(switchTo.name)');
  });

  it("shows a scheduled downgrade with Undo, and the plans held in the history", () => {
    expect(source).toContain('onClick={() => void billingAction("undo-change")}');
    expect(source).toContain("current.history!.plans.map((entry, index) => (");
    expect(source).toContain("current.history!.credits.map((credit, index) => (");
  });

  it("opens the gateway's portal from Billing, and never on the canvas", () => {
    expect(source).toMatch(/disabled=\{billingBusy \|\| onCanvas\} onClick=\{\(\) => void billingAction\("portal"\)\}/);
  });
});

describe("cancel plan", () => {
  it("is a clear button that opens an in-place confirmation with Keep plan and Cancel plan", () => {
    expect(source).toContain('className="mf-dash-button mf-dash-button-danger"');
    expect(source).toContain("onClick={() => setConfirmingCancel(true)}");
    expect(source).toContain('t("cancelKeeps").split("{date}").join(formatDate(subscription.currentPeriodEnd))');
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
