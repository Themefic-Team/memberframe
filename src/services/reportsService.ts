/**
 * The Reports tab's API client. Development doc:
 * `docs/development-docs/24-reports.md`. The shapes are the backend's
 * `services/reportService.ts`, field for field.
 */

import { apiClient, type ApiClient, type ApiResult } from "./apiClient";

export type ReportMode = "live" | "test";
export type ReportPeriod = "30d" | "90d" | "12m" | "all";
export type SubscriptionStatusFilter = "all" | "paying" | "active" | "past_due" | "canceling" | "ended";

export interface Money {
  currency: string;
  amountMinor: number;
}

export interface TierCount {
  key: string;
  name: string;
  rank: number;
  count: number;
}

export interface RevenueTotals {
  currency: string;
  grossMinor: number;
  refundedMinor: number;
  netMinor: number;
  payments: number;
}

export interface GroupedRevenue {
  key: string;
  currency: string;
  netMinor: number;
  payments: number;
}

export interface OverviewReport {
  mode: ReportMode;
  period: ReportPeriod;
  from: string | null;
  siteCurrency: string;
  members: {
    total: number;
    newInPeriod: number;
    paying: number;
    byTier: TierCount[];
    byStatus: Record<string, number>;
    signupsByMonth: Array<{ month: string; count: number }>;
  };
  subscriptions: {
    active: number;
    pastDue: number;
    canceling: number;
    startedInPeriod: number;
    endedInPeriod: number;
    byInterval: { month: number; year: number; lifetime: number };
    byTier: TierCount[];
  };
  revenue: {
    totals: RevenueTotals[];
    mrr: Money[];
    byMonth: Array<{ month: string; currency: string; netMinor: number; payments: number }>;
    months: string[];
    byTier: Array<GroupedRevenue & { name: string }>;
    byGateway: GroupedRevenue[];
  };
  content: {
    topBookmarks: Array<{ itemSlug: string; title: string; url: string; count: number }>;
    topDownloads: Array<{ id: string; name: string; downloadCount: number; lastDownloadAt: string | null }>;
  };
}

export interface ReportMember {
  id: string;
  email: string;
  name: string | null;
}

export interface SubscriptionRow {
  id: string;
  member: ReportMember;
  tierKey: string;
  tierName: string;
  interval: string;
  status: string;
  gateway: string;
  amountMinor: number;
  currency: string;
  startedAt: string;
  currentPeriodEnd: string | null;
  endedAt: string | null;
}

export interface PaymentRow {
  id: string;
  member: ReportMember;
  tierKey: string;
  tierName: string;
  interval: string | null;
  amountMinor: number;
  currency: string;
  gateway: string;
  status: string;
  paidAt: string;
  receiptUrl: string | null;
}

export interface ReportPage<Row> {
  total: number;
  page: number;
  pageSize: number;
  rows: Row[];
}

export interface MemberHistory {
  member: ReportMember & {
    activeTier: string;
    tierName: string;
    status: string;
    createdAt: string;
    lastLoginAt: string | null;
  };
  lifetimeSpend: RevenueTotals[];
  subscriptions: Array<Omit<SubscriptionRow, "member">>;
  payments: Array<{ id: string; amountMinor: number; currency: string; gateway: string; status: string; paidAt: string; receiptUrl: string | null; tierName: string }>;
}

/** An export asks for this many rows at once, the server's cap. */
export const REPORT_EXPORT_MAX = 5000;

export function fetchOverview(
  siteId: string,
  mode: ReportMode,
  period: ReportPeriod,
  client: ApiClient = apiClient
): Promise<ApiResult<OverviewReport>> {
  return client.get("/api/site/reports/overview", { siteId, mode, period });
}

export function fetchSubscriptions(
  query: { siteId: string; mode: ReportMode; status: SubscriptionStatusFilter; tier: string; page: number; pageSize?: number },
  client: ApiClient = apiClient
): Promise<ApiResult<ReportPage<SubscriptionRow>>> {
  return client.get("/api/site/reports/subscriptions", { ...query, tier: query.tier || undefined });
}

export function fetchPayments(
  query: { siteId: string; mode: ReportMode; period: ReportPeriod; tier: string; memberId?: string; page: number; pageSize?: number },
  client: ApiClient = apiClient
): Promise<ApiResult<ReportPage<PaymentRow> & { totals: RevenueTotals[] }>> {
  return client.get("/api/site/reports/payments", { ...query, tier: query.tier || undefined, memberId: query.memberId || undefined });
}

export function fetchMemberHistory(
  siteId: string,
  memberId: string,
  mode: ReportMode,
  client: ApiClient = apiClient
): Promise<ApiResult<MemberHistory>> {
  return client.get(`/api/site/reports/members/${encodeURIComponent(memberId)}`, { siteId, mode });
}

/**
 * Rows to CSV text. Every cell is quoted when it holds a comma, quote, or line
 * break, and a cell starting with = + - or @ is prefixed with a quote mark so a
 * spreadsheet shows it as text instead of running it as a formula: a member's
 * name is typed by the member.
 */
export function toCsv(header: ReadonlyArray<string>, rows: ReadonlyArray<ReadonlyArray<string | number | null>>): string {
  const cell = (value: string | number | null) => {
    let text = value === null ? "" : String(value);
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
}

/**
 * Save text as a file. A link with `download`, the one way a page in an
 * iframe can hand the browser a file; it answers false where the plugin frame
 * refuses, so the caller can say so.
 */
export function downloadFile(fileName: string, content: string, type: string): boolean {
  try {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}
