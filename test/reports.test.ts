/**
 * Reports in the panel. Development doc: 24-reports.md.
 *
 * The CSV is opened in a spreadsheet, and a member's name is typed by the
 * member, so escaping and the formula guard are pinned here. The client's
 * requests are checked against the routes the backend serves.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "../src/services/apiClient";
import { fetchMemberHistory, fetchOverview, fetchPayments, fetchSubscriptions, toCsv } from "../src/services/reportsService";
import { TABS } from "../src/components/tabs/tabs";

describe("CSV export", () => {
  it("quotes cells with commas, quotes, and line breaks", () => {
    expect(toCsv(["Name", "Note"], [["Okafor, Jordan", 'Said "hi"\nthen left']])).toBe(
      'Name,Note\r\n"Okafor, Jordan","Said ""hi""\nthen left"'
    );
  });

  it("keeps a typed formula from running in a spreadsheet", () => {
    for (const formula of ["=HYPERLINK(\"x\")", "+1+1", "-2", "@SUM(A1)"]) {
      expect(toCsv(["Name"], [[formula]]).split("\r\n")[1].replace(/^"|"$/g, "")).toMatch(/^'/);
    }
  });

  it("writes empty cells for missing values", () => {
    expect(toCsv(["A", "B"], [[null, 3]])).toBe("A,B\r\n,3");
  });
});

describe("the report requests", () => {
  const client = () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }));
    return { fetchImpl, api: new ApiClient({ getCreatorToken: () => "token", fetchImpl, baseUrl: "https://api.example.com" }) };
  };
  const url = (fetchImpl: ReturnType<typeof vi.fn>) => String(fetchImpl.mock.calls[0][0]);

  it("asks for the overview by site, mode, and period", async () => {
    const { fetchImpl, api } = client();
    await fetchOverview("site_1", "live", "90d", api);
    expect(url(fetchImpl)).toBe("https://api.example.com/api/site/reports/overview?siteId=site_1&mode=live&period=90d");
  });

  it("leaves an empty tier filter out", async () => {
    const { fetchImpl, api } = client();
    await fetchSubscriptions({ siteId: "site_1", mode: "test", status: "paying", tier: "", page: 2 }, api);
    expect(url(fetchImpl)).toBe("https://api.example.com/api/site/reports/subscriptions?siteId=site_1&mode=test&status=paying&page=2");
  });

  it("filters payments by tier and member", async () => {
    const { fetchImpl, api } = client();
    await fetchPayments({ siteId: "site_1", mode: "live", period: "all", tier: "gold_plus", memberId: "m_1", page: 1 }, api);
    expect(url(fetchImpl)).toContain("tier=gold_plus");
    expect(url(fetchImpl)).toContain("memberId=m_1");
  });

  it("asks for one member's history", async () => {
    const { fetchImpl, api } = client();
    await fetchMemberHistory("site_1", "m 1", "live", api);
    expect(url(fetchImpl)).toBe("https://api.example.com/api/site/reports/members/m%201?siteId=site_1&mode=live");
  });
});

describe("the tab and the chart", () => {
  it("puts Reports last in the tab bar", () => {
    expect(TABS.map((tab) => tab.id)).toEqual(["home", "builder", "manage", "settings", "reports"]);
  });

  it("builds the members drill-down from Manage's own pieces, so the tabs match", () => {
    const views = readFileSync(path.join(process.cwd(), "src", "components", "reports", "ReportViews.tsx"), "utf-8");
    const parts = readFileSync(path.join(process.cwd(), "src", "components", "reports", "ReportParts.tsx"), "utf-8");
    expect(views).toContain('<article key={row.key} className="integration-card">'); // the Tiers card
    expect(views).toContain("<MemberRow key={member.id}"); // Manage's member row
    expect(views).toContain('<p className="members-count">');
    expect(parts).toContain('<div className="members-pager">'); // the members list's pager
    expect(views).toContain("money(0, currency)"); // nothing spent reads in the site currency
  });

  it("keeps the view switcher's labels short enough for a 360px panel", () => {
    // "Subscriptions" made the four segments overflow and clip at both ends.
    const tab = readFileSync(path.join(process.cwd(), "src", "components", "tabs", "ReportsTab.tsx"), "utf-8");
    const block = tab.slice(tab.indexOf("const VIEWS"), tab.indexOf("];", tab.indexOf("const VIEWS")));
    const labels = [...block.matchAll(/label: "([^"]+)"/g)].map((match) => match[1]);
    expect(labels).toEqual(["Overview", "Revenue", "Plans", "Members"]);
    expect(labels.join("").length).toBeLessThanOrEqual(28);
  });

  it("draws columns rounded at the top and square at the baseline, with a hover readout", () => {
    const parts = readFileSync(path.join(process.cwd(), "src", "components", "reports", "ReportParts.tsx"), "utf-8");
    expect(parts).toContain("const RADIUS = 4;");
    expect(parts).toMatch(/M\$\{x\},\$\{BASE\}V/); // starts square at the baseline
    expect(parts).toContain('aria-live="polite"');
    expect(parts).toContain("onFocus={() => setActive(index)}");
  });
});
