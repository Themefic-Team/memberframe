/**
 * The tab registry. Single source of truth for order, ids, and titles, so the
 * tab bar and the panel switch cannot drift apart.
 *
 * Four tabs is a resolved decision, PRD section 7.3. The feature doc proposed
 * five (Home, Builder, Members, Tiers, Settings) and the shell standard permits
 * two to four, so Members and Tiers were folded into Manage behind a segmented
 * control. Do not re-split them.
 */
export const TABS = [
  { id: "home", title: "Home" },
  { id: "builder", title: "Builder" },
  { id: "manage", title: "Manage" },
  { id: "settings", title: "Settings" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

export const DEFAULT_TAB: TabId = "home";

export function isTabId(value: string | null): value is TabId {
  return TABS.some((tab) => tab.id === value);
}
