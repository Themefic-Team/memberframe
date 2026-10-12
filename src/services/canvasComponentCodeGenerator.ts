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
import { API_BASE_URL, SESSION_CACHE_TTL_MS } from "../config/backend";
import {
  AUTH_RADIUS_MAX,
  AUTH_RADIUS_MIN,
  BLUR_MAX,
  BLUR_MIN,
  DEFAULT_MEMBER_AUTH_CONFIG,
  DEFAULT_MEMBER_GATE_CONFIG,
  type GateFallbackAction,
  type MemberAuthConfig,
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
  config: Config
): string {
  return [
    CONFIG_START_MARKER,
    `const CONFIG: ${descriptor.configTypeName} = {`,
    ...descriptor.serializeFields(descriptor.normalize(config)),
    "};",
    CONFIG_END_MARKER,
  ].join("\n");
}

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
  serializeFields: (config: Config) => ReadonlyArray<string>;
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
  sourceOverride?: string
): GeneratedCanvasFile<Config> {
  const source = sourceOverride ?? descriptor.source;
  const normalized = descriptor.normalize(config);
  const code = replaceConfigBlock(source, buildConfigBlock(descriptor, normalized));

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
  serializeFields: (config) => [
    `  requiredTier: ${encodeLiteral(config.requiredTier)},`,
    `  fallbackAction: ${encodeLiteral(config.fallbackAction)},`,
    `  redirectUrl: ${encodeLiteral(config.redirectUrl)},`,
    `  cardTitle: ${encodeLiteral(config.cardTitle)},`,
    `  cardDescription: ${encodeLiteral(config.cardDescription)},`,
    `  blurIntensity: ${config.blurIntensity},`,
    `  apiBaseUrl: ${encodeLiteral(API_BASE_URL)},`,
    `  sessionTtlMs: ${SESSION_CACHE_TTL_MS},`,
  ],
};

export function generateMemberGateCode(
  config: MemberGateConfig,
  source?: string
): GeneratedCanvasFile<MemberGateConfig> {
  return generateComponentCode(MEMBER_GATE_DESCRIPTOR, config, source);
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

export const MEMBER_AUTH_DESCRIPTOR: CanvasComponentDescriptor<MemberAuthConfig> = {
  id: "member_auth",
  fileName: MEMBER_AUTH_FILE_NAME,
  source: memberAuthSource,
  configTypeName: "AuthConfig",
  normalize: normalizeAuthConfig,
  serializeFields: (config) => [
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
    `  apiBaseUrl: ${encodeLiteral(API_BASE_URL)},`,
  ],
};

export function generateMemberAuthCode(
  config: MemberAuthConfig,
  source?: string
): GeneratedCanvasFile<MemberAuthConfig> {
  return generateComponentCode(MEMBER_AUTH_DESCRIPTOR, config, source);
}
