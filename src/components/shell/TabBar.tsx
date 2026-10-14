import React from "react";
import { UserRound } from "lucide-react";
import { IconButton } from "../ui";
import { cn } from "../../utils/cn";
import type { TabId } from "../tabs/tabs";
import { TABS } from "../tabs/tabs";

export interface TabBarProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  /** Opens the account sheet. Disabled until that view exists. */
  onOpenAccount?: () => void;
}

/**
 * 36px, with a 2px gradient pill under the active tab, a spacer, then the
 * account button. PRD section 7.2.
 *
 * Five tabs since the Connect tab, which is a widening of the shell standard's
 * two-to-four and is recorded as conflict C26. What has NOT changed is why
 * there are not six: Members and Tiers stay folded into Manage behind a
 * segmented control because they share a data domain and the same backend
 * calls, which is the resolved decision in PRD section 7.3. Do not re-split
 * them to make room for anything.
 */
export const TabBar: React.FC<TabBarProps> = ({ activeTab, onSelectTab, onOpenAccount }) => (
  <nav className="framefic-tab-bar">
    <div className="framefic-tabs-list" role="tablist" aria-label="Plugin sections">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={`tab-${tab.id}`}
          aria-selected={tab.id === activeTab}
          aria-controls={`panel-${tab.id}`}
          className={cn("framefic-tab", tab.id === activeTab && "active")}
          onClick={() => onSelectTab(tab.id)}
        >
          {tab.title}
        </button>
      ))}
    </div>
    <span className="framefic-tab-spacer" />
    <IconButton
      label="Account"
      onClick={onOpenAccount}
      disabled={!onOpenAccount}
    >
      <UserRound aria-hidden={true} />
    </IconButton>
  </nav>
);
