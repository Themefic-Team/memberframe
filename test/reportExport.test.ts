/**
 * Report exports: the CSV and PDF renderers and the per-view documents.
 * Development doc: docs/development-docs/24-reports.md, section on exports.
 */

import { describe, expect, it } from "vitest";
import { renderPdf, toWinAnsi, type PdfReport } from "../src/utils/pdf";
import { amountText, exportFileName, reportCsv, reportMeta } from "../src/services/reportExport";
import {
  memberHistoryDocument,
  overviewDocument,
  revenueDocument,
  subscriptionsDocument,
  tierMembersDocument,
  tiersDocument,
} from "../src/components/reports/reportDocuments";
import type { OverviewReport, PaymentRow } from "../src/services/reportsService";

const REPORT: OverviewReport = {
  mode: "live",
  period: "30d",
  from: null,
  siteCurrency: "INR",
  members: {
    total: 4,
    newInPeriod: 2,
    paying: 1,
    byTier: [
      { key: "free", name: "Free", rank: 0, count: 3 },
      { key: "gold", name: "Gold", rank: 1, count: 1 },
    ],
    byStatus: { active: 4 },
    signupsByMonth: [{ month: "2026-10", count: 2 }],
  },
  subscriptions: {
    active: 1,
    pastDue: 0,
    canceling: 0,
    startedInPeriod: 1,
    endedInPeriod: 0,
    byInterval: { month: 1, year: 0, lifetime: 0 },
    byTier: [{ key: "gold", name: "Gold", rank: 1, count: 1 }],
  },
  revenue: {
    totals: [
      { currency: "INR", grossMinor: 125000, refundedMinor: 0, netMinor: 125000, payments: 1 },
      { currency: "USD", grossMinor: 999, refundedMinor: 0, netMinor: 999, payments: 1 },
    ],
    mrr: [{ currency: "INR", amountMinor: 125000 }],
    byMonth: [{ month: "2026-10", currency: "INR", netMinor: 125000, payments: 1 }],
    months: ["2026-09", "2026-10"],
    byTier: [{ key: "gold", name: "Gold", currency: "INR", netMinor: 125000, payments: 1 }],
    byGateway: [{ key: "razorpay", currency: "INR", netMinor: 125000, payments: 1 }],
  },
  content: { topBookmarks: [], topDownloads: [] },
};

const PAYMENT: PaymentRow = {
  id: "p1",
  member: { id: "m1", email: "ana@example.com", name: "=HYPERLINK(\"x\")" },
  tierKey: "gold",
  tierName: "Gold",
  interval: "month",
  amountMinor: 125000,
  currency: "INR",
  gateway: "razorpay",
  status: "paid",
  paidAt: "2026-10-20T08:00:00.000Z",
  receiptUrl: "https://example.com/r/1",
};

/** The PDF's xref table points at each object: proves the offsets are right. */
function checkXref(pdf: string): number {
  const start = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(pdf)?.[1]);
  expect(pdf.slice(start, start + 4)).toBe("xref");
  const lines = pdf.slice(start).split("\n");
  const count = Number(lines[1].split(" ")[1]);
  for (let id = 1; id < count; id += 1) {
    const offset = Number(lines[2 + id].slice(0, 10));
    expect(pdf.slice(offset, offset + `${id} 0 obj`.length)).toBe(`${id} 0 obj`);
  }
  return count;
}

const pageCount = (pdf: string) => Number(/\/Type \/Pages .*\/Count (\d+)/.exec(pdf)?.[1]);

describe("amountText", () => {
  it("writes the currency code and groups the whole part", () => {
    expect(amountText(125000, "INR")).toBe("INR 1,250.00");
    expect(amountText(123456789, "USD")).toBe("USD 1,234,567.89");
    expect(amountText(-500, "EUR")).toBe("-EUR 5.00");
    expect(amountText(0, "USD")).toBe("USD 0.00");
  });

  it("follows the currency's own decimals", () => {
    expect(amountText(1500, "JPY")).toBe("JPY 1,500");
  });
});

describe("reportCsv", () => {
  const report: PdfReport = {
    title: "Revenue",
    meta: ["Live payments"],
    footer: "MemberFrame report",
    tables: [
      { title: "Payments", columns: [{ label: "Name" }, { label: "Receipt", pdf: false }], rows: [["=SUM(A1)", "https://x"]] },
      { title: "Empty", columns: [{ label: "A" }], rows: [], empty: "Nothing here." },
    ],
  };

  it("starts with a byte order mark so Excel reads UTF-8", () => {
    expect(reportCsv(report).startsWith("﻿Revenue\r\nLive payments")).toBe(true);
  });

  it("puts each table under its title, a blank line between, and keeps CSV only columns", () => {
    const csv = reportCsv(report);
    expect(csv).toContain("\r\n\r\nPayments\r\nName,Receipt\r\n'=SUM(A1),https://x\r\n\r\nEmpty\r\nA\r\nNothing here.");
  });
});

describe("renderPdf", () => {
  const rows = Array.from({ length: 120 }, (_, index) => [`Member ${index}`, `${index}`]);
  const report: PdfReport = {
    title: "Members (all)",
    meta: ["Live payments"],
    footer: "MemberFrame report",
    tables: [{ title: "Members", columns: [{ label: "Name" }, { label: "Count", align: "right" }, { label: "Secret", pdf: false }], rows }],
  };

  it("is a well formed PDF with a correct cross reference table", () => {
    const pdf = renderPdf(report);
    expect(pdf.startsWith("%PDF-1.4\n")).toBe(true);
    checkXref(pdf);
  });

  it("is 7-bit throughout, so the string is the file", () => {
    expect(/^[\x00-\x7f]*$/.test(renderPdf({ ...report, title: "Café € Ünïcode" }))).toBe(true);
  });

  it("breaks long tables onto more pages and repeats the header on each", () => {
    const pdf = renderPdf(report);
    const pages = pageCount(pdf);
    expect(pages).toBeGreaterThan(2);
    expect(pdf.match(/\(Name\) Tj/g)?.length).toBe(pages);
    expect(pdf).toContain(`(Page ${pages} of ${pages}) Tj`);
  });

  it("leaves pdf: false columns out", () => {
    expect(renderPdf(report)).not.toContain("(Secret)");
  });

  it("escapes brackets and shows unsupported characters as a question mark", () => {
    expect(renderPdf(report)).toContain("(Members \\(all\\)) Tj");
    expect(toWinAnsi("রহমান ₹ é €")).toEqual([63, 63, 63, 63, 63, 32, 63, 32, 0xe9, 32, 0x80]);
  });

  it("cuts a cell that does not fit with an ellipsis", () => {
    const pdf = renderPdf({ ...report, tables: [{ title: "T", columns: [{ label: "A" }, { label: "B", weight: 20 }], rows: [["x".repeat(200), "y"]] }] });
    expect(pdf).toMatch(/\(x+\\205\) Tj/);
  });

  it("uses a landscape page when asked", () => {
    expect(renderPdf({ ...report, landscape: true })).toContain("/MediaBox [0 0 841.89 595.28]");
    expect(renderPdf(report)).toContain("/MediaBox [0 0 595.28 841.89]");
  });
});

describe("exportFileName and reportMeta", () => {
  const now = new Date("2026-10-25T10:00:00Z");

  it("makes a lowercase, safe name", () => {
    expect(exportFileName(["Revenue", "live", "30d"], "pdf", now)).toBe("memberframe-revenue-live-30d-2026-10-25.pdf");
    expect(exportFileName(["members", "Gold Plus!"], "csv", now)).toBe("memberframe-members-gold-plus-2026-10-25.csv");
  });

  it("says test figures are not real money", () => {
    expect(reportMeta({ mode: "test", period: "12m", now })[0]).toMatch(/no real money/);
    expect(reportMeta({ mode: "live", period: "12m", filters: ["Tier: Gold"], now })).toEqual([
      "Live payments",
      "Period: Last 12 months",
      "Tier: Gold",
      "Exported 2026-10-25",
    ]);
  });
});

describe("report documents", () => {
  it("every view renders to both formats", () => {
    const documents = [
      overviewDocument(REPORT, "live", "30d"),
      revenueDocument({ report: REPORT, mode: "live", period: "30d", tierLabel: "All tiers", payments: [PAYMENT], paymentsTotal: 1 }),
      subscriptionsDocument({ report: REPORT, mode: "live", period: "30d", statusLabel: "Paying", tierLabel: "All tiers", rows: [], total: 0 }),
      tiersDocument(REPORT, "live", "30d"),
      tierMembersDocument({ tierName: "Gold", mode: "live", members: [], total: 0 }),
      memberHistoryDocument(
        {
          member: { id: "m1", email: "ana@example.com", name: "Ana", activeTier: "gold", tierName: "Gold", status: "active", createdAt: "2026-01-02T00:00:00Z", lastLoginAt: null },
          lifetimeSpend: [{ currency: "INR", grossMinor: 125000, refundedMinor: 0, netMinor: 125000, payments: 1 }],
          subscriptions: [],
          payments: [],
        },
        "live"
      ),
    ];
    for (const document of documents) {
      checkXref(renderPdf(document));
      expect(reportCsv(document)).toContain(document.title);
    }
  });

  it("revenue keeps other currencies apart and the receipt in the CSV only", () => {
    const document = revenueDocument({ report: REPORT, mode: "live", period: "30d", tierLabel: "Gold", payments: [PAYMENT], paymentsTotal: 1 });
    const csv = reportCsv(document);
    expect(csv).toContain("Net in USD,USD 9.99,Not added to the figures above");
    expect(csv).toContain(`2026-10-20,"'=HYPERLINK(""x"")",ana@example.com,Gold,Monthly,1250.00,INR,Razorpay,Paid,https://example.com/r/1`);
    expect(renderPdf(document)).not.toContain("example.com/r/1");
  });

  it("says when a list was cut at the export cap", () => {
    const document = revenueDocument({ report: REPORT, mode: "live", period: "30d", tierLabel: "All tiers", payments: [PAYMENT], paymentsTotal: 7000 });
    expect(document.tables.at(-1)?.note).toBe("The first 1 of 7000, newest first.");
  });
});
