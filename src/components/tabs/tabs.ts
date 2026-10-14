/**
 * The tab registry. Single source of truth for order, ids, and titles, so the
 * tab bar and the panel switch cannot drift apart.
 *
 * ## Five tabs, and that is a change worth flagging
 *
 * The shell standard permits two to four, and PRD section 7.3 resolved this
 * product at four by folding Members and Tiers into Manage behind a segmented
 * control. **That resolution still holds**: Members and Tiers are not re-split,
 * and they must not be.
 *
 * Connect is a fifth tab on the user's explicit instruction, and it is a
 * different kind of surface from the other four. They are workspaces a creator
 * returns to; this one is a gate they pass through once and revisit only to add
 * a domain or disconnect. Folding it into Settings was the alternative, and it
 * would have buried the one thing a new creator must do first underneath the
 * payment vault.
 *
 * Recorded as conflict C26 in the ledger, because it is a standard being
 * widened rather than a decision being made freshly. If the panel feels cramped
 * at 360px, the fix is to move Connect into Settings, never to re-split Manage.
 */
export const TABS = [
  { id: "home", title: "Home" },
  { id: "builder", title: "Builder" },
  { id: "manage", title: "Manage" },
  { id: "settings", title: "Settings" },
  { id: "connect", title: "Connect" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

export const DEFAULT_TAB: TabId = "home";

export function isTabId(value: string | null): value is TabId {
  return TABS.some((tab) => tab.id === value);
}
