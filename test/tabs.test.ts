/**
 * The tab registry. Design rule section 7: the Figma Navigation page allows at
 * most four tabs, with the Account icon pinned right. A fifth tab pushed that
 * icon out of the 360px panel once; these tests stop it happening again.
 *
 * Layer 1 of the PRD section 16.1 triad: pure data, no DOM.
 */

import { describe, expect, it } from "vitest";
import { ACCOUNT_VIEW, DEFAULT_TAB, TABS, isTabId, isViewId } from "../src/components/tabs/tabs";

describe("TABS", () => {
  it("has five tabs at most: the four plus Reports, the creator's choice on 2026-10-18", () => {
    // The Figma maximum is four; Reports is a fifth by request (24-reports.md),
    // with the tab gap narrowed so the Account icon still fits in 360px.
    expect(TABS.length).toBeLessThanOrEqual(5);
  });

  it("starts with Home, which is also the default", () => {
    expect(TABS[0].id).toBe("home");
    expect(DEFAULT_TAB).toBe("home");
  });

  it("keeps the account view out of the tab bar", () => {
    const ids: ReadonlyArray<string> = TABS.map((tab) => tab.id);
    expect(ids.includes(ACCOUNT_VIEW)).toBe(false);
  });
});

describe("isViewId", () => {
  it("accepts every tab and the account view", () => {
    for (const tab of TABS) expect(isViewId(tab.id)).toBe(true);
    expect(isViewId(ACCOUNT_VIEW)).toBe(true);
  });

  it("rejects anything else, so a stale stored value falls back to Home", () => {
    expect(isViewId(null)).toBe(false);
    expect(isViewId("members")).toBe(false);
    expect(isViewId("")).toBe(false);
  });

  it("is wider than isTabId by exactly the account view", () => {
    expect(isTabId(ACCOUNT_VIEW)).toBe(false);
    expect(isViewId(ACCOUNT_VIEW)).toBe(true);
  });
});
