import React from "react";
import { UserRound } from "lucide-react";
import { IconButton } from "../ui";
import { cn } from "../../utils/cn";
import { ACCOUNT_VIEW, TABS, type TabId, type ViewId } from "../tabs/tabs";

export interface TabBarProps {
  activeTab: ViewId;
  onSelectTab: (tab: TabId) => void;
  /** Opens the account view (Connect). */
  onOpenAccount: () => void;
  /** While collapsed, picking a tab or Account expands the panel first. */
  collapsed: boolean;
  onToggleCollapse: () => void;
}

/**
 * 36px and the top row of the panel: tabs with a 2px gradient pill under the
 * active one, a spacer, then Account pinned right. PRD section 7.2, Figma
 * Navigation page.
 *
 * Four tabs, the Figma maximum. The Account icon opens the account view
 * (Connect) and shows a pressed state while it is open; no tab is selected
 * then. See tabs.ts for why Connect lives here rather than in the tab list.
 *
 * Collapse is not here: it is an item in Framer's own window-bar menu, beside
 * Framer's close button (see App.tsx). Picking a tab or Account while
 * collapsed expands the panel, since a tab you cannot see the content of is
 * not a useful choice.
 */
export const TabBar: React.FC<TabBarProps> = ({
  activeTab,
  onSelectTab,
  onOpenAccount,
  collapsed,
  onToggleCollapse,
}) => {
  const expandThen = (action: () => void) => () => {
    if (collapsed) onToggleCollapse();
    action();
  };

  return (
    <nav className="framefic-tab-bar">
      <div className="framefic-tabs-list" role="tablist" aria-label="Plugin sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={tab.id === activeTab}
            aria-controls={collapsed ? undefined : `panel-${tab.id}`}
            className={cn("framefic-tab", tab.id === activeTab && "active")}
            onClick={expandThen(() => onSelectTab(tab.id))}
          >
            {tab.title}
          </button>
        ))}
      </div>
      <span className="framefic-tab-spacer" />
      <div className="framefic-tab-bar-actions">
        <IconButton
          label="Account"
          className={cn("framefic-account-button", activeTab === ACCOUNT_VIEW && "is-active")}
          aria-pressed={activeTab === ACCOUNT_VIEW}
          onClick={expandThen(onOpenAccount)}
        >
          <UserRound aria-hidden={true} />
        </IconButton>
      </div>
    </nav>
  );
};
