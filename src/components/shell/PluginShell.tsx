import React, { useState } from "react";
import { framer } from "framer-plugin";
import {
  ChevronDown,
  ChevronUp,
  X,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import "./PluginShell.css";

export type NavTabId = "home" | "builder" | "members" | "tiers" | "settings";

interface PluginShellProps {
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  children: React.ReactNode;
}

export const PluginShell: React.FC<PluginShellProps> = ({
  activeTab,
  onSelectTab,
  children,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleCollapse = async () => {
    try {
      if (!isCollapsed) {
        await framer.showUI({
          position: "top right",
          width: 360,
          height: 48,
        });
        setIsCollapsed(true);
      } else {
        await framer.showUI({
          position: "top right",
          width: 360,
          height: 640,
        });
        setIsCollapsed(false);
      }
    } catch {
      setIsCollapsed(!isCollapsed);
    }
  };

  const handleClose = async () => {
    try {
      await framer.closePlugin();
    } catch {
      // Mock mode fallback
    }
  };

  return (
    <div className="framefic-shell">
      {/* Plugin Header (48px) */}
      <header className="framefic-header">
        <div className="framefic-header-brand">
          <div className="framefic-header-logo">
            <ShieldCheck size={14} stroke="currentColor" />
          </div>
          <span className="framefic-header-title">MemberFrame</span>
        </div>

        <div className="framefic-header-actions">
          <button
            type="button"
            className="icon-btn"
            onClick={toggleCollapse}
            aria-label={isCollapsed ? "Expand plugin" : "Collapse plugin"}
            title={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? (
              <ChevronUp size={14} stroke="currentColor" />
            ) : (
              <ChevronDown size={14} stroke="currentColor" />
            )}
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={handleClose}
            aria-label="Close plugin"
            title="Close"
          >
            <X size={14} stroke="currentColor" />
          </button>
        </div>
      </header>

      {/* When not collapsed, render Tabs, Content and Footer */}
      {!isCollapsed && (
        <>
          {/* Tab Navigation (36px) */}
          <nav className="framefic-tab-bar" aria-label="Plugin navigation">
            <div className="framefic-tabs-list">
              <button
                type="button"
                className={`framefic-tab ${activeTab === "home" ? "active" : ""}`}
                onClick={() => onSelectTab("home")}
              >
                Home
              </button>
              <button
                type="button"
                className={`framefic-tab ${activeTab === "builder" ? "active" : ""}`}
                onClick={() => onSelectTab("builder")}
              >
                Builder
              </button>
              <button
                type="button"
                className={`framefic-tab ${activeTab === "members" ? "active" : ""}`}
                onClick={() => onSelectTab("members")}
              >
                Members
              </button>
              <button
                type="button"
                className={`framefic-tab ${activeTab === "tiers" ? "active" : ""}`}
                onClick={() => onSelectTab("tiers")}
              >
                Tiers
              </button>
              <button
                type="button"
                className={`framefic-tab ${activeTab === "settings" ? "active" : ""}`}
                onClick={() => onSelectTab("settings")}
              >
                Settings
              </button>
            </div>
            <div className="framefic-tab-spacer" />
          </nav>

          {/* Scrollable Content Area */}
          <main className="framefic-content-area">{children}</main>

          {/* Plugin Footer (40px) */}
          <footer className="framefic-footer">
            <a
              href="https://framefic.com"
              target="_blank"
              rel="noopener noreferrer"
              className="framefic-footer-link"
            >
              <span>@Framefic</span>
              <ExternalLink size={11} stroke="currentColor" />
            </a>
            <span className="framefic-footer-version">v1.0.0</span>
          </footer>
        </>
      )}
    </div>
  );
};
