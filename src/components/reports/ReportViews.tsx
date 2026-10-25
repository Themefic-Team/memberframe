import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Crown, Gift, Users } from "lucide-react";
import { Badge, Banner, EmptyState, IconButton, Select } from "../ui";
import { MemberRow } from "../manage/MemberRow";
import { failureMessage, type ApiFailure } from "../../services/apiClient";
import { fetchMembers } from "../../services/siteService";
import {
  REPORT_EXPORT_MAX,
  fetchMemberHistory,
  fetchPayments,
  fetchSubscriptions,
  type MemberHistory,
  type OverviewReport,
  type PaymentRow,
  type ReportMode,
  type ReportPage,
  type ReportPeriod,
  type SubscriptionRow,
  type SubscriptionStatusFilter,
} from "../../services/reportsService";
import type { SiteMemberRecord } from "../../types/site";
import { MEMBER_PAGE_SIZE } from "../../types/site";
import {
  ColumnChart,
  INTERVAL_LABEL,
  PAYMENT_STATUS,
  Pager,
  ReportExport,
  ReportRow,
  SUBSCRIPTION_STATUS,
  StatTile,
  date,
  gatewayLabel,
  inCurrency,
  money,
  monthLabel,
  totalsIn,
} from "./ReportParts";
import {
  memberHistoryDocument,
  overviewDocument,
  revenueDocument,
  subscriptionsDocument,
  tierMembersDocument,
  tiersDocument,
} from "./reportDocuments";

/** Members per request when exporting a tier's list. */
const MEMBER_EXPORT_PAGE = 500;

const labelOf = (options: ReadonlyArray<{ value: string; label: string }>, value: string) =>
  options.find((option) => option.value === value)?.label ?? value;

interface ViewProps {
  report: OverviewReport;
  siteId: string;
  mode: ReportMode;
  period: ReportPeriod;
}

const PERIOD_WORDS: Record<ReportPeriod, string> = {
  "30d": "in the last 30 days",
  "90d": "in the last 90 days",
  "12m": "in the last 12 months",
  all: "all time",
};

function percent(part: number, whole: number): string {
  return whole === 0 ? "0%" : `${Math.round((part / whole) * 100)}%`;
}

const Heading: React.FC<{ title: string; subtitle?: string; children?: React.ReactNode }> = ({ title, subtitle, children }) => (
  <div className="section-header">
    <div className="report-filters">
      <h2 className="section-title">{title}</h2>
      {children}
    </div>
    {subtitle ? <p className="section-subtitle">{subtitle}</p> : null}
  </div>
);

/* ==========================================================================
   OVERVIEW
   ========================================================================== */

export const OverviewView: React.FC<ViewProps> = ({ report, mode, period }) => {
  const currency = report.siteCurrency;
  const net = totalsIn(report.revenue.totals, currency);
  const { members, subscriptions, content } = report;

  return (
    <div className="report-stack">
      <ReportExport build={async () => overviewDocument(report, mode, period)} fileParts={["overview", mode, period]} />
      <div className="report-kpis">
        <StatTile label="Members" value={String(members.total)} sub={`${members.newInPeriod} new ${PERIOD_WORDS[period]}`} />
        <StatTile label="Paying members" value={String(members.paying)} sub={`${percent(members.paying, members.total)} of members`} />
        <StatTile label="MRR" value={money(inCurrency(report.revenue.mrr, currency), currency)} sub="Monthly recurring revenue" />
        <StatTile label="Net revenue" value={money(net.netMinor, currency)} sub={`After refunds, ${PERIOD_WORDS[period]}`} />
        <StatTile
          label="Active subscriptions"
          value={String(subscriptions.active + subscriptions.pastDue + subscriptions.canceling)}
          sub={`${subscriptions.pastDue} payment failed, ${subscriptions.canceling} canceling`}
        />
        <StatTile label="Ended" value={String(subscriptions.endedInPeriod)} sub={`Subscriptions ${PERIOD_WORDS[period]}`} />
      </div>

      <section className="section-group">
        <Heading title="Members By Tier" />
        <div className="report-table">
          {members.byTier.map((tier) => (
            <ReportRow key={tier.key} title={tier.name} sub={`${percent(tier.count, members.total)} of members`} figure={tier.count} />
          ))}
        </div>
      </section>

      <section className="section-group">
        <Heading title="Sign Ups" subtitle="New members each month, the last 12 months." />
        <ColumnChart
          label="Sign ups per month"
          summary={`${members.signupsByMonth.reduce((sum, month) => sum + month.count, 0)} in 12 months`}
          points={members.signupsByMonth.map((month) => ({
            month: month.month,
            value: month.count,
            display: `${month.count} sign up${month.count === 1 ? "" : "s"}`,
          }))}
        />
      </section>

      {content.topBookmarks.length > 0 ? (
        <section className="section-group">
          <Heading title="Most Saved" subtitle="What members bookmark most." />
          <div className="report-table">
            {content.topBookmarks.map((item) => (
              <ReportRow key={item.itemSlug} title={item.title} sub={item.url || item.itemSlug} figure={item.count} />
            ))}
          </div>
        </section>
      ) : null}

      {content.topDownloads.length > 0 ? (
        <section className="section-group">
          <Heading title="Most Downloaded" subtitle="Protected files, all time." />
          <div className="report-table">
            {content.topDownloads.map((file) => (
              <ReportRow key={file.id} title={file.name} sub={file.lastDownloadAt ? `Last ${date(file.lastDownloadAt)}` : undefined} figure={file.downloadCount} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
};

/* ==========================================================================
   REVENUE
   ========================================================================== */

export const RevenueView: React.FC<ViewProps & { tierOptions: ReadonlyArray<{ value: string; label: string }> }> = ({
  report,
  siteId,
  mode,
  period,
  tierOptions,
}) => {
  const currency = report.siteCurrency;
  const totals = totalsIn(report.revenue.totals, currency);
  const others = report.revenue.totals.filter((entry) => entry.currency !== currency);
  const monthly = report.revenue.months.map((month) => {
    const row = report.revenue.byMonth.find((entry) => entry.month === month && entry.currency === currency);
    const value = row?.netMinor ?? 0;
    return { month, value, display: money(value, currency) };
  });

  const [tier, setTier] = useState("");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<(ReportPage<PaymentRow>) | null>(null);
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  useEffect(() => setPage(1), [tier, mode, period]);
  useEffect(() => {
    let active = true;
    setList(null);
    void fetchPayments({ siteId, mode, period, tier, page }).then((result) => {
      if (!active) return;
      if (result.kind === "ok") setList(result.data);
      else setFailure(result);
    });
    return () => {
      active = false;
    };
  }, [siteId, mode, period, tier, page]);

  /** The whole report, with every payment for the filter up to the export cap. */
  const buildExport = async () => {
    const result = await fetchPayments({ siteId, mode, period, tier, page: 1, pageSize: REPORT_EXPORT_MAX });
    if (result.kind !== "ok") throw new Error(failureMessage(result).message);
    return revenueDocument({
      report,
      mode,
      period,
      tierLabel: labelOf(tierOptions, tier),
      payments: result.data.rows,
      paymentsTotal: result.data.total,
    });
  };

  return (
    <div className="report-stack">
      <ReportExport build={buildExport} fileParts={["revenue", mode, period]} />
      <div className="report-kpis">
        <StatTile label="Net revenue" value={money(totals.netMinor, currency)} sub={PERIOD_WORDS[period]} />
        <StatTile label="Payments" value={String(totals.payments)} sub={`Gross ${money(totals.grossMinor, currency)}`} />
        <StatTile label="Refunded" value={money(totals.refundedMinor, currency)} sub={`${percent(totals.refundedMinor, totals.grossMinor)} of gross`} />
        <StatTile label="MRR" value={money(inCurrency(report.revenue.mrr, currency), currency)} sub="Monthly recurring revenue" />
      </div>

      {others.length > 0 ? (
        <Banner
          tone="info"
          title="Payments in other currencies"
          message={others.map((entry) => `${money(entry.netMinor, entry.currency)} net in ${entry.currency}`).join(". ") + ". Not added to the figures above."}
        />
      ) : null}

      <section className="section-group">
        <Heading title="Revenue By Month" subtitle={`Net, in ${currency}, the last 12 months.`} />
        <ColumnChart
          label="Net revenue per month"
          summary={`${money(monthly.reduce((sum, point) => sum + point.value, 0), currency)} in 12 months`}
          points={monthly}
        />
        <div className="report-table">
          {[...monthly].reverse().map((point) => (
            <ReportRow key={point.month} title={monthLabel(point.month, true)} figure={point.display} />
          ))}
        </div>
      </section>

      <section className="section-group">
        <Heading title="By Tier" subtitle={`Net ${PERIOD_WORDS[period]}.`} />
        <div className="report-table">
          {report.revenue.byTier.length === 0 ? <p className="report-empty">No payments in this period.</p> : null}
          {report.revenue.byTier.map((row) => (
            <ReportRow key={`${row.key}-${row.currency}`} title={row.name} sub={`${row.payments} payment${row.payments === 1 ? "" : "s"}`} figure={money(row.netMinor, row.currency)} />
          ))}
        </div>
      </section>

      <section className="section-group">
        <Heading title="By Gateway" />
        <div className="report-table">
          {report.revenue.byGateway.length === 0 ? <p className="report-empty">No payments in this period.</p> : null}
          {report.revenue.byGateway.map((row) => (
            <ReportRow key={`${row.key}-${row.currency}`} title={gatewayLabel(row.key)} sub={`${row.payments} payment${row.payments === 1 ? "" : "s"}`} figure={money(row.netMinor, row.currency)} />
          ))}
        </div>
      </section>

      <section className="section-group">
        <Heading title="Payment History">
          <Select label="Tier" value={tier} options={tierOptions} onChange={setTier} />
        </Heading>
        {failure ? <Banner tone="warning" title="Could not load payments" message={failureMessage(failure).message} /> : null}
        <div className="report-table">
          {list === null ? <p className="report-empty">Loading payments.</p> : null}
          {list && list.rows.length === 0 ? <p className="report-empty">No payments for this filter.</p> : null}
          {list?.rows.map((row) => (
            <ReportRow
              key={row.id}
              title={row.member.name ?? row.member.email}
              sub={`${row.tierName}, ${gatewayLabel(row.gateway)}, ${date(row.paidAt)}`}
              figure={money(row.amountMinor, row.currency)}
            >
              <Badge tone={PAYMENT_STATUS[row.status]?.tone ?? "neutral"}>{PAYMENT_STATUS[row.status]?.label ?? row.status}</Badge>
            </ReportRow>
          ))}
        </div>
        {list ? <Pager page={list.page} pageSize={list.pageSize} total={list.total} onPage={setPage} /> : null}
      </section>
    </div>
  );
};

/* ==========================================================================
   SUBSCRIPTIONS
   ========================================================================== */

const STATUS_OPTIONS: ReadonlyArray<{ value: SubscriptionStatusFilter; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "paying", label: "Paying" },
  { value: "active", label: "Active" },
  { value: "past_due", label: "Payment failed" },
  { value: "canceling", label: "Canceling" },
  { value: "ended", label: "Ended" },
];

export const SubscriptionsView: React.FC<ViewProps & { tierOptions: ReadonlyArray<{ value: string; label: string }> }> = ({
  report,
  siteId,
  mode,
  period,
  tierOptions,
}) => {
  const { subscriptions } = report;
  const [status, setStatus] = useState<SubscriptionStatusFilter>("paying");
  const [tier, setTier] = useState("");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<ReportPage<SubscriptionRow> | null>(null);
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  useEffect(() => setPage(1), [status, tier, mode]);
  useEffect(() => {
    let active = true;
    setList(null);
    void fetchSubscriptions({ siteId, mode, status, tier, page }).then((result) => {
      if (!active) return;
      if (result.kind === "ok") setList(result.data);
      else setFailure(result);
    });
    return () => {
      active = false;
    };
  }, [siteId, mode, status, tier, page]);

  /** The whole report, with every subscription for the filters up to the export cap. */
  const buildExport = async () => {
    const result = await fetchSubscriptions({ siteId, mode, status, tier, page: 1, pageSize: REPORT_EXPORT_MAX });
    if (result.kind !== "ok") throw new Error(failureMessage(result).message);
    return subscriptionsDocument({
      report,
      mode,
      period,
      statusLabel: labelOf(STATUS_OPTIONS, status),
      tierLabel: labelOf(tierOptions, tier),
      rows: result.data.rows,
      total: result.data.total,
    });
  };

  const when = (row: SubscriptionRow) =>
    row.endedAt ? `Ended ${date(row.endedAt)}` : row.interval === "lifetime" ? `Since ${date(row.startedAt)}` : row.currentPeriodEnd ? `${row.status === "canceling" ? "Ends" : "Renews"} ${date(row.currentPeriodEnd)}` : `Since ${date(row.startedAt)}`;

  return (
    <div className="report-stack">
      <ReportExport build={buildExport} fileParts={["subscriptions", mode, status]} />
      <div className="report-kpis">
        <StatTile label="Active" value={String(subscriptions.active)} sub="Paid and running" />
        <StatTile label="Payment failed" value={String(subscriptions.pastDue)} sub="In the grace period" />
        <StatTile label="Canceling" value={String(subscriptions.canceling)} sub="Ends at period end" />
        <StatTile label="Started" value={String(subscriptions.startedInPeriod)} sub={PERIOD_WORDS[period]} />
        <StatTile label="Ended" value={String(subscriptions.endedInPeriod)} sub={PERIOD_WORDS[period]} />
        <StatTile
          label="By plan"
          value={`${subscriptions.byInterval.month} / ${subscriptions.byInterval.year} / ${subscriptions.byInterval.lifetime}`}
          sub="Monthly, yearly, lifetime"
        />
      </div>

      <section className="section-group">
        <Heading title="Paying By Tier" />
        <div className="report-table">
          {subscriptions.byTier.filter((row) => row.count > 0).length === 0 ? <p className="report-empty">No paying subscriptions yet.</p> : null}
          {subscriptions.byTier
            .filter((row) => row.count > 0)
            .map((row) => (
              <ReportRow key={row.key} title={row.name} figure={row.count} />
            ))}
        </div>
      </section>

      <section className="section-group">
        <Heading title="Subscriptions" subtitle="Newest first." />
        <div className="report-filters">
          <Select label="Status" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
          <Select label="Tier" value={tier} options={tierOptions} onChange={setTier} />
        </div>
        {failure ? <Banner tone="warning" title="Could not load subscriptions" message={failureMessage(failure).message} /> : null}
        <div className="report-table">
          {list === null ? <p className="report-empty">Loading subscriptions.</p> : null}
          {list && list.rows.length === 0 ? <p className="report-empty">No subscriptions for this filter.</p> : null}
          {list?.rows.map((row) => (
            <ReportRow
              key={row.id}
              title={row.member.name ?? row.member.email}
              sub={`${row.tierName}, ${INTERVAL_LABEL[row.interval] ?? row.interval}, ${when(row)}`}
              figure={money(row.amountMinor, row.currency)}
            >
              <Badge tone={SUBSCRIPTION_STATUS[row.status]?.tone ?? "neutral"}>{SUBSCRIPTION_STATUS[row.status]?.label ?? row.status}</Badge>
            </ReportRow>
          ))}
        </div>
        {list ? <Pager page={list.page} pageSize={list.pageSize} total={list.total} onPage={setPage} /> : null}
      </section>
    </div>
  );
};

/* ==========================================================================
   MEMBERS: by tier, a tier's members, a member's history

   The same pieces as Manage, so the two tabs read as one product: a tier is
   the Tiers card (icon, name, figures, chevron), a member is Manage's own
   MemberRow, and the count line and pager are the members list's.
   ========================================================================== */

export const MembersView: React.FC<ViewProps> = ({ report, siteId, mode, period }) => {
  const currency = report.siteCurrency;
  const [tier, setTier] = useState<{ key: string; name: string; rank: number } | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);

  const revenueFor = (key: string) =>
    report.revenue.byTier.filter((row) => row.key === key && row.currency === currency).reduce((sum, row) => sum + row.netMinor, 0);

  if (memberId) {
    return <MemberHistoryView siteId={siteId} memberId={memberId} mode={mode} currency={currency} onBack={() => setMemberId(null)} />;
  }
  if (tier) return <TierMembersView siteId={siteId} mode={mode} tier={tier} onBack={() => setTier(null)} onMember={setMemberId} />;

  return (
    <div className="report-stack">
      <ReportExport build={async () => tiersDocument(report, mode, period)} fileParts={["members-by-tier", mode, period]} />
      <section className="section-group">
        <Heading title="By Tier" subtitle={`Members and paying members now, net revenue ${PERIOD_WORDS[period]}. Open a tier to see its members.`} />
        <div className="integration-grid">
          {[...report.members.byTier].sort((a, b) => b.rank - a.rank).map((row) => {
            const paying = report.subscriptions.byTier.find((entry) => entry.key === row.key)?.count ?? 0;
            const free = row.rank === 0;
            return (
              <article key={row.key} className="integration-card">
                <div
                  className="integration-card-bar"
                  role="button"
                  tabIndex={0}
                  onClick={() => setTier({ key: row.key, name: row.name, rank: row.rank })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setTier({ key: row.key, name: row.name, rank: row.rank });
                    }
                  }}
                >
                  <div className="integration-card-bar-left">
                    <span className="integration-card-icon">{free ? <Gift aria-hidden={true} /> : <Crown aria-hidden={true} />}</span>
                    <div className="integration-card-text">
                      <span className="integration-card-title">{row.name}</span>
                      <span className="integration-card-sub">
                        {`${row.count} member${row.count === 1 ? "" : "s"}, ${paying} paying. ${money(revenueFor(row.key), currency)} net`}
                      </span>
                    </div>
                  </div>
                  <div className="integration-card-bar-right">
                    <Badge tone={free ? "neutral" : "brand"}>{free ? "Free" : "Paid"}</Badge>
                    <span className="integration-chevron">
                      <ChevronRight aria-hidden={true} />
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
};

const TierMembersView: React.FC<{
  siteId: string;
  mode: ReportMode;
  tier: { key: string; name: string; rank: number };
  onBack: () => void;
  onMember: (id: string) => void;
}> = ({ siteId, mode, tier, onBack, onMember }) => {
  const [page, setPage] = useState(1);
  const [members, setMembers] = useState<{ rows: ReadonlyArray<SiteMemberRecord>; total: number } | null>(null);
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  useEffect(() => {
    let active = true;
    setMembers(null);
    void fetchMembers({ siteId, page, tier: tier.key }).then((result) => {
      if (!active) return;
      if (result.kind === "ok") setMembers({ rows: result.data.members, total: result.data.totalCount });
      else setFailure(result);
    });
    return () => {
      active = false;
    };
  }, [siteId, tier.key, page]);

  /**
   * Every member on the tier, up to the export cap. Page by page, at the size
   * the server answers with: an older server ignores the larger size and
   * sends 25, which still gets there.
   */
  const buildExport = async () => {
    const rows: SiteMemberRecord[] = [];
    let total = 0;
    for (let next = 1; rows.length < REPORT_EXPORT_MAX; next += 1) {
      const result = await fetchMembers({ siteId, page: next, tier: tier.key, pageSize: MEMBER_EXPORT_PAGE });
      if (result.kind !== "ok") throw new Error(failureMessage(result).message);
      total = result.data.totalCount;
      rows.push(...result.data.members);
      if (result.data.members.length === 0 || rows.length >= total) break;
    }
    return tierMembersDocument({ tierName: tier.name, mode, members: rows.slice(0, REPORT_EXPORT_MAX), total });
  };

  return (
    <div className="report-stack">
      <BackHeader title={tier.name} backLabel="Back to all tiers" onBack={onBack} />
      <ReportExport build={buildExport} fileParts={["members", tier.name]} disabled={members?.total === 0} />
      {failure ? <Banner tone="warning" title="Could not load members" message={failureMessage(failure).message} /> : null}

      {members === null && !failure ? (
        <div className="members-list" aria-busy={true} aria-label="Loading members">
          {[0, 1].map((index) => (
            <div key={index} className="member-row-skeleton" />
          ))}
        </div>
      ) : null}

      {members && members.rows.length === 0 ? (
        <EmptyState icon={<Users aria-hidden={true} />} title="Nobody On This Tier" description="Members appear here when they join or buy this tier." />
      ) : null}

      {members && members.rows.length > 0 ? (
        <>
          <p className="members-count">
            {members.total} member{members.total === 1 ? "" : "s"}. Open one to see every subscription and payment.
          </p>
          <div className="members-list">
            {members.rows.map((member) => (
              <MemberRow key={member.id} member={member} selected={false} onSelect={() => onMember(member.id)} />
            ))}
          </div>
          <Pager page={page} pageSize={MEMBER_PAGE_SIZE} total={members.total} onPage={setPage} />
        </>
      ) : null}
    </div>
  );
};

const MemberHistoryView: React.FC<{ siteId: string; memberId: string; mode: ReportMode; currency: string; onBack: () => void }> = ({
  siteId,
  memberId,
  mode,
  currency,
  onBack,
}) => {
  const [history, setHistory] = useState<MemberHistory | null>(null);
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  useEffect(() => {
    let active = true;
    void fetchMemberHistory(siteId, memberId, mode).then((result) => {
      if (!active) return;
      if (result.kind === "ok") setHistory(result.data);
      else setFailure(result);
    });
    return () => {
      active = false;
    };
  }, [siteId, memberId, mode]);

  const spend = useMemo(() => history?.lifetimeSpend ?? [], [history]);

  return (
    <div className="report-stack">
      <BackHeader title={history ? history.member.name ?? history.member.email : "Member"} backLabel="Back to the tier" onBack={onBack} />
      <ReportExport
        build={async () => {
          if (!history) throw new Error("This member is still loading.");
          return memberHistoryDocument(history, mode);
        }}
        fileParts={["member", history?.member.name ?? history?.member.email ?? "history", mode]}
        disabled={history === null}
      />
      {failure ? <Banner tone="warning" title="Could not load this member" message={failureMessage(failure).message} /> : null}

      {history === null && !failure ? (
        <div className="members-list" aria-busy={true} aria-label="Loading history">
          {[0, 1].map((index) => (
            <div key={index} className="member-row-skeleton" />
          ))}
        </div>
      ) : null}

      {history ? (
        <>
          <div className="report-kpis">
            <StatTile label="Tier" value={history.member.tierName} sub={`Joined ${date(history.member.createdAt)}`} />
            <StatTile
              label="Lifetime spend"
              value={spend.length ? spend.map((entry) => money(entry.netMinor, entry.currency)).join(", ") : money(0, currency)}
              sub={`${spend.reduce((sum, entry) => sum + entry.payments, 0)} payments${history.member.name ? `, ${history.member.email}` : ""}`}
            />
          </div>

          <section className="section-group">
            <Heading title="Subscriptions" />
            <div className="report-table">
              {history.subscriptions.length === 0 ? <p className="report-empty">No subscriptions.</p> : null}
              {history.subscriptions.map((row) => (
                <ReportRow
                  key={row.id}
                  title={`${row.tierName}, ${INTERVAL_LABEL[row.interval] ?? row.interval}`}
                  sub={`${gatewayLabel(row.gateway)}, since ${date(row.startedAt)}${row.endedAt ? `, ended ${date(row.endedAt)}` : ""}`}
                  figure={money(row.amountMinor, row.currency)}
                >
                  <Badge tone={SUBSCRIPTION_STATUS[row.status]?.tone ?? "neutral"}>{SUBSCRIPTION_STATUS[row.status]?.label ?? row.status}</Badge>
                </ReportRow>
              ))}
            </div>
          </section>

          <section className="section-group">
            <Heading title="Payments" />
            <div className="report-table">
              {history.payments.length === 0 ? <p className="report-empty">No payments.</p> : null}
              {history.payments.map((row) => (
                <ReportRow key={row.id} title={`${row.tierName}, ${date(row.paidAt)}`} sub={gatewayLabel(row.gateway)} figure={money(row.amountMinor, row.currency)}>
                  <Badge tone={PAYMENT_STATUS[row.status]?.tone ?? "neutral"}>{PAYMENT_STATUS[row.status]?.label ?? row.status}</Badge>
                </ReportRow>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
};

/** A drill-down's title row: back, then the title on one line, aligned with the content. */
const BackHeader: React.FC<{ title: string; backLabel: string; onBack: () => void }> = ({ title, backLabel, onBack }) => (
  <div className="report-back">
    <IconButton label={backLabel} variant="ghost" onClick={onBack}>
      <ArrowLeft aria-hidden={true} />
    </IconButton>
    <h2 className="section-title report-back-title">{title}</h2>
  </div>
);
