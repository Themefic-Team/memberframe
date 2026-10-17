import React from "react";

export interface HelpTileProps {
  label: string;
  icon: React.ReactNode;
  href: string;
  /** Brand dot on the icon, for example on Changelog after an update. */
  hasDot?: boolean;
}

/**
 * Foundations Content: Help tile. Use exactly three in a `<HelpTileRow>`,
 * equal width: Guide (FileText), Contact us (Mail), Changelog (List).
 *
 * Help tiles are links out to help, never shortcuts into the plugin. Routing
 * into a tab belongs to a Button or a Banner action.
 *
 * Opens in a new browser tab: the panel is an iframe inside Framer, and
 * navigating it would replace the plugin with no way back.
 */
export const HelpTile: React.FC<HelpTileProps> = ({ label, icon, href, hasDot = false }) => (
  <a
    className="help-tile"
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    aria-label={`${label}, opens in your browser`}
  >
    <span className="help-tile-icon-box" aria-hidden={true}>
      {icon}
      {hasDot ? <span className="help-tile-dot" /> : null}
    </span>
    <span className="help-tile-label">{label}</span>
  </a>
);

export const HelpTileRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="help-tile-row">{children}</div>
);
