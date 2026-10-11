import React, { useState } from "react";
import { CreditCard, Sun, Moon, Monitor, CheckCircle2, Globe, ShieldAlert } from "lucide-react";
import { usePluginStorage } from "../../hooks/usePluginStorage";
import { PaymentGatewaySettings } from "../../types";
import "./SettingsTab.css";

const DEFAULT_SETTINGS: PaymentGatewaySettings = {
  stripePublishableKey: "pk_test_sample51N8xMemberFrame",
  defaultCurrency: "USD",
  testMode: true,
};

export const SettingsTab: React.FC = () => {
  const [settings, setSettings, isLoading] = usePluginStorage<PaymentGatewaySettings>(
    "settings",
    DEFAULT_SETTINGS
  );

  const [formKey, setFormKey] = useState(settings.stripePublishableKey);
  const [currency, setCurrency] = useState(settings.defaultCurrency);
  const [testMode, setTestMode] = useState(settings.testMode);

  const [userTheme, setUserTheme] = useState(() => {
    return localStorage.getItem("memberframe_user_theme") || "system";
  });
  const [isSaved, setIsSaved] = useState(false);

  // Sync state if settings finish loading from Framer project data
  React.useEffect(() => {
    if (!isLoading) {
      setFormKey(settings.stripePublishableKey);
      setCurrency(settings.defaultCurrency);
      setTestMode(settings.testMode);
    }
  }, [isLoading, settings]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await setSettings({
      ...settings,
      stripePublishableKey: formKey,
      defaultCurrency: currency,
      testMode,
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleThemeChange = (theme: "system" | "dark" | "light") => {
    setUserTheme(theme);
    localStorage.setItem("memberframe_user_theme", theme);
    if (theme === "system") {
      document.documentElement.removeAttribute("data-user-theme");
      document.body.removeAttribute("data-framer-theme");
    } else {
      document.documentElement.setAttribute("data-user-theme", theme);
      document.body.setAttribute("data-framer-theme", theme);
    }
  };

  return (
    <div className="settings-tab-container">
      {/* Stripe Payment Gateway Setup */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-title-wrap">
            <CreditCard size={14} stroke="currentColor" />
            <h3 className="settings-card-title">Stripe Payment Gateway</h3>
          </div>
          <span className="badge badge-success">
            {testMode ? "Test Mode" : "Live Ready"}
          </span>
        </div>

        <form onSubmit={handleSaveSettings}>
          <div className="field-rows">
            <div className="field-row">
              <label htmlFor="stripe-publishable-key" className="field-row-label">
                Publishable Key
              </label>
              <div className="field-row-control fill">
                <input
                  id="stripe-publishable-key"
                  type="text"
                  className="input-text"
                  placeholder="pk_live_... or pk_test_..."
                  value={formKey}
                  onChange={(e) => setFormKey(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="field-row">
              <label htmlFor="currency-select" className="field-row-label">
                Default Currency
              </label>
              <div className="field-row-control">
                <select
                  id="currency-select"
                  className="input-select"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="CAD">CAD ($)</option>
                  <option value="AUD">AUD ($)</option>
                </select>
              </div>
            </div>

            <div className="field-row">
              <label htmlFor="test-mode-toggle" className="field-row-label">
                Sandbox Mode
              </label>
              <div className="field-row-control">
                <input
                  id="test-mode-toggle"
                  type="checkbox"
                  checked={testMode}
                  onChange={(e) => setTestMode(e.target.checked)}
                />
              </div>
            </div>

            <button type="submit" className="primary-cta btn-sm">
              {isSaved ? (
                <>
                  <CheckCircle2 size={13} stroke="currentColor" />
                  <span>Saved to Framer Project</span>
                </>
              ) : (
                <span>Save Gateway Settings</span>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Security & Client-Side Notice */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-title-wrap">
            <ShieldAlert size={14} stroke="currentColor" />
            <h3 className="settings-card-title">Security Architecture</h3>
          </div>
        </div>
        <p className="preview-studio__description">
          MemberFrame uses a 100% client-safe model. Only your Stripe <strong>Publishable Key</strong> is stored. Secret API keys are never stored on client devices.
        </p>
      </div>

      {/* Theme Preference */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-title-wrap">
            <Globe size={14} stroke="currentColor" />
            <h3 className="settings-card-title">Plugin Appearance</h3>
          </div>
        </div>

        <div className="field-rows">
          <span className="field-row-label">Workspace Theme Override</span>
          <div className="theme-options-grid">
            <button
              type="button"
              className={`theme-btn ${userTheme === "system" ? "active" : ""}`}
              onClick={() => handleThemeChange("system")}
            >
              <Monitor size={12} stroke="currentColor" />
              <span>System</span>
            </button>
            <button
              type="button"
              className={`theme-btn ${userTheme === "dark" ? "active" : ""}`}
              onClick={() => handleThemeChange("dark")}
            >
              <Moon size={12} stroke="currentColor" />
              <span>Dark</span>
            </button>
            <button
              type="button"
              className={`theme-btn ${userTheme === "light" ? "active" : ""}`}
              onClick={() => handleThemeChange("light")}
            >
              <Sun size={12} stroke="currentColor" />
              <span>Light</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
