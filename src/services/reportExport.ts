/**
 * Report exports, CSV and PDF, from one description of the report.
 * Development doc: `docs/development-docs/24-reports.md`, section on exports.
 *
 * Every view builds a `ReportDocument`: a title, the lines that say what it
 * covers, and titled tables. CSV and PDF both render that same document, so the
 * two files always hold the same figures and a new view gets both formats by
 * building one object.
 */

import { renderPdf, type PdfReport } from "../utils/pdf";
import { currencyExponent } from "../utils/currencies";
import { formatMinorPlain } from "../utils/money";
import { downloadFile, toCsv, type ReportMode, type ReportPeriod } from "./reportsService";

export type ReportDocument = PdfReport;
export type ReportTable = ReportDocument["tables"][number];
export type ExportFormat = "csv" | "pdf";

export const PERIOD_LABEL: Record<ReportPeriod, string> = {
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "12m": "Last 12 months",
  all: "All time",
};

/**
 * Money as a currency code and a grouped amount: "INR 1,250.00". A code and
 * not a symbol, because the PDF's fonts have no rupee or taka sign and a
 * spreadsheet should not have to guess which dollar.
 */
export function amountText(amountMinor: number, currency: string): string {
  const plain = formatMinorPlain(amountMinor, currencyExponent(currency));
  const [whole, fraction] = plain.replace(/^-/, "").split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${plain.startsWith("-") ? "-" : ""}${currency} ${grouped}${fraction !== undefined ? `.${fraction}` : ""}`;
}

/** An amount for a spreadsheet column: digits and a point, no grouping or code. */
export function amountPlain(amountMinor: number, currency: string): string {
  return formatMinorPlain(amountMinor, currencyExponent(currency));
}

/** "2026-10-25". Exports use ISO dates so a spreadsheet sorts them. */
export function isoDate(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}

/** The lines under a report's title: which payments, which period, which filters, and when. */
export function reportMeta(input: {
  mode: ReportMode;
  period?: ReportPeriod;
  filters?: ReadonlyArray<string>;
  now?: Date;
}): string[] {
  const lines = [
    input.mode === "live" ? "Live payments" : "Test payments. Figures from test checkouts, no real money moved.",
  ];
  if (input.period) lines.push(`Period: ${PERIOD_LABEL[input.period]}`);
  for (const filter of input.filters ?? []) lines.push(filter);
  lines.push(`Exported ${isoDate((input.now ?? new Date()).toISOString())}`);
  return lines;
}

/**
 * The document as CSV: the title and its lines, then each table under its
 * title, a blank line between. Opens in any spreadsheet as one sheet.
 */
export function reportCsv(report: ReportDocument): string {
  const blocks = [
    toCsv([report.title], report.meta.map((line) => [line])),
    ...report.tables.map((table) =>
      [
        toCsv([table.title], table.note ? [[table.note]] : []),
        toCsv(
          table.columns.map((column) => column.label),
          table.rows.length > 0 ? table.rows : [[table.empty ?? "Nothing to show."]]
        ),
      ].join("\r\n")
    ),
  ];
  // A byte order mark, so Excel reads the file as UTF-8 and names keep their accents.
  return `﻿${blocks.join("\r\n\r\n")}\r\n`;
}

export function reportPdf(report: ReportDocument): string {
  return renderPdf(report);
}

/** "memberframe-revenue-live-30d-2026-10-25.pdf": lowercase, safe on every system. */
export function exportFileName(parts: ReadonlyArray<string>, format: ExportFormat, now = new Date()): string {
  const slug = [...parts, isoDate(now.toISOString())]
    .map((part) =>
      part
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    )
    .filter(Boolean)
    .join("-");
  return `memberframe-${slug}.${format}`;
}

/** Render and save. False where the plugin frame refuses the download. */
export function saveReport(report: ReportDocument, fileParts: ReadonlyArray<string>, format: ExportFormat): boolean {
  return format === "csv"
    ? downloadFile(exportFileName(fileParts, "csv"), reportCsv(report), "text/csv;charset=utf-8")
    : downloadFile(exportFileName(fileParts, "pdf"), reportPdf(report), "application/pdf");
}
