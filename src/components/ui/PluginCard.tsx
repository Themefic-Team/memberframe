import React from "react";
import { ArrowUpRight } from "lucide-react";

export interface PluginCardProps {
  name: string;
  description: string;
  /** The sibling plugin's logo glyph, shown on the 44px brand-gradient tile. */
  logo: React.ReactNode;
  href: string;
}

/**
 * Foundations Content: Plugin card ("More from Framefic").
 *
 * Sibling Pixelfic plugins only, listed below Help. bg/raised, radius 14,
 * hairline, Shadow/Card; hover is border/brand plus a lifted shadow. The
 * trailing arrow says the card opens the browser, and the accessible name
 * says so too.
 */
export const PluginCard: React.FC<PluginCardProps> = ({ name, description, logo, href }) => (
  <a
    className="framefic-card"
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    aria-label={`${name}: ${description}. Opens in your browser`}
  >
    <span className="framefic-card-logo" aria-hidden={true}>
      {logo}
    </span>
    <span className="framefic-card-info">
      <span className="framefic-card-name">{name}</span>
      <span className="framefic-card-desc">{description}</span>
    </span>
    <span className="framefic-card-open" aria-hidden={true}>
      <ArrowUpRight />
    </span>
  </a>
);

export const PluginCardList: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="framefic-card-list">{children}</div>
);
