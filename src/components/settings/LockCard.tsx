import React from "react";
import { ChevronRight } from "lucide-react";
import { Toggle } from "../ui";

/**
 * A lock's card, page or section: the status dot, its name and badge, the
 * toggle that applies at once, and a chevron. A click opens its sheet.
 */
export const LockCard: React.FC<{
  title: string;
  badge?: string;
  enabled: boolean;
  toggleId: string;
  toggleLabel: string;
  disabled: boolean;
  onToggle: (checked: boolean) => void;
  onOpen: () => void;
}> = ({ title, badge, enabled, toggleId, toggleLabel, disabled, onToggle, onOpen }) => (
  <div className="page-rule-card">
    <div
      className="page-rule-card-header"
      role="button"
      tabIndex={0}
      aria-haspopup="dialog"
      aria-label={`Edit ${title}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="page-rule-info">
        <span className="page-rule-status-dot" data-enabled={enabled} title={enabled ? "Lock on" : "Lock off"} />
        <span className="page-rule-title">{title}</span>
        {badge ? <span className="page-rule-path-badge">{badge}</span> : null}
      </div>
      {/* The toggle acts on its own: a click on it must not open the sheet. */}
      <div className="page-rule-header-actions">
        <span className="page-rule-toggle" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <Toggle id={toggleId} checked={enabled} onChange={onToggle} label={toggleLabel} disabled={disabled} />
        </span>
        <span className="page-rule-chevron">
          <ChevronRight aria-hidden={true} />
        </span>
      </div>
    </div>
  </div>
);
