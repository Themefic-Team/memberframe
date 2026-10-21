/**
 * Canvas component configuration drafts.
 *
 * One interface per insertable component, holding exactly what the Builder tab
 * customizer can edit. These are the inputs to the code generator in task 1.4,
 * so a field here becomes a property control default in generated canvas code.
 */

/** Bounds for a blur radius control, the metered paywall's. */
export const BLUR_MIN = 2;
export const BLUR_MAX = 20;

/* ==========================================================================
   MEMBER AUTH, PRD task 2.5, feature F05
   ========================================================================== */

/** F05 supports a modal overlay and an inline page mode. */
export type AuthDisplayMode = "inline" | "modal";

/** The four OAuth providers F05 names, plus the email code path. */
export type AuthProvider = "otp" | "google" | "apple" | "github" | "discord";

/**
 * Which email method the component opens on, feature plan FP-02.
 *
 * It picks the first view and nothing else. A visitor can always switch, so a
 * creator choosing `password` has not decided that a visitor who prefers a code
 * cannot have one.
 */
export type AuthMethod = "password" | "otp";

/** What opens a Modal Overlay sign-in on a published page (05-member-auth.md). */
export type AuthModalTrigger = "click" | "load" | "scroll";

export interface MemberAuthConfig {
  authMode: AuthDisplayMode;
  /** Modal only: on a click of the trigger, after a delay on load, or at a scroll depth. */
  modalTrigger: AuthModalTrigger;
  /** A link to `#id`, or a layer named `id`, opens the modal. */
  modalTriggerId: string;
  /** On Page Load: seconds, 0 to 60. */
  modalDelay: number;
  /** On Scroll: percent of the page, 0 to 100. */
  modalScrollPercent: number;
  /** On Page Load and On Scroll: once per visit. */
  modalOncePerSession: boolean;
  headline: string;
  welcomeMessage: string;
  emailEnabled: boolean;
  googleEnabled: boolean;
  appleEnabled: boolean;
  githubEnabled: boolean;
  discordEnabled: boolean;
  /**
   * A CSS colour from `ControlType.Color`.
   *
   * The only hardcoded colour literal in the plugin's source, and unavoidable:
   * a canvas component has no access to `design-tokens.css`, so a Color control
   * default has to be a literal. The reference master template does the same.
   *
   * It is also creator-supplied data that ends up inside a CSS declaration at
   * runtime, which makes it an injection surface. `MemberAuth.tsx` sanitizes it
   * before it reaches a style block. See that file's `safeColor`.
   */
  accentColor: string;
  /** Pixels. */
  borderRadius: number;

  /* ---- Feature plan FP-02, email and password ---- */

  /**
   * FP-02: the password path is parity for buyers who distrust OTP, per PRD
   * section 18 conflict 6. Defaults on, because a creator who wants
   * passwordless-only has to turn something off either way, and the market
   * reason for FP-02 is that the absence loses the B2B buyer.
   */
  enablePasswordAuth: boolean;
  /** Which email method the component opens on. See `AuthMethod`. */
  defaultAuthMethod: AuthMethod;
  /**
   * Require a letter and a digit, on top of the 8-character minimum.
   *
   * A hint, not a control: this runs in a component that ships to the browser.
   * See `05-member-auth.md` section 9.3, which also records that NIST SP
   * 800-63B advises against composition rules of exactly this kind.
   */
}

export const AUTH_RADIUS_MIN = 0;
export const AUTH_RADIUS_MAX = 24;

/** Defaults matching the property controls in `MemberAuth.tsx`. */
export const DEFAULT_MEMBER_AUTH_CONFIG: MemberAuthConfig = {
  authMode: "inline",
  modalTrigger: "click",
  modalTriggerId: "sign-in",
  modalDelay: 0,
  modalScrollPercent: 50,
  modalOncePerSession: true,
  headline: "Sign in to continue",
  welcomeMessage: "Use your email or a connected account.",
  emailEnabled: true,
  googleEnabled: true,
  appleEnabled: false,
  githubEnabled: false,
  discordEnabled: false,
  accentColor: "#5271ff",
  borderRadius: 10,
  enablePasswordAuth: true,
  defaultAuthMethod: "password",
};

export const AUTH_PROVIDER_LABELS: Record<AuthProvider, string> = {
  otp: "Email code",
  google: "Google",
  apple: "Apple",
  github: "GitHub",
  discord: "Discord",
};

/* ==========================================================================
   MEMBER DASHBOARD, feature plan FP-08, PRD feature F06
   ========================================================================== */

/**
 * What the Builder tab can edit about `<MemberDashboard>`.
 *
 * `apiBaseUrl`, `siteKey`, `loginPath`, and `afterLogoutPath` are absent on
 * purpose. All four are properties of the CONNECTION rather than of the
 * component: the first two come from the connected site and the last two from
 * the settings document, and the generator bakes all four in at deploy time.
 * Offering them in the customizer would invite a creator to set a login path
 * here that disagrees with the one page locks redirect to, which is a
 * dead end nobody would think to look for.
 */
export interface MemberDashboardConfig {
  headline: string;
  showTier: boolean;
  showBilling: boolean;
  showSignOut: boolean;
  /** FP-09. The editable profile form: name plus the site's custom fields. */
  showProfile: boolean;
  signedOutMessage: string;
  accentColor: string;
  borderRadius: number;
}

export const DASHBOARD_RADIUS_MIN = 0;
export const DASHBOARD_RADIUS_MAX = 32;

/** Defaults copied from the component's own property controls, so the panel and
 * the Framer sidebar open on the same values. */
export const DEFAULT_MEMBER_DASHBOARD_CONFIG: MemberDashboardConfig = {
  headline: "Your account",
  showTier: true,
  showBilling: true,
  showSignOut: true,
  showProfile: true,
  signedOutMessage: "Sign in to see your account.",
  accentColor: "#5271ff",
  borderRadius: 12,
};

/* ==========================================================================
   MEMBER PRICING, feature plan FP-16
   ========================================================================== */

/**
 * What the generator bakes into `<MemberPricing>`. Prices are not here: the
 * component reads them live from the API, so a price edited in Manage, Tiers
 * shows on the published site without redeploying.
 */
export interface MemberPricingConfig {
  headline: string;
  subheadline: string;
  defaultInterval: "month" | "year";
  showLifetime: boolean;
  showFreeTier: boolean;
  highlightTier: string;
  accentColor: string;
  borderRadius: number;
}

export const PRICING_RADIUS_MIN = 0;
export const PRICING_RADIUS_MAX = 40;

export const DEFAULT_MEMBER_PRICING_CONFIG: MemberPricingConfig = {
  headline: "Choose your plan",
  subheadline: "Upgrade, switch, or cancel any time.",
  defaultInterval: "month",
  showLifetime: true,
  showFreeTier: true,
  highlightTier: "",
  accentColor: "#5271ff",
  borderRadius: 16,
};

/* ==========================================================================
   DEDICATED AUTH SCREENS, all deployed from MemberAuth.tsx
   ========================================================================== */

/**
 * Which flows one deployment of `MemberAuth.tsx` offers. Mirrors `AuthScreen`
 * in the component. `all` is `<MemberAuth>`; the others are `<MemberLogin>`,
 * `<MemberRegister>`, `<MemberPasswordReset>`, and `<MemberOtpVerify>`.
 */
export type AuthScreen = "all" | "login" | "register" | "reset" | "otp";

/* ==========================================================================
   CONTENT COMPONENTS: FP-07 soft paywall, FP-12 downloads, FP-10 bookmarks
   ========================================================================== */

/**
 * What the generator bakes into `<MeteredPaywall>`. The rest of its controls
 * (paywall type, Full Access For, paragraphs, SEO markup) start from the
 * component's own defaults and are set in Framer's properties panel.
 */
export interface MeteredPaywallConfig {
  freeQuotaCount: number;
  quotaPeriod: "weekly" | "monthly";
  blurIntensity: number;
  showCounterPill: boolean;
  ctaLabel: string;
  cardTitle: string;
  cardDescription: string;
  accentColor: string;
  borderRadius: number;
}

export const METERED_QUOTA_MIN = 1;
export const METERED_QUOTA_MAX = 100;
export const CONTENT_RADIUS_MAX = 32;

export const DEFAULT_METERED_PAYWALL_CONFIG: MeteredPaywallConfig = {
  freeQuotaCount: 3,
  quotaPeriod: "monthly",
  blurIntensity: 8,
  showCounterPill: true,
  ctaLabel: "Subscribe to continue reading",
  cardTitle: "Enjoying this article?",
  cardDescription: "You have reached your free reading limit for this {period}.",
  accentColor: "#5271ff",
  borderRadius: 14,
};

/**
 * `<ProtectedDownload>`. No tier here: which plan a file needs is set on the
 * file in Manage, Files, and enforced by the server.
 */
export interface ProtectedDownloadConfig {
  buttonText: string;
  lockedButtonText: string;
  iconType: "download" | "file" | "archive" | "code";
  accentColor: string;
  borderRadius: number;
  defaultAssetId?: string;
}

export const DEFAULT_PROTECTED_DOWNLOAD_CONFIG: ProtectedDownloadConfig = {
  buttonText: "Download Source Files",
  lockedButtonText: "Upgrade to Download",
  iconType: "download",
  accentColor: "#5271ff",
  borderRadius: 12,
  defaultAssetId: "",
};

export interface BookmarkButtonConfig {
  iconShape: "bookmark" | "heart" | "star";
  activeFillColor: string;
  showLabel: boolean;
  labelText: string;
}

export const DEFAULT_BOOKMARK_BUTTON_CONFIG: BookmarkButtonConfig = {
  iconShape: "bookmark",
  activeFillColor: "#5271ff",
  showLabel: false,
  labelText: "Save",
};

export interface BookmarksTrayConfig {
  drawerSide: "right" | "left";
  emptyStateText: string;
  maxItems: number;
  showBadge: boolean;
  accentColor: string;
  borderRadius: number;
}

export const TRAY_MAX_ITEMS_MIN = 10;
export const TRAY_MAX_ITEMS_MAX = 200;

export const DEFAULT_BOOKMARKS_TRAY_CONFIG: BookmarksTrayConfig = {
  drawerSide: "right",
  emptyStateText: "You haven't bookmarked any items yet.",
  maxItems: 50,
  showBadge: true,
  accentColor: "#5271ff",
  borderRadius: 16,
};
