/**
 * Canvas component configuration drafts.
 *
 * One interface per insertable component, holding exactly what the Builder tab
 * customizer can edit. These are the inputs to the code generator in task 1.4,
 * so a field here becomes a property control default in generated canvas code.
 *
 * `contentSlot` is absent on purpose. It is a `ControlType.ComponentInstance`
 * bound on the canvas after insertion, so there is nothing for the panel to
 * edit and nothing for the generator to emit.
 */

import type { RequiredTier } from "./member";

/** The four locked-state behaviours from PRD section 8 F01. */
export type GateFallbackAction = "blur" | "hide" | "redirect" | "custom_card";

export interface MemberGateConfig {
  requiredTier: RequiredTier;
  fallbackAction: GateFallbackAction;
  /** Only meaningful when `fallbackAction` is "redirect". */
  redirectUrl: string;
  /** Only meaningful when `fallbackAction` is "custom_card". */
  cardTitle: string;
  /** Only meaningful when `fallbackAction` is "custom_card". */
  cardDescription: string;
  /** Pixels. Only meaningful when `fallbackAction` is "blur". */
  blurIntensity: number;
}

/** Bounds from the F01 `blurIntensity` property control. */
export const BLUR_MIN = 2;
export const BLUR_MAX = 20;

/**
 * Defaults copied from F01's property controls so the panel and the Framer
 * sidebar open on the same values. A creator who customizes nothing and a
 * creator who drops the component straight onto the canvas must get the same
 * component.
 */
export const DEFAULT_MEMBER_GATE_CONFIG: MemberGateConfig = {
  requiredTier: "signed_in",
  fallbackAction: "blur",
  redirectUrl: "",
  cardTitle: "Members Only Content",
  cardDescription: "Join or sign in to read this full guide.",
  blurIntensity: 8,
};

/** Friendly labels. PRD section 7.6 rule 4: never surface the raw value. */
export const FALLBACK_ACTION_LABELS: Record<GateFallbackAction, string> = {
  blur: "Frosted blur",
  hide: "Hide completely",
  redirect: "Page redirect",
  custom_card: "Lock card",
};

/**
 * Which customizer rows a given fallback action should show.
 *
 * Mirrors the `hidden` predicates on F01's property controls, so the panel
 * offers exactly what the canvas sidebar will offer. Showing all five rows at
 * once would promise controls the sidebar then hides.
 */
export function visibleGateRows(action: GateFallbackAction): {
  blur: boolean;
  redirect: boolean;
  card: boolean;
} {
  return {
    blur: action === "blur",
    redirect: action === "redirect",
    card: action === "custom_card",
  };
}

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

export interface MemberAuthConfig {
  authMode: AuthDisplayMode;
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
  requirePasswordStrength: boolean;
}

export const AUTH_RADIUS_MIN = 0;
export const AUTH_RADIUS_MAX = 24;

/** Defaults matching the property controls in `MemberAuth.tsx`. */
export const DEFAULT_MEMBER_AUTH_CONFIG: MemberAuthConfig = {
  authMode: "inline",
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
  requirePasswordStrength: true,
};

export const AUTH_PROVIDER_LABELS: Record<AuthProvider, string> = {
  otp: "Email code",
  google: "Google",
  apple: "Apple",
  github: "GitHub",
  discord: "Discord",
};
