# Feature: Reports

A fifth tab that answers what a membership business asks: how many members, on which tiers, paying what, how that is changing, and what each member has paid.

**PRD reference**: F02 (members, tiers), F03 and FP-16 (payments), F10 and F14 (downloads, bookmarks)
**Status**: awaiting review
**Tasks**: unscheduled, requested 2026-10-18

---

## 1. Overview and Problem Solved

- **Feature Name**: Reports
- **Target Audience**: Framer Creator
- **Value Proposition**: The panel could manage members, tiers, and gateways, but not answer "how is it going". Every number below is already recorded by the backend; nothing new is collected.
- **Priority Tier**: P1, Creator Enhancement

### 1.1. What The System Records, Reviewed 2026-10-18

| Table | What a report can use |
| :--- | :--- |
| `members` | join date, `activeTier`, status, last sign in |
| `subscriptions` | tier, interval (month, year, lifetime), status (`active`, `past_due`, `canceling`, `ended`), amount and currency, gateway, `mode` (test or live), start, current period end, end |
| `payments` | amount and currency, gateway, `mode`, `paid` or `refunded`, paid at, receipt URL, the subscription it paid for (so its tier) |
| `bookmarks` | which items members save, and how often |
| `assets` | `downloadCount`, last download |

### 1.2. The Reports

**Filters, above every view**: Live or Test (default: the site's current mode, since test payments are not income), and a period: 30 days, 90 days, 12 months, all time.

| View | Contents |
| :--- | :--- |
| **Overview** | KPI tiles: members, new members in the period, paying members, MRR, net revenue in the period, subscriptions ended in the period. Members by tier. Top bookmarked items and top downloads |
| **Revenue** | Net revenue, gross, refunds. Revenue by month (12 months, a column chart with a month table). By tier. By gateway. Payment history with member, tier, amount, status, date, receipt |
| **Subscriptions** | Counts by status and by interval. The subscription list, filtered by status and tier: member, tier, interval, amount, status, renews or ended |
| **Members** | Per tier: members, paying, net revenue. A tier opens its member list; a member opens their history: every subscription and payment, with lifetime spend |

Every view, including the two Members drill downs, has **Export CSV** and **Export PDF** at its top (section 9).

### 1.3. Definitions

- **Paying member**: a member with a subscription in `active`, `past_due`, or `canceling` (a `canceling` one has paid to the period end), or a lifetime purchase, in the chosen mode.
- **MRR**: the sum over those recurring subscriptions of the monthly amount: a monthly price as is, a yearly price over 12. Lifetime purchases are revenue, not recurring. Per currency.
- **Gross**: every payment in the period. **Refunded**: those marked refunded. **Net**: gross less refunded. Per currency; a site has one currency now, but older payments may be in another, and amounts in two currencies are never added together.
- **A payment's tier**: the tier of the subscription it paid for; "Unknown" when it has none.

### 1.4. Conflicts

- **Five tabs.** The Figma Navigation page and `tabs.ts` capped the bar at four, and a fifth tab once pushed the Account icon out of the 360px panel (C26). Asked on 2026-10-18 between a chart icon beside Account and a fifth text tab; the creator chose the tab. The gap between tabs is 12px instead of 20px (kit.css), which fits five labels and the Account icon in 360px. Recorded in the design rule's changelog and in `tabs.ts`.

---

## 2. User Flows

### 2.1. In-Plugin Flow

Reports tab, pick Live or Test and a period, then Overview, Revenue, Subscriptions, or Members. In Members, a tier opens its members, and a member opens their history. Export CSV or Export PDF on any of them downloads that report, with its lists in full for the current filters.

### 2.2. Visitor / Member Runtime Flow

None. Reports read what the site already records.

---

## 3. Architecture and File Inventory

- **Backend**: `src/services/reportService.ts` (queries and arithmetic, no HTTP), `src/routes/reports.ts` mounted at `/api/site/reports`, creator authentication as the rest of `/api/site`.
- **Plugin**: `src/services/reportsService.ts` (API client), `src/components/tabs/ReportsTab.tsx`, `src/components/reports/*` (views, stat tile, column chart, export bar, `reportDocuments.ts`), `src/services/reportExport.ts` (CSV, file names, download), `src/utils/pdf.ts` (the PDF writer), `src/styles/reports.css`.
- **Shell**: `tabs.ts` gains Reports; `kit.css` narrows the tab gap.

---

## 4. Framer Property Controls Specification

None.

---

## 5. Data Contracts

```typescript
type ReportMode = "live" | "test";
type ReportPeriod = "30d" | "90d" | "12m" | "all";
interface Money { currency: string; amountMinor: number }

// GET /api/site/reports/overview?siteId&mode&period
interface OverviewReport {
  mode: ReportMode; period: ReportPeriod; from: string | null; siteCurrency: string;
  members: { total: number; newInPeriod: number; paying: number; byTier: TierCount[]; byStatus: Record<string, number>; signupsByMonth: MonthCount[] };
  subscriptions: { active: number; pastDue: number; canceling: number; startedInPeriod: number; endedInPeriod: number; byInterval: Record<"month" | "year" | "lifetime", number>; byTier: TierCount[] };
  revenue: { totals: RevenueTotals[]; mrr: Money[]; byMonth: MonthRevenue[]; byTier: TierRevenue[]; byGateway: GatewayRevenue[] };
  content: { topBookmarks: { itemSlug: string; title: string; url: string; count: number }[]; topDownloads: { id: string; name: string; downloadCount: number; lastDownloadAt: string | null }[] };
}

// GET /api/site/reports/subscriptions?siteId&mode&status&tier&page&pageSize
// GET /api/site/reports/payments?siteId&mode&period&tier&memberId&page&pageSize
// GET /api/site/reports/members/:memberId?siteId&mode
// GET /api/site/members?siteId&tier&page&pageSize   pageSize 1 to 500, default 25: the tier export's pages
```

---

## 6. Verification and Testing Checklist

- [x] Backend: the arithmetic (MRR, net, per-currency, period starts, grouping) in `test/reports.test.ts`, without a database.
- [x] Plugin: the client, CSV escaping and the formula guard, the tab registry, and the chart shape in `test/reports.test.ts`.
- [x] Every report query run against the development database on all four sites. Tabfolio (copy), test mode: 4 members, 2 paying, 2 payments of 9.99 USD on Gold, so net 19.98 and MRR 19.98, payments attributed to Gold. Matches the rows.
- [x] Gates: plugin lint, design lint, tsc, 890 tests, build; backend tsc, 393 tests.
- [ ] Needs human verification: the tab bar fits at 360px with five tabs in both themes; the chart's hover; Export CSV downloads from inside Framer's plugin frame.
- [x] Exports (section 9): CSV layout, BOM, formula guard, CSV only columns; PDF structure (cross reference offsets, 7-bit bytes, page breaks with repeated headers, ellipsis, landscape, escaping, WinAnsi fallback); every view's document in both formats; in `test/reportExport.test.ts`. Sample Overview and Revenue PDFs opened and read back page by page.
- [ ] Needs human verification: Export CSV and Export PDF download from inside Framer's plugin frame on every view, and the PDF opens in Acrobat, Preview, and a browser.

---

## 7. View Switcher Fit, 2026-10-18

"Overview, Revenue, Subscriptions, Members" came to about 332px in a 328px content area: each segment is `flex: 1` with `nowrap` and no `min-width`, so the control overflowed and clipped Overview and Members at its edges. The switcher now says **Plans** (the view's heading still says Subscriptions), and `kit.css` lets any segment shrink to an ellipsis, so a long label in any segmented control truncates rather than breaking the layout. `test/reports.test.ts` keeps the four labels within 28 characters.

---

## 8. Members Drill-Down Matches Manage, 2026-10-18

Reported as inconsistent with the rest of the panel. Three causes, each fixed by reusing what Manage already has rather than styling Reports its own way:

- **By Tier** rows were plain table rows; Manage, Tiers shows the same tiers as cards. They are now that card (`integration-card`): Gift or Crown icon, name, "N members, N paying. X net", Free or Paid badge, and a chevron to open.
- **A tier's members** were table rows; they are now Manage's own `MemberRow` (avatar, name, email, tier, joined, lifetime spend, status badge), under the members list's count line, paged by the members list's pager (`members-pager`, now also used by Revenue and Plans).
- **Back** was a loose ghost button on its own line; it is an icon button in one row with the drill-down's title (`report-back`).
- **Currency**: the tier list read BDT 0.00 and the member list $0.00. A member with no payments was given USD by the members API (`routes/site.ts`, list and update); it now falls back to the site currency from Payments, which fixes Manage, Members too.

---

## 9. Export CSV and Export PDF on Every Report, 2026-10-25

Asked for: every report exports as CSV and as PDF. Before, only Revenue and Plans had Export CSV, and it held the list alone.

- **One document, two formats.** Each view builds a ReportDocument (components/reports/reportDocuments.ts): a title, lines saying what it covers (Live or Test, period, filters, export date), and titled tables. KPI tiles become a Measure, Value, Detail table. eportCsv and enderPdf render the same document, so the two files always agree.
- **What each holds.** Overview: summary, members by tier, sign ups by month, most saved and most downloaded when not empty. Revenue: summary (other currencies listed apart, never added), by month, by tier, by gateway, every payment for the tier filter. Plans: summary, paying by tier, every subscription for the status and tier filters. Members: the tier list; a tier's members; a member's details, subscriptions, and payments. Lists are fetched in full up to the server's export cap of 5000, and a cut list says so in its note.
- **CSV.** One sheet: each table under its title, a blank line between. UTF-8 with a byte order mark so Excel keeps accents. The formula guard from 	oCsv still applies. Amounts in list columns stay plain digits with a separate currency column, for sums in a spreadsheet; receipt links are CSV only.
- **PDF.** Written by utils/pdf.ts, no dependency: A4 (landscape for the wide lists), Helvetica, grey header band, hairline rows, a long table carries its header onto each page, page numbers in the footer, and a cell too wide ends in an ellipsis. Money is "INR 1,250.00", a code and never a symbol. Known limit: the standard fonts cover WinAnsi (Latin, accents, euro), so text in other scripts prints as "?" in the PDF. The CSV keeps every character. Embedding a Unicode font would add hundreds of kilobytes to the plugin; revisit if creators ask.
- **Members export paging.** GET /api/site/members takes pageSize up to 500 (default 25, so Manage is unchanged). The plugin pages at whatever size the server answers with, so a server without this change still exports, 25 at a time.
- **Placement.** Two secondary buttons side by side at the top of each view (eport-export), so the export is found without scrolling a long list. Success and failure are toasts.
