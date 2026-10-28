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
  companyName: "Framefic",
  /** The footer handle, as the Figma Plugin footer writes it. */
  companyHandle: "@Framefic",
  companyUrl: "https://framefic.com",
  changelogUrl: "https://framefic.com/memberframe/changelog",
  /** Linked from the consent line before sign in (Marketplace audit C3). UNCONFIRMED, task 8.8. */
  privacyUrl: "https://framefic.com/privacy",
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

export type SiblingPluginId = "beaf" | "connectfic" | "crestbar";

/**
 * "More from Framefic": sibling plugins only, per the Foundations Content doc.
 * Names, descriptions, logos, and Marketplace links are BEAF's own "More from
 * Framefic" section, so every Framefic plugin lists its siblings the same way.
 * Each logo is a file in `public/`, copied from BEAF.
 */
export const SIBLING_PLUGINS: ReadonlyArray<{
  id: SiblingPluginId;
  name: string;
  description: string;
  logo: string;
  href: string;
}> = [
  {
    id: "beaf",
    name: "Before After Images Slider",
    description: "Advanced image slider fully customizable and responsive",
    logo: "/Beaf.png",
    href: "https://www.framer.com/marketplace/plugins/beaf/",
  },
  {
    id: "connectfic",
    name: "Connectfic",
    description: "Connect your framer site with shopify store and components",
    logo: "/Connectfic.png",
    href: "https://www.framer.com/marketplace/plugins/connectfic/",
  },
  {
    id: "crestbar",
    name: "Announcement Bar",
    description: "Create bars and countdown timers to boost engagement and conversions.",
    logo: "/Crestbar.png",
    href: "https://www.framer.com/community/marketplace/plugins/announcement-bar/",
  },
];

/** Mirrors `version` in framer.json. Keep the two in step at packaging time. */
export const PLUGIN_VERSION = "1.0.0";

/**
 * Setup guides, one per sign-in provider and payment gateway, linked from the
 * top of each one's settings sheet. UNCONFIRMED like the links above (task
 * 8.8): they follow the sections of docs/integrations-setup-guide.md under the
 * docs address. Replace them with the published guide's real addresses.
 */
export type SetupGuideId = "google" | "github" | "apple" | "discord" | "stripe" | "lemonsqueezy" | "razorpay";

export const SETUP_GUIDES: Record<SetupGuideId, string> = {
  google: `${HELP_LINKS.guide}/sign-in/google`,
  github: `${HELP_LINKS.guide}/sign-in/github`,
  apple: `${HELP_LINKS.guide}/sign-in/apple`,
  discord: `${HELP_LINKS.guide}/sign-in/discord`,
  stripe: `${HELP_LINKS.guide}/payments/stripe`,
  lemonsqueezy: `${HELP_LINKS.guide}/payments/lemon-squeezy`,
  razorpay: `${HELP_LINKS.guide}/payments/razorpay`,
};
