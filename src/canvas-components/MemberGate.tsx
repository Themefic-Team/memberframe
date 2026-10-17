/**
 * `<MemberGate>`, the zero-code visual gate. PRD task 1.7, feature F01.
 *
 * ## This file leaves the repository
 *
 * Everything else in `src/` runs inside the plugin panel, where the only person
 * affected by a mistake is the creator who is already looking at it. This file
 * is written into the creator's Framer project by
 * `services/canvasComponentCodeGenerator.ts` and runs on their published
 * website, in front of their visitors. It is the only code here that does that,
 * so it is held to the strictest reading of every rule.
 *
 * Consequences, all deliberate:
 *
 *   - It imports only `react`, `framer`, and `lucide-react`. Framer supplies all
 *     three on the canvas. It cannot import from this repo, which is why the
 *     entitlement resolver and the session types appear here a second time.
 *   - All styling is one `cssContent` string injected through `<style>`, per PRD
 *     section 9.3 requirement 1. The one dynamic value, blur radius, is a CSS
 *     custom property scoped to the instance.
 *   - It starts locked and only ever becomes unlocked. There is no code path
 *     that renders protected content before entitlement resolves true, which is
 *     what makes PRD section 16.4's "disabling JavaScript leaves gated content
 *     locked" true by construction rather than by observation.
 *
 * ## The config block
 *
 * The marked block below is the only part the generator rewrites. Everything
 * else is byte-identical between this repo and the deployed file. Do not move
 * the markers, do not add a second pair, and do not reformat the block: the
 * generator asserts it finds exactly one pair and replaces what is between.
 *
 * ## The resolver appears twice on purpose
 *
 * PRD section 11.3 requires `isEntitled` to be "implemented identically in the
 * plugin, the canvas components, and the backend", and calls divergence a
 * security defect. The canvas copy cannot import the plugin's, so
 * `test/memberGateParity.test.ts` reads both files and fails if their bodies
 * stop matching. Edit one, edit the other.
 */

import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { addPropertyControls, ControlType, RenderTarget } from "framer";
import { Crown, Lock } from "lucide-react";

// ============================================================================
// LICENSING AND TRIAL STATE
// ============================================================================
// Rewritten in place by F19's `enforceLockState` regex patcher, so the four
// lines below must keep this exact shape. PRD section 9.3 requirement 3. The
// 1-instance duplicate registry from the reference master template is NOT here:
// that is licensing enforcement behaviour and it belongs to F19, which
// `.agents/rules/` places after the core workflow. Conflict C6 in the F01
// development doc.
const IS_LOCKED = false;
const IS_TRIAL = false;
// @plugin-lock-state: unlocked
// @plugin-trial-state: paid

// @memberframe-appearance-start
// ============================================================================
// APPEARANCE, SHARED BY EVERY MEMBERFRAME CANVAS COMPONENT
// ============================================================================
// Byte-identical in every canvas component: MemberAuth, MemberDashboard,
// MemberGate, MemberPricing, OnboardingModal, MeteredPaywall,
// ProtectedDownload, BookmarkButton, and BookmarksTray. Held so by
// `test/canvasAppearanceParity.test.ts`, which also compiles this block and
// runs it. A canvas component is compiled by Framer alone and cannot import
// from this repository, so the copy is the architecture. Edit all or none.
//
// One vocabulary for every component. The Theme control picks a palette, the
// creator's Colors, Typography, and Layout groups override it, and every rule
// in a component's stylesheet reads the resolved `--mf-c-*` values.
//
// ## Theme is a control, not the visitor's operating system
//
// These components used to switch palette on `prefers-color-scheme` alone.
// The Framer canvas renders light, but that media query follows the visitor's
// OS, so a published page turned dark for every visitor with a dark OS while
// the editor showed light. Theme now defaults to Light, matching the editor,
// and "Match visitor" is still offered as an explicit choice.
//
// ## Every creator value is sanitized before it reaches a style block
//
// Colors, the font family, and the numbers below end up inside a `<style>`
// element. A Framer variable can set a prop the code generator never saw, so
// each value is checked here, at runtime, and anything that could close a
// declaration is dropped in favour of the theme default.

type MfThemeMode = "light" | "dark" | "auto";

type MfColorKey = "onAccent" | "surface" | "text" | "muted" | "border" | "field";

interface MfAppearanceProps {
  theme?: MfThemeMode;
  colors?: Partial<Record<MfColorKey, string>> | null;
  typography?: { customFont?: boolean; font?: unknown; textScale?: number } | null;
  layout?: { padding?: number; gap?: number; borderWidth?: number; shadow?: boolean } | null;
  labels?: Record<string, unknown> | null;
}

interface MfAppearanceInput extends MfAppearanceProps {
  accent: unknown;
  radius: unknown;
  radiusMax: number;
  /** The component's look before Layout existed: a card has a shadow, a page section does not. */
  shadowByDefault: boolean;
}

const MF_DEFAULT_ACCENT = "#5271ff";

const MF_COLOR_VARS: Record<MfColorKey, string> = {
  onAccent: "--mf-on-accent",
  surface: "--mf-surface",
  text: "--mf-text",
  muted: "--mf-muted",
  border: "--mf-border",
  field: "--mf-field",
};

const MF_PLAIN_COLOR =
  /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*[\d.%\s,/]+\)|hsla?\(\s*[\d.%\s,/a-z]+\)|transparent)$/;

/**
 * A colour, and nothing but a colour, or the fallback.
 *
 * Accepts hex, rgb(a), hsl(a), and a Framer colour style, which arrives as
 * `var(--token-id, rgb(...))`, sometimes followed by a name comment that is
 * stripped first. A brace, a semicolon, an angle bracket, a backslash, or a
 * comment anywhere else rejects the value outright.
 */
function mfSafeColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;

  const colour = value.replace(/\s*\/\*[^*]*\*\/\s*$/, "").trim();
  if (colour === "" || colour.length > 160) return fallback;
  if (/[;{}<>\\]/.test(colour) || colour.indexOf("/*") !== -1) return fallback;
  if (MF_PLAIN_COLOR.test(colour)) return colour;

  const token = /^var\(\s*--[a-zA-Z0-9_-]+\s*(?:,\s*(.+))?\)$/.exec(colour);
  if (token && (token[1] === undefined || MF_PLAIN_COLOR.test(token[1].trim()))) return colour;

  return fallback;
}

/** A finite number inside the range, or the fallback. */
function mfNumber(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === "number" ? value : Number(value);
  if (typeof value === "string" && value.trim() === "") return fallback;
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

/**
 * The family out of a Font control value, or null.
 *
 * Letters, digits, spaces, quotes, commas, dots, and hyphens only: enough for
 * `"Inter", "Inter Placeholder", sans-serif` and nothing that can end a rule.
 */
function mfFontFamily(font: unknown): string | null {
  let family = "";
  if (typeof font === "string") family = font;
  else if (font && typeof font === "object") {
    const candidate = (font as { fontFamily?: unknown }).fontFamily;
    if (typeof candidate === "string") family = candidate;
  }

  family = family.trim();
  if (family === "" || family.length > 300) return null;
  if (!/^[A-Za-z0-9 "',._-]+$/.test(family)) return null;
  return family;
}

/** The root class for a theme. Anything unknown is Light, the editor's look. */
function mfThemeClass(theme: unknown): string {
  if (theme === "dark") return "is-dark";
  if (theme === "auto") return "is-auto";
  return "is-light";
}

/** `{name}` placeholders in a creator's label, filled with plain text. */
function mfFill(template: string, values: Record<string, string | number>): string {
  let out = template;
  for (const key of Object.keys(values)) out = out.split(`{${key}}`).join(String(values[key]));
  return out;
}

/**
 * One label: the creator's text when they typed some, the default otherwise.
 * Labels render as React text, never as markup, so they need no escaping.
 */
function mfLabel(
  labels: Record<string, unknown> | null | undefined,
  defaults: Record<string, readonly [string, string]>,
  key: string
): string {
  const value = labels ? labels[key] : undefined;
  if (typeof value === "string" && value.trim() !== "") return value;
  return defaults[key] ? defaults[key][1] : "";
}

/**
 * The scoped custom properties for one instance.
 *
 * Every `--mf-*` is declared, set or `initial`. `initial` makes `var()` fall
 * back to the theme default, and declaring it stops a component nested inside
 * another from inheriting the outer one's overrides.
 */
function mfAppearanceVars(input: MfAppearanceInput): string {
  const lines: string[] = [];
  const set = (name: string, value: string | null) => {
    lines.push(`${name}: ${value === null ? "initial" : value};`);
  };

  set("--mf-accent", mfSafeColor(input.accent, MF_DEFAULT_ACCENT));
  set("--mf-radius", `${Math.round(mfNumber(input.radius, 0, input.radiusMax, 10))}px`);

  const colors = input.colors || {};
  for (const key of Object.keys(MF_COLOR_VARS) as MfColorKey[]) {
    const colour = mfSafeColor(colors[key], "");
    set(MF_COLOR_VARS[key], colour === "" ? null : colour);
  }

  const typography = input.typography || {};
  set("--mf-font", typography.customFont === true ? mfFontFamily(typography.font) : null);
  set("--mf-text-scale", String(mfNumber(typography.textScale, 70, 160, 100) / 100));

  const layout = input.layout || {};
  const px = (value: unknown, max: number) =>
    value === undefined || value === null ? null : `${Math.round(mfNumber(value, 0, max, 0))}px`;
  set("--mf-pad", px(layout.padding, 64));
  set("--mf-gap", px(layout.gap, 48));
  set("--mf-border-width", px(layout.borderWidth, 4));
  const shadow = typeof layout.shadow === "boolean" ? layout.shadow : input.shadowByDefault;
  set("--mf-card-shadow", shadow ? null : "none");

  return lines.join(" ");
}

const MF_LIGHT = `
  --mf-c-accent: var(--mf-accent, #5271ff);
  --mf-c-on-accent: var(--mf-on-accent, #ffffff);
  --mf-c-surface: var(--mf-surface, #ffffff);
  --mf-c-text: var(--mf-text, #18202b);
  --mf-c-muted: var(--mf-muted, #5b6472);
  --mf-c-border: var(--mf-border, rgba(16, 24, 40, 0.12));
  --mf-c-field: var(--mf-field, #f4f5f7);
  --mf-c-danger: #dc2626;
  --mf-c-veil: rgba(255, 255, 255, 0.55);
  --mf-c-backdrop: rgba(15, 17, 23, 0.55);
  --mf-c-shadow: var(--mf-card-shadow, 0 12px 32px rgba(16, 24, 40, 0.14));
  color-scheme: light;`;

const MF_DARK = `
  --mf-c-accent: var(--mf-accent, #5271ff);
  --mf-c-on-accent: var(--mf-on-accent, #ffffff);
  --mf-c-surface: var(--mf-surface, #18191b);
  --mf-c-text: var(--mf-text, #ffffff);
  --mf-c-muted: var(--mf-muted, #cbcbcb);
  --mf-c-border: var(--mf-border, rgba(255, 255, 255, 0.1));
  --mf-c-field: var(--mf-field, #202020);
  --mf-c-danger: #f87171;
  --mf-c-veil: rgba(12, 14, 18, 0.55);
  --mf-c-backdrop: rgba(0, 0, 0, 0.62);
  --mf-c-shadow: var(--mf-card-shadow, 0 12px 32px rgba(0, 0, 0, 0.45));
  color-scheme: dark;`;

/** The palette for a component root, per theme. Emitted before the component's own CSS. */
function mfThemeCss(root: string): string {
  return `
${root} {${MF_LIGHT}
  --mf-c-radius: var(--mf-radius, 10px);
  --mf-c-font: var(--mf-font, var(--framer-font-family, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif));
  font-family: var(--mf-c-font);
}
${root}.is-dark {${MF_DARK}
}
@media (prefers-color-scheme: dark) {
  ${root}.is-auto {${MF_DARK}
  }
}
`;
}

/**
 * The shared property controls: Theme, Colors, Typography, Layout.
 *
 * Return types are inferred on purpose. Framer's real `framer` module and this
 * repo's shim name their control types differently, and this file compiles
 * against both.
 *
 * Colours are optional, so an untouched one stays undefined and the theme
 * default shows through. Layout defaults are the component's own, passed in,
 * so a fresh instance looks exactly as it did before the group existed.
 */
function mfAppearanceControls(defaults: { padding: number; gap: number; shadow: boolean }) {
  return {
    theme: {
      type: ControlType.Enum,
      title: "Theme",
      options: ["light", "dark", "auto"],
      optionTitles: ["Light", "Dark", "Match visitor"],
      defaultValue: "light",
    },
    colors: {
      type: ControlType.Object,
      title: "Colors",
      buttonTitle: "Colors",
      controls: {
        surface: { type: ControlType.Color, title: "Background", optional: true },
        text: { type: ControlType.Color, title: "Text", optional: true },
        muted: { type: ControlType.Color, title: "Muted text", optional: true },
        border: { type: ControlType.Color, title: "Border", optional: true },
        field: { type: ControlType.Color, title: "Field", optional: true },
        onAccent: { type: ControlType.Color, title: "Button text", optional: true },
      },
    },
    typography: {
      type: ControlType.Object,
      title: "Typography",
      buttonTitle: "Typography",
      controls: {
        customFont: { type: ControlType.Boolean, title: "Custom font", defaultValue: false },
        font: {
          type: ControlType.Font,
          title: "Font",
          controls: "basic" as const,
          defaultFontType: "sans-serif" as const,
        },
        textScale: {
          type: ControlType.Number,
          title: "Text size",
          min: 70,
          max: 160,
          step: 5,
          unit: "%",
          defaultValue: 100,
        },
      },
    },
    layout: {
      type: ControlType.Object,
      title: "Layout",
      buttonTitle: "Layout",
      controls: {
        padding: {
          type: ControlType.Number,
          title: "Padding",
          min: 0,
          max: 64,
          step: 1,
          unit: "px",
          defaultValue: defaults.padding,
        },
        gap: {
          type: ControlType.Number,
          title: "Spacing",
          min: 0,
          max: 48,
          step: 1,
          unit: "px",
          defaultValue: defaults.gap,
        },
        borderWidth: {
          type: ControlType.Number,
          title: "Border",
          min: 0,
          max: 4,
          step: 1,
          unit: "px",
          defaultValue: 1,
        },
        shadow: { type: ControlType.Boolean, title: "Shadow", defaultValue: defaults.shadow },
      },
    },
  };
}

/** The Labels group, one String control per entry: key -> [title, default text]. */
function mfLabelControls(defaults: Record<string, readonly [string, string]>) {
  const controls: Record<
    string,
    { type: typeof ControlType.String; title: string; defaultValue: string }
  > = {};
  for (const key of Object.keys(defaults)) {
    controls[key] = { type: ControlType.String, title: defaults[key][0], defaultValue: defaults[key][1] };
  }
  return { type: ControlType.Object, title: "Labels", buttonTitle: "Labels", controls };
}
// @memberframe-appearance-end

// @memberframe-schema-start
// ============================================================================
// SCHEMA.ORG PAYWALL MARKUP, PRD F08
// ============================================================================
// Byte-identical in MemberGate and MeteredPaywall, held so by
// `test/softPaywall.test.ts`. One script per page, added to the head on the
// published site only: the canvas is not a page Google reads.

const MF_GATED_BODY_CLASS = "memberframe-gated-body";
const MF_SCHEMA_ID = "memberframe-paywall-schema";
const MF_SCHEMA_TYPES = ["Article", "NewsArticle", "BlogPosting", "CreativeWork"];

/** The JSON-LD for a page whose `.memberframe-gated-body` is paid content. */
function mfPaywallSchema(type: string, headline: string, url: string): string {
  const data = {
    "@context": "https://schema.org",
    "@type": MF_SCHEMA_TYPES.indexOf(type) === -1 ? "Article" : type,
    headline: headline.slice(0, 110),
    url,
    isAccessibleForFree: "False",
    hasPart: {
      "@type": "WebPageElement",
      isAccessibleForFree: "False",
      cssSelector: `.${MF_GATED_BODY_CLASS}`,
    },
  };
  // `<` escaped so the text can never close the script element it sits in.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** Add the markup once per page. Later instances find it and do nothing. */
function mfInjectPaywallSchema(type: string): void {
  if (typeof document === "undefined" || document.getElementById(MF_SCHEMA_ID)) return;
  const canonical = document.querySelector('link[rel="canonical"]');
  const href = canonical ? canonical.getAttribute("href") : null;
  const url = href && /^https?:\/\//.test(href) ? href : window.location.origin + window.location.pathname;
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.id = MF_SCHEMA_ID;
  script.textContent = mfPaywallSchema(type, document.title || "", url);
  document.head.appendChild(script);
}
// @memberframe-schema-end

/**
 * `useLayoutEffect` in the browser, `useEffect` while Framer pre-renders the
 * page on its server, where a layout effect cannot run and only warns.
 */
const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

// ============================================================================
// DATA CONTRACTS, PRD SECTION 11
// ============================================================================

// The four built in keys, or a creator's own (conflict C9, resolved).
type TierKey = "free_member" | "tier_1" | "tier_2" | "vip" | (string & {});
type RequiredTier = "anyone" | "signed_in" | TierKey;
type MemberStatus = "active" | "trialing" | "past_due" | "canceled";
type GateFallbackAction = "blur" | "hide" | "redirect" | "custom_card";

interface MemberSessionData {
  memberId: string;
  email: string;
  name: string | null;
  activeTier: TierKey;
  status: MemberStatus;
  /** Unix seconds, UTC. A canceled member keeps access until this moment. */
  currentPeriodEnd: number;
  /** Unix seconds, UTC. A past_due member keeps access until this moment. */
  gracePeriodEndsAt: number;
  siteId: string;
}

interface TierLadderEntry {
  key: TierKey;
  rank: number;
  name: string;
}

/**
 * The fallback tier ladder.
 *
 * CONFLICT C5, resolved. The session response carries the site's real ladder
 * (`tiers`), signed in or not, and every comparison below uses it. This
 * default is only for a response that somehow lacks one, and it fails safe:
 * a key it does not know misses, and the gate stays shut.
 */
const DEFAULT_SITE_TIERS: ReadonlyArray<TierLadderEntry> = [
  { key: "free_member", rank: 0, name: "Free" },
  { key: "tier_1", rank: 1, name: "Silver" },
  { key: "tier_2", rank: 2, name: "Gold" },
  { key: "vip", rank: 3, name: "VIP" },
];

interface GateConfig {
  requiredTier: RequiredTier;
  fallbackAction: GateFallbackAction;
  redirectUrl: string;
  cardTitle: string;
  cardDescription: string;
  blurIntensity: number;
  apiBaseUrl: string;
  sessionTtlMs: number;
  /**
   * Which MemberFrame site this gate belongs to.
   *
   * Public. It identifies the tenant; the request's `Origin` is what
   * authorizes, checked against that site's allowlist on the server. See the
   * same field on `<MemberAuth>` for the full reasoning.
   *
   * Empty when the gate was deployed before the project was connected, in
   * which case every session check fails and the gate stays shut. That is the
   * right direction to fail in: no content leaks.
   */
  siteKey: string;
  loginPath: string;
}

const ENV_API_BASE_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_APP_BASE_URL)) ||
  "";

// @memberframe-config-start
const CONFIG: GateConfig = {
  requiredTier: "signed_in",
  fallbackAction: "blur",
  redirectUrl: "",
  cardTitle: "Members Only Content",
  cardDescription: "Join or sign in to read this full guide.",
  blurIntensity: 8,
  apiBaseUrl: ENV_API_BASE_URL,
  sessionTtlMs: 60000,
  siteKey: "",
  loginPath: "/login",
};
// @memberframe-config-end

// ============================================================================
// ENTITLEMENT RESOLUTION, PRD SECTION 11.3
// ============================================================================
// Second copy. Held to the plugin's by test/memberGateParity.test.ts. If you
// change anything below, change src/utils/entitlement.ts to match.

function isEntitled(
  session: MemberSessionData | null,
  requiredTier: RequiredTier,
  tiers: ReadonlyArray<TierLadderEntry> = DEFAULT_SITE_TIERS,
  nowSeconds: number = Date.now() / 1000
): boolean {
  if (requiredTier === "anyone") return true;
  if (!session) return false;

  const statusOk =
    session.status === "active" ||
    session.status === "trialing" ||
    (session.status === "past_due" && nowSeconds < session.gracePeriodEndsAt) ||
    (session.status === "canceled" && nowSeconds < session.currentPeriodEnd);

  if (!statusOk) return false;
  if (requiredTier === "signed_in") return true;

  const required = tiers.find((tier) => tier.key === requiredTier);
  const held = tiers.find((tier) => tier.key === session.activeTier);

  if (!required || !held) return false;

  return held.rank >= required.rank;
}

// ============================================================================
// SESSION VERIFICATION
// ============================================================================

/**
 * What the one call to the backend produced. Four outcomes, and only the first
 * can ever unlock anything.
 */
type SessionResult =
  | { kind: "member"; session: MemberSessionData; tiers: ReadonlyArray<TierLadderEntry> }
  | { kind: "guest"; tiers: ReadonlyArray<TierLadderEntry> }
  | { kind: "upgrade"; tiers: ReadonlyArray<TierLadderEntry> }
  | { kind: "unavailable" };

/** The site's ladder from a session answer, or the fallback. */
function ladderOf(result: SessionResult | null): ReadonlyArray<TierLadderEntry> {
  return result && "tiers" in result && result.tiers.length > 0 ? result.tiers : DEFAULT_SITE_TIERS;
}

function readLadder(value: unknown): ReadonlyArray<TierLadderEntry> {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is TierLadderEntry =>
      Boolean(entry) && typeof entry.key === "string" && typeof entry.rank === "number"
  );
}

/**
 * Module-scope cache, shared by every gate instance on the page.
 *
 * PRD P4 forbids a request per gated element, so a page with ten gates makes
 * one request. A failed verification is cached for the same window, which is
 * also what PRD section 10.6 asks for on a 429: locked state, no retry storm.
 */
let cachedSession: { at: number; value: Promise<SessionResult> } | null = null;

async function requestSession(): Promise<SessionResult> {
  try {
    // No token is read anywhere. PRD section 14.1 S2 puts the member session in
    // an HTTP-only cookie and forbids a JWT in localStorage, so the browser
    // attaches the credential and this component never sees it. Conflict C4.
    const response = await fetch(`${CONFIG.apiBaseUrl}/api/member/session`, {
      credentials: "include",
      headers:
        CONFIG.siteKey === ""
          ? { Accept: "application/json" }
          : { Accept: "application/json", "X-MemberFrame-Site": CONFIG.siteKey },
    });

    // Every answer, signed in or not, carries the site's tier ladder.
    const body = (await response.json().catch(() => ({}))) as {
      member?: MemberSessionData;
      tiers?: unknown;
    } & Partial<MemberSessionData>;
    const tiers = readLadder(body.tiers);

    if (response.status === 401) return { kind: "guest", tiers };
    if (response.status === 403) return { kind: "upgrade", tiers };
    if (!response.ok) return { kind: "unavailable" };

    // The API answers `{ member, tiers }`. Reading the body itself as the
    // member left `status` undefined, so no signed-in member was ever let in.
    const session = body.member ?? (body as MemberSessionData);
    if (typeof session.status !== "string") return { kind: "unavailable" };
    return { kind: "member", session, tiers };
  } catch {
    // Network failure, a blocked request, or a malformed body. All three are
    // "entitlement could not be verified", which PRD S11 settles: fail closed.
    return { kind: "unavailable" };
  }
}

function loadSession(): Promise<SessionResult> {
  const now = Date.now();

  if (cachedSession && now - cachedSession.at < CONFIG.sessionTtlMs) {
    return cachedSession.value;
  }

  const value = requestSession();
  cachedSession = { at: now, value };
  return value;
}

// ============================================================================
// CONSOLIDATED CSS, INJECTED ONCE PER INSTANCE
// ============================================================================
// The plugin's design tokens are not available here: `design-tokens.css` is
// loaded by the panel and does not exist on a published site. So the palette is
// declared on the component root and every rule reads it, which keeps the
// "no hex in a rule body" shape with a different declaration site. The dark
// variant keys off `prefers-color-scheme`, the published-site equivalent of the
// panel's `data-framer-theme`.

const cssContent = `
/*
  The palette comes from the shared appearance block (mfThemeCss): Theme plus
  the creator's Colors resolve into --mf-c-*. The gradient's dark end is the
  accent mixed toward black, so a custom accent keeps the brand's depth.
*/
.memberframe-gate-root {
  --memberframe-gate-surface: var(--mf-c-surface);
  --memberframe-gate-border: var(--mf-c-border);
  --memberframe-gate-title: var(--mf-c-text);
  --memberframe-gate-body: var(--mf-c-muted);
  --memberframe-gate-brand: var(--mf-c-accent);
  --memberframe-gate-brand-strong: color-mix(in srgb, var(--mf-c-accent) 72%, #000000);
  --memberframe-gate-on-brand: var(--mf-c-on-accent);
  --memberframe-gate-scrim: var(--mf-c-veil);
  --memberframe-gate-shadow: var(--mf-c-shadow);
  --memberframe-gate-blur: 8px;

  box-sizing: border-box;
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 260px;
  min-height: 120px;
  overflow: hidden;
}

.memberframe-gate-content {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
}

/* Frosted blur teaser. The content stays in the DOM on purpose: a teaser the
   visitor can almost read is the point of this fallback. A creator who needs the
   content withheld entirely chooses Hide Completely or Lock Card. */
.memberframe-gate-content.is-blurred {
  filter: blur(var(--memberframe-gate-blur));
  pointer-events: none;
  user-select: none;
}

.memberframe-gate-overlay {
  box-sizing: border-box;
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--memberframe-gate-scrim);
  backdrop-filter: saturate(1.1);
  -webkit-backdrop-filter: saturate(1.1);
}

.memberframe-gate-overlay.is-plain {
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.memberframe-lock-card {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--mf-gap, 10px);
  max-width: 340px;
  padding: var(--mf-pad, 24px);
  text-align: center;
  border: var(--mf-border-width, 1px) solid var(--memberframe-gate-border);
  border-radius: var(--mf-c-radius);
  background: var(--memberframe-gate-surface);
  box-shadow: var(--memberframe-gate-shadow);
}

.memberframe-lock-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  color: var(--memberframe-gate-brand);
  background: color-mix(in srgb, var(--memberframe-gate-brand) 12%, transparent);
}

.memberframe-lock-title {
  margin: 0;
  font-size: calc(15px * var(--mf-text-scale, 1));
  font-weight: 600;
  line-height: 1.3;
  color: var(--memberframe-gate-title);
}

.memberframe-lock-description {
  margin: 0;
  font-size: calc(13px * var(--mf-text-scale, 1));
  line-height: 1.5;
  color: var(--memberframe-gate-body);
}

.memberframe-lock-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 4px;
  padding: 9px 18px;
  border-radius: calc(var(--mf-c-radius) * 0.6);
  font-size: calc(13px * var(--mf-text-scale, 1));
  font-weight: 600;
  color: var(--memberframe-gate-on-brand);
  background: linear-gradient(
    180deg,
    var(--memberframe-gate-brand) 0%,
    var(--memberframe-gate-brand-strong) 100%
  );
  border: none;
  cursor: pointer;
  text-decoration: none;
  font-family: inherit;
  transition: opacity 0.15s ease, transform 0.1s ease;
}

.memberframe-lock-cta:hover {
  opacity: 0.95;
  filter: brightness(1.05);
}

.memberframe-lock-cta:active {
  transform: scale(0.98);
}

/* Canvas only. Tells the creator the frame is gated without hiding the frame
   they are trying to design. */
.memberframe-gate-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 20;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: calc(11px * var(--mf-text-scale, 1));
  font-weight: 600;
  letter-spacing: 0.2px;
  color: var(--memberframe-gate-on-brand);
  background: linear-gradient(
    180deg,
    var(--memberframe-gate-brand) 0%,
    var(--memberframe-gate-brand-strong) 100%
  );
  box-shadow: var(--memberframe-gate-shadow);
}

.memberframe-gate-placeholder {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 72px;
  height: 100%;
  padding: 16px;
  text-align: center;
  font-size: calc(12px * var(--mf-text-scale, 1));
  line-height: 1.5;
  color: var(--memberframe-gate-body);
  border: 1px dashed var(--memberframe-gate-border);
  border-radius: 10px;
  background: var(--memberframe-gate-surface);
}

/* Full-screen guard shield: prevents content flashing before page redirect */
.memberframe-page-shield {
  box-sizing: border-box;
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: 999999;
  background: var(--memberframe-gate-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.memberframe-page-shield-card {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  max-width: 320px;
  padding: 24px;
  text-align: center;
  border-radius: 14px;
  background: var(--memberframe-gate-surface);
  border: 1px solid var(--memberframe-gate-border);
  box-shadow: var(--memberframe-gate-shadow);
}

.memberframe-page-shield-title {
  margin: 0;
  font-size: calc(14px * var(--mf-text-scale, 1));
  font-weight: 600;
  color: var(--memberframe-gate-title);
}

/* Canvas representation of MemberGate when idle or configured as a page guard */
.memberframe-canvas-guard-card {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 260px;
  max-width: 380px;
  width: 100%;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--memberframe-gate-border);
  background: var(--memberframe-gate-surface);
  box-shadow: var(--memberframe-gate-shadow);
}

.memberframe-canvas-guard-card.is-unconnected {
  border-style: dashed;
}

.memberframe-canvas-guard-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.memberframe-canvas-guard-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  color: var(--memberframe-gate-brand);
  background: color-mix(in srgb, var(--memberframe-gate-brand) 12%, transparent);
}

.memberframe-canvas-guard-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: calc(10px * var(--mf-text-scale, 1));
  font-weight: 600;
  letter-spacing: 0.3px;
  color: var(--memberframe-gate-on-brand);
  background: var(--memberframe-gate-brand);
}

.memberframe-canvas-guard-title {
  margin: 0;
  font-size: calc(13px * var(--mf-text-scale, 1));
  font-weight: 600;
  line-height: 1.3;
  color: var(--memberframe-gate-title);
}

.memberframe-canvas-guard-desc {
  margin: 0;
  font-size: calc(11px * var(--mf-text-scale, 1));
  line-height: 1.5;
  color: var(--memberframe-gate-body);
}

.memberframe-canvas-guard-desc strong {
  color: var(--memberframe-gate-title);
}

/* F19 layer: the Pro-Lock banner, shown when IS_LOCKED is patched to true. */
.memberframe-prolock {
  box-sizing: border-box;
  position: absolute;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 17, 23, 0.72);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

/* F19 layer: the trial watermark. Stops rendering the moment IS_TRIAL is
   patched to false, which is the automatic removal PRD section 12 requires. */
.memberframe-trial-watermark {
  position: absolute;
  right: 8px;
  bottom: 8px;
  z-index: 110;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: calc(10px * var(--mf-text-scale, 1));
  font-weight: 600;
  text-decoration: none;
  color: var(--memberframe-gate-on-brand);
  background: rgba(15, 17, 23, 0.82);
}
`;

// ============================================================================
// COMPONENT
// ============================================================================

export interface MemberGateProps extends MfAppearanceProps {
  accentColor?: string;
  borderRadius?: number;
  /** `ControlType.ComponentInstance`. The frame being protected. */
  contentSlot?: React.ReactNode;
  requiredTier?: RequiredTier;
  fallbackAction?: GateFallbackAction;
  redirectUrl?: string;
  cardTitle?: string;
  cardDescription?: string;
  blurIntensity?: number;
  /** Lock card details. Not in CONFIG: no plugin field sets them. */
  showLockIcon?: boolean;
  showLockButton?: boolean;
  /** Where the lock card's button goes. Defaults to the site's sign in page. */
  loginPath?: string;
  /**
   * FP-16. Where a signed-in member without the tier goes to upgrade: the page
   * with `<MemberPricing>`. A signed-out visitor still goes to sign in.
   */
  pricingPath?: string;
  /**
   * F08. Schema.org paywall markup for Frosted Blur, where the content stays in
   * the page. Off by itself for every other state: Hide Completely removes the
   * content from the page, and markup describing content that is not there
   * would be wrong.
   */
  seoMarkup?: boolean;
  schemaType?: string;
}

/**
 * The lock card's visible strings, as [sidebar title, default]. The Labels
 * group edits them; an empty field falls back. `{tier}` is the plan name.
 * Lock Title and Lock Message stay their own controls, for the Lock Card state.
 */
const GATE_LABELS: Record<string, readonly [string, string]> = {
  guestTitle: ["Signed out title", "Members Only Content"],
  guestText: ["Signed out text", "Sign in to see this section."],
  unavailableText: ["Check failed text", "We could not check your membership just now."],
  signInCta: ["Sign in button", "Sign in to unlock"],
  upgradeTitle: ["Upgrade title", "Upgrade To Continue"],
  upgradeText: ["Upgrade text", "Your plan does not include this section."],
  tierText: ["Needs plan text", "This needs the {tier} plan or higher."],
  noAccessText: ["No access text", "You do not have access to this yet."],
  upgradeCta: ["Upgrade button", "Upgrade to unlock"],
  pastDueTitle: ["Payment failed title", "Payment Problem"],
  pastDueText: ["Payment failed text", "Your last payment did not go through."],
  pastDueCta: ["Payment button", "Update payment method"],
  canceledTitle: ["Ended title", "Membership Ended"],
  canceledText: ["Ended text", "Rejoin to get this section back."],
  verifying: ["Redirect checking", "Verifying access..."],
  overrideCta: ["Override button", "Sign In to Access"],
};

/** Style defaults for the lock card. The gate's CONFIG predates them. */
const GATE_STYLE_DEFAULTS = { accentColor: "#5271ff", borderRadius: 14 };

const BLUR_MIN = 2;
const BLUR_MAX = 20;

function clampBlur(value: number): number {
  if (!Number.isFinite(value)) return CONFIG.blurIntensity;
  return Math.min(BLUR_MAX, Math.max(BLUR_MIN, Math.round(value)));
}

/**
 * The locked card's copy, in plain language.
 *
 * PRD section 7.6 rule 4: never surface a raw enum value to a user. Nothing
 * here interpolates a status or a tier key, only names from the tier table.
 */
function lockCopy(
  result: SessionResult | null,
  requiredTier: RequiredTier,
  tiers: ReadonlyArray<TierLadderEntry>,
  labels: Record<string, unknown> | null | undefined
): { title: string; description: string; cta: string } {
  const t = (key: string) => mfLabel(labels, GATE_LABELS, key);

  if (!result || result.kind === "unavailable") {
    return { title: t("guestTitle"), description: t("unavailableText"), cta: t("signInCta") };
  }

  if (result.kind === "guest") {
    return { title: t("guestTitle"), description: t("guestText"), cta: t("signInCta") };
  }

  if (result.kind === "upgrade") {
    return { title: t("upgradeTitle"), description: t("upgradeText"), cta: t("upgradeCta") };
  }

  if (result.session.status === "past_due") {
    return { title: t("pastDueTitle"), description: t("pastDueText"), cta: t("pastDueCta") };
  }

  if (result.session.status === "canceled") {
    return { title: t("canceledTitle"), description: t("canceledText"), cta: t("upgradeCta") };
  }

  const required = tiers.find((tier) => tier.key === requiredTier);

  return {
    title: t("upgradeTitle"),
    description: required ? mfFill(t("tierText"), { tier: required.name }) : t("noAccessText"),
    cta: t("upgradeCta"),
  };
}

/**
 * Fixed size by default: the gate is the size of the frame it protects, and
 * the creator draws that frame. Fit and Fill stay available in the sidebar.
 *
 * @framerIntrinsicWidth 400
 * @framerIntrinsicHeight 300
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
export default function MemberGate(props: MemberGateProps) {
  const {
    accentColor = GATE_STYLE_DEFAULTS.accentColor,
    borderRadius = GATE_STYLE_DEFAULTS.borderRadius,
    theme = "light",
    colors,
    typography,
    layout,
    labels,
    contentSlot,
    requiredTier = CONFIG.requiredTier,
    fallbackAction = CONFIG.fallbackAction,
    redirectUrl = CONFIG.redirectUrl,
    cardTitle = CONFIG.cardTitle,
    cardDescription = CONFIG.cardDescription,
    blurIntensity = CONFIG.blurIntensity,
    showLockIcon = true,
    showLockButton = true,
    loginPath = CONFIG.loginPath,
    pricingPath = "/pricing",
    seoMarkup = true,
    schemaType = "Article",
  } = props;

  /**
   * A CSS-safe scope for this instance, so two gates with different blur
   * settings on one page do not overwrite each other's radius. `useId` returns
   * a value containing colons, which are legal in a quoted attribute selector
   * but not worth relying on.
   */
  const rawId = useId();
  const scope = useMemo(() => `mfg${rawId.replace(/[^a-zA-Z0-9]/g, "")}`, [rawId]);

  /**
   * Canvas and thumbnail renders are the creator designing, not a visitor
   * reading. The gate makes no request there and never navigates, and it shows
   * the protected frame so the creator can actually arrange it. The locked
   * states are what the Live Preview Studio in the plugin panel is for, which
   * is the division F04 exists to provide.
   */
  const onCanvas = useMemo(() => {
    const target = RenderTarget.current();
    return target === RenderTarget.canvas || target === RenderTarget.thumbnail;
  }, []);

  /** `null` means still checking, and checking renders locked. */
  const [result, setResult] = useState<SessionResult | null>(null);

  useEffect(() => {
    if (onCanvas) return;

    let active = true;
    void loadSession().then((value) => {
      if (active) setResult(value);
    });

    function handleSessionUpdate() {
      cachedSession = null;
      void loadSession().then((value) => {
        if (active) setResult(value);
      });
    }

    window.addEventListener("memberframe:session-updated", handleSessionUpdate);

    return () => {
      active = false;
      window.removeEventListener("memberframe:session-updated", handleSessionUpdate);
    };
  }, [onCanvas]);

  const entitled =
    result !== null &&
    result.kind === "member" &&
    isEntitled(result.session, requiredTier, ladderOf(result));

  const effectiveRedirect = redirectUrl || CONFIG.redirectUrl || CONFIG.loginPath || "/";

  useEffect(() => {
    if (onCanvas) return;
    if (fallbackAction !== "redirect") return;
    if (result === null || entitled) return;
    if (!effectiveRedirect) return;

    window.location.replace(effectiveRedirect);
  }, [onCanvas, fallbackAction, result, entitled, effectiveRedirect]);

  // F08: the blurred teaser is paid content left in the page, so it is
  // described to search engines as such. Never for Hide Completely.
  useEffect(() => {
    if (onCanvas || !seoMarkup || fallbackAction !== "blur" || !contentSlot) return;
    mfInjectPaywallSchema(schemaType);
  }, [onCanvas, seoMarkup, fallbackAction, contentSlot, schemaType]);

  // The blurred copy is unreadable, so focus and screen readers skip it and
  // reach the lock card instead (F08). Set on the node, which every React accepts.
  const blurredRef = useRef<HTMLDivElement | null>(null);
  const blurred = !onCanvas && !entitled && fallbackAction === "blur";
  useBrowserLayoutEffect(() => {
    const node = blurredRef.current;
    if (!node) return;
    if (blurred) node.setAttribute("inert", "");
    else node.removeAttribute("inert");
  }, [blurred, contentSlot]);

  const blur = clampBlur(blurIntensity);
  const scopedBlur =
    `[data-memberframe-gate="${scope}"] { --memberframe-gate-blur: ${blur}px; ` +
    mfAppearanceVars({
      accent: accentColor,
      radius: borderRadius,
      radiusMax: 32,
      shadowByDefault: true,
      colors,
      typography,
      layout,
    }) +
    " }";
  const copy = lockCopy(result, requiredTier, ladderOf(result), labels);

  const showCustomCard = fallbackAction === "custom_card";
  const title = showCustomCard ? cardTitle : copy.title;
  const description = showCustomCard ? cardDescription : copy.description;

  const handleLockCtaClick = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("memberframe:open-auth"));
    // Signed in but on too low a tier: the fix is a purchase, not a sign in.
    const signedIn = result !== null && result.kind !== "guest" && result.kind !== "unavailable";
    const target = signedIn && pricingPath ? pricingPath : loginPath || CONFIG.loginPath || "/login";
    if (target && window.location.pathname !== target) {
      window.location.assign(target);
    }
  };

  /** The locked card, shared by the blur, custom card, and redirect states. */
  const lockCard = (
    <div className="memberframe-lock-card">
      {showLockIcon ? (
        <span className="memberframe-lock-icon">
          <Lock size={18} stroke="currentColor" aria-hidden={true} />
        </span>
      ) : null}
      <h3 className="memberframe-lock-title">{title}</h3>
      <p className="memberframe-lock-description">{description}</p>
      {showLockButton ? (
        <button
          type="button"
          className="memberframe-lock-cta"
          onClick={handleLockCtaClick}
        >
          {copy.cta}
        </button>
      ) : null}
    </div>
  );

  /** Shown only when IS_TRIAL has been patched on. PRD section 9.3 point 4. */
  const watermark = IS_TRIAL && !IS_LOCKED ? (
    <a
      className="memberframe-trial-watermark"
      href="https://framefic.com"
      target="_blank"
      rel="noopener noreferrer"
    >
      <Crown size={10} stroke="currentColor" aria-hidden={true} />
      <span>Trial Version</span>
    </a>
  ) : null;

  const proLock = IS_LOCKED ? (
    <div className="memberframe-prolock">
      <div className="memberframe-lock-card">
        <span className="memberframe-lock-icon">
          <Lock size={18} stroke="currentColor" aria-hidden={true} />
        </span>
        <h3 className="memberframe-lock-title">Component Locked</h3>
        <p className="memberframe-lock-description">
          Open the MemberFrame plugin to activate your license or start a free trial.
        </p>
      </div>
    </div>
  ) : null;

  function body(): React.ReactNode {
    // The creator's own canvas. Show the frame, label it, change nothing.
    if (onCanvas) {
      if (contentSlot) {
        return (
          <React.Fragment>
            <span className="memberframe-gate-badge">
              <Lock size={11} stroke="currentColor" aria-hidden={true} />
              <span>Gated</span>
            </span>
            <div className="memberframe-gate-content">{contentSlot}</div>
          </React.Fragment>
        );
      }

      if (fallbackAction === "redirect") {
        return (
          <div className="memberframe-canvas-guard-card">
            <div className="memberframe-canvas-guard-head">
              <span className="memberframe-canvas-guard-icon">
                <Lock size={15} stroke="currentColor" aria-hidden={true} />
              </span>
              <span className="memberframe-canvas-guard-badge">Page Lock Active</span>
            </div>
            <h4 className="memberframe-canvas-guard-title">
              Route Protected: {requiredTier === "signed_in" ? "Signed in members only" : requiredTier}
            </h4>
            <p className="memberframe-canvas-guard-desc">
              Unauthenticated visitors will be redirected to: <strong>{effectiveRedirect}</strong>
            </p>
          </div>
        );
      }

      return (
        <div className="memberframe-canvas-guard-card is-unconnected">
          <div className="memberframe-canvas-guard-head">
            <span className="memberframe-canvas-guard-icon">
              <Lock size={15} stroke="currentColor" aria-hidden={true} />
            </span>
            <span className="memberframe-canvas-guard-badge">MemberGate</span>
          </div>
          <h4 className="memberframe-canvas-guard-title">Connect Protected Frame</h4>
          <p className="memberframe-canvas-guard-desc">
            In Framer&apos;s right sidebar, select any Frame or Stack in the <em>Protected Frame</em> slot.
          </p>
        </div>
      );
    }

    // F01 acceptance criterion 1: rendered unmodified. No wrapper class that
    // filters, scrims, or repositions, and no overlay sibling.
    if (entitled) {
      return <div className="memberframe-gate-content">{contentSlot}</div>;
    }

    if (fallbackAction === "hide") {
      return null;
    }

    if (fallbackAction === "blur") {
      return (
        <React.Fragment>
          <div ref={blurredRef} className={`memberframe-gate-content is-blurred ${MF_GATED_BODY_CLASS}`}>
            {contentSlot}
          </div>
          <div className="memberframe-gate-overlay">{lockCard}</div>
        </React.Fragment>
      );
    }

    if (fallbackAction === "redirect") {
      return (
        <div className="memberframe-page-shield">
          <div className="memberframe-page-shield-card">
            <span className="memberframe-lock-icon">
              <Lock size={18} stroke="currentColor" aria-hidden={true} />
            </span>
            <h3 className="memberframe-page-shield-title">{mfLabel(labels, GATE_LABELS, "verifying")}</h3>
          </div>
        </div>
      );
    }

    return <div className="memberframe-gate-overlay is-plain">{lockCard}</div>;
  }

  return (
    <div className={`memberframe-gate-root ${mfThemeClass(theme)}`} data-memberframe-gate={scope}>
      <style>{mfThemeCss(".memberframe-gate-root")}</style>
      <style>{cssContent}</style>
      <style>{scopedBlur}</style>
      {body()}
      {proLock}
      {watermark}
    </div>
  );
}

// ============================================================================
// PROPERTY CONTROLS, PRD SECTION 8 F01
// ============================================================================
// All seven, with F01's titles and option titles unchanged. Every default reads
// from CONFIG, so a creator who customized in the plugin panel sees their own
// values here, and a creator who did not sees F01's.

addPropertyControls(MemberGate, {
  contentSlot: {
    type: ControlType.ComponentInstance,
    title: "Protected Frame",
  },
  requiredTier: {
    type: ControlType.Enum,
    title: "Access Tier",
    // The generator replaces these two lines with the site's own tiers, by
    // rank, so a custom tier can be chosen here. Keep them on one line each.
    options: ["signed_in", "free_member", "tier_1", "tier_2", "vip"],
    optionTitles: ["Any Signed In", "Free Member", "Tier 1: Silver", "Tier 2: Gold", "VIP Member"],
    defaultValue: CONFIG.requiredTier,
  },
  fallbackAction: {
    type: ControlType.Enum,
    title: "Locked State",
    options: ["blur", "hide", "redirect", "custom_card"],
    optionTitles: ["Frosted Blur", "Hide Completely", "Page Redirect", "Lock Card"],
    defaultValue: CONFIG.fallbackAction,
  },
  redirectUrl: {
    type: ControlType.Link,
    title: "Redirect Target",
    defaultValue: CONFIG.redirectUrl,
    hidden: (props) => props.fallbackAction !== "redirect",
  },
  cardTitle: {
    type: ControlType.String,
    title: "Lock Title",
    defaultValue: CONFIG.cardTitle,
    hidden: (props) => props.fallbackAction !== "custom_card",
  },
  cardDescription: {
    type: ControlType.String,
    title: "Lock Message",
    defaultValue: CONFIG.cardDescription,
    hidden: (props) => props.fallbackAction !== "custom_card",
  },
  blurIntensity: {
    type: ControlType.Number,
    title: "Blur Amount",
    min: BLUR_MIN,
    max: BLUR_MAX,
    step: 1,
    unit: "px",
    defaultValue: CONFIG.blurIntensity,
    hidden: (props) => props.fallbackAction !== "blur",
  },

  seoMarkup: {
    type: ControlType.Boolean,
    title: "SEO Paywall Markup",
    defaultValue: true,
    hidden: (props) => props.fallbackAction !== "blur",
  },
  schemaType: {
    type: ControlType.Enum,
    title: "Content Type",
    options: ["Article", "NewsArticle", "BlogPosting", "CreativeWork"],
    optionTitles: ["Article", "News Article", "Blog Post", "Other Content"],
    defaultValue: "Article",
    hidden: (props) => props.fallbackAction !== "blur" || props.seoMarkup === false,
  },

  /* ---- Lock card contents, for every state that shows one ---- */

  showLockIcon: {
    type: ControlType.Boolean,
    title: "Lock Icon",
    defaultValue: true,
    hidden: (props) => props.fallbackAction === "hide",
  },
  showLockButton: {
    type: ControlType.Boolean,
    title: "Lock Button",
    defaultValue: true,
    hidden: (props) => props.fallbackAction === "hide",
  },
  loginPath: {
    type: ControlType.String,
    title: "Sign In Page",
    defaultValue: CONFIG.loginPath,
    hidden: (props) => props.fallbackAction === "hide" || props.showLockButton === false,
  },
  pricingPath: {
    type: ControlType.String,
    title: "Pricing Page",
    defaultValue: "/pricing",
    hidden: (props) => props.fallbackAction === "hide" || props.showLockButton === false,
  },

  /* ---- Lock card style, then the shared appearance groups and Labels ---- */

  accentColor: {
    type: ControlType.Color,
    title: "Accent Color",
    defaultValue: GATE_STYLE_DEFAULTS.accentColor,
  },
  borderRadius: {
    type: ControlType.Number,
    title: "Corner Radius",
    min: 0,
    max: 32,
    step: 1,
    unit: "px",
    defaultValue: GATE_STYLE_DEFAULTS.borderRadius,
  },
  ...mfAppearanceControls({ padding: 24, gap: 10, shadow: true }),
  labels: mfLabelControls(GATE_LABELS),
});

// ============================================================================
// ============================================================================
// FRAMER CODE OVERRIDES FOR NATIVE FRAMES & SECTIONS
// ============================================================================
// Allows any native Framer Frame, Stack, or Grid on canvas to be locked
// directly with zero component creation or slot dropdowns. Designers simply
// select their section and pick the desired override from Framer's "Code overrides".

function createGatedSection(
  Component: React.ComponentType<any>,
  tier: RequiredTier,
  fallback: "blur" | "hide"
): React.ComponentType<any> {
  return function GatedSection(props: any) {
    const onCanvas = RenderTarget.current() === RenderTarget.canvas;
    const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);

    useEffect(() => {
      if (onCanvas) return;
      let active = true;
      loadSession().then((res) => {
        if (active) setSessionResult(res);
      });
      return () => {
        active = false;
      };
    }, [onCanvas]);

    const session = sessionResult?.kind === "member" ? sessionResult.session : null;
    const entitled = isEntitled(session, tier, ladderOf(sessionResult));

    if (onCanvas || entitled) {
      return (
        <React.Fragment>
          <style>{mfThemeCss(".memberframe-gate-root")}</style>
          <style>{cssContent}</style>
          <Component {...props} />
        </React.Fragment>
      );
    }

    if (fallback === "hide") {
      return null;
    }

    const tierName =
      tier === "vip"
        ? "VIP"
        : tier === "tier_2"
        ? "Gold"
        : tier === "tier_1"
        ? "Silver"
        : tier === "free_member"
        ? "Member"
        : "";

    const title = CONFIG.cardTitle || (tierName ? `${tierName} Content` : "Members Only Content");
    const description =
      tierName && tier !== "signed_in" && tier !== "anyone"
        ? `Requires ${tierName} plan or higher to unlock this section.`
        : CONFIG.cardDescription || "Join or sign in to read this full guide.";

    return (
      <div className="memberframe-gate-root is-light">
        <style>{mfThemeCss(".memberframe-gate-root")}</style>
        <style>{cssContent}</style>
        <div className="memberframe-gate-content is-blurred">
          <Component {...props} />
        </div>
        <div className="memberframe-gate-overlay">
          {/* Was "memberframe-gate-card", a class the stylesheet never defined. */}
          <div className="memberframe-lock-card">
            <span className="memberframe-lock-icon">
              <Lock size={18} stroke="currentColor" aria-hidden={true} />
            </span>
            <h3 className="memberframe-lock-title">{title}</h3>
            <p className="memberframe-lock-description">{description}</p>
            <a href={CONFIG.loginPath || "/login"} className="memberframe-lock-cta">
              {GATE_LABELS.overrideCta[1]}
            </a>
          </div>
        </div>
      </div>
    );
  };
}

// Default overrides using CONFIG settings
export function withMemberGate(Component: React.ComponentType<any>): React.ComponentType<any> {
  return createGatedSection(Component, CONFIG.requiredTier, CONFIG.fallbackAction === "hide" ? "hide" : "blur");
}

export function withBlurLock(Component: React.ComponentType<any>): React.ComponentType<any> {
  return createGatedSection(Component, CONFIG.requiredTier, "blur");
}

export function withHideLock(Component: React.ComponentType<any>): React.ComponentType<any> {
  return createGatedSection(Component, CONFIG.requiredTier, "hide");
}

// ---------------------------------------------------------------------------
// TIER-SPECIFIC OVERRIDES: Frosted Blur Teaser + Lock Card
// ---------------------------------------------------------------------------
export function withSignedInOnly(Component: React.ComponentType<any>): React.ComponentType<any> {
  return createGatedSection(Component, "signed_in", "blur");
}

export function withFreeTier(Component: React.ComponentType<any>): React.ComponentType<any> {
  return createGatedSection(Component, "free_member", "blur");
}

export function withSilverTier(Component: React.ComponentType<any>): React.ComponentType<any> {
  return createGatedSection(Component, "tier_1", "blur");
}

export function withGoldTier(Component: React.ComponentType<any>): React.ComponentType<any> {
  return createGatedSection(Component, "tier_2", "blur");
}

export function withVipTier(Component: React.ComponentType<any>): React.ComponentType<any> {
  return createGatedSection(Component, "vip", "blur");
}

// ---------------------------------------------------------------------------
// TIER-SPECIFIC OVERRIDES: Completely Hidden if not authorized
// ---------------------------------------------------------------------------
export function withSignedInHide(Component: React.ComponentType<any>): React.ComponentType<any> {
  return createGatedSection(Component, "signed_in", "hide");
}

export function withFreeTierHide(Component: React.ComponentType<any>): React.ComponentType<any> {
  return createGatedSection(Component, "free_member", "hide");
}

export function withSilverTierHide(Component: React.ComponentType<any>): React.ComponentType<any> {
  return createGatedSection(Component, "tier_1", "hide");
}

export function withGoldTierHide(Component: React.ComponentType<any>): React.ComponentType<any> {
  return createGatedSection(Component, "tier_2", "hide");
}

export function withVipTierHide(Component: React.ComponentType<any>): React.ComponentType<any> {
  return createGatedSection(Component, "vip", "hide");
}


