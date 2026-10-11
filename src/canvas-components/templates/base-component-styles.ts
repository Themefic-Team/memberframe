/**
 * Base Component Styles for Framer Canvas Components
 * Strict Zero Inline CSS Rule · Master External CSS String Templates
 */

export const MEMBER_GATE_BASE_CSS = `
.mf-gate-container,
.memberframe-gate-container {
  position: relative;
  width: 100%;
  min-height: 120px;
  box-sizing: border-box;
}

.mf-gate-content {
  width: 100%;
  transition: filter 200ms ease, opacity 200ms ease;
}

.mf-gate-content--locked-blur,
.memberframe-blur-overlay {
  filter: blur(var(--mf-blur-radius, 8px));
  user-select: none;
  pointer-events: none;
  opacity: 0.6;
}

.mf-gate-content--locked-hidden {
  display: none !important;
}

.mf-gate-overlay,
.memberframe-lock-card {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  background: rgba(18, 18, 18, 0.82);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  text-align: center;
  z-index: 10;
}

.mf-gate-overlay__icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(82, 113, 255, 0.16);
  border: 1px solid rgba(82, 113, 255, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #708aff;
}

.mf-gate-overlay__title {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 17px;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
}

.mf-gate-overlay__desc {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  color: #a1a1aa;
  max-width: 340px;
  line-height: 1.5;
  margin: 0;
}

.mf-gate-overlay__cta {
  background: linear-gradient(180deg, #5271ff 0%, #3b51b8 100%);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 10px 22px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(82, 113, 255, 0.35);
  transition: transform 150ms ease, box-shadow 150ms ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.mf-gate-overlay__cta:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(82, 113, 255, 0.45);
}
`;

export const MEMBER_AUTH_BASE_CSS = `
.mf-auth-card {
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
  padding: 28px 24px;
  background: #201f1f;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.4);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #ffffff;
  box-sizing: border-box;
}

.mf-auth-header {
  text-align: center;
  margin-bottom: 22px;
}

.mf-auth-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 6px 0;
}

.mf-auth-subtitle {
  font-size: 13px;
  color: #95a3b2;
  margin: 0;
  line-height: 1.4;
}

.mf-auth-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.mf-auth-input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mf-auth-label {
  font-size: 12px;
  font-weight: 500;
  color: #edf0f7;
}

.mf-auth-input {
  height: 40px;
  padding: 0 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: #ffffff;
  font-size: 14px;
  outline: none;
  transition: border-color 150ms ease;
}

.mf-auth-input:focus {
  border-color: #5271ff;
  box-shadow: 0 0 0 3px rgba(82, 113, 255, 0.25);
}

.mf-auth-btn-submit {
  height: 42px;
  background: linear-gradient(180deg, #5271ff 0%, #3b51b8 100%);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: opacity 150ms ease, transform 150ms ease;
}

.mf-auth-btn-submit:hover {
  opacity: 0.95;
  transform: translateY(-1px);
}

.mf-auth-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
  color: #6f7b87;
  font-size: 11px;
  text-transform: uppercase;
}

.mf-auth-divider::before,
.mf-auth-divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
}

.mf-auth-btn-google {
  height: 40px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: #ffffff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition: background 150ms ease;
}

.mf-auth-btn-google:hover {
  background: rgba(255, 255, 255, 0.1);
}

.mf-auth-otp-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.mf-auth-otp-digit {
  width: 44px;
  height: 52px;
  text-align: center;
  font-size: 20px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  color: #ffffff;
}

.mf-auth-otp-digit:focus {
  border-color: #5271ff;
  box-shadow: 0 0 0 3px rgba(82, 113, 255, 0.25);
}
`;

export const MEMBER_DASHBOARD_BASE_CSS = `
.mf-dashboard-card {
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
  padding: 24px;
  background: #201f1f;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #ffffff;
  box-sizing: border-box;
}

.mf-dashboard-user-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 18px;
}

.mf-dashboard-user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mf-dashboard-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #3b3a3a;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #edf0f7;
  font-weight: 600;
  font-size: 16px;
}

.mf-dashboard-name {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 2px 0;
}

.mf-dashboard-email {
  font-size: 12px;
  color: #95a3b2;
  margin: 0;
}

.mf-dashboard-sub-panel {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.mf-dashboard-tier-title {
  font-size: 14px;
  font-weight: 600;
  color: #edf0f7;
  margin: 0 0 4px 0;
}

.mf-dashboard-tier-desc {
  font-size: 12px;
  color: #95a3b2;
  margin: 0;
}

.mf-dashboard-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mf-dashboard-btn-manage {
  width: 100%;
  height: 38px;
  background: linear-gradient(180deg, #5271ff 0%, #3b51b8 100%);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.mf-dashboard-btn-cancel {
  width: 100%;
  height: 36px;
  background: transparent;
  color: #f87171;
  border: 1px solid rgba(248, 113, 113, 0.2);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 150ms ease;
}

.mf-dashboard-btn-cancel:hover {
  background: rgba(248, 113, 113, 0.1);
}
`;

export const METERED_PAYWALL_BASE_CSS = `
.mf-metered-pill {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: rgba(24, 24, 27, 0.94);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 9999px;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.4);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  color: #edf0f7;
  z-index: 999;
}

.mf-metered-pill-badge {
  background: rgba(82, 113, 255, 0.2);
  color: #708aff;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
}

.mf-metered-pill-btn {
  background: #5271ff;
  color: #ffffff;
  border: none;
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
}

.mf-metered-locked-card {
  width: 100%;
  padding: 32px 20px;
  background: #201f1f;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  box-sizing: border-box;
}
`;

export const CMS_GATED_TEMPLATE_BASE_CSS = `
.mf-cms-gate-wrapper {
  position: relative;
  width: 100%;
}

.mf-cms-excerpt-fade {
  position: relative;
  overflow: hidden;
}

.mf-cms-excerpt-fade::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 120px;
  background: linear-gradient(180deg, rgba(32, 31, 31, 0) 0%, rgba(32, 31, 31, 1) 100%);
  pointer-events: none;
}

.mf-cms-lock-banner {
  margin-top: 16px;
  padding: 24px;
  background: #201f1f;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.mf-cms-lock-title {
  font-size: 16px;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
}

.mf-cms-lock-desc {
  font-size: 13px;
  color: #95a3b2;
  max-width: 380px;
  margin: 0;
  line-height: 1.5;
}
`;

export const PROTECTED_DOWNLOAD_BASE_CSS = `
.mf-download-card {
  width: 100%;
  max-width: 440px;
  background: #201f1f;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 18px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #ffffff;
  box-sizing: border-box;
}

.mf-download-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mf-download-icon-box {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: rgba(82, 113, 255, 0.12);
  border: 1px solid rgba(82, 113, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #708aff;
  flex-shrink: 0;
}

.mf-download-name {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 2px 0;
  color: #edf0f7;
}

.mf-download-size {
  font-size: 11px;
  color: #8d9ba8;
  margin: 0;
}

.mf-download-btn {
  height: 36px;
  padding: 0 16px;
  background: linear-gradient(180deg, #5271ff 0%, #3b51b8 100%);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
`;

export const COURSE_PROGRESS_BASE_CSS = `
.mf-course-progress-card {
  width: 100%;
  max-width: 480px;
  background: #201f1f;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #ffffff;
  box-sizing: border-box;
}

.mf-course-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.mf-course-title {
  font-size: 14px;
  font-weight: 600;
  color: #edf0f7;
  margin: 0;
}

.mf-course-percent {
  font-size: 12px;
  font-weight: 700;
  color: #708aff;
}

.mf-progress-track {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 16px;
}

.mf-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #5271ff 0%, #34d399 100%);
  border-radius: 999px;
  transition: width 300ms ease;
}

.mf-lesson-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mf-lesson-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  font-size: 12px;
  color: #c7ccd6;
  cursor: pointer;
  transition: background 150ms ease;
}

.mf-lesson-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.mf-lesson-completed {
  color: #34d399;
}
`;

export const DONATION_SLIDER_BASE_CSS = `
.mf-donation-card {
  width: 100%;
  max-width: 420px;
  background: #201f1f;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  padding: 24px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #ffffff;
  box-sizing: border-box;
  text-align: center;
}

.mf-donation-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 6px 0;
  color: #ffffff;
}

.mf-donation-desc {
  font-size: 12px;
  color: #95a3b2;
  margin: 0 0 20px 0;
}

.mf-donation-amount-display {
  font-size: 36px;
  font-weight: 800;
  color: #708aff;
  margin-bottom: 16px;
  letter-spacing: -0.5px;
}

.mf-donation-slider-input {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  outline: none;
  margin-bottom: 20px;
  cursor: pointer;
}

.mf-donation-presets {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 20px;
}

.mf-donation-preset-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 600;
  color: #edf0f7;
  cursor: pointer;
  transition: all 150ms ease;
}

.mf-donation-preset-btn--active {
  background: #5271ff;
  border-color: #5271ff;
  color: #ffffff;
}

.mf-donation-submit-btn {
  width: 100%;
  height: 42px;
  background: linear-gradient(180deg, #5271ff 0%, #3b51b8 100%);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: transform 150ms ease;
}

.mf-donation-submit-btn:hover {
  transform: translateY(-1px);
}
`;

/**
 * Injects a scoped CSS string template into the document head if not already present.
 */
export function injectCanvasStyles(id: string, cssText: string): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(id)) return;

  const styleEl = document.createElement("style");
  styleEl.id = id;
  styleEl.textContent = cssText;
  document.head.appendChild(styleEl);
}
