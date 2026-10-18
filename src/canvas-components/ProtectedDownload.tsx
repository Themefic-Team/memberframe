/**
 * `<ProtectedDownload>`, Upgrade to Download. PRD feature F10, feature plan
 * FP-12, task 5.5.
 *
 * A download button for a file kept in MemberFrame's vault. The page holds
 * only the file's opaque Asset ID; the file itself, its storage, and any link
 * the creator gave it stay on the server.
 *
 *   - Signed out: the button reads "Sign in to Download" and takes the visitor
 *     to the sign in page, then back here.
 *   - Signed in below the file's plan: "Upgrade to Download", to the pricing
 *     page, with the plan it needs underneath.
 *   - On the plan: "Download", with the file type and size. Pressing it asks
 *     the server to check again and sign a link that works for 60 seconds; the
 *     browser downloads through it, and the link is dead a minute later.
 *
 * ## The plan rule is on the server
 *
 * Which plan a file needs is set on the file, in the plugin's Manage tab,
 * Files. PRD F10 put an `allowedTiers` control on the component; a rule in
 * published page code is one any visitor can edit, so the component shows the
 * server's answer and the server enforces it on every download. Conflict noted
 * in `docs/development-docs/18-content-features.md`.
 *
 * ## This file leaves the repository
 *
 * Written into the creator's project by the code generator. Imports only
 * `react`, `framer`, and icons Framer is known to provide.
 */

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { addPropertyControls, ControlType, RenderTarget } from "framer";
import { Loader2, Lock } from "lucide-react";

// ============================================================================
// LICENSING AND TRIAL STATE
// ============================================================================
// Rewritten in place by F19's `enforceLockState` regex patcher.
const IS_LOCKED = false;
const IS_TRIAL = false;
// @plugin-lock-state: unlocked
// @plugin-trial-state: paid

// @memberframe-appearance-start
// ============================================================================
// APPEARANCE, SHARED BY EVERY MEMBERFRAME CANVAS COMPONENT
// ============================================================================
// Byte-identical in every canvas component: MemberAuth, MemberDashboard,
// MemberPricing, OnboardingModal, MeteredPaywall, ProtectedDownload,
// BookmarkButton, and BookmarksTray. Held so by
// `test/canvasAppearanceParity.test.ts`, which also compiles this block and
// runs it. A canvas component is compiled by Framer alone and cannot import
// from this repository, so the copy is the architecture. Edit all or none.
//
// One vocabulary for every component. The Theme control picks a palette, the
// creator's Colors, Typography, Layout, and Spacing groups override it, and every rule
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
  spacing?: { margin?: unknown; customPadding?: boolean; padding?: unknown } | null;
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

  const spacing = mfSpacingCss(input.spacing);
  if (spacing !== "") lines.push(spacing);

  return lines.join(" ");
}

/**
 * Four pixel sides out of a Padding control value, or null.
 *
 * Framer's Padding control produces `"24px"` or `"24px 16px 24px 16px"`, and a
 * number is read as all four sides. One to four sides expand the way CSS
 * shorthand does. Anything else, a negative, or a unit other than px is
 * refused, because the result is written into a style block.
 */
function mfBox(value: unknown, max: number): [number, number, number, number] | null {
  const parts: number[] = [];
  if (typeof value === "number") {
    parts.push(value);
  } else if (typeof value === "string") {
    const tokens = value.trim().split(/\s+/);
    if (tokens[0] === "" || tokens.length > 4) return null;
    for (const token of tokens) {
      const match = /^(\d+(?:\.\d+)?)(?:px)?$/.exec(token);
      if (!match) return null;
      parts.push(Number(match[1]));
    }
  } else {
    return null;
  }

  if (!parts.every((part) => Number.isFinite(part) && part >= 0)) return null;
  const [t, r = t, b = t, l = r] = parts.map((part) => Math.round(Math.min(max, part)));
  return [t, r, b, l];
}

/**
 * The Spacing group as declarations for the component root, or "".
 *
 * Emitted into the instance's scoped rule, which follows the component's own
 * stylesheet, so a value the creator set wins and an untouched one leaves the
 * component's own spacing alone. Top and bottom margin keep a root's own
 * centring; a side margin replaces it, and `width: auto` lets the root fill
 * the space between the two margins instead of overflowing at 100%.
 */
function mfSpacingCss(spacing: MfAppearanceProps["spacing"]): string {
  const input = spacing || {};
  const out: string[] = [];

  const margin = mfBox(input.margin, 400);
  if (margin) {
    const [t, r, b, l] = margin;
    if (t > 0) out.push(`margin-top: ${t}px;`);
    if (b > 0) out.push(`margin-bottom: ${b}px;`);
    if (r > 0 || l > 0) out.push(`margin-left: ${l}px; margin-right: ${r}px; width: auto;`);
  }

  if (input.customPadding === true) {
    const padding = mfBox(input.padding, 400);
    if (padding) out.push(`padding: ${padding.map((side) => `${side}px`).join(" ")};`);
  }

  return out.join(" ");
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
 * The shared property controls: Theme, Colors, Typography, Layout, Spacing.
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
    spacing: {
      type: ControlType.Object,
      title: "Spacing",
      buttonTitle: "Spacing",
      controls: {
        margin: { type: ControlType.Padding, title: "Margin", defaultValue: "0px" },
        customPadding: { type: ControlType.Boolean, title: "Custom padding", defaultValue: false },
        padding: {
          type: ControlType.Padding,
          title: "Padding",
          defaultValue: "24px",
          description: "Used when Custom padding is on.",
        },
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

// @memberframe-canvas-preview-start
// ============================================================================
// REAL DATA ON THE CANVAS
// ============================================================================
// Byte-identical in MemberPricing, MemberDashboard, OnboardingModal, and
// ProtectedDownload, held so by `test/canvasRealData.test.ts`.
//
// On the canvas there is no visitor, but there is a site: the creator's own
// tiers, profile questions, and files. `GET /api/preview` answers with what
// the published site shows any visitor, so a creator designs against their
// real plans rather than samples. One request per address per 15 seconds,
// shared by every component on the canvas. Any failure answers null, and the
// component keeps its sample.

const MF_PREVIEW_TTL_MS = 15000;

type MfPreviewCache = Record<string, { at: number; promise: Promise<Record<string, unknown> | null> }>;

function mfCanvasPreview(apiBaseUrl: string, siteKey: string, assetId: string = ""): Promise<Record<string, unknown> | null> {
  const base = String(apiBaseUrl || "").replace(/\/+$/, "");
  if (base === "" || !siteKey || typeof window === "undefined" || typeof fetch !== "function") return Promise.resolve(null);
  const url = base + "/api/preview?site=" + encodeURIComponent(siteKey) + (assetId ? "&asset=" + encodeURIComponent(assetId) : "");
  const holder = window as unknown as { __mfCanvasPreview?: MfPreviewCache };
  const cache = holder.__mfCanvasPreview || (holder.__mfCanvasPreview = {});
  const hit = cache[url];
  if (hit && Date.now() - hit.at < MF_PREVIEW_TTL_MS) return hit.promise;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (base.indexOf(".ngrok") !== -1) headers["ngrok-skip-browser-warning"] = "1";
  const promise = fetch(url, { headers })
    .then((response) => (response.ok ? (response.json() as Promise<Record<string, unknown>>) : null))
    .catch(() => null);
  cache[url] = { at: Date.now(), promise };
  return promise;
}
// @memberframe-canvas-preview-end

// ============================================================================
// CONFIG
// ============================================================================

type IconType = "download" | "file" | "archive" | "code";

interface DownloadConfig {
  buttonText: string;
  lockedButtonText: string;
  iconType: IconType;
  accentColor: string;
  borderRadius: number;
  apiBaseUrl: string;
  /** Public. Identifies the tenant; the request's Origin is what authorizes. */
  siteKey: string;
  loginPath: string;
  pricingPath: string;
  defaultAssetId?: string;
}

const ENV_API_BASE_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_APP_BASE_URL)) ||
  "";

// @memberframe-config-start
const CONFIG: DownloadConfig = {
  buttonText: "Download Source Files",
  lockedButtonText: "Upgrade to Download",
  iconType: "download",
  accentColor: "#5271ff",
  borderRadius: 12,
  apiBaseUrl: ENV_API_BASE_URL,
  siteKey: "",
  loginPath: "/login",
  pricingPath: "/pricing",
  defaultAssetId: "",
};
// @memberframe-config-end

const RETURN_KEY = `memberframe:return-to:${CONFIG.siteKey}`;

/** What the API tells a visitor about a file. Never a path or a storage address. */
interface PublicAsset {
  id: string;
  name: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  requiredTier: string;
  requiredTierName: string;
}

type Access = "granted" | "upgrade" | "sign_in";

type Load =
  | { phase: "loading" }
  | { phase: "ready"; asset: PublicAsset; access: Access }
  | { phase: "missing" }
  | { phase: "failed" };

type Action =
  | { phase: "idle" }
  | { phase: "signing" }
  | { phase: "started" }
  | { phase: "error"; message: string };

// ============================================================================
// HELPERS
// ============================================================================

function apiHeaders(withBody: boolean): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (withBody) headers["Content-Type"] = "application/json";
  if (CONFIG.siteKey !== "") headers["X-MemberFrame-Site"] = CONFIG.siteKey;
  // A free ngrok tunnel answers a browser with its warning page, not the API,
  // unless the request asks it not to. Only sent to an ngrok address.
  if (CONFIG.apiBaseUrl.indexOf(".ngrok") !== -1) headers["ngrok-skip-browser-warning"] = "1";
  return headers;
}

function safePath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//") && value.indexOf("\\") === -1;
}

/** Remember this page, so signing in or upgrading brings the visitor back to the file. */
function rememberReturn(): void {
  try {
    const path = `${window.location.pathname}${window.location.search}`;
    if (safePath(path)) window.sessionStorage.setItem(RETURN_KEY, JSON.stringify({ path, ts: Date.now() }));
  } catch {
    // Without storage the visitor lands on the site's after-sign-in page.
  }
}

/** 42 MB, 980 KB, 1.2 GB. */
function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

/** ZIP, 42 MB */
function fileMeta(asset: PublicAsset): string {
  const extension = /\.([A-Za-z0-9]{1,8})$/.exec(asset.fileName);
  const parts = [extension ? extension[1].toUpperCase() : "", formatBytes(asset.sizeBytes)].filter(Boolean);
  return parts.join(", ");
}

/** One request per Asset ID per page, however many buttons share it. */
const assetRequests = new Map<string, Promise<Load>>();

async function requestAsset(assetId: string): Promise<Load> {
  try {
    const response = await fetch(`${CONFIG.apiBaseUrl}/api/assets/${encodeURIComponent(assetId)}`, {
      credentials: "include",
      headers: apiHeaders(false),
    });
    if (response.status === 404) return { phase: "missing" };
    if (!response.ok) return { phase: "failed" };
    const body = (await response.json()) as { asset?: PublicAsset; access?: Access };
    if (!body.asset || !body.access) return { phase: "failed" };
    return { phase: "ready", asset: body.asset, access: body.access };
  } catch {
    return { phase: "failed" };
  }
}

function loadAsset(assetId: string, fresh = false): Promise<Load> {
  if (fresh) assetRequests.delete(assetId);
  let pending = assetRequests.get(assetId);
  if (!pending) {
    pending = requestAsset(assetId);
    assetRequests.set(assetId, pending);
  }
  return pending;
}

// ============================================================================
// ICONS
// ============================================================================
// Drawn here rather than imported: Framer's bundled icon set is older than this
// repository's, and an icon it lacks stops the whole file compiling.

function FileTypeIcon({ type }: { type: IconType }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (type === "file") {
    return (
      <svg {...common}>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5M9 13h6M9 17h6" />
      </svg>
    );
  }
  if (type === "archive") {
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="5" rx="1" />
        <path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" />
      </svg>
    );
  }
  if (type === "code") {
    return (
      <svg {...common}>
        <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
    </svg>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const cssContent = `
.mf-download {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 100%;
  min-width: 180px;
  color: var(--mf-c-text);
  font-size: calc(14px * var(--mf-text-scale, 1));
  line-height: 1.4;
}
.mf-download-button {
  appearance: none; box-sizing: border-box; position: relative;
  display: flex; align-items: center; gap: 12px; width: 100%; margin: 0;
  padding: var(--mf-pad, 12px) calc(var(--mf-pad, 12px) + 4px);
  border: var(--mf-border-width, 1px) solid var(--mf-c-accent); border-radius: var(--mf-c-radius);
  background: var(--mf-c-accent); color: var(--mf-c-on-accent);
  box-shadow: var(--mf-c-shadow);
  font: inherit; text-align: left; cursor: pointer;
  transition: filter 0.15s ease, transform 0.1s ease;
}
.mf-download-button.is-outline { background: var(--mf-c-surface); color: var(--mf-c-text); border-color: var(--mf-c-border); }
.mf-download-button.is-locked { background: var(--mf-c-field); color: var(--mf-c-text); border-color: var(--mf-c-border); }
.mf-download-button:hover:not(:disabled) { filter: brightness(1.05); }
.mf-download-button:active:not(:disabled) { transform: scale(0.99); }
.mf-download-button:disabled { cursor: default; opacity: 0.75; }
.mf-download-button:focus-visible { outline: 2px solid var(--mf-c-accent); outline-offset: 2px; }
.mf-download-icon {
  flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; border-radius: max(0px, calc(var(--mf-c-radius) - 4px));
  background: color-mix(in srgb, currentColor 14%, transparent);
}
.mf-download-icon svg { width: 18px; height: 18px; stroke: currentColor; }
.mf-download-label { display: flex; flex-direction: column; min-width: 0; flex: 1 1 auto; }
.mf-download-title { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mf-download-meta { font-size: calc(12px * var(--mf-text-scale, 1)); opacity: 0.8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mf-download-note { margin: 0; font-size: calc(12px * var(--mf-text-scale, 1)); color: var(--mf-c-muted); text-align: center; }
.mf-download-note.is-error { color: var(--mf-c-danger); }
.mf-download-spin { animation: mf-download-spin 0.9s linear infinite; }
@keyframes mf-download-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .mf-download-spin { animation: none; } }
.mf-download-prolock {
  position: absolute; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center;
  padding: 8px; border-radius: var(--mf-c-radius); background: rgba(15, 17, 23, 0.78); color: var(--mf-c-on-accent);
  font-size: calc(12px * var(--mf-text-scale, 1)); text-align: center;
}
.mf-download-watermark {
  align-self: flex-end; padding: 2px 8px; border-radius: 999px; font-size: calc(10px * var(--mf-text-scale, 1));
  font-weight: 600; color: var(--mf-c-on-accent); background: rgba(15, 17, 23, 0.82); text-decoration: none;
}
`;

// ============================================================================
// COMPONENT
// ============================================================================

const DOWNLOAD_LABELS: Record<string, readonly [string, string]> = {
  signInButton: ["Signed out button", "Sign in to Download"],
  signInNote: ["Signed out note", "Free for members on the {tier} plan."],
  upgradeNote: ["Upgrade note", "Included with the {tier} plan and above."],
  checking: ["Checking", "Checking access"],
  preparing: ["Preparing", "Preparing your download"],
  started: ["Started", "Your download has started"],
  missing: ["Missing file", "This file is not available"],
  failed: ["Load failed", "Could not check access. Refresh to try again."],
  error: ["Download failed", "The download could not start. Try again."],
  tooMany: ["Too many", "Too many downloads. Try again in a minute."],
  noAsset: ["No asset", "Paste an Asset ID from Manage, Files"],
};

export interface ProtectedDownloadProps extends MfAppearanceProps {
  assetId?: string;
  buttonText?: string;
  lockedButtonText?: string;
  fileMetaLabel?: string;
  showFileMeta?: boolean;
  showNote?: boolean;
  iconType?: IconType;
  buttonStyle?: "filled" | "outline";
  loginPath?: string;
  pricingPath?: string;
  canvasPreview?: "unlocked" | "locked";
  accentColor?: string;
  borderRadius?: number;
}

/**
 * @framerIntrinsicWidth 340
 * @framerIntrinsicHeight 88
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
export default function ProtectedDownload(props: ProtectedDownloadProps) {
  const {
    assetId = "",
    buttonText = CONFIG.buttonText,
    lockedButtonText = CONFIG.lockedButtonText,
    fileMetaLabel = "",
    showFileMeta = true,
    showNote = true,
    iconType = CONFIG.iconType,
    buttonStyle = "filled",
    loginPath = CONFIG.loginPath,
    pricingPath = CONFIG.pricingPath,
    canvasPreview = "unlocked",
    accentColor = CONFIG.accentColor,
    borderRadius = CONFIG.borderRadius,
    theme = "light",
    colors,
    typography,
    layout,
    spacing,
    labels,
  } = props;

  const t = (key: string, values: Record<string, string | number> = {}) =>
    mfFill(mfLabel(labels, DOWNLOAD_LABELS, key), values);

  const rawId = useId();
  const scope = useMemo(() => `mfd${rawId.replace(/[^a-zA-Z0-9]/g, "")}`, [rawId]);
  const onCanvas = useMemo(() => {
    const target = RenderTarget.current();
    return target === RenderTarget.canvas || target === RenderTarget.thumbnail;
  }, []);

  const id = String(assetId || CONFIG.defaultAssetId || "").trim();
  const [load, setLoad] = useState<Load>({ phase: "loading" });
  /** On the canvas: the chosen file's real label and plan, once they arrive. */
  const [canvasAsset, setCanvasAsset] = useState<PublicAsset | null>(null);

  useEffect(() => {
    if (!onCanvas || id === "") {
      setCanvasAsset(null);
      return;
    }
    let active = true;
    void mfCanvasPreview(CONFIG.apiBaseUrl, CONFIG.siteKey, id).then((data) => {
      const asset = data ? (data["asset"] as PublicAsset | null | undefined) : null;
      if (active) setCanvasAsset(asset && typeof asset.fileName === "string" ? asset : null);
    });
    return () => {
      active = false;
    };
  }, [onCanvas, id]);
  const [action, setAction] = useState<Action>({ phase: "idle" });
  const busy = useRef(false);

  useEffect(() => {
    if (onCanvas) return;
    if (id === "") {
      setLoad({ phase: "missing" });
      return;
    }
    let active = true;
    const refresh = (fresh: boolean) => {
      void loadAsset(id, fresh).then((next) => {
        if (active) setLoad(next);
      });
    };
    refresh(false);
    const onSession = () => refresh(true);
    window.addEventListener("memberframe:session-updated", onSession);
    return () => {
      active = false;
      window.removeEventListener("memberframe:session-updated", onSession);
    };
  }, [onCanvas, id]);

  // The started note fades back to the button after a moment.
  useEffect(() => {
    if (action.phase !== "started") return;
    const timer = window.setTimeout(() => setAction({ phase: "idle" }), 4000);
    return () => window.clearTimeout(timer);
  }, [action.phase]);

  const goTo = (path: string, fallback: string) => {
    rememberReturn();
    const target = safePath(path) ? path : fallback;
    if (window.location.pathname !== target) window.location.assign(target);
  };

  const download = useCallback(async () => {
    // One signing at a time: a double click must not ask twice (PRD F10).
    if (busy.current || load.phase !== "ready") return;
    busy.current = true;
    setAction({ phase: "signing" });

    try {
      const response = await fetch(`${CONFIG.apiBaseUrl}/api/assets/sign-download-url`, {
        method: "POST",
        credentials: "include",
        headers: apiHeaders(true),
        body: JSON.stringify({ assetId: id }),
      });

      if (response.status === 401) {
        setLoad({ ...load, access: "sign_in" });
        setAction({ phase: "idle" });
        return;
      }
      if (response.status === 403) {
        setLoad({ ...load, access: "upgrade" });
        setAction({ phase: "idle" });
        return;
      }
      if (response.status === 429) {
        setAction({ phase: "error", message: t("tooMany") });
        return;
      }
      const body = (await response.json().catch(() => ({}))) as { signedUrl?: string };
      if (!response.ok || !body.signedUrl || !/^https?:\/\//.test(body.signedUrl)) {
        setAction({ phase: "error", message: t("error") });
        return;
      }

      // The link answers with Content-Disposition: attachment, so the page
      // stays where it is and the browser saves the file.
      window.location.assign(body.signedUrl);
      setAction({ phase: "started" });
    } catch {
      setAction({ phase: "error", message: t("error") });
    } finally {
      busy.current = false;
    }
    // `t` reads the labels prop; the copy is read when each message is set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, load]);

  // ---- What to show ----

  type Shown = {
    title: string;
    meta: string;
    note: string;
    noteError: boolean;
    locked: boolean;
    disabled: boolean;
    spinning: boolean;
    onPress: (() => void) | null;
  };

  function shown(): Shown {
    const base: Shown = { title: buttonText, meta: "", note: "", noteError: false, locked: false, disabled: false, spinning: false, onPress: null };

    if (onCanvas) {
      const locked = canvasPreview === "locked";
      return {
        ...base,
        title: locked ? lockedButtonText : buttonText,
        meta: fileMetaLabel || (id === "" ? t("noAsset") : canvasAsset ? fileMeta(canvasAsset) : "ZIP, 42 MB"),
        note: locked ? t("upgradeNote", { tier: canvasAsset ? canvasAsset.requiredTierName : "Gold" }) : "",
        locked,
      };
    }

    if (load.phase === "loading") return { ...base, title: t("checking"), disabled: true, spinning: true };
    if (load.phase === "missing") return { ...base, title: t("missing"), disabled: true, locked: true };
    if (load.phase === "failed") {
      return { ...base, title: buttonText, disabled: true, note: t("failed"), noteError: true, locked: true };
    }

    const { asset, access } = load;
    const meta = fileMetaLabel || fileMeta(asset);

    if (access === "sign_in") {
      return {
        ...base,
        title: t("signInButton"),
        meta,
        note: asset.requiredTier === "signed_in" ? "" : t("signInNote", { tier: asset.requiredTierName }),
        locked: true,
        onPress: () => {
          window.dispatchEvent(new CustomEvent("memberframe:open-auth", { detail: { reason: "download" } }));
          goTo(loginPath, CONFIG.loginPath);
        },
      };
    }

    if (access === "upgrade") {
      return {
        ...base,
        title: lockedButtonText,
        meta,
        note: t("upgradeNote", { tier: asset.requiredTierName }),
        locked: true,
        onPress: () => goTo(pricingPath, CONFIG.pricingPath),
      };
    }

    if (action.phase === "signing") return { ...base, title: t("preparing"), meta, disabled: true, spinning: true };
    return {
      ...base,
      meta,
      note: action.phase === "started" ? t("started") : action.phase === "error" ? action.message : "",
      noteError: action.phase === "error",
      onPress: () => void download(),
    };
  }

  const view = shown();
  const scopedCss =
    `[data-mf-download="${scope}"] { ` +
    mfAppearanceVars({
      accent: accentColor,
      radius: borderRadius,
      radiusMax: 32,
      shadowByDefault: false,
      colors,
      typography,
      layout,
      spacing,
    }) +
    " }";

  const buttonClass = [
    "mf-download-button",
    view.locked ? "is-locked" : buttonStyle === "outline" ? "is-outline" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`mf-download ${mfThemeClass(theme)}`} data-mf-download={scope}>
      <style>{mfThemeCss(".mf-download")}</style>
      <style>{cssContent}</style>
      <style>{scopedCss}</style>
      <button
        type="button"
        className={buttonClass}
        disabled={view.disabled || (!onCanvas && view.onPress === null)}
        aria-busy={view.spinning ? true : undefined}
        onClick={() => {
          if (!onCanvas && view.onPress) view.onPress();
        }}
      >
        <span className="mf-download-icon">
          {view.spinning ? (
            <Loader2 className="mf-download-spin" aria-hidden={true} />
          ) : view.locked ? (
            <Lock aria-hidden={true} />
          ) : (
            <FileTypeIcon type={iconType} />
          )}
        </span>
        <span className="mf-download-label">
          <span className="mf-download-title">{view.title}</span>
          {showFileMeta && view.meta ? <span className="mf-download-meta">{view.meta}</span> : null}
        </span>
      </button>
      {showNote && view.note ? (
        <p className={`mf-download-note${view.noteError ? " is-error" : ""}`} role={view.noteError ? "alert" : "status"}>
          {view.note}
        </p>
      ) : null}
      {IS_LOCKED ? <div className="mf-download-prolock">Open the MemberFrame plugin to activate this component.</div> : null}
      {IS_TRIAL && !IS_LOCKED ? (
        <a className="mf-download-watermark" href="https://framefic.com" target="_blank" rel="noopener noreferrer">
          Trial Version
        </a>
      ) : null}
    </div>
  );
}

// ============================================================================
// PROPERTY CONTROLS, PRD F10
// ============================================================================

addPropertyControls(ProtectedDownload, {
  assetId: {
    type: ControlType.String,
    title: "Asset ID",
    placeholder: "ast_...",
    description: "From the MemberFrame plugin: Manage, Files. The plan a file needs is set there.",
    defaultValue: CONFIG.defaultAssetId || "",
  },
  buttonText: {
    type: ControlType.String,
    title: "Download Text",
    defaultValue: CONFIG.buttonText,
  },
  lockedButtonText: {
    type: ControlType.String,
    title: "Locked Text",
    defaultValue: CONFIG.lockedButtonText,
  },
  showFileMeta: {
    type: ControlType.Boolean,
    title: "File Type and Size",
    defaultValue: true,
  },
  fileMetaLabel: {
    type: ControlType.String,
    title: "File Meta",
    placeholder: "Automatic, e.g. ZIP, 42 MB",
    defaultValue: "",
    hidden: (props) => props.showFileMeta === false,
  },
  showNote: {
    type: ControlType.Boolean,
    title: "Plan Note",
    defaultValue: true,
  },
  iconType: {
    type: ControlType.Enum,
    title: "Icon",
    options: ["download", "file", "archive", "code"],
    optionTitles: ["Download Arrow", "Document", "ZIP Archive", "Code"],
    defaultValue: CONFIG.iconType,
  },
  buttonStyle: {
    type: ControlType.Enum,
    title: "Button Style",
    options: ["filled", "outline"],
    optionTitles: ["Filled", "Outline"],
    displaySegmentedControl: true,
    defaultValue: "filled",
  },
  loginPath: {
    type: ControlType.String,
    title: "Sign In Page",
    defaultValue: CONFIG.loginPath,
  },
  pricingPath: {
    type: ControlType.String,
    title: "Pricing Page",
    defaultValue: CONFIG.pricingPath,
  },
  canvasPreview: {
    type: ControlType.Enum,
    title: "Canvas Preview",
    options: ["unlocked", "locked"],
    optionTitles: ["Unlocked", "Locked"],
    displaySegmentedControl: true,
    defaultValue: "unlocked",
  },
  accentColor: {
    type: ControlType.Color,
    title: "Button Color",
    defaultValue: CONFIG.accentColor,
  },
  borderRadius: {
    type: ControlType.Number,
    title: "Corner Radius",
    min: 0,
    max: 32,
    step: 1,
    unit: "px",
    defaultValue: CONFIG.borderRadius,
  },
  ...mfAppearanceControls({ padding: 12, gap: 6, shadow: false }),
  labels: mfLabelControls(DOWNLOAD_LABELS),
});
