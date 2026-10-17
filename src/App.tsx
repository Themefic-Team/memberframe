import React, { useCallback, useEffect, useState } from "react";
import { framer } from "framer-plugin";
import { PluginShell } from "./components/shell";
import { ConnectionProvider } from "./components/ConnectionProvider";
import { ACCOUNT_VIEW, BuilderTab, ConnectTab, HomeTab, ManageTab, SettingsTab } from "./components/tabs";
import { ToastProvider } from "./components/ui";
import { useActiveTab } from "./hooks/useActiveTab";
import { useFramerTheme } from "./hooks/useFramerTheme";

/** PRD section 7.1. Geometry is fixed by the shell standard. */
const PANEL_WIDTH = 360;
const PANEL_HEIGHT = 640;
/** The tab bar, which is the panel's top row since the plugin header went. */
const COLLAPSED_HEIGHT = 36;

export const App: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useActiveTab();
  const { preference, setPreference } = useFramerTheme();

  useEffect(() => {
    try {
      framer.showUI({
        position: "top right",
        width: PANEL_WIDTH,
        height: collapsed ? COLLAPSED_HEIGHT : PANEL_HEIGHT,
      });
    } catch {
      // Running in a standalone browser dev preview, outside Framer.
    }
  }, [collapsed]);

  // No close handler: Framer's own window bar closes the plugin, and the shell
  // no longer draws a second one. See PluginShell.

  const toggleCollapse = useCallback(() => setCollapsed((current) => !current), []);

  // Collapse lives in Framer's own window bar, beside its close button: the
  // plugin menu (`framer.setMenu`) is the only thing a plugin can put there.
  // Framer draws the menu button itself, and items are text only, so this is
  // a labelled menu item rather than our chevron icon. No permission needed.
  useEffect(() => {
    try {
      void framer
        .setMenu([
          {
            label: collapsed ? "Expand panel" : "Collapse panel",
            onAction: toggleCollapse,
          },
        ])
        .catch(() => {
          // Outside Framer there is no window bar to put a menu in.
        });
    } catch {
      // Same: a standalone browser dev preview has no Framer host.
    }
  }, [collapsed, toggleCollapse]);
  const openBuilder = useCallback(() => setActiveTab("builder"), [setActiveTab]);
  const openManage = useCallback(() => setActiveTab("manage"), [setActiveTab]);
  const openSettings = useCallback(() => setActiveTab("settings"), [setActiveTab]);
  const openConnect = useCallback(() => setActiveTab(ACCOUNT_VIEW), [setActiveTab]);

  return (
    <ToastProvider>
      {/*
        The connection wraps the shell rather than sitting inside one tab,
        because three tabs read the same site id. Two copies of "which site is
        this" is how the Manage tab lists one site's members while the Settings
        tab writes another's.
      */}
      <ConnectionProvider>
        <PluginShell
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
          onOpenAccount={openConnect}
        >
          {activeTab === "home" ? (
            <HomeTab
              onOpenBuilder={openBuilder}
              onOpenManage={openManage}
              onOpenSettings={openSettings}
              onOpenConnect={openConnect}
            />
          ) : null}
          {activeTab === "builder" ? <BuilderTab /> : null}
          {activeTab === "manage" ? <ManageTab /> : null}
          {activeTab === "settings" ? (
            <SettingsTab themePreference={preference} onChangeThemePreference={setPreference} />
          ) : null}
          {activeTab === ACCOUNT_VIEW ? <ConnectTab /> : null}
        </PluginShell>
      </ConnectionProvider>
    </ToastProvider>
  );
};
