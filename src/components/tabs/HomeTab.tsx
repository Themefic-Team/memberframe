import React from "react";
import {
  Sparkles,
  BookOpen,
  Headphones,
  Lightbulb,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { NavTabId } from "../shell/PluginShell";
import "./HomeTab.css";

interface HomeTabProps {
  onNavigate: (tab: NavTabId) => void;
}

export const HomeTab: React.FC<HomeTabProps> = ({ onNavigate }) => {
  return (
    <div className="home-tab-container">
      {/* Hero Card */}
      <div className="home-hero-card">
        <div className="home-hero-badge">
          <Sparkles size={12} stroke="currentColor" />
          <span>In-Framer Membership</span>
        </div>

        <h1 className="home-hero-title">Welcome to MemberFrame</h1>
        <p className="home-hero-description">
          The complete membership and recurring monetization suite. Manage
          tiers, members, and gating rules 100% inside Framer with zero external
          dashboards.
        </p>

        {/* Live Metrics */}
        <div className="home-metrics-grid">
          <div className="metric-tile">
            <span className="metric-label">Active Members</span>
            <span className="metric-value">124</span>
          </div>
          <div className="metric-tile">
            <span className="metric-label">Monthly Revenue</span>
            <span className="metric-value">$1,420</span>
          </div>
        </div>

        {/* Mandatory .primary-cta */}
        <button
          type="button"
          className="primary-cta"
          onClick={() => onNavigate("tiers")}
        >
          <span>Configure Membership Tiers</span>
          <ArrowRight size={14} stroke="currentColor" />
        </button>
      </div>

      {/* Quick Setup Notice */}
      <div className="field-rows">
        <h2 className="section-heading">Resources and Support</h2>

        <div className="home-help-grid">
          <a
            href="https://framefic.com/docs/memberframe"
            target="_blank"
            rel="noopener noreferrer"
            className="help-tile"
          >
            <div className="help-tile-icon">
              <BookOpen size={15} stroke="currentColor" />
            </div>
            <h3 className="help-tile-title">Docs & Guide</h3>
            <p className="help-tile-desc">
              Step-by-step setup tutorials and canvas components.
            </p>
          </a>

          <a
            href="https://framefic.com/support"
            target="_blank"
            rel="noopener noreferrer"
            className="help-tile"
          >
            <div className="help-tile-icon">
              <Headphones size={15} stroke="currentColor" />
            </div>
            <h3 className="help-tile-title">Get Support</h3>
            <p className="help-tile-desc">
              Fast assistance from the engineering team.
            </p>
          </a>

          <a
            href="https://framefic.com/feedback"
            target="_blank"
            rel="noopener noreferrer"
            className="help-tile"
          >
            <div className="help-tile-icon">
              <Lightbulb size={15} stroke="currentColor" />
            </div>
            <h3 className="help-tile-title">Feature Request</h3>
            <p className="help-tile-desc">
              Suggest new ideas for upcoming releases.
            </p>
          </a>

          <button
            type="button"
            className="help-tile"
            onClick={() => onNavigate("builder")}
          >
            <div className="help-tile-icon">
              <ShieldAlert size={15} stroke="currentColor" />
            </div>
            <h3 className="help-tile-title">Canvas Builder</h3>
            <p className="help-tile-desc">
              Insert gates, paywalls, and auth modals.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
};
