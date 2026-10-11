import React from "react";
import { PluginFooter } from "./PluginFooter";
import { PluginHeader } from "./PluginHeader";
import { TabBar } from "./TabBar";
import { BRANDING, PLUGIN_VERSION } from "../../config/branding";
import { cn } from "../../utils/cn";
import type { TabId } from "../tabs/tabs";

export interface PluginShellProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onClose: () => void;
  onOpenAccount?: () => void;
  children: React.ReactNode;
}

/**
 * The four-part shell from PRD section 7.2: header 48px, tab bar 36px, content
 * scroll area, footer 40px pinned. All four parts are required.
 *
 * Collapsed, only the header renders. Hiding the rest with CSS would leave the
 * footer and the tab list in the accessibility tree inside a 48px window, so
 * they come out of the DOM instead.
 */
export const PluginShell: React.FC<PluginShellProps> = ({
  activeTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
  onClose,
  onOpenAccount,
  children,
}) => (
  <div className={cn("framefic-shell", collapsed && "is-collapsed")}>
    <PluginHeader
      title={BRANDING.pluginName}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      onClose={onClose}
    />

    {collapsed ? null : (
      <>
        <TabBar
          activeTab={activeTab}
          onSelectTab={onSelectTab}
          onOpenAccount={onOpenAccount}
        />

        <div className="framefic-content-area">
          <div
            className="tab-panel"
            role="tabpanel"
            id={`panel-${activeTab}`}
            aria-labelledby={`tab-${activeTab}`}
          >
            {children}
          </div>
        </div>

        <PluginFooter
          version={PLUGIN_VERSION}
          companyName={BRANDING.companyName}
          companyUrl={BRANDING.companyUrl}
          changelogUrl={BRANDING.changelogUrl}
        />
      </>
    )}
  </div>
);
