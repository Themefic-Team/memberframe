/**
 * Panel chrome strings and links.
 *
 * UNCONFIRMED: the two URLs below are placeholders. The PRD names only the
 * backend host (`api.memberframe.framefic.com`, PRD section 10) and never gives
 * a marketing site or a changelog location. Replace both with the real
 * addresses before packaging, PRD task 8.8. They are centralised here so that
 * is a one-line change rather than a hunt through the shell.
 */
export const BRANDING = {
  pluginName: "MemberFrame",
  companyName: "Pixelfic",
  /** The footer handle, as the Figma Plugin footer writes it. */
  companyHandle: "@Framefic",
  companyUrl: "https://framefic.com",
  changelogUrl: "https://framefic.com/memberframe/changelog",
} as const;

/**
 * The Home tab Help row: Guide, Contact us, Changelog, per the Foundations
 * Content doc. UNCONFIRMED like the URLs above; same task 8.8.
 */
export const HELP_LINKS = {
  guide: `${BRANDING.companyUrl}/memberframe/docs`,
  contact: `${BRANDING.companyUrl}/support`,
  changelog: BRANDING.changelogUrl,
} as const;

export type SiblingPluginId = "crestbar" | "beaf" | "formfic";

/**
 * "More from Pixelfic": sibling plugins only, per the Foundations Content doc.
 * Names and descriptions are the ones in the Figma Home tab. UNCONFIRMED: each
 * href is the company site until the real listing URLs are known, task 8.8.
 */
export const SIBLING_PLUGINS: ReadonlyArray<{
  id: SiblingPluginId;
  name: string;
  description: string;
  href: string;
}> = [
  { id: "crestbar", name: "Crestbar", description: "Marketing & design widgets", href: BRANDING.companyUrl },
  { id: "beaf", name: "BEAF", description: "Advanced before & after image slider", href: BRANDING.companyUrl },
  { id: "formfic", name: "Formfic", description: "Send form submissions to connected tools", href: BRANDING.companyUrl },
];

/** Mirrors `version` in framer.json. Keep the two in step at packaging time. */
export const PLUGIN_VERSION = "1.0.0";
