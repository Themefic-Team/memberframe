/**
 * The plan cards and Home's plugin list, as Hydra Booking shows them:
 * plans switched off in the backend's env are hidden, a plan's own discount
 * is struck through, the cards load as a skeleton (no flash of a switched off
 * plan), and "More From Framefic" lists every Framefic plugin but this one.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PaymentPlans, yearOfMonthly } from "../src/components/billing/PaymentPlans";
import { SIBLING_PLUGINS } from "../src/config/branding";

type Id = "monthly" | "yearly" | "lifetime";
const offer = (id: Id, amountMinor: number, extra: { enabled?: boolean; discount?: { code: string; amountMinor: number } } = {}) => ({
  id,
  enabled: extra.enabled ?? true,
  amountMinor,
  currency: "usd",
  interval: id === "monthly" ? "month" : id === "yearly" ? "year" : null,
  discount: extra.discount ? { ...extra.discount, percentOff: null, amountOffMinor: null } : null,
});
const response = (plans: unknown[]) => ({ plans, yearlySavingPercent: 17, lifetime: { total: 20, remaining: 20 }, publishableKey: "pk_test" });
const render = (props: Record<string, unknown>) =>
  renderToStaticMarkup(React.createElement(PaymentPlans, { plans: null, isCreatingPayment: false, payingPlan: null, currentPlan: null, onPay: () => undefined, ...props } as never));

describe("More From Framefic", () => {
  it("lists every Framefic plugin but MemberFrame, each with a bundled logo and a Marketplace link", () => {
    expect(SIBLING_PLUGINS.map((plugin) => plugin.id)).toEqual(["social-share", "store-locator", "beaf", "connectfic", "crestbar", "cms-filter", "formfic", "chat-bubbles", "auto-toc"]);
    for (const plugin of SIBLING_PLUGINS) {
      expect(existsSync(path.join(process.cwd(), "public", plugin.logo.slice(1))), plugin.logo).toBe(true);
      expect(plugin.href).toMatch(/^https:\/\/www\.framer\.com\/(community\/)?marketplace\/plugins\/[a-z-]+\/$/);
    }
    expect(readFileSync("src/components/tabs/HomeTab.tsx", "utf8")).toContain("isNew={plugin.isNew}");
  });
});

describe("the plan cards", () => {
  it("show a skeleton until the server's plans arrive, so a switched off plan never shows first", () => {
    const html = render({ plans: null, loading: true });
    expect(html).toContain('aria-label="Loading plans"');
    expect(html).not.toContain("Yearly");
    expect(html).not.toContain("Lifetime");
    expect(readFileSync("src/components/billing/SubscriptionPage.tsx", "utf8")).toContain("loading={plansLoading}");
  });

  it("drop the Monthly and Yearly toggle when Yearly is switched off", () => {
    const html = render({ plans: response([offer("monthly", 499), offer("yearly", 4999, { enabled: false }), offer("lifetime", 9999)]) });
    expect(html).not.toContain("ffmf-interval-toggle-container");
    expect(html).not.toContain("Yearly");
    expect(html).toContain("Monthly");
    expect(html).toContain("Get Lifetime Access");
  });

  it("hide Lifetime when it is switched off, and the divider with it", () => {
    const html = render({ plans: response([offer("monthly", 499), offer("yearly", 4999), offer("lifetime", 9999, { enabled: false })]) });
    expect(html).toContain("ffmf-interval-toggle-container");
    expect(html).not.toContain("Lifetime");
    expect(html).not.toContain("or, pay once");
  });

  it("keep showing a switched off plan the project is on", () => {
    const html = render({ plans: response([offer("monthly", 499), offer("yearly", 4999, { enabled: false }), offer("lifetime", 9999)]), currentPlan: "yearly" });
    expect(html).toContain("Current Plan");
  });

  it("compare a year with twelve months exactly: $49.99 a year is $9.89 off $59.88", () => {
    expect(yearOfMonthly(499)).toBe(5988);
    const html = render({ plans: response([offer("monthly", 499), offer("yearly", 4999), offer("lifetime", 9999)]), currentPlan: "yearly" });
    expect(html).toContain('<s class="plan-compare-price">$59.88</s><span class="plan-off-badge">$9.89 OFF</span>');
  });

  it("strike a plan's own price when it has a discount code", () => {
    const html = render({ plans: response([offer("monthly", 499), offer("yearly", 4999), offer("lifetime", 9999, { discount: { code: "LTD50", amountMinor: 5000 } })]) });
    expect(html).toContain('<span class="plan-price">$50.00</span><div class="plan-compare-row"><s class="plan-compare-price">$99.99</s><span class="plan-off-badge">$49.99 OFF</span></div>');
  });
});
