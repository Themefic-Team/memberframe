import React, { useCallback, useEffect, useState } from "react";
import { framer } from "framer-plugin";
import { PluginShell } from "./components/shell";
import { BuilderTab, HomeTab, ManageTab, SettingsTab } from "./components/tabs";
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

  return (
    <ToastProvider>
      <PluginShell
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        onClose={handleClose}
      >
        {activeTab === "home" ? <HomeTab onOpenBuilder={openBuilder} /> : null}
        {activeTab === "builder" ? <BuilderTab /> : null}
        {activeTab === "manage" ? <ManageTab /> : null}
        {activeTab === "settings" ? (
          <SettingsTab themePreference={preference} onChangeThemePreference={setPreference} />
        ) : null}
      </PluginShell>
    </ToastProvider>
  );
};
