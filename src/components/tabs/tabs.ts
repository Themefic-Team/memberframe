/**
 * The tab registry. Single source of truth for order, ids, and titles, so the
 * tab bar and the panel switch cannot drift apart.
 *
 * ## Four tabs plus the account view
 *
 * The shell standard and the Figma Navigation page permit two to four tabs,
 * with an Account icon button pinned to the right of the tab bar. PRD section
 * 7.3 resolved this product at four by folding Members and Tiers into Manage
 * behind a segmented control. **That resolution still holds**: Members and
 * Tiers are not re-split, and they must not be.
 *
 * Connect is not a tab. It is the creator's account: the email and code that
 * prove who they are, then the connected summary and Disconnect. It opens
 * from the Account icon, which is where PRD conflict 6 already put the
 * profile. It used to be a fifth tab (conflict C26), which pushed the Account
 * icon out of the 360px panel; the user chose the Figma layout on 2026-10-15.
 *
 * So the content area shows a `ViewId`: one of the tabs, or the account
 * view. Only `TABS` appear in the tab bar.
 *
 * ## Five, since 2026-10-18
 *
 * Reports is a fifth tab. Asked between a chart icon beside Account (inside
 * the four-tab rule) and a fifth text tab, the creator chose the tab. The gap
 * between tabs is 12px instead of the reference's 20px (kit.css) so five
 * labels and the Account icon fit in 360px. Development doc: 24-reports.md.
 */
export const TABS = [
  { id: "home", title: "Home" },
  { id: "builder", title: "Builder" },
  { id: "manage", title: "Manage" },
  { id: "settings", title: "Settings" },
  { id: "reports", title: "Reports" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

/** The account view behind the Account icon. */
export const ACCOUNT_VIEW = "connect";

/** Everything the content area can show. */
export type ViewId = TabId | typeof ACCOUNT_VIEW;

export const DEFAULT_TAB: TabId = "home";

export function isTabId(value: string | null): value is TabId {
  return TABS.some((tab) => tab.id === value);
}

export function isViewId(value: string | null): value is ViewId {
  return value === ACCOUNT_VIEW || isTabId(value);
}
