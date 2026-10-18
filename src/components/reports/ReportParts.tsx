import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "../ui";
import { cn } from "../../utils/cn";
import { formatMinorWithCurrency } from "../../utils/money";
import { currencyExponent } from "../../utils/currencies";
import { GATEWAY_LABELS, type GatewayId } from "../../types/site";
import type { Money, RevenueTotals } from "../../services/reportsService";

/* ==========================================================================
   FORMATTERS
   ========================================================================== */

export function money(amountMinor: number, currency: string): string {
  return formatMinorWithCurrency(amountMinor, currency, currencyExponent(currency));
}

/** The site currency's amount from a per-currency list, or zero in it. */
export function inCurrency(list: ReadonlyArray<Money>, currency: string): number {
  return list.find((item) => item.currency === currency)?.amountMinor ?? 0;
}

/** The site currency's totals, or zeros. */
export function totalsIn(list: ReadonlyArray<RevenueTotals>, currency: string): RevenueTotals {
  return list.find((item) => item.currency === currency) ?? { currency, grossMinor: 0, refundedMinor: 0, netMinor: 0, payments: 0 };
}

export function date(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** "2026-10" as "Oct", or "Oct 2026" when asked. */
export function monthLabel(key: string, withYear = false): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, {
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

export function gatewayLabel(gateway: string): string {
  return GATEWAY_LABELS[gateway as GatewayId] ?? gateway;
}

/** Subscription status in words and the badge tone that goes with it. Never the raw value. */
export const SUBSCRIPTION_STATUS: Record<string, { label: string; tone: "success" | "warning" | "neutral" | "danger" }> = {
  active: { label: "Active", tone: "success" },
  past_due: { label: "Payment failed", tone: "warning" },
  canceling: { label: "Canceling", tone: "warning" },
  canceled: { label: "Canceled", tone: "neutral" },
  ended: { label: "Ended", tone: "neutral" },
};

export const PAYMENT_STATUS: Record<string, { label: string; tone: "success" | "neutral" | "danger" }> = {
  paid: { label: "Paid", tone: "success" },
  refunded: { label: "Refunded", tone: "neutral" },
  failed: { label: "Failed", tone: "danger" },
};

export const INTERVAL_LABEL: Record<string, string> = { month: "Monthly", year: "Yearly", lifetime: "Lifetime" };

/* ==========================================================================
   PIECES
   ========================================================================== */

/** A KPI tile: label, value, one line under it. A number, not a chart. */
export const StatTile: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <div className="report-kpi">
    <span className="report-kpi-label">{label}</span>
    <span className="report-kpi-value">{value}</span>
    {sub ? <span className="report-kpi-sub">{sub}</span> : null}
  </div>
);

/** A table row: a title and a line under it on the left, a figure on the right. */
export const ReportRow: React.FC<{
  title: string;
  sub?: string;
  figure?: React.ReactNode;
  onClick?: () => void;
  children?: React.ReactNode;
}> = ({ title, sub, figure, onClick, children }) => {
  const body = (
    <>
      <span className="report-cell-main">
        <span className="report-cell-title">{title}</span>
        {sub ? <span className="report-cell-sub">{sub}</span> : null}
      </span>
      {children}
      {figure !== undefined ? <span className="report-cell-figure">{figure}</span> : null}
    </>
  );
  return onClick ? (
    <button type="button" className="report-row" onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className="report-row">{body}</div>
  );
};

/** Previous and next: the members list's pager, so every list in the panel pages the same way. */
export const Pager: React.FC<{ page: number; pageSize: number; total: number; onPage: (page: number) => void }> = ({
  page,
  pageSize,
  total,
  onPage,
}) => {
  if (total <= pageSize) return null;
  const last = Math.ceil(total / pageSize);
  return (
    <div className="members-pager">
      <IconButton label="Previous page" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <ChevronLeft aria-hidden={true} />
      </IconButton>
      <span className="members-pager-label">{`Page ${page} of ${last}`}</span>
      <IconButton label="Next page" variant="secondary" disabled={page >= last} onClick={() => onPage(page + 1)}>
        <ChevronRight aria-hidden={true} />
      </IconButton>
    </div>
  );
};

/* ==========================================================================
   COLUMN CHART
   ========================================================================== */

export interface ChartPoint {
  /** "2026-10" */
  month: string;
  value: number;
  /** The value as read out: "$1,240.00", "12 sign ups". */
  display: string;
}

const WIDTH = 320;
const HEIGHT = 112;
const BASE = 96;
const BAR = 14;
const RADIUS = 4;

/** A column with a 4px rounded cap and a square base, as one path. */
function columnPath(x: number, top: number): string {
  const r = Math.min(RADIUS, (BASE - top) / 2, BAR / 2);
  return `M${x},${BASE}V${top + r}Q${x},${top} ${x + r},${top}H${x + BAR - r}Q${x + BAR},${top} ${x + BAR},${top + r}V${BASE}Z`;
}

/**
 * One series over the last twelve months. dataviz: a single series, so one
 * brand hue and no legend (the heading names it); columns 14px with air
 * between, rounded at the data end and square at the baseline; a recessive
 * baseline and every third month labelled. Hovering or focusing a month reads
 * it out above the chart and dims the rest; the month table beside it is the
 * table view.
 */
export const ColumnChart: React.FC<{ label: string; points: ReadonlyArray<ChartPoint>; summary: string }> = ({
  label,
  points,
  summary,
}) => {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(0, ...points.map((point) => point.value));
  const slot = WIDTH / Math.max(1, points.length);
  const readout = active !== null && points[active] ? `${monthLabel(points[active].month, true)}: ${points[active].display}` : summary;

  return (
    <div className="report-chart">
      <span className="report-chart-readout" aria-live="polite">
        {readout}
      </span>
      <svg className="report-chart-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${label}. ${summary}`}>
        <line className="report-chart-axis" x1={0} x2={WIDTH} y1={BASE + 0.5} y2={BASE + 0.5} />
        {points.map((point, index) => {
          const x = index * slot + (slot - BAR) / 2;
          const top = max === 0 ? BASE : BASE - Math.max(point.value > 0 ? 2 : 0, (point.value / max) * (BASE - 8));
          return (
            <g key={point.month}>
              {point.value > 0 ? (
                <path className={cn("report-chart-bar", active !== null && active !== index && "is-dim")} d={columnPath(x, top)} />
              ) : null}
              <rect
                className="report-chart-hit"
                x={index * slot}
                y={0}
                width={slot}
                height={BASE}
                tabIndex={0}
                aria-label={`${monthLabel(point.month, true)}: ${point.display}`}
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
              />
              {index % 3 === 2 || index === points.length - 1 ? (
                <text className="report-chart-tick" x={index * slot + slot / 2} y={HEIGHT - 2} textAnchor="middle">
                  {monthLabel(point.month)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
