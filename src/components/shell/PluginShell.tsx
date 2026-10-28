import React from "react";
import { PluginFooter } from "./PluginFooter";
import { TabBar } from "./TabBar";
import { BRANDING, PLUGIN_VERSION } from "../../config/branding";
import { cn } from "../../utils/cn";
import { useScrollbarGutter } from "../../hooks/useScrollbarGutter";
import { ACCOUNT_VIEW, type TabId, type ViewId } from "../tabs/tabs";

export interface PluginShellProps {
  activeTab: ViewId;
  onSelectTab: (tab: TabId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** Opens the account view (Connect) from the Account icon. */
  onOpenAccount: () => void;
  /** Above the tab bar: the BEAF trial countdown (F19). Renders nothing when empty. */
  topBanner?: React.ReactNode;
  /** No content padding: the billing screens carry their own (BEAF layout). */
  flush?: boolean;
  children: React.ReactNode;
}

/**
 * The plugin shell: tab bar 36px, content scroll area, footer 40px pinned.
 * PRD section 7.2, Figma Navigation page, design rule section 7.
 *
 * ## No plugin header of our own
 *
 * Framer always draws its own window bar above a plugin, with the plugin name
 * and a close button, and the SDK cannot hide it (`UIOptions` has only size,
 * position, and resizing). The Figma shell's 48px header repeated both, so the
 * panel showed two title bars. The user chose to drop ours on 2026-10-15:
 * Framer's bar carries the name and Close, and Collapse is an item in that
 * bar's plugin menu (`framer.setMenu`, wired in App.tsx).
 *
 * Collapsed, only the tab bar renders, so the window is 36px. Hiding the rest
 * with CSS would leave the footer and the content in the accessibility tree
 * inside a 36px window, so they come out of the DOM instead.
 */
export const PluginShell: React.FC<PluginShellProps> = ({
  activeTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
  onOpenAccount,
  topBanner,
  flush = false,
  children,
}) => {
  // Content 16px from both edges whatever the system's scrollbar takes (kit.css).
  useScrollbarGutter(!collapsed);
  return (
  <div className={cn("framefic-shell", collapsed && "is-collapsed")}>
    {collapsed ? null : topBanner}
    <TabBar
      activeTab={activeTab}
      onSelectTab={onSelectTab}
      onOpenAccount={onOpenAccount}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
    />

    {collapsed ? null : (
      <>
        <div className="framefic-content-area">
          {activeTab === ACCOUNT_VIEW ? (
            // Not a tab, so not a tabpanel: the account view is a named region.
            <div className={cn("tab-panel", flush && "is-flush")} role="region" id="panel-account" aria-label="Account">
              {children}
            </div>
          ) : (
            <div
              className={cn("tab-panel", flush && "is-flush")}
              role="tabpanel"
              id={`panel-${activeTab}`}
              aria-labelledby={`tab-${activeTab}`}
            >
              {children}
            </div>
          )}
        </div>

        <PluginFooter
          version={PLUGIN_VERSION}
          companyHandle={BRANDING.companyHandle}
          companyUrl={BRANDING.companyUrl}
          changelogUrl={BRANDING.changelogUrl}
        />
      </>
    )}
  </div>
  );
};
