import React from "react";
import { ChevronDown, ChevronUp, ShieldCheck, X } from "lucide-react";
import { IconButton } from "../ui";

export interface PluginHeaderProps {
  title: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onClose: () => void;
}

/**
 * 48px. Logo, plugin name, collapse toggle, close. PRD section 7.2.
 *
 * The chevron flips direction with the collapsed state so the control reads as
 * "what will happen" rather than "what is true".
 */
export const PluginHeader: React.FC<PluginHeaderProps> = ({
  title,
  collapsed,
  onToggleCollapse,
  onClose,
}) => (
  <header className="framefic-header">
    <div className="framefic-header-brand">
      <span className="framefic-header-logo">
        <ShieldCheck aria-hidden={true} />
      </span>
      <h1 className="framefic-header-title">{title}</h1>
    </div>
    <div className="framefic-header-actions">
      <IconButton
        label={collapsed ? "Expand panel" : "Collapse panel"}
        onClick={onToggleCollapse}
      >
        {collapsed ? <ChevronUp aria-hidden={true} /> : <ChevronDown aria-hidden={true} />}
      </IconButton>
      <IconButton label="Close plugin" onClick={onClose}>
        <X aria-hidden={true} />
      </IconButton>
    </div>
  </header>
);
