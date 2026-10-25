import React, { useEffect, useMemo, useState } from "react";
import { Link2 } from "lucide-react";
import { Banner, EmptyState, Segmented, Select, Skeleton, SkeletonList } from "../ui";
import { useConnection } from "../../hooks/useConnection";
import { failureMessage, type ApiFailure } from "../../services/apiClient";
import { fetchPayments as fetchPaymentSettings } from "../../services/paymentsService";
import { fetchOverview, type OverviewReport, type ReportMode, type ReportPeriod } from "../../services/reportsService";
import { MembersView, OverviewView, RevenueView, SubscriptionsView } from "../reports/ReportViews";

type ReportView = "overview" | "revenue" | "subscriptions" | "members";

const VIEWS: ReadonlyArray<{ value: ReportView; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "revenue", label: "Revenue" },
  // "Plans", not "Subscriptions": four labels must fit a 360px panel. The view's heading says Subscriptions.
  { value: "subscriptions", label: "Plans" },
  { value: "members", label: "Members" },
];

const MODES: ReadonlyArray<{ value: ReportMode; label: string }> = [
  { value: "live", label: "Live" },
  { value: "test", label: "Test" },
];

const PERIODS: ReadonlyArray<{ value: ReportPeriod; label: string }> = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
  { value: "all", label: "All time" },
];

/**
 * Reports. Development doc: `docs/development-docs/24-reports.md`.
 *
 * Live or Test and a period sit above four views. Live or Test starts on the
 * site's own mode, because a test card's payment is not income and a creator
 * still testing wants to see their test checkouts. Every figure comes from
 * the backend's report routes; nothing is computed from samples.
 */
export const ReportsTab: React.FC = () => {
  const { connection } = useConnection();
  const siteId = connection?.siteId ?? null;

  const [view, setView] = useState<ReportView>("overview");
  const [mode, setMode] = useState<ReportMode | null>(null);
  const [period, setPeriod] = useState<ReportPeriod>("30d");
  const [report, setReport] = useState<OverviewReport | null>(null);
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  // Start on the mode the site sells in.
  useEffect(() => {
    if (!siteId) return;
    let active = true;
    void fetchPaymentSettings(siteId).then((result) => {
      if (active) setMode(result.kind === "ok" ? result.data.settings.mode : "live");
    });
    return () => {
      active = false;
    };
  }, [siteId]);

  useEffect(() => {
    if (!siteId || !mode) return;
    let active = true;
    setFailure(null);
    void fetchOverview(siteId, mode, period).then((result) => {
      if (!active) return;
      if (result.kind === "ok") setReport(result.data);
      else {
        setReport(null);
        setFailure(result);
      }
    });
    return () => {
      active = false;
    };
  }, [siteId, mode, period]);

  const tierOptions = useMemo(
    () => [{ value: "", label: "All tiers" }, ...(report?.members.byTier ?? []).map((tier) => ({ value: tier.key, label: tier.name }))],
    [report]
  );

  if (!siteId) {
    return (
      <div className="tab-panel-body">
        <EmptyState
          icon={<Link2 aria-hidden={true} />}
          title="Connect this project first"
          description="Reports read the members and payments of a connected site. Open Account, top right, to link one."
        />
      </div>
    );
  }

  return (
    <div className="tab-panel-body">
      <div className="report-filters">
        <Segmented label="Payments mode" options={MODES} value={mode ?? "live"} onChange={setMode} />
        <Select label="Period" value={period} options={PERIODS} onChange={setPeriod} />
      </div>

      <Segmented label="Report" options={VIEWS} value={view} onChange={setView} />

      {mode === "test" ? (
        <Banner tone="info" title="Test mode" message="Figures from test checkouts. No real money moved." />
      ) : null}

      {failure ? (
        <Banner tone="danger" title="Could not load reports" message={failureMessage(failure).message} />
      ) : null}

      {!report && !failure ? (
        <div className="report-stack">
          <Skeleton variant="block" />
          <SkeletonList label="Loading reports" count={3} heading />
        </div>
      ) : null}

      {report && mode ? (
        <>
          {view === "overview" ? <OverviewView report={report} siteId={siteId} mode={mode} period={period} /> : null}
          {view === "revenue" ? <RevenueView report={report} siteId={siteId} mode={mode} period={period} tierOptions={tierOptions} /> : null}
          {view === "subscriptions" ? (
            <SubscriptionsView report={report} siteId={siteId} mode={mode} period={period} tierOptions={tierOptions} />
          ) : null}
          {view === "members" ? <MembersView report={report} siteId={siteId} mode={mode} period={period} /> : null}
        </>
      ) : null}
    </div>
  );
};
