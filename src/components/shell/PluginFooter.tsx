import React from "react";
import { ExternalLink } from "lucide-react";

export interface PluginFooterProps {
  version: string;
  companyName: string;
  companyUrl: string;
  changelogUrl: string;
}

/** 40px, pinned. Company link left, version tag right. PRD section 7.2. */
export const PluginFooter: React.FC<PluginFooterProps> = ({
  version,
  companyName,
  companyUrl,
  changelogUrl,
}) => (
  <footer className="framefic-footer">
    <a
      className="framefic-footer-link"
      href={companyUrl}
      target="_blank"
      rel="noreferrer noopener"
    >
      <ExternalLink aria-hidden={true} />
      {companyName}
    </a>
    <a
      className="framefic-footer-version"
      href={changelogUrl}
      target="_blank"
      rel="noreferrer noopener"
      title="Open the changelog"
    >
      v{version}
    </a>
  </footer>
);
