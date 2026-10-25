/**
 * Each report view as an export document (see `services/reportExport.ts`).
 * Development doc: `docs/development-docs/24-reports.md`, section on exports.
 *
 * Pure: the view fetches, these arrange. An export holds what the view shows,
 * with the paged lists in full (up to the server's export cap), so a PDF is
 * the report on paper and a CSV is the same figures for a spreadsheet.
 */

import type { MemberHistory, OverviewReport, PaymentRow, ReportMode, ReportPeriod, SubscriptionRow } from "../../services/reportsService";
import { amountPlain, amountText, isoDate, reportMeta, type ReportDocument, type ReportTable } from "../../services/reportExport";
import { MEMBER_STATUS_LABELS, type MemberStatus } from "../../types/member";
import type { SiteMemberRecord } from "../../types/site";
import { INTERVAL_LABEL, PAYMENT_STATUS, SUBSCRIPTION_STATUS, gatewayLabel, inCurrency, monthLabel, totalsIn } from "./ReportParts";

const FOOTER = "MemberFrame report";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const percent = (part: number, whole: number) => (whole === 0 ? "0%" : `${Math.round((part / whole) * 100)}%`);
const interval = (value: string | null) => (value ? INTERVAL_LABEL[value] ?? value : "");

/** Measure, value, detail: the KPI tiles as a table. */
function figures(title: string, rows: ReadonlyArray<[string, string, string?]>): ReportTable {
  return {
    title,
    columns: [
      { label: "Measure", weight: 1.2 },
      { label: "Value", align: "right", weight: 1.1 },
      { label: "Detail", weight: 1.7 },
    ],
    rows: rows.map(([label, value, detail]) => [label, value, detail ?? ""]),
  };
}

const PAYMENT_COLUMNS: ReportTable["columns"] = [
  { label: "Date", weight: 0.9 },
  { label: "Member", weight: 1.6 },
  { label: "Email", weight: 1.8 },
  { label: "Tier", weight: 1.3 },
  { label: "Plan", weight: 0.7 },
  { label: "Amount", align: "right", weight: 0.8 },
  { label: "Currency", weight: 0.7 },
  { label: "Gateway", weight: 0.9 },
  { label: "Status", weight: 0.8 },
  { label: "Receipt", pdf: false },
];

function paymentRows(rows: ReadonlyArray<PaymentRow>): string[][] {
  return rows.map((row) => [
    isoDate(row.paidAt),
    row.member.name ?? "",
    row.member.email,
    row.tierName,
    interval(row.interval),
    amountPlain(row.amountMinor, row.currency),
    row.currency,
    gatewayLabel(row.gateway),
    PAYMENT_STATUS[row.status]?.label ?? row.status,
    row.receiptUrl ?? "",
  ]);
}

/** A line saying a list was cut at the export cap, or nothing. */
function capNote(shown: number, total: number): string | undefined {
  return total > shown ? `The first ${shown} of ${total}, newest first.` : undefined;
}

export function overviewDocument(report: OverviewReport, mode: ReportMode, period: ReportPeriod): ReportDocument {
  const currency = report.siteCurrency;
  const net = totalsIn(report.revenue.totals, currency);
  const { members, subscriptions, content } = report;

  const tables: ReportTable[] = [
    figures("Summary", [
      ["Members", String(members.total), `${members.newInPeriod} new`],
      ["Paying members", String(members.paying), `${percent(members.paying, members.total)} of members`],
      ["MRR", amountText(inCurrency(report.revenue.mrr, currency), currency), "Monthly recurring revenue"],
      ["Net revenue", amountText(net.netMinor, currency), "After refunds"],
      [
        "Active subscriptions",
        String(subscriptions.active + subscriptions.pastDue + subscriptions.canceling),
        `${subscriptions.pastDue} payment failed, ${subscriptions.canceling} canceling`,
      ],
      ["Ended subscriptions", String(subscriptions.endedInPeriod), "In the period"],
    ]),
    {
      title: "Members By Tier",
      columns: [{ label: "Tier", weight: 2 }, { label: "Members", align: "right" }, { label: "Share", align: "right" }],
      rows: members.byTier.map((tier) => [tier.name, String(tier.count), percent(tier.count, members.total)]),
      empty: "No tiers yet.",
    },
    {
      title: "Sign Ups By Month",
      note: "The last 12 months.",
      columns: [{ label: "Month", weight: 2 }, { label: "Sign ups", align: "right" }],
      rows: members.signupsByMonth.map((month) => [monthLabel(month.month, true), String(month.count)]),
    },
  ];

  // Like the view: these two appear only once there is something in them.
  if (content.topBookmarks.length > 0) {
    tables.push({
      title: "Most Saved",
      columns: [{ label: "Item", weight: 2 }, { label: "Address", weight: 2 }, { label: "Saves", align: "right", weight: 0.7 }],
      rows: content.topBookmarks.map((item) => [item.title, item.url || item.itemSlug, String(item.count)]),
    });
  }
  if (content.topDownloads.length > 0) {
    tables.push({
      title: "Most Downloaded",
      note: "Protected files, all time.",
      columns: [{ label: "File", weight: 2.5 }, { label: "Last download" }, { label: "Downloads", align: "right", weight: 0.7 }],
      rows: content.topDownloads.map((file) => [file.name, isoDate(file.lastDownloadAt), String(file.downloadCount)]),
    });
  }

  return { title: "Overview", meta: reportMeta({ mode, period }), tables, footer: FOOTER };
}

export function revenueDocument(input: {
  report: OverviewReport;
  mode: ReportMode;
  period: ReportPeriod;
  tierLabel: string;
  payments: ReadonlyArray<PaymentRow>;
  paymentsTotal: number;
}): ReportDocument {
  const { report, mode, period } = input;
  const currency = report.siteCurrency;
  const totals = totalsIn(report.revenue.totals, currency);
  const others = report.revenue.totals.filter((entry) => entry.currency !== currency);

  const tables: ReportTable[] = [
    figures("Summary", [
      ["Net revenue", amountText(totals.netMinor, currency), "After refunds"],
      ["Gross revenue", amountText(totals.grossMinor, currency), plural(totals.payments, "payment")],
      ["Refunded", amountText(totals.refundedMinor, currency), `${percent(totals.refundedMinor, totals.grossMinor)} of gross`],
      ["MRR", amountText(inCurrency(report.revenue.mrr, currency), currency), "Monthly recurring revenue"],
      ...others.map((entry): [string, string, string] => [`Net in ${entry.currency}`, amountText(entry.netMinor, entry.currency), "Not added to the figures above"]),
    ]),
    {
      title: "Revenue By Month",
      note: `Net, in ${currency}, the last 12 months.`,
      columns: [{ label: "Month", weight: 2 }, { label: "Payments", align: "right" }, { label: "Net", align: "right" }],
      rows: [...report.revenue.months].reverse().map((month) => {
        const row = report.revenue.byMonth.find((entry) => entry.month === month && entry.currency === currency);
        return [monthLabel(month, true), String(row?.payments ?? 0), amountText(row?.netMinor ?? 0, currency)];
      }),
    },
    {
      title: "By Tier",
      columns: [{ label: "Tier", weight: 2 }, { label: "Payments", align: "right" }, { label: "Net", align: "right" }],
      rows: report.revenue.byTier.map((row) => [row.name, String(row.payments), amountText(row.netMinor, row.currency)]),
      empty: "No payments in this period.",
    },
    {
      title: "By Gateway",
      columns: [{ label: "Gateway", weight: 2 }, { label: "Payments", align: "right" }, { label: "Net", align: "right" }],
      rows: report.revenue.byGateway.map((row) => [gatewayLabel(row.key), String(row.payments), amountText(row.netMinor, row.currency)]),
      empty: "No payments in this period.",
    },
    {
      title: "Payment History",
      note: capNote(input.payments.length, input.paymentsTotal),
      columns: PAYMENT_COLUMNS,
      rows: paymentRows(input.payments),
      empty: "No payments for this filter.",
    },
  ];

  return {
    title: "Revenue",
    meta: reportMeta({ mode, period, filters: [`Tier: ${input.tierLabel}`] }),
    tables,
    footer: FOOTER,
    landscape: true,
  };
}

export function subscriptionsDocument(input: {
  report: OverviewReport;
  mode: ReportMode;
  period: ReportPeriod;
  statusLabel: string;
  tierLabel: string;
  rows: ReadonlyArray<SubscriptionRow>;
  total: number;
}): ReportDocument {
  const { subscriptions } = input.report;

  const tables: ReportTable[] = [
    figures("Summary", [
      ["Active", String(subscriptions.active), "Paid and running"],
      ["Payment failed", String(subscriptions.pastDue), "In the grace period"],
      ["Canceling", String(subscriptions.canceling), "Ends at period end"],
      ["Started", String(subscriptions.startedInPeriod), "In the period"],
      ["Ended", String(subscriptions.endedInPeriod), "In the period"],
      ["Monthly", String(subscriptions.byInterval.month), "Running now"],
      ["Yearly", String(subscriptions.byInterval.year), "Running now"],
      ["Lifetime", String(subscriptions.byInterval.lifetime), "Running now"],
    ]),
    {
      title: "Paying By Tier",
      columns: [{ label: "Tier", weight: 2 }, { label: "Paying", align: "right" }],
      rows: subscriptions.byTier.filter((row) => row.count > 0).map((row) => [row.name, String(row.count)]),
      empty: "No paying subscriptions yet.",
    },
    {
      title: "Subscriptions",
      note: capNote(input.rows.length, input.total) ?? "Newest first.",
      columns: [
        { label: "Member", weight: 1.6 },
        { label: "Email", weight: 1.9 },
        { label: "Tier", weight: 1 },
        { label: "Plan", weight: 0.8 },
        { label: "Status", weight: 1 },
        { label: "Amount", align: "right", weight: 0.9 },
        { label: "Currency", weight: 0.7 },
        { label: "Gateway", weight: 1 },
        { label: "Started", weight: 0.9 },
        { label: "Renews or ends", weight: 1 },
      ],
      rows: input.rows.map((row) => [
        row.member.name ?? "",
        row.member.email,
        row.tierName,
        interval(row.interval),
        SUBSCRIPTION_STATUS[row.status]?.label ?? row.status,
        amountPlain(row.amountMinor, row.currency),
        row.currency,
        gatewayLabel(row.gateway),
        isoDate(row.startedAt),
        isoDate(row.endedAt ?? row.currentPeriodEnd),
      ]),
      empty: "No subscriptions for this filter.",
    },
  ];

  return {
    title: "Subscriptions",
    meta: reportMeta({ mode: input.mode, period: input.period, filters: [`Status: ${input.statusLabel}`, `Tier: ${input.tierLabel}`] }),
    tables,
    footer: FOOTER,
    landscape: true,
  };
}

/** Members, the tier list: members, paying, and net revenue per tier. */
export function tiersDocument(report: OverviewReport, mode: ReportMode, period: ReportPeriod): ReportDocument {
  const currency = report.siteCurrency;
  const revenueFor = (key: string) =>
    report.revenue.byTier.filter((row) => row.key === key && row.currency === currency).reduce((sum, row) => sum + row.netMinor, 0);

  return {
    title: "Members By Tier",
    meta: reportMeta({ mode, period }),
    tables: [
      {
        title: "Tiers",
        note: "Members and paying members now, net revenue in the period.",
        columns: [
          { label: "Tier", weight: 2 },
          { label: "Type" },
          { label: "Members", align: "right" },
          { label: "Paying", align: "right" },
          { label: "Net revenue", align: "right", weight: 1.4 },
        ],
        rows: [...report.members.byTier]
          .sort((a, b) => b.rank - a.rank)
          .map((row) => [
            row.name,
            row.rank === 0 ? "Free" : "Paid",
            String(row.count),
            String(report.subscriptions.byTier.find((entry) => entry.key === row.key)?.count ?? 0),
            amountText(revenueFor(row.key), currency),
          ]),
        empty: "No tiers yet.",
      },
    ],
    footer: FOOTER,
  };
}

/** Members, one tier's members. */
export function tierMembersDocument(input: {
  tierName: string;
  mode: ReportMode;
  members: ReadonlyArray<SiteMemberRecord>;
  total: number;
}): ReportDocument {
  return {
    title: `${input.tierName} Members`,
    meta: reportMeta({ mode: input.mode, filters: [`Tier: ${input.tierName}`] }),
    tables: [
      {
        title: "Members",
        note: capNote(input.members.length, input.total) ?? plural(input.total, "member"),
        columns: [
          { label: "Member", weight: 1.6 },
          { label: "Email", weight: 2.2 },
          { label: "Status" },
          { label: "Joined", weight: 0.9 },
          { label: "Lifetime spend", align: "right", weight: 1.3 },
        ],
        rows: input.members.map((member) => [
          member.name ?? "",
          member.email,
          MEMBER_STATUS_LABELS[member.status as MemberStatus] ?? member.status,
          isoDate(member.createdAt),
          amountText(member.lifetimeSpend, member.currency),
        ]),
        empty: "Nobody on this tier.",
      },
    ],
    footer: FOOTER,
    landscape: true,
  };
}

/** Members, one member's subscriptions and payments. */
export function memberHistoryDocument(history: MemberHistory, mode: ReportMode): ReportDocument {
  const { member } = history;
  const spend = history.lifetimeSpend;

  return {
    title: member.name ?? member.email,
    meta: reportMeta({ mode, filters: [member.email] }),
    tables: [
      figures("Member", [
        ["Tier", member.tierName],
        ["Status", MEMBER_STATUS_LABELS[member.status as MemberStatus] ?? member.status],
        ["Joined", isoDate(member.createdAt)],
        ["Last sign in", isoDate(member.lastLoginAt) || "Never"],
        ...spend.map((entry): [string, string, string] => ["Lifetime spend", amountText(entry.netMinor, entry.currency), plural(entry.payments, "payment")]),
      ]),
      {
        title: "Subscriptions",
        columns: [
          { label: "Tier", weight: 1.3 },
          { label: "Plan", weight: 0.8 },
          { label: "Status" },
          { label: "Gateway" },
          { label: "Started", weight: 0.9 },
          { label: "Ended", weight: 0.9 },
          { label: "Amount", align: "right", weight: 1.2 },
        ],
        rows: history.subscriptions.map((row) => [
          row.tierName,
          interval(row.interval),
          SUBSCRIPTION_STATUS[row.status]?.label ?? row.status,
          gatewayLabel(row.gateway),
          isoDate(row.startedAt),
          isoDate(row.endedAt),
          amountText(row.amountMinor, row.currency),
        ]),
        empty: "No subscriptions.",
      },
      {
        title: "Payments",
        columns: [
          { label: "Date", weight: 0.9 },
          { label: "Tier", weight: 1.3 },
          { label: "Gateway" },
          { label: "Status" },
          { label: "Amount", align: "right", weight: 1.2 },
          { label: "Receipt", pdf: false },
        ],
        rows: history.payments.map((row) => [
          isoDate(row.paidAt),
          row.tierName,
          gatewayLabel(row.gateway),
          PAYMENT_STATUS[row.status]?.label ?? row.status,
          amountText(row.amountMinor, row.currency),
          row.receiptUrl ?? "",
        ]),
        empty: "No payments.",
      },
    ],
    footer: FOOTER,
  };
}
