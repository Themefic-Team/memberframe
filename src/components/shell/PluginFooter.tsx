import React from "react";
import { ArrowUpRight } from "lucide-react";

export interface PluginFooterProps {
  version: string;
  /** Shown as written, for example "@Framefic". */
  companyHandle: string;
  companyUrl: string;
  changelogUrl: string;
}

/**
 * 40px, pinned, bg/secondary with a top hairline. Company handle left with a
 * brand ArrowUpRight after it, version tag right, both Body/Small in
 * text/tertiary. Matches the Figma Plugin footer. PRD section 7.2.
 */
export const PluginFooter: React.FC<PluginFooterProps> = ({
  version,
  companyHandle,
  companyUrl,
  changelogUrl,
}) => (
  <footer className="framefic-footer">
    <a
      className="framefic-footer-link"
      href={companyUrl}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={`${companyHandle}, opens in your browser`}
    >
      {companyHandle}
      <ArrowUpRight aria-hidden={true} />
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
