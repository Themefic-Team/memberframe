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
  companyUrl: "https://framefic.com",
  changelogUrl: "https://framefic.com/memberframe/changelog",
} as const;

/** Mirrors `version` in framer.json. Keep the two in step at packaging time. */
export const PLUGIN_VERSION = "1.0.0";
