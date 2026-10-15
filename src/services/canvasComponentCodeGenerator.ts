/**
 * The canvas component code generator. PRD task 1.4, feature F01.
 *
 * Takes the creator's panel configuration and produces the exact text that gets
 * written into their Framer project. The output runs on their published website,
 * so this file's one job is to never emit code that does not parse.
 *
 * ## It rewrites one marked block, it does not template
 *
 * The component is authored as a real file,
 * `src/canvas-components/MemberGate.tsx`, and imported here as raw text. This
 * generator finds its `@memberframe-config-start` / `@memberframe-config-end`
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

import memberGateSource from "../canvas-components/MemberGate.tsx?raw";
import memberAuthSource from "../canvas-components/MemberAuth.tsx?raw";
import memberDashboardSource from "../canvas-components/MemberDashboard.tsx?raw";
import onboardingModalSource from "../canvas-components/OnboardingModal.tsx?raw";
import { isSafeSitePath } from "./siteSettingsService";
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
  DEFAULT_MEMBER_GATE_CONFIG,
  DEFAULT_ONBOARDING_MODAL_CONFIG,
  ONBOARDING_RADIUS_MAX,
  ONBOARDING_RADIUS_MIN,
  type OnboardingModalConfig,
  type AuthScreen,
  type GateFallbackAction,
  type MemberAuthConfig,
  type MemberDashboardConfig,
  type MemberGateConfig,
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
 * One file per project, named for the component. Framer requires the extension,
 * and `.tsx` specifically: the docs on `createCodeFile` note that any other
 * extension rejects JSX syntax.
 */
export const MEMBER_GATE_FILE_NAME = "MemberGate.tsx";

/**
 * The `requiredTier` values F01's property control actually offers.
 *
 * `anyone` is a legal `RequiredTier` and is deliberately absent. A gate set to
 * "Anyone" is entitled by definition, so it gates nothing, and emitting it as
 * the `defaultValue` of an Enum whose `options` do not list it would leave the
 * Framer sidebar showing a selection it cannot represent.
 */
const ALLOWED_REQUIRED_TIERS: ReadonlyArray<RequiredTier> = [
  "signed_in",
  "free_member",
  "tier_1",
  "tier_2",
  "vip",
];

const ALLOWED_FALLBACK_ACTIONS: ReadonlyArray<GateFallbackAction> = [
  "blur",
  "hide",
  "redirect",
  "custom_card",
];

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
 * Schemes a redirect target may use.
 *
 * `javascript:` is the reason this list exists. `window.location.assign` will
 * execute such a URL in some browsers, and `redirectUrl` is a value a creator
 * may well paste from somewhere else. A relative path, a fragment, or an
 * explicit http(s) URL covers every legitimate use of a redirect gate.
 */
function sanitizeRedirectUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") return "";

  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  ) {
    return trimmed;
  }

  return "";
}

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

/**
 * Bring a config into the range the generated component can represent.
 *
 * Exported because the Builder tab holds a draft that may predate a later
 * change to the allowed values, and because the tests assert each clamp.
 * Anything unrecognised falls back to F01's own default rather than throwing:
 * the creator's other five fields are still worth deploying.
 */
export function normalizeGateConfig(config: MemberGateConfig): MemberGateConfig {
  const requiredTier = ALLOWED_REQUIRED_TIERS.includes(config.requiredTier)
    ? config.requiredTier
    : DEFAULT_MEMBER_GATE_CONFIG.requiredTier;

  const fallbackAction = ALLOWED_FALLBACK_ACTIONS.includes(config.fallbackAction)
    ? config.fallbackAction
    : DEFAULT_MEMBER_GATE_CONFIG.fallbackAction;

  const rawBlur = Number(config.blurIntensity);
  const blurIntensity = Number.isFinite(rawBlur)
    ? Math.min(BLUR_MAX, Math.max(BLUR_MIN, Math.round(rawBlur)))
    : DEFAULT_MEMBER_GATE_CONFIG.blurIntensity;

  return {
    requiredTier,
    fallbackAction,
    redirectUrl: sanitizeRedirectUrl(String(config.redirectUrl ?? "")),
    cardTitle: sanitizeText(String(config.cardTitle ?? ""), MAX_CARD_TITLE),
    cardDescription: sanitizeText(String(config.cardDescription ?? ""), MAX_CARD_DESCRIPTION),
    blurIntensity,
  };
}

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
  transform?: (code: string) => string;
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
  const code = descriptor.transform ? descriptor.transform(replaced) : replaced;

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

/* ==========================================================================
   MEMBER GATE, PRD task 1.7, feature F01
   ========================================================================== */

export const MEMBER_GATE_DESCRIPTOR: CanvasComponentDescriptor<MemberGateConfig> = {
  id: "member_gate",
  fileName: MEMBER_GATE_FILE_NAME,
  source: memberGateSource,
  configTypeName: "GateConfig",
  normalize: normalizeGateConfig,
  serializeFields: (config, context) => [
    `  requiredTier: ${encodeLiteral(config.requiredTier)},`,
    `  fallbackAction: ${encodeLiteral(config.fallbackAction)},`,
    `  redirectUrl: ${encodeLiteral(config.redirectUrl)},`,
    `  cardTitle: ${encodeLiteral(config.cardTitle)},`,
    `  cardDescription: ${encodeLiteral(config.cardDescription)},`,
    `  blurIntensity: ${config.blurIntensity},`,
    `  apiBaseUrl: ${encodeLiteral(context.apiBaseUrl)},`,
    `  sessionTtlMs: ${SESSION_CACHE_TTL_MS},`,
    `  siteKey: ${encodeLiteral(context.siteKey)},`,
    `  loginPath: ${encodeLiteral(context.loginPath || "/login")},`,
  ],
};

export function generateMemberGateCode(
  config: MemberGateConfig,
  source?: string,
  context: DeployContext = DISCONNECTED_DEPLOY_CONTEXT
): GeneratedCanvasFile<MemberGateConfig> {
  return generateComponentCode(MEMBER_GATE_DESCRIPTOR, config, source, context);
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
export function normalizeAuthConfig(config: MemberAuthConfig): MemberAuthConfig {
  const rawRadius = Number(config.borderRadius);
  const borderRadius = Number.isFinite(rawRadius)
    ? Math.min(AUTH_RADIUS_MAX, Math.max(AUTH_RADIUS_MIN, Math.round(rawRadius)))
    : DEFAULT_MEMBER_AUTH_CONFIG.borderRadius;

  return {
    authMode: config.authMode === "modal" ? "modal" : "inline",
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
    requirePasswordStrength: Boolean(config.requirePasswordStrength),
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
    `  requirePasswordStrength: ${config.requirePasswordStrength},`,
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
   ONBOARDING MODAL, feature plan FP-09, PRD feature F16, task 6.3
   ========================================================================== */

export const ONBOARDING_MODAL_FILE_NAME = "OnboardingModal.tsx";

/**
 * Clamp and whitelist before emission, same contract as the other three.
 *
 * `completionRedirect` is dropped to empty unless it is a site-relative path.
 * The component checks again at runtime, and checking here as well means an
 * off-site address never reaches the creator's project file at all.
 */
export function normalizeOnboardingConfig(config: OnboardingModalConfig): OnboardingModalConfig {
  const redirect = String(config.completionRedirect ?? "").trim();

  return {
    welcomeTitle: sanitizeText(String(config.welcomeTitle ?? ""), MAX_CARD_TITLE),
    welcomeMessage: sanitizeText(String(config.welcomeMessage ?? ""), MAX_CARD_DESCRIPTION),
    showStepIndicator: config.showStepIndicator !== false,
    allowSkip: config.allowSkip !== false,
    completionRedirect: redirect !== "" && isSafeSitePath(redirect) ? redirect : "",
    accentColor: isSafeCssColor(config.accentColor)
      ? config.accentColor
      : DEFAULT_ONBOARDING_MODAL_CONFIG.accentColor,
    borderRadius: Math.max(
      ONBOARDING_RADIUS_MIN,
      Math.min(ONBOARDING_RADIUS_MAX, Math.round(Number(config.borderRadius) || 0))
    ),
  };
}

export const ONBOARDING_MODAL_DESCRIPTOR: CanvasComponentDescriptor<OnboardingModalConfig> = {
  id: "onboarding_modal",
  fileName: ONBOARDING_MODAL_FILE_NAME,
  source: onboardingModalSource,
  configTypeName: "OnboardingConfig",
  normalize: normalizeOnboardingConfig,
  serializeFields: (config, context) => [
    `  welcomeTitle: ${encodeLiteral(config.welcomeTitle)},`,
    `  welcomeMessage: ${encodeLiteral(config.welcomeMessage)},`,
    `  showStepIndicator: ${config.showStepIndicator},`,
    `  allowSkip: ${config.allowSkip},`,
    `  completionRedirect: ${encodeLiteral(config.completionRedirect)},`,
    `  accentColor: ${encodeLiteral(config.accentColor)},`,
    `  borderRadius: ${config.borderRadius},`,
    `  apiBaseUrl: ${encodeLiteral(context.apiBaseUrl)},`,
    `  siteKey: ${encodeLiteral(context.siteKey)},`,
  ],
};

export function generateOnboardingModalCode(
  config: OnboardingModalConfig,
  source?: string,
  context: DeployContext = DISCONNECTED_DEPLOY_CONTEXT
): GeneratedCanvasFile<OnboardingModalConfig> {
  return generateComponentCode(ONBOARDING_MODAL_DESCRIPTOR, config, source, context);
}
