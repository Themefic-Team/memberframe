import React from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "../../utils/cn";

export type BannerTone = "info" | "success" | "warning" | "danger";

export interface BannerProps {
  tone?: BannerTone;
  title: string;
  message?: string;
  /**
   * One next step: a button (`onClick`), or a link that opens in the browser
   * (`href`). A link for an address already known, so the panel never calls
   * `window.open` (Marketplace audit I2).
   */
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
}

const TONE_ICON: Record<BannerTone, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

/**
 * Persistent screen state. Maximum two per screen, per PRD section 7.5.
 * A finished action belongs in a toast, and a field validation error belongs
 * inline under its field, not here.
 */
export const Banner: React.FC<BannerProps> = ({ tone = "info", title, message, action }) => {
  const Icon = TONE_ICON[tone];

  return (
    <div
      className={cn("framefic-banner", `banner-${tone}`)}
      role={tone === "danger" ? "alert" : "status"}
    >
      <span className="banner-icon">
        <Icon aria-hidden={true} />
      </span>
      <div className="banner-body">
        <p className="banner-title">{title}</p>
        {message ? <p className="banner-message">{message}</p> : null}
        {action ? (
          <span className="banner-action-wrap">
            {action.href ? (
              <a className="banner-action-btn" href={action.href} target="_blank" rel="noopener noreferrer" onClick={action.onClick}>
                {action.label}
              </a>
            ) : (
              <button type="button" className="banner-action-btn" onClick={action.onClick}>
                {action.label}
              </button>
            )}
          </span>
        ) : null}
      </div>
    </div>
  );
};
