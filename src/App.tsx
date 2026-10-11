import React, { useEffect, useState } from "react";
import { framer } from "framer-plugin";
import { PluginShell, NavTabId } from "./components/shell/PluginShell";
import { HomeTab } from "./components/tabs/HomeTab";
import { BuilderTab } from "./components/tabs/BuilderTab";
import { MembersTab } from "./components/tabs/MembersTab";
import { TiersTab } from "./components/tabs/TiersTab";
import { SettingsTab } from "./components/tabs/SettingsTab";
import { useFramerTheme } from "./hooks/useFramerTheme";

import "./styles/design-tokens.css";
import "./styles/components.css";
import "./components/ui/ui.css";
import "./App.css";

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTabId>("home");
  useFramerTheme();

  useEffect(() => {
    // Initialize standard Framer plugin window geometry (360x640)
    try {
      framer.showUI({
        position: "top right",
        width: 360,
        height: 640,
      });
    } catch {
      // Running in standalone browser dev preview
    }
  }, []);

  return (
    <PluginShell activeTab={activeTab} onSelectTab={setActiveTab}>
      {activeTab === "home" && <HomeTab onNavigate={setActiveTab} />}
      {activeTab === "builder" && <BuilderTab />}
      {activeTab === "members" && <MembersTab />}
      {activeTab === "tiers" && <TiersTab />}
      {activeTab === "settings" && <SettingsTab />}
    </PluginShell>
  );
};
