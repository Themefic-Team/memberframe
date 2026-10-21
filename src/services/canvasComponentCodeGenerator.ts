/**
 * The canvas component code generator. PRD task 1.4, feature F01.
 *
 * Takes the creator's panel configuration and produces the exact text that gets
 * written into their Framer project. The output runs on their published website,
 * so this file's one job is to never emit code that does not parse.
 *
 * ## It rewrites one marked block, it does not template
 *
 * Each component is authored as a real file in `src/canvas-components/` and
 * imported here as raw text. This generator finds its `@memberframe-config-start` / `@memberframe-config-end`
 * pair and replaces what sits between them. Everything else is byte-identical
 * between the repo and the deployed file.
 *
 * The alternative, a template literal with a dozen interpolation sites, has a
 * dozen ways to produce a syntax error and no compiler watching any of them.
 * This way `tsc --noEmit` typechecks the deployed component and
 * `npm run lint:css` lints it, because it is a real file in `src`. Reasoning in
 * `docs/development-docs/01-member-gate.md` section 3.2.
 *
 * ## Creator strings are serialized, never concatenated
 *
 * `cardTitle` and `cardDescription` are free text typed by a creator and they
 * end up inside a string literal in generated code. A naive generator that
 * concatenated them would turn a lock title containing an apostrophe and a
 * quote into a broken published page. Every value goes through `JSON.stringify`
 * plus a U+2028 and U+2029 escape, and every enum and numeric field is checked
 * against its own allowed values first.
 */

import memberAuthSource from "../canvas-components/MemberAuth.tsx?raw";
import memberDashboardSource from "../canvas-components/MemberDashboard.tsx?raw";
import memberPricingSource from "../canvas-components/MemberPricing.tsx?raw";
import meteredPaywallSource from "../canvas-components/MeteredPaywall.tsx?raw";
import protectedDownloadSource from "../canvas-components/ProtectedDownload.tsx?raw";
import bookmarkButtonSource from "../canvas-components/BookmarkButton.tsx?raw";
import bookmarksTraySource from "../canvas-components/BookmarksTray.tsx?raw";
import { LICENSED_FILE_NAMES, patchLockState } from "../utils/lockPatcher";
import type { CanvasLicense } from "./licenseService";
import { isSafeSitePath } from "./siteSettingsService";
import { readPasswordPolicy, type PasswordPolicy } from "../utils/credentials";
import { stripComments } from "../utils/stripComments";

/** The site's password rules as a CONFIG literal, read defensively first. */
function policyLiteral(policy: PasswordPolicy | undefined): string {
  const rules = readPasswordPolicy(policy);
  return (
    `{ minLength: ${rules.minLength}, requireNumber: ${rules.requireNumber}, requireUppercase: ${rules.requireUppercase}, ` +
    `requireLowercase: ${rules.requireLowercase}, requireSymbol: ${rules.requireSymbol} }`
  );
}
import { SESSION_CACHE_TTL_MS, deployBaseUrl } from "../config/backend";
import {
  AUTH_RADIUS_MAX,
  AUTH_RADIUS_MIN,
  BLUR_MAX,
  BLUR_MIN,
  DASHBOARD_RADIUS_MAX,
  DASHBOARD_RADIUS_MIN,
  DEFAULT_MEMBER_AUTH_CONFIG,
  DEFAULT_MEMBER_DASHBOARD_CONFIG,
  DEFAULT_MEMBER_PRICING_CONFIG,
  PRICING_RADIUS_MAX,
  PRICING_RADIUS_MIN,
  type MemberPricingConfig,
  type AuthScreen,
  type MemberAuthConfig,
  type MemberDashboardConfig,
  CONTENT_RADIUS_MAX,
  DEFAULT_BOOKMARK_BUTTON_CONFIG,
  DEFAULT_BOOKMARKS_TRAY_CONFIG,
  DEFAULT_METERED_PAYWALL_CONFIG,
  DEFAULT_PROTECTED_DOWNLOAD_CONFIG,
  METERED_QUOTA_MAX,
  METERED_QUOTA_MIN,
  TRAY_MAX_ITEMS_MAX,
  TRAY_MAX_ITEMS_MIN,
  type BookmarkButtonConfig,
  type BookmarksTrayConfig,
  type MeteredPaywallConfig,
  type ProtectedDownloadConfig,
} from "../types/canvas";
import type { RequiredTier } from "../types/member";

/** The anchor pair in the authored component. Must appear exactly once each. */
export const CONFIG_START_MARKER = "// @memberframe-config-start";
export const CONFIG_END_MARKER = "// @memberframe-config-end";

/**
 * The lock-state block F19's `enforceLockState` patcher rewrites. The generator
 * asserts both lines survive into the output: if a future edit to the authored
 * component drops them, the patcher would silently find nothing to patch and
 * every deployed component would stay permanently unlocked.
 */
export const LOCK_STATE_SIGNATURE = ["const IS_LOCKED = false;", "// @plugin-lock-state: unlocked"];

/**
 * Caps on the two free-text fields.
 *
 * Both are `ControlType.String`, a single-line input, and both end up in the
 * generated file. The limits are generous for real copy and stop a paste of a
 * whole article from bloating every published page that carries the component.
 */
const MAX_CARD_TITLE = 200;
const MAX_CARD_DESCRIPTION = 500;

/**
 * Characters collapsed to a single space in a single-line field.
 *
 * Tab, line feed, carriage return, and then U+2028 and U+2029. The last two are
 * the reason this is built from char codes rather than written as a regex
 * literal: they are invisible, they are legal raw inside a JSON string, and
 * they are line terminators to an older JavaScript parser, so a lock title
 * carrying one could produce a file that parses differently than it reads.
 * Removing them is better than escaping them, because no lock title needs one.
 */
const COLLAPSIBLE_WHITESPACE = new RegExp(
  "[" + String.fromCharCode(9, 10, 13, 0x2028, 0x2029) + "]+",
  "g"
);

/** Single-line fields stay single-line, and leading padding is not content. */
function sanitizeText(value: string, maxLength: number): string {
  return value.replace(COLLAPSIBLE_WHITESPACE, " ").trim().slice(0, maxLength);
}

/** A custom tier key, as the API accepts it. Conflict C9, resolved. */
const CUSTOM_TIER_KEY_PATTERN = /^[a-z][a-z0-9_]{1,49}$/;


/**
 * A string as a JavaScript string literal.
 *
 * `JSON.stringify` handles the quotes, the backslashes, and every control
 * character, which is the whole of what makes creator free text dangerous
 * inside generated code. The two invisible line separators it would pass
 * through raw are removed earlier, by `sanitizeText`.
 */
function encodeLiteral(value: string): string {
  return JSON.stringify(value);
}

/**
 * The replacement block, markers included.
 *
 * Indentation and field order match the authored file so a diff between the repo
 * copy and a deployed copy shows only the values that actually changed.
 */
export function buildConfigBlock<Config>(
  descriptor: CanvasComponentDescriptor<Config>,
  config: Config,
  context: DeployContext = DISCONNECTED_DEPLOY_CONTEXT
): string {
  return [
    CONFIG_START_MARKER,
    `const CONFIG: ${descriptor.configTypeName} = {`,
    ...descriptor.serializeFields(descriptor.normalize(config), context),
    "};",
    CONFIG_END_MARKER,
  ].join("\n");
}

/**
 * What the panel knows when it deploys, which the authored file cannot.
 *
 * The three fields have one thing in common: they are properties of the
 * CONNECTION rather than of the component, so a creator never sets them in the
 * customizer and they change when the project is reconnected rather than when
 * the component is reconfigured.
 *
 * Passing them explicitly rather than reading module state is what makes the
 * generator testable: a test can prove that a disconnected deploy emits an
 * empty site key without arranging global state to say so.
 */
export interface DeployContext {
  /** Where the published site will send its requests. */
  apiBaseUrl: string;
  /** The public site key. Empty when the project is not connected. */
  siteKey: string;
  /** Site-relative. Empty means the visitor stays where they are. */
  afterLoginPath: string;
  /** Site-relative. Where `<MemberDashboard>` sends a signed-out visitor. */
  loginPath: string;
  /** Site-relative. Where signing out lands. */
  afterLogoutPath: string;
  /**
   * Site-relative. The sign up and reset pages a dedicated `<MemberLogin>`
   * links to. Optional so the existing call sites and tests that predate the
   * dedicated screens still describe a complete context; absent means the
   * settings defaults.
   */
  signupPath?: string;
  resetPath?: string;
  /** The site's password rules (05-member-auth.md 13). Absent means the defaults. */
  passwordPolicy?: PasswordPolicy;
  /** Site-relative. The pricing page from Payments, where the paywall's buttons go. Absent means /pricing. */
  pricingPath?: string;
  /**
   * The site's tiers, when the panel has them. The gate's Access Tier list is
   * written from these, so a creator's custom tiers can be chosen in Framer.
   * Absent or empty keeps the built in four.
   */
  tiers?: ReadonlyArray<{ key: string; name: string; rank: number }>;
  /**
   * F19: the project's license, baked into the four lock lines of a licensed
   * component as it is written, so a fresh file shows the trial mark or the
   * lock at once. Absent leaves the authored lines (unlocked), as for tests.
   */
  license?: CanvasLicense;
}

/**
 * The context for a panel that is not connected to a site.
 *
 * The site key is empty, which makes every request from the deployed component
 * fail with `missing_site_key`. That is deliberate and it is why the Builder
 * tab refuses to deploy while disconnected: a component that silently talked to
 * the wrong tenant would be far worse than one that plainly does not work.
 *
 * The base URL comes from `deployBaseUrl()` rather than `API_BASE_URL`, so a
 * developer running against `127.0.0.1` cannot bake an address into a
 * component that no published site could ever reach. See `config/backend.ts`.
 */
export const DISCONNECTED_DEPLOY_CONTEXT: DeployContext = {
  apiBaseUrl: deployBaseUrl(),
  siteKey: "",
  afterLoginPath: "",
  loginPath: "/login",
  afterLogoutPath: "/",
};

export interface GeneratedCanvasFile<Config = unknown> {
  /** Passed straight to `framer.createCodeFile`. Extension included. */
  fileName: string;
  /** The complete file text. */
  code: string;
  /** What was actually emitted, after clamping. Shown back to the creator. */
  config: Config;
}

/**
 * One authored component, described well enough to generate it.
 *
 * Added in task 2.5, when `<MemberAuth>` became the second component. The
 * marker handling, the config-block swap, and the F19 lock-state assertion are
 * identical for every component and were lifted here rather than copied. Doing
 * that at the second component is where the shape is still visible and the
 * abstraction is still cheap; by Phase 4 there are fifteen, and fifteen copies
 * of "exactly one marker pair" is fifteen places for it to be wrong.
 */
export interface CanvasComponentDescriptor<Config> {
  /** Matches the picker id in `components/studio/componentRegistry.ts`. */
  id: string;
  /** With the extension. Framer rejects JSX outside a `.tsx` file. */
  fileName: string;
  /** The authored source, imported with `?raw`. */
  source: string;
  /** The `GateConfig`-style type name the emitted block annotates. */
  configTypeName: string;
  /** Clamp and whitelist before emission. */
  normalize: (config: Config) => Config;
  /** The object body, one `  key: value,` line each, markers excluded. */
  serializeFields: (config: Config, context: DeployContext) => ReadonlyArray<string>;
  /**
   * A rewrite applied after the config block is swapped, for a deployment that
   * needs more than different values. The dedicated auth screens use it to
   * rename the export, so Framer lists `MemberLogin` rather than a second
   * `MemberAuth`. Must throw `CodeGenerationError` when it cannot apply.
   */
  transform?: (code: string, context: DeployContext) => string;
}

/**
 * Thrown when the authored source no longer carries exactly one marker pair, or
 * when the output lost the F19 lock-state signature.
 *
 * Both are repo defects rather than creator mistakes, so they throw instead of
 * degrading: a silent fallback would deploy a component whose defaults ignore
 * everything the creator configured, or one that F19 can never lock.
 */
export class CodeGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CodeGenerationError";
  }
}

function occurrences(haystack: string, needle: string): number {
  let count = 0;
  let index = haystack.indexOf(needle);

  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }

  return count;
}

/**
 * Produce the file to deploy for any described component.
 *
 * `sourceOverride` is injectable so the tests can prove the marker assertions
 * fire, rather than only proving the happy path against a file that currently
 * satisfies them. Production passes nothing and gets the authored component.
 */
export function generateComponentCode<Config>(
  descriptor: CanvasComponentDescriptor<Config>,
  config: Config,
  sourceOverride?: string,
  context: DeployContext = DISCONNECTED_DEPLOY_CONTEXT
): GeneratedCanvasFile<Config> {
  const source = sourceOverride ?? descriptor.source;
  const normalized = descriptor.normalize(config);
  const replaced = replaceConfigBlock(source, buildConfigBlock(descriptor, normalized, context));
  const transformed = descriptor.transform ? descriptor.transform(replaced, context) : replaced;
  // After the signature check in replaceConfigBlock, which reads the authored lines.
  const patched =
    context.license && LICENSED_FILE_NAMES.includes(descriptor.fileName)
      ? patchLockState(transformed, context.license) ?? transformed
      : transformed;
  // The repository's explanations stay in the repository (utils/stripComments.ts).
  const code = stripComments(patched);

  return { fileName: descriptor.fileName, code, config: normalized };
}

/**
 * Swap the one marked block, and refuse if the file is not shaped for it.
 *
 * Both failures are repo defects rather than creator mistakes, so they throw
 * instead of degrading: a silent fallback would deploy a component whose
 * defaults ignore everything the creator configured, or one that F19 can never
 * lock.
 */
function replaceConfigBlock(source: string, block: string): string {
  const startCount = occurrences(source, CONFIG_START_MARKER);
  const endCount = occurrences(source, CONFIG_END_MARKER);

  if (startCount !== 1 || endCount !== 1) {
    throw new CodeGenerationError(
      `Expected exactly one config marker pair in the authored component, found ${startCount} start and ${endCount} end. ` +
        "The generator replaces one block and cannot guess which."
    );
  }

  const start = source.indexOf(CONFIG_START_MARKER);
  const end = source.indexOf(CONFIG_END_MARKER) + CONFIG_END_MARKER.length;

  if (start > end) {
    throw new CodeGenerationError(
      "The config end marker appears before the start marker in the authored component."
    );
  }

  const code = source.slice(0, start) + block + source.slice(end);

  for (const line of LOCK_STATE_SIGNATURE) {
    if (!code.includes(line)) {
      throw new CodeGenerationError(
        `Generated component is missing the F19 lock-state line "${line}". ` +
          "Without it enforceLockState has nothing to patch and the component can never be locked."
      );
    }
  }

  return code;
}

/**
 * Swap one tier Enum's two lines for the site's own tiers, by rank, after the
 * fixed leading entries. Shared by the gate and the paywall.
 */
function rewriteTierOptions(
  code: string,
  context: DeployContext,
  spec: { optionsLine: string; titlesLine: string; leading: ReadonlyArray<readonly [string, string]>; what: string }
): string {
  const tiers = (context.tiers ?? []).filter((tier) => CUSTOM_TIER_KEY_PATTERN.test(tier.key));
  if (tiers.length === 0) return code;

  if (occurrences(code, spec.optionsLine) !== 1 || occurrences(code, spec.titlesLine) !== 1) {
    throw new CodeGenerationError(
      `${spec.what} are not in the shape the generator rewrites. Keep options and optionTitles on one line each.`
    );
  }

  const ordered = [...tiers].sort((a, b) => a.rank - b.rank);
  const keys = [...spec.leading.map(([key]) => key), ...ordered.map((tier) => tier.key)];
  const titles = [
    ...spec.leading.map(([, title]) => title),
    ...ordered.map((tier) => sanitizeText(tier.name, 60) || tier.key),
  ];

  return code
    .replace(spec.optionsLine, `    options: [${keys.map(encodeLiteral).join(", ")}],`)
    .replace(spec.titlesLine, `    optionTitles: [${titles.map(encodeLiteral).join(", ")}],`);
}

/* ==========================================================================
   MEMBER AUTH, PRD task 2.5, feature F05
   ========================================================================== */

export const MEMBER_AUTH_FILE_NAME = "MemberAuth.tsx";

/**
 * Bring an auth config into the range the component can represent.
 *
 * `accentColor` gets a whitelist rather than a clamp, because it is the one
 * creator value in either component that reaches a CSS declaration. A string
 * like `red; } body { display: none } .x {` written into a style block is CSS
 * injection on the creator's own published page. `ControlType.Color` should
 * never produce such a value, and "should never" is not a reason to emit it
 * unchecked: `MemberAuth.tsx` sanitizes again at runtime, because a prop can
 * also be set from a Framer variable the generator never sees.
 */
/** A finite number within `min..max`, or the fallback. */
function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

export function normalizeAuthConfig(config: MemberAuthConfig): MemberAuthConfig {
  const rawRadius = Number(config.borderRadius);
  const borderRadius = Number.isFinite(rawRadius)
    ? Math.min(AUTH_RADIUS_MAX, Math.max(AUTH_RADIUS_MIN, Math.round(rawRadius)))
    : DEFAULT_MEMBER_AUTH_CONFIG.borderRadius;

  return {
    authMode: config.authMode === "modal" ? "modal" : "inline",
    modalTrigger: config.modalTrigger === "load" || config.modalTrigger === "scroll" ? config.modalTrigger : "click",
    // An id is a link hash or a layer name: letters, digits, dash, underscore.
    modalTriggerId: String(config.modalTriggerId ?? "").trim().replace(/^#/, "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60),
    modalDelay: clampNumber(config.modalDelay, 0, 60, DEFAULT_MEMBER_AUTH_CONFIG.modalDelay),
    modalScrollPercent: clampNumber(config.modalScrollPercent, 0, 100, DEFAULT_MEMBER_AUTH_CONFIG.modalScrollPercent),
    modalOncePerSession: config.modalOncePerSession !== false,
    headline: sanitizeText(String(config.headline ?? ""), MAX_CARD_TITLE),
    welcomeMessage: sanitizeText(String(config.welcomeMessage ?? ""), MAX_CARD_DESCRIPTION),
    emailEnabled: Boolean(config.emailEnabled),
    googleEnabled: Boolean(config.googleEnabled),
    appleEnabled: Boolean(config.appleEnabled),
    githubEnabled: Boolean(config.githubEnabled),
    discordEnabled: Boolean(config.discordEnabled),
    accentColor: isSafeCssColor(config.accentColor)
      ? config.accentColor.trim()
      : DEFAULT_MEMBER_AUTH_CONFIG.accentColor,
    borderRadius,
    enablePasswordAuth: Boolean(config.enablePasswordAuth),
    // An unrecognised value becomes "otp" rather than the default "password",
    // because the OTP path is the one that exists in the contract already. A
    // malformed config should not silently select the newer flow.
    defaultAuthMethod: config.defaultAuthMethod === "password" ? "password" : "otp",
  };
}

/**
 * Is this a colour, and nothing but a colour?
 *
 * A whitelist of the three notations `ControlType.Color` produces. Anything
 * carrying a brace, a semicolon, a colon, or a comment opener is rejected
 * outright rather than escaped, because there is no legitimate colour that
 * needs one.
 */
export function isSafeCssColor(value: string): boolean {
  const colour = String(value ?? "").trim();
  if (colour === "") return false;
  if (colour.length > 32) return false;

  if (/^#[0-9a-fA-F]{3,8}$/.test(colour)) return true;
  if (/^rgba?\(\s*[\d.%\s,/]+\)$/.test(colour)) return true;
  if (/^hsla?\(\s*[\d.%\s,/deg]+\)$/.test(colour)) return true;

  return false;
}

/**
 * One descriptor per auth deployment, all from `MemberAuth.tsx`.
 *
 * `all` is `<MemberAuth>` unchanged. The other four bake a screen in and rename
 * the export. Every one emits the same config fields, because the authored
 * interface declares them all and a missing one is a type error in Framer.
 */
function authDescriptor(
  screen: AuthScreen,
  id: string,
  fileName: string,
  componentName: string
): CanvasComponentDescriptor<MemberAuthConfig> {
  return {
    id,
    fileName,
    source: memberAuthSource,
    configTypeName: "AuthConfig",
    normalize: normalizeAuthConfig,
    serializeFields: (config, context) => [
      ...authFields(config, context),
      `  screen: ${encodeLiteral(screen)},`,
      `  loginPath: ${encodeLiteral(context.loginPath || "/login")},`,
      // The login page links to sign up only when the creator has given it its
      // own page. Settings defaults sign up to the login path, and a link from
      // the login page to itself is a reload, so it is emitted empty instead.
      `  signupPath: ${encodeLiteral(
        context.signupPath && context.signupPath !== context.loginPath ? context.signupPath : ""
      )},`,
      `  resetPath: ${encodeLiteral(context.resetPath ?? "/reset-password")},`,
      `  otpPath: ${encodeLiteral("")},`,
    ],
    transform:
      componentName === "MemberAuth" ? undefined : (code) => renameComponent(code, componentName),
  };
}

/**
 * Rename the default export and its property controls.
 *
 * Both occurrences are asserted exactly once. A rename that missed the
 * `addPropertyControls` call would deploy a component with no sidebar controls
 * and no error anywhere, so a source edit that breaks either pattern stops
 * generation instead.
 */
function renameComponent(code: string, name: string): string {
  const declaration = "export default function MemberAuth(";
  const controls = "addPropertyControls(MemberAuth,";

  if (occurrences(code, declaration) !== 1 || occurrences(code, controls) !== 1) {
    throw new CodeGenerationError(
      `Cannot rename MemberAuth to ${name}: expected exactly one default export and one addPropertyControls call.`
    );
  }

  return code
    .replace(declaration, `export default function ${name}(`)
    .replace(controls, `addPropertyControls(${name},`);
}

function authFields(config: MemberAuthConfig, context: DeployContext): string[] {
  return [
    `  authMode: ${encodeLiteral(config.authMode)},`,
    `  modalTrigger: ${encodeLiteral(config.modalTrigger)},`,
    `  modalTriggerId: ${encodeLiteral(config.modalTriggerId)},`,
    `  modalDelay: ${config.modalDelay},`,
    `  modalScrollPercent: ${config.modalScrollPercent},`,
    `  modalOncePerSession: ${config.modalOncePerSession},`,
    `  headline: ${encodeLiteral(config.headline)},`,
    `  welcomeMessage: ${encodeLiteral(config.welcomeMessage)},`,
    `  emailEnabled: ${config.emailEnabled},`,
    `  googleEnabled: ${config.googleEnabled},`,
    `  appleEnabled: ${config.appleEnabled},`,
    `  githubEnabled: ${config.githubEnabled},`,
    `  discordEnabled: ${config.discordEnabled},`,
    `  accentColor: ${encodeLiteral(config.accentColor)},`,
    `  borderRadius: ${config.borderRadius},`,
    `  enablePasswordAuth: ${config.enablePasswordAuth},`,
    `  defaultAuthMethod: ${encodeLiteral(config.defaultAuthMethod)},`,
    // The site's rules, until the form asks the server for the current ones (05-member-auth.md 13).
    `  passwordPolicy: ${policyLiteral(context.passwordPolicy)},`,
    `  apiBaseUrl: ${encodeLiteral(context.apiBaseUrl)},`,
    `  siteKey: ${encodeLiteral(context.siteKey)},`,
    `  afterLoginPath: ${encodeLiteral(context.afterLoginPath)},`,
  ];
}

export const MEMBER_AUTH_DESCRIPTOR = authDescriptor(
  "all",
  "member_auth",
  MEMBER_AUTH_FILE_NAME,
  "MemberAuth"
);

/* ---- The four dedicated screens ---- */

export const AUTH_SCREEN_DESCRIPTORS = {
  member_login: authDescriptor("login", "member_login", "MemberLogin.tsx", "MemberLogin"),
  member_register: authDescriptor(
    "register",
    "member_register",
    "MemberRegister.tsx",
    "MemberRegister"
  ),
  member_password_reset: authDescriptor(
    "reset",
    "member_password_reset",
    "MemberPasswordReset.tsx",
    "MemberPasswordReset"
  ),
  member_otp_verify: authDescriptor(
    "otp",
    "member_otp_verify",
    "MemberOtpVerify.tsx",
    "MemberOtpVerify"
  ),
} as const;

export type AuthScreenComponentId = keyof typeof AUTH_SCREEN_DESCRIPTORS;

/**
 * What each dedicated screen says before the creator edits it. The combined
 * component's "Sign in to continue" would be wrong on three of the four.
 */
export const AUTH_SCREEN_DEFAULTS: Record<AuthScreenComponentId, MemberAuthConfig> = {
  member_login: {
    ...DEFAULT_MEMBER_AUTH_CONFIG,
    headline: "Welcome back",
    welcomeMessage: "Sign in to your account.",
  },
  member_register: {
    ...DEFAULT_MEMBER_AUTH_CONFIG,
    headline: "Create your account",
    welcomeMessage: "Join to unlock members-only content.",
  },
  member_password_reset: {
    ...DEFAULT_MEMBER_AUTH_CONFIG,
    headline: "Reset your password",
    welcomeMessage: "Enter your email and we will send you a reset link.",
  },
  member_otp_verify: {
    ...DEFAULT_MEMBER_AUTH_CONFIG,
    headline: "Sign in with a code",
    welcomeMessage: "We will email you a six digit code. No password needed.",
    defaultAuthMethod: "otp",
  },
};

export function generateAuthScreenCode(
  id: AuthScreenComponentId,
  config: MemberAuthConfig = AUTH_SCREEN_DEFAULTS[id],
  source?: string,
  context: DeployContext = DISCONNECTED_DEPLOY_CONTEXT
): GeneratedCanvasFile<MemberAuthConfig> {
  return generateComponentCode(AUTH_SCREEN_DESCRIPTORS[id], config, source, context);
}

export function generateMemberAuthCode(
  config: MemberAuthConfig,
  source?: string,
  context: DeployContext = DISCONNECTED_DEPLOY_CONTEXT
): GeneratedCanvasFile<MemberAuthConfig> {
  return generateComponentCode(MEMBER_AUTH_DESCRIPTOR, config, source, context);
}

/* ==========================================================================
   MEMBER DASHBOARD, feature plan FP-08, PRD feature F06
   ========================================================================== */

export const MEMBER_DASHBOARD_FILE_NAME = "MemberDashboard.tsx";

/**
 * Clamp and whitelist before emission.
 *
 * Same contract as the other two normalizers: every field is replaced rather
 * than merged, so a property the panel does not know about cannot survive into
 * the emitted block, and the radius is clamped rather than trusted.
 */
export function normalizeDashboardConfig(config: MemberDashboardConfig): MemberDashboardConfig {
  return {
    headline: String(config.headline ?? "").slice(0, 120),
    showTier: config.showTier !== false,
    showBilling: config.showBilling !== false,
    showSignOut: config.showSignOut !== false,
    showProfile: config.showProfile !== false,
    signedOutMessage: String(config.signedOutMessage ?? "").slice(0, 240),
    // The same sanitizer the component applies at runtime. Applying it here as
    // well means an unsafe value never reaches the creator's project file, not
    // merely that it is ignored once it is there.
    accentColor: isSafeCssColor(config.accentColor)
      ? config.accentColor
      : DEFAULT_MEMBER_DASHBOARD_CONFIG.accentColor,
    borderRadius: Math.max(
      DASHBOARD_RADIUS_MIN,
      Math.min(DASHBOARD_RADIUS_MAX, Math.round(Number(config.borderRadius) || 0))
    ),
  };
}

export const MEMBER_DASHBOARD_DESCRIPTOR: CanvasComponentDescriptor<MemberDashboardConfig> = {
  id: "member_dashboard",
  fileName: MEMBER_DASHBOARD_FILE_NAME,
  source: memberDashboardSource,
  configTypeName: "DashboardConfig",
  normalize: normalizeDashboardConfig,
  serializeFields: (config, context) => [
    `  headline: ${encodeLiteral(config.headline)},`,
    `  showTier: ${config.showTier},`,
    `  showBilling: ${config.showBilling},`,
    `  showSignOut: ${config.showSignOut},`,
    `  showProfile: ${config.showProfile},`,
    `  signedOutMessage: ${encodeLiteral(config.signedOutMessage)},`,
    `  accentColor: ${encodeLiteral(config.accentColor)},`,
    `  borderRadius: ${config.borderRadius},`,
    `  apiBaseUrl: ${encodeLiteral(context.apiBaseUrl)},`,
    `  siteKey: ${encodeLiteral(context.siteKey)},`,
    `  loginPath: ${encodeLiteral(context.loginPath)},`,
    `  afterLogoutPath: ${encodeLiteral(context.afterLogoutPath)},`,
  ],
};

export function generateMemberDashboardCode(
  config: MemberDashboardConfig,
  source?: string,
  context: DeployContext = DISCONNECTED_DEPLOY_CONTEXT
): GeneratedCanvasFile<MemberDashboardConfig> {
  return generateComponentCode(MEMBER_DASHBOARD_DESCRIPTOR, config, source, context);
}

/* ==========================================================================
   MEMBER PRICING, feature plan FP-16
   ========================================================================== */

export const MEMBER_PRICING_FILE_NAME = "MemberPricing.tsx";

/** Clamp and whitelist before emission, same contract as the others. */
export function normalizePricingConfig(config: MemberPricingConfig): MemberPricingConfig {
  return {
    headline: sanitizeText(String(config.headline ?? ""), MAX_CARD_TITLE),
    subheadline: sanitizeText(String(config.subheadline ?? ""), MAX_CARD_DESCRIPTION),
    defaultInterval: config.defaultInterval === "year" ? "year" : "month",
    showLifetime: config.showLifetime !== false,
    showFreeTier: config.showFreeTier !== false,
    highlightTier: sanitizeText(String(config.highlightTier ?? ""), 100),
    accentColor: isSafeCssColor(config.accentColor)
      ? config.accentColor
      : DEFAULT_MEMBER_PRICING_CONFIG.accentColor,
    borderRadius: Math.max(
      PRICING_RADIUS_MIN,
      Math.min(PRICING_RADIUS_MAX, Math.round(Number(config.borderRadius) || 0))
    ),
  };
}

export const MEMBER_PRICING_DESCRIPTOR: CanvasComponentDescriptor<MemberPricingConfig> = {
  id: "member_pricing",
  fileName: MEMBER_PRICING_FILE_NAME,
  source: memberPricingSource,
  configTypeName: "PricingConfig",
  normalize: normalizePricingConfig,
  serializeFields: (config, context) => [
    `  headline: ${encodeLiteral(config.headline)},`,
    `  subheadline: ${encodeLiteral(config.subheadline)},`,
    `  defaultInterval: ${encodeLiteral(config.defaultInterval)},`,
    `  showLifetime: ${config.showLifetime},`,
    `  showFreeTier: ${config.showFreeTier},`,
    `  highlightTier: ${encodeLiteral(config.highlightTier)},`,
    `  accentColor: ${encodeLiteral(config.accentColor)},`,
    `  borderRadius: ${config.borderRadius},`,
    `  apiBaseUrl: ${encodeLiteral(context.apiBaseUrl)},`,
    `  siteKey: ${encodeLiteral(context.siteKey)},`,
    // A signed-out buyer makes an account first. The sign up page when the
    // site has its own, otherwise the sign in page, whose form has sign up.
    `  signupPath: ${encodeLiteral(context.signupPath || context.loginPath || "/login")},`,
  ],
};

export function generateMemberPricingCode(
  config: MemberPricingConfig,
  source?: string,
  context: DeployContext = DISCONNECTED_DEPLOY_CONTEXT
): GeneratedCanvasFile<MemberPricingConfig> {
  return generateComponentCode(MEMBER_PRICING_DESCRIPTOR, config, source, context);
}

/* ==========================================================================
   CONTENT COMPONENTS: FP-07 soft paywall, FP-12 downloads, FP-10 bookmarks
   ========================================================================== */

export const METERED_PAYWALL_FILE_NAME = "MeteredPaywall.tsx";
export const PROTECTED_DOWNLOAD_FILE_NAME = "ProtectedDownload.tsx";
export const BOOKMARK_BUTTON_FILE_NAME = "BookmarkButton.tsx";
export const BOOKMARKS_TRAY_FILE_NAME = "BookmarksTray.tsx";

/** Every content component reads the same connection and sign in page. */
function contentContextFields(context: DeployContext): string[] {
  return [
    `  apiBaseUrl: ${encodeLiteral(context.apiBaseUrl)},`,
    `  siteKey: ${encodeLiteral(context.siteKey)},`,
    `  loginPath: ${encodeLiteral(isSafeSitePath(context.loginPath) ? context.loginPath : "/login")},`,
  ];
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function colorOr(value: string, fallback: string): string {
  return isSafeCssColor(value) ? value : fallback;
}

export function normalizeMeteredPaywallConfig(config: MeteredPaywallConfig): MeteredPaywallConfig {
  const defaults = DEFAULT_METERED_PAYWALL_CONFIG;
  return {
    freeQuotaCount: clampInt(config.freeQuotaCount, METERED_QUOTA_MIN, METERED_QUOTA_MAX, defaults.freeQuotaCount),
    quotaPeriod: config.quotaPeriod === "weekly" ? "weekly" : "monthly",
    blurIntensity: clampInt(config.blurIntensity, BLUR_MIN, BLUR_MAX, defaults.blurIntensity),
    showCounterPill: config.showCounterPill !== false,
    ctaLabel: sanitizeText(String(config.ctaLabel ?? ""), MAX_CARD_TITLE) || defaults.ctaLabel,
    cardTitle: sanitizeText(String(config.cardTitle ?? ""), MAX_CARD_TITLE),
    cardDescription: sanitizeText(String(config.cardDescription ?? ""), MAX_CARD_DESCRIPTION),
    accentColor: colorOr(config.accentColor, defaults.accentColor),
    borderRadius: clampInt(config.borderRadius, 0, CONTENT_RADIUS_MAX, defaults.borderRadius),
  };
}

const PAYWALL_TIER_OPTIONS_LINE = `    options: ["any_paid", "signed_in", "free_member", "tier_1", "tier_2", "vip"],`;
const PAYWALL_TIER_TITLES_LINE = `    optionTitles: ["Any Paid Plan", "Any Signed In", "Free Member", "Tier 1: Silver", "Tier 2: Gold", "VIP Member"],`;

export const METERED_PAYWALL_DESCRIPTOR: CanvasComponentDescriptor<MeteredPaywallConfig> = {
  id: "metered_paywall",
  fileName: METERED_PAYWALL_FILE_NAME,
  source: meteredPaywallSource,
  configTypeName: "PaywallConfig",
  normalize: normalizeMeteredPaywallConfig,
  serializeFields: (config, context) => [
    `  freeQuotaCount: ${config.freeQuotaCount},`,
    `  quotaPeriod: ${encodeLiteral(config.quotaPeriod)},`,
    `  blurIntensity: ${config.blurIntensity},`,
    `  showCounterPill: ${config.showCounterPill},`,
    `  ctaLabel: ${encodeLiteral(config.ctaLabel)},`,
    `  cardTitle: ${encodeLiteral(config.cardTitle)},`,
    `  cardDescription: ${encodeLiteral(config.cardDescription)},`,
    `  accentColor: ${encodeLiteral(config.accentColor)},`,
    `  borderRadius: ${config.borderRadius},`,
    `  apiBaseUrl: ${encodeLiteral(context.apiBaseUrl)},`,
    `  sessionTtlMs: ${SESSION_CACHE_TTL_MS},`,
    `  siteKey: ${encodeLiteral(context.siteKey)},`,
    `  loginPath: ${encodeLiteral(isSafeSitePath(context.loginPath) ? context.loginPath : "/login")},`,
    `  pricingPath: ${encodeLiteral(context.pricingPath && isSafeSitePath(context.pricingPath) ? context.pricingPath : "/pricing")},`,
  ],
  // Full Access For lists the site's own tiers after Any Paid Plan and Any Signed In.
  transform: (code, context) =>
    rewriteTierOptions(code, context, {
      optionsLine: PAYWALL_TIER_OPTIONS_LINE,
      titlesLine: PAYWALL_TIER_TITLES_LINE,
      leading: [
        ["any_paid", "Any Paid Plan"],
        ["signed_in", "Any Signed In"],
      ],
      what: "The paywall's Full Access For options",
    }),
};

export function generateMeteredPaywallCode(
  config: MeteredPaywallConfig,
  source?: string,
  context: DeployContext = DISCONNECTED_DEPLOY_CONTEXT
): GeneratedCanvasFile<MeteredPaywallConfig> {
  return generateComponentCode(METERED_PAYWALL_DESCRIPTOR, config, source, context);
}

const ICON_TYPES: ReadonlyArray<ProtectedDownloadConfig["iconType"]> = ["download", "file", "archive", "code"];

export function normalizeProtectedDownloadConfig(config: ProtectedDownloadConfig): ProtectedDownloadConfig {
  const defaults = DEFAULT_PROTECTED_DOWNLOAD_CONFIG;
  return {
    buttonText: sanitizeText(String(config.buttonText ?? ""), MAX_CARD_TITLE) || defaults.buttonText,
    lockedButtonText: sanitizeText(String(config.lockedButtonText ?? ""), MAX_CARD_TITLE) || defaults.lockedButtonText,
    iconType: ICON_TYPES.includes(config.iconType) ? config.iconType : defaults.iconType,
    accentColor: colorOr(config.accentColor, defaults.accentColor),
    borderRadius: clampInt(config.borderRadius, 0, CONTENT_RADIUS_MAX, defaults.borderRadius),
    defaultAssetId: sanitizeText(String(config.defaultAssetId ?? ""), 100),
  };
}

export const PROTECTED_DOWNLOAD_DESCRIPTOR: CanvasComponentDescriptor<ProtectedDownloadConfig> = {
  id: "protected_download",
  fileName: PROTECTED_DOWNLOAD_FILE_NAME,
  source: protectedDownloadSource,
  configTypeName: "DownloadConfig",
  normalize: normalizeProtectedDownloadConfig,
  serializeFields: (config, context) => [
    `  buttonText: ${encodeLiteral(config.buttonText)},`,
    `  lockedButtonText: ${encodeLiteral(config.lockedButtonText)},`,
    `  iconType: ${encodeLiteral(config.iconType)},`,
    `  accentColor: ${encodeLiteral(config.accentColor)},`,
    `  borderRadius: ${config.borderRadius},`,
    ...contentContextFields(context),
    `  pricingPath: ${encodeLiteral("/pricing")},`,
    `  defaultAssetId: ${encodeLiteral(config.defaultAssetId ?? "")},`,
  ],
};

export function generateProtectedDownloadCode(
  config: ProtectedDownloadConfig,
  source?: string,
  context: DeployContext = DISCONNECTED_DEPLOY_CONTEXT
): GeneratedCanvasFile<ProtectedDownloadConfig> {
  return generateComponentCode(PROTECTED_DOWNLOAD_DESCRIPTOR, config, source, context);
}

const ICON_SHAPES: ReadonlyArray<BookmarkButtonConfig["iconShape"]> = ["bookmark", "heart", "star"];

export function normalizeBookmarkButtonConfig(config: BookmarkButtonConfig): BookmarkButtonConfig {
  const defaults = DEFAULT_BOOKMARK_BUTTON_CONFIG;
  return {
    iconShape: ICON_SHAPES.includes(config.iconShape) ? config.iconShape : defaults.iconShape,
    activeFillColor: colorOr(config.activeFillColor, defaults.activeFillColor),
    showLabel: config.showLabel === true,
    labelText: sanitizeText(String(config.labelText ?? ""), 60) || defaults.labelText,
  };
}

export const BOOKMARK_BUTTON_DESCRIPTOR: CanvasComponentDescriptor<BookmarkButtonConfig> = {
  id: "bookmark_button",
  fileName: BOOKMARK_BUTTON_FILE_NAME,
  source: bookmarkButtonSource,
  configTypeName: "BookmarkButtonConfig",
  normalize: normalizeBookmarkButtonConfig,
  serializeFields: (config, context) => [
    `  iconShape: ${encodeLiteral(config.iconShape)},`,
    `  activeFillColor: ${encodeLiteral(config.activeFillColor)},`,
    `  showLabel: ${config.showLabel},`,
    `  labelText: ${encodeLiteral(config.labelText)},`,
    ...contentContextFields(context),
  ],
};

export function generateBookmarkButtonCode(
  config: BookmarkButtonConfig,
  source?: string,
  context: DeployContext = DISCONNECTED_DEPLOY_CONTEXT
): GeneratedCanvasFile<BookmarkButtonConfig> {
  return generateComponentCode(BOOKMARK_BUTTON_DESCRIPTOR, config, source, context);
}

export function normalizeBookmarksTrayConfig(config: BookmarksTrayConfig): BookmarksTrayConfig {
  const defaults = DEFAULT_BOOKMARKS_TRAY_CONFIG;
  return {
    drawerSide: config.drawerSide === "left" ? "left" : "right",
    emptyStateText: sanitizeText(String(config.emptyStateText ?? ""), MAX_CARD_DESCRIPTION) || defaults.emptyStateText,
    maxItems: clampInt(config.maxItems, TRAY_MAX_ITEMS_MIN, TRAY_MAX_ITEMS_MAX, defaults.maxItems),
    showBadge: config.showBadge !== false,
    accentColor: colorOr(config.accentColor, defaults.accentColor),
    borderRadius: clampInt(config.borderRadius, 0, CONTENT_RADIUS_MAX, defaults.borderRadius),
  };
}

export const BOOKMARKS_TRAY_DESCRIPTOR: CanvasComponentDescriptor<BookmarksTrayConfig> = {
  id: "bookmarks_tray",
  fileName: BOOKMARKS_TRAY_FILE_NAME,
  source: bookmarksTraySource,
  configTypeName: "TrayConfig",
  normalize: normalizeBookmarksTrayConfig,
  serializeFields: (config, context) => [
    `  drawerSide: ${encodeLiteral(config.drawerSide)},`,
    `  emptyStateText: ${encodeLiteral(config.emptyStateText)},`,
    `  maxItems: ${config.maxItems},`,
    `  showBadge: ${config.showBadge},`,
    `  accentColor: ${encodeLiteral(config.accentColor)},`,
    `  borderRadius: ${config.borderRadius},`,
    ...contentContextFields(context),
  ],
};

export function generateBookmarksTrayCode(
  config: BookmarksTrayConfig,
  source?: string,
  context: DeployContext = DISCONNECTED_DEPLOY_CONTEXT
): GeneratedCanvasFile<BookmarksTrayConfig> {
  return generateComponentCode(BOOKMARKS_TRAY_DESCRIPTOR, config, source, context);
}
