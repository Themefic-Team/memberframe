import React, { useCallback, useEffect, useState } from "react";
import { framer } from "framer-plugin";
import { PluginShell } from "./components/shell";
import { ConnectionProvider } from "./components/ConnectionProvider";
import { BuilderTab, ConnectTab, HomeTab, ManageTab, SettingsTab } from "./components/tabs";
import { ToastProvider } from "./components/ui";
import { useActiveTab } from "./hooks/useActiveTab";
import { useFramerTheme } from "./hooks/useFramerTheme";

/** PRD section 7.1. Geometry is fixed by the shell standard. */
const PANEL_WIDTH = 360;
const PANEL_HEIGHT = 640;
const COLLAPSED_HEIGHT = 48;

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

  const handleClose = useCallback(() => {
    try {
      framer.closePlugin();
    } catch {
      // Same as above: nothing to close outside Framer.
    }
  }, []);

  const toggleCollapse = useCallback(() => setCollapsed((current) => !current), []);
  const openBuilder = useCallback(() => setActiveTab("builder"), [setActiveTab]);
  const openManage = useCallback(() => setActiveTab("manage"), [setActiveTab]);
  const openSettings = useCallback(() => setActiveTab("settings"), [setActiveTab]);
  const openConnect = useCallback(() => setActiveTab("connect"), [setActiveTab]);

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
          onClose={handleClose}
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
          {activeTab === "connect" ? <ConnectTab /> : null}
        </PluginShell>
      </ConnectionProvider>
    </ToastProvider>
  );
};
