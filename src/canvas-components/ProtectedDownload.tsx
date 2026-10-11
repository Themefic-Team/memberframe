import React, { useEffect, useState } from "react";
import { addPropertyControls, ControlType } from "framer";

export interface ProtectedDownloadProps {
  assetName?: string;
  fileSize?: string;
  requiredTier?: "all_paid" | "pro" | "vip";
  buttonText?: string;
  tokenExpiryMinutes?: number;
}

const PROTECTED_DOWNLOAD_CSS = `
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
  box-sizing: border-box;
  transition: opacity 150ms ease;
}

.mf-download-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
`;

function injectStyles(id: string, cssText: string): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(id)) return;
  const styleEl = document.createElement("style");
  styleEl.id = id;
  styleEl.textContent = cssText;
  document.head.appendChild(styleEl);
}

const FileArchiveIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="16" height="20" x="4" y="2" rx="2" />
    <path d="M10 2v4" />
    <path d="M14 2v4" />
    <path d="M10 10v4" />
    <path d="M14 10v4" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" x2="12" y1="15" y2="3" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export default function ProtectedDownload({
  assetName = "Design System Kit 2026.zip",
  fileSize = "48.5 MB",
  requiredTier = "all_paid",
  buttonText = "Download Asset",
  tokenExpiryMinutes = 15,
}: ProtectedDownloadProps): React.JSX.Element {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    injectStyles("mf-protected-download-styles", PROTECTED_DOWNLOAD_CSS);
  }, []);

  const handleDownload = () => {
    setDownloading(true);
    setTimeout(() => {
      setDownloading(false);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 3000);
    }, 1200);
  };

  return (
    <div className="mf-download-card">
      <div className="mf-download-info">
        <div className="mf-download-icon-box">
          <FileArchiveIcon />
        </div>
        <div>
          <h4 className="mf-download-name">{assetName}</h4>
          <p className="mf-download-size">
            {fileSize} · Expiring signed link ({tokenExpiryMinutes}m valid)
          </p>
        </div>
      </div>

      <button
        type="button"
        className="mf-download-btn"
        onClick={handleDownload}
        disabled={downloading}
      >
        {downloaded ? (
          <>
            <CheckCircleIcon />
            <span>Link Generated</span>
          </>
        ) : (
          <>
            <DownloadIcon />
            <span>{downloading ? "Signing Vault..." : buttonText}</span>
          </>
        )}
      </button>
    </div>
  );
}

export { ProtectedDownload };

addPropertyControls(ProtectedDownload, {
  assetName: {
    type: ControlType.String,
    title: "Filename",
    defaultValue: "Design System Kit 2026.zip",
  },
  fileSize: {
    type: ControlType.String,
    title: "File Size",
    defaultValue: "48.5 MB",
  },
  requiredTier: {
    type: ControlType.Enum,
    title: "Required Tier",
    options: ["all_paid", "pro", "vip"],
    optionTitles: ["All Paid Members", "Pro Member", "VIP Member"],
    defaultValue: "all_paid",
  },
  buttonText: {
    type: ControlType.String,
    title: "Button Text",
    defaultValue: "Download Asset",
  },
  tokenExpiryMinutes: {
    type: ControlType.Number,
    title: "Link Valid (Min)",
    min: 5,
    max: 120,
    defaultValue: 15,
  },
});
