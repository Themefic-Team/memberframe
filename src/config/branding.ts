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

export type SiblingPluginId = "social-share" | "store-locator" | "beaf" | "connectfic" | "crestbar" | "cms-filter" | "formfic" | "chat-bubbles" | "auto-toc";

/**
 * "More From Framefic": every published Framefic plugin but this one, the
 * same list Hydra Booking shows (2026-11-24). Each logo is a file in
 * `public/`, bundled, never loaded from a CDN. `isNew` shows the kit's New badge.
 */
export const SIBLING_PLUGINS: ReadonlyArray<{ id: SiblingPluginId; name: string; description: string; logo: string; href: string; isNew?: boolean }> = [
  {
    id: "social-share",
    name: "Social Share",
    description: "Share buttons for 13+ platforms, with counts and custom styles.",
    logo: "/SocialShare.svg",
    href: "https://www.framer.com/marketplace/plugins/social-share/",
    isNew: true,
  },
  {
    id: "store-locator",
    name: "Store Locator",
    description: "Interactive maps, store finder, custom pins, and CMS locations.",
    logo: "/StoreLocator.png",
    href: "https://www.framer.com/marketplace/plugins/store-locator/",
    isNew: true,
  },
  {
    id: "beaf",
    name: "Before After Images Slider",
    description: "Advanced image slider fully customizable and responsive.",
    logo: "/Beaf.png",
    href: "https://www.framer.com/marketplace/plugins/beaf/",
  },
  {
    id: "connectfic",
    name: "Connectfic",
    description: "Connect your Framer site with a Shopify store and components.",
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
  {
    id: "cms-filter",
    name: "CMS Filter",
    description: "Real time search, multi filters, and animations for Framer CMS.",
    logo: "/CmsFilter.png",
    href: "https://www.framer.com/marketplace/plugins/cms-filter/",
  },
  {
    id: "formfic",
    name: "Formfic",
    description: "Powerful customizable forms, validation, and multi step workflows.",
    logo: "/Formfic.png",
    href: "https://www.framer.com/marketplace/plugins/formfic/",
  },
  {
    id: "chat-bubbles",
    name: "Chat Bubbles",
    description: "Interactive floating chat widgets and customer engagement prompts.",
    logo: "/ChatBubbles.png",
    href: "https://www.framer.com/marketplace/plugins/chat-bubbles/",
  },
  {
    id: "auto-toc",
    name: "Auto Table of Contents",
    description: "Generate a clean, automatic table of contents for blogs and docs.",
    logo: "/AutoToc.png",
    href: "https://www.framer.com/marketplace/plugins/auto-table-of-contents/",
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
