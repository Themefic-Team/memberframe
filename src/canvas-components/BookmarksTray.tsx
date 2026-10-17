/**
 * `<BookmarksTray>`, the member's saved items. PRD feature F14, feature plan
 * FP-10, task 7.1.
 *
 * A button for the navigation bar, with a count badge, that slides out a
 * drawer listing everything the member saved with `<BookmarkButton>`: search
 * as you type, a link to each item, and one-click removal. Removal is
 * optimistic and puts the item back if the server refuses.
 *
 * The drawer is a modal dialog: focus moves into it, Tab cycles inside it,
 * Escape and the backdrop close it, and focus returns to the button.
 *
 * The tray and every `<BookmarkButton>` on the page keep each other current
 * through the `memberframe:bookmark-updated` event, which carries the full
 * list the server last returned.
 *
 * ## This file leaves the repository
 *
 * Written into the creator's project by the code generator. Imports only
 * `react`, `react-dom` for the drawer's portal, `framer`, and icons drawn here.
 */

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addPropertyControls, ControlType, RenderTarget } from "framer";

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

// ============================================================================
// CONFIG
// ============================================================================

type DrawerSide = "right" | "left";

interface TrayConfig {
  drawerSide: DrawerSide;
  emptyStateText: string;
  maxItems: number;
  showBadge: boolean;
  accentColor: string;
  borderRadius: number;
  apiBaseUrl: string;
  /** Public. Identifies the tenant; the request's Origin is what authorizes. */
  siteKey: string;
  loginPath: string;
}

const ENV_API_BASE_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_APP_BASE_URL)) ||
  "";

// @memberframe-config-start
const CONFIG: TrayConfig = {
  drawerSide: "right",
  emptyStateText: "You haven't bookmarked any items yet.",
  maxItems: 50,
  showBadge: true,
  accentColor: "#5271ff",
  borderRadius: 16,
  apiBaseUrl: ENV_API_BASE_URL,
  siteKey: "",
  loginPath: "/login",
};
// @memberframe-config-end

/** Shared with BookmarkButton and MemberAuth. Change together. */
const RETURN_KEY = `memberframe:return-to:${CONFIG.siteKey}`;
const UPDATED_EVENT = "memberframe:bookmark-updated";
const REQUEST_TIMEOUT_MS = 10_000;
const STORE_ID = Math.random().toString(36).slice(2);

interface BookmarkItem {
  itemSlug: string;
  title: string;
  url: string;
  savedAt: number;
}

type Load =
  | { phase: "loading" }
  | { phase: "guest" }
  | { phase: "error" }
  | { phase: "ready"; items: BookmarkItem[] };

const PREVIEW_ITEMS: BookmarkItem[] = [
  { itemSlug: "design-system", title: "Framer Design System Template", url: "/templates/design-system", savedAt: Date.now() - 3600_000 },
  { itemSlug: "pricing-guide", title: "How to Price a Membership", url: "/blog/pricing-guide", savedAt: Date.now() - 86_400_000 },
  { itemSlug: "course-intro", title: "Course: Getting Started", url: "/courses/intro", savedAt: Date.now() - 4 * 86_400_000 },
];

// ============================================================================
// HELPERS
// ============================================================================

function apiHeaders(withBody: boolean): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (withBody) headers["Content-Type"] = "application/json";
  if (CONFIG.siteKey !== "") headers["X-MemberFrame-Site"] = CONFIG.siteKey;
  return headers;
}

async function timedFetch(path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${CONFIG.apiBaseUrl}${path}`, { ...init, credentials: "include", signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

function readList(value: unknown): BookmarkItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is BookmarkItem => Boolean(entry) && typeof entry.itemSlug === "string" && typeof entry.url === "string"
  );
}

function safePath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//") && value.indexOf("\\") === -1;
}

/** Only a site path or a web address becomes a link; the server checks this too. */
function safeHref(value: string): string | null {
  if (safePath(value)) return value;
  return /^https?:\/\//i.test(value) ? value : null;
}

function rememberReturn(): void {
  try {
    const path = `${window.location.pathname}${window.location.search}`;
    if (safePath(path)) window.sessionStorage.setItem(RETURN_KEY, JSON.stringify({ path, ts: Date.now() }));
  } catch {
    // Without storage the visitor lands on the site's after-sign-in page.
  }
}

/** "Saved today", "Saved 3 days ago", or a date. */
function savedWhen(savedAt: number, labels: { today: string; yesterday: string; days: string }): string {
  const days = Math.floor((Date.now() - savedAt) / 86_400_000);
  if (days <= 0) return labels.today;
  if (days === 1) return labels.yesterday;
  if (days < 30) return labels.days.split("{days}").join(String(days));
  try {
    return new Date(savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

// ============================================================================
// ICONS
// ============================================================================

const ICON = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function RibbonIcon() {
  return (
    <svg {...ICON}>
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg {...ICON}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg {...ICON}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg {...ICON}>
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
    </svg>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const cssContent = `
.mf-tray {
  box-sizing: border-box; position: relative; display: inline-flex; align-items: center; justify-content: center;
  width: 100%; height: 100%; min-width: 36px; min-height: 36px;
  color: var(--mf-c-text); font-size: calc(14px * var(--mf-text-scale, 1)); line-height: 1.4;
}
.mf-tray-trigger {
  appearance: none; box-sizing: border-box; position: relative;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; height: 100%; margin: 0; padding: 0 12px;
  border: var(--mf-border-width, 1px) solid var(--mf-c-border); border-radius: 999px;
  background: var(--mf-c-surface); color: var(--mf-c-text); font: inherit; font-weight: 600; cursor: pointer;
}
.mf-tray-trigger:hover { border-color: var(--mf-c-accent); }
.mf-tray-trigger:focus-visible { outline: 2px solid var(--mf-c-accent); outline-offset: 2px; }
.mf-tray-trigger svg { width: 18px; height: 18px; flex: 0 0 auto; }
.mf-tray-badge {
  position: absolute; top: -6px; right: -6px; min-width: 18px; height: 18px; padding: 0 5px; box-sizing: border-box;
  display: inline-flex; align-items: center; justify-content: center; border-radius: 999px;
  background: var(--mf-c-accent); color: var(--mf-c-on-accent); font-size: calc(11px * var(--mf-text-scale, 1)); font-weight: 700;
  box-shadow: 0 0 0 2px var(--mf-c-surface);
}
/* The drawer's own wrapper carries the theme and takes no space. */
.mf-tray.is-drawer { position: absolute; inset: 0; min-width: 0; min-height: 0; pointer-events: none; }
.mf-tray.is-drawer > * { pointer-events: auto; }
.mf-tray-layer { position: fixed; inset: 0; z-index: 2147483000; display: flex; }
.mf-tray-layer.is-left { justify-content: flex-start; }
.mf-tray-layer.is-right { justify-content: flex-end; }
.mf-tray-layer.is-inline { position: absolute; inset: auto; top: calc(100% + 8px); right: 0; height: 420px; width: 340px; z-index: 50; }
.mf-tray-backdrop { position: absolute; inset: 0; background: var(--mf-c-backdrop); animation: mf-tray-fade 0.2s ease-out; }
.mf-tray-panel {
  position: relative; box-sizing: border-box; display: flex; flex-direction: column; gap: var(--mf-gap, 12px);
  width: min(400px, 100vw); height: 100%; padding: var(--mf-pad, 20px);
  background: var(--mf-c-surface); color: var(--mf-c-text); box-shadow: var(--mf-c-shadow);
  font-family: var(--mf-c-font); font-size: calc(14px * var(--mf-text-scale, 1)); line-height: 1.45;
  animation: mf-tray-in-right 0.24s ease-out;
}
.mf-tray-layer.is-left .mf-tray-panel { animation-name: mf-tray-in-left; border-radius: 0 var(--mf-c-radius) var(--mf-c-radius) 0; }
.mf-tray-layer.is-right .mf-tray-panel { border-radius: var(--mf-c-radius) 0 0 var(--mf-c-radius); }
.mf-tray-layer.is-inline .mf-tray-panel { width: 100%; border-radius: var(--mf-c-radius); border: 1px solid var(--mf-c-border); animation: none; }
@keyframes mf-tray-in-right { from { transform: translateX(24px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes mf-tray-in-left { from { transform: translateX(-24px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes mf-tray-fade { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .mf-tray-panel, .mf-tray-backdrop { animation: none; } }
.mf-tray-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.mf-tray-title { margin: 0; font-size: calc(17px * var(--mf-text-scale, 1)); font-weight: 600; }
.mf-tray-count { color: var(--mf-c-muted); font-weight: 400; }
.mf-tray-icon-button {
  appearance: none; display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0;
  border: 0; border-radius: 8px; background: transparent; color: var(--mf-c-muted); cursor: pointer; flex: 0 0 auto;
}
.mf-tray-icon-button:hover { background: var(--mf-c-field); color: var(--mf-c-text); }
.mf-tray-icon-button:focus-visible, .mf-tray-link:focus-visible, .mf-tray-cta:focus-visible { outline: 2px solid var(--mf-c-accent); outline-offset: 2px; }
.mf-tray-icon-button svg { width: 16px; height: 16px; }
.mf-tray-search {
  display: flex; align-items: center; gap: 8px; padding: 0 12px; border-radius: max(0px, calc(var(--mf-c-radius) - 6px));
  background: var(--mf-c-field); border: 1px solid var(--mf-c-border); color: var(--mf-c-muted);
}
.mf-tray-search svg { width: 16px; height: 16px; flex: 0 0 auto; }
.mf-tray-search input {
  flex: 1 1 auto; min-width: 0; height: 38px; border: 0; outline: none; background: transparent; color: var(--mf-c-text); font: inherit;
}
.mf-tray-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; overflow-y: auto; flex: 1 1 auto; }
.mf-tray-item {
  display: flex; align-items: center; gap: 8px; padding: 10px 8px 10px 12px;
  border: 1px solid var(--mf-c-border); border-radius: max(0px, calc(var(--mf-c-radius) - 6px));
}
.mf-tray-item.is-removing { opacity: 0.5; }
.mf-tray-link { display: flex; flex-direction: column; min-width: 0; flex: 1 1 auto; color: inherit; text-decoration: none; }
.mf-tray-link:hover .mf-tray-item-title { color: var(--mf-c-accent); }
.mf-tray-item-title { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mf-tray-item-meta { color: var(--mf-c-muted); font-size: calc(12px * var(--mf-text-scale, 1)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mf-tray-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
  flex: 1 1 auto; padding: 24px 8px; text-align: center; color: var(--mf-c-muted);
}
.mf-tray-state svg { width: 28px; height: 28px; color: var(--mf-c-accent); }
.mf-tray-state p { margin: 0; }
.mf-tray-cta {
  appearance: none; padding: 9px 18px; border: 0; border-radius: max(0px, calc(var(--mf-c-radius) * 0.6));
  background: var(--mf-c-accent); color: var(--mf-c-on-accent); font: inherit; font-weight: 600; cursor: pointer;
}
.mf-tray-toast {
  margin: 0; padding: 8px 12px; border-radius: 8px; background: var(--mf-c-field); color: var(--mf-c-danger);
  font-size: calc(13px * var(--mf-text-scale, 1));
}
.mf-tray-more { margin: 0; color: var(--mf-c-muted); font-size: calc(12px * var(--mf-text-scale, 1)); text-align: center; }
.mf-tray-watermark {
  position: absolute; right: -4px; bottom: -14px; padding: 1px 6px; border-radius: 999px;
  font-size: calc(9px * var(--mf-text-scale, 1)); color: var(--mf-c-on-accent); background: rgba(15, 17, 23, 0.82); text-decoration: none;
}
.mf-tray-prolock {
  position: absolute; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center;
  border-radius: 999px; background: rgba(15, 17, 23, 0.78); color: var(--mf-c-on-accent); font-size: calc(10px * var(--mf-text-scale, 1));
}
`;

// ============================================================================
// COMPONENT
// ============================================================================

const TRAY_LABELS: Record<string, readonly [string, string]> = {
  title: ["Drawer title", "Saved items"],
  open: ["Open, screen reader", "Open saved items, {count} saved"],
  close: ["Close button", "Close"],
  search: ["Search placeholder", "Search saved items"],
  noMatch: ["No match", "Nothing saved matches \"{query}\"."],
  remove: ["Remove, screen reader", "Remove {title}"],
  signedOut: ["Signed out text", "Sign in to see the items you saved."],
  signIn: ["Sign in button", "Sign in"],
  loading: ["Loading", "Loading your saved items"],
  failed: ["Load failed", "Your saved items could not be loaded."],
  retry: ["Retry button", "Try again"],
  removeFailed: ["Remove failed", "Could not remove that item. Try again."],
  savedToday: ["Saved today", "Saved today"],
  savedYesterday: ["Saved yesterday", "Saved yesterday"],
  savedDays: ["Saved days ago", "Saved {days} days ago"],
  more: ["More items", "Showing {shown} of {total}. Search to find the rest."],
};

export interface BookmarksTrayProps extends MfAppearanceProps {
  drawerSide?: DrawerSide;
  emptyStateText?: string;
  maxItems?: number;
  showBadge?: boolean;
  showLabel?: boolean;
  triggerLabel?: string;
  showSearch?: boolean;
  loginPath?: string;
  canvasPreview?: "closed" | "open";
  accentColor?: string;
  borderRadius?: number;
}

/**
 * @framerIntrinsicWidth 44
 * @framerIntrinsicHeight 44
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
export default function BookmarksTray(props: BookmarksTrayProps) {
  const {
    drawerSide = CONFIG.drawerSide,
    emptyStateText = CONFIG.emptyStateText,
    maxItems = CONFIG.maxItems,
    showBadge = CONFIG.showBadge,
    showLabel = false,
    triggerLabel = "Saved",
    showSearch = true,
    loginPath = CONFIG.loginPath,
    canvasPreview = "closed",
    accentColor = CONFIG.accentColor,
    borderRadius = CONFIG.borderRadius,
    theme = "light",
    colors,
    typography,
    layout,
    labels,
  } = props;

  const t = (key: string, values: Record<string, string | number> = {}) =>
    mfFill(mfLabel(labels, TRAY_LABELS, key), values);

  const rawId = useId();
  const scope = useMemo(() => `mft${rawId.replace(/[^a-zA-Z0-9]/g, "")}`, [rawId]);
  const titleId = `${scope}-title`;
  const onCanvas = useMemo(() => {
    const target = RenderTarget.current();
    return target === RenderTarget.canvas || target === RenderTarget.thumbnail;
  }, []);

  const [load, setLoad] = useState<Load>(onCanvas ? { phase: "ready", items: PREVIEW_ITEMS } : { phase: "loading" });
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [removing, setRemoving] = useState<ReadonlySet<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const fetchList = useCallback(async () => {
    try {
      const response = await timedFetch("/api/member/bookmarks", { headers: apiHeaders(false) });
      if (response.status === 401) {
        setLoad({ phase: "guest" });
        return;
      }
      if (!response.ok) {
        setLoad({ phase: "error" });
        return;
      }
      const body = (await response.json()) as { bookmarks?: unknown };
      setLoad({ phase: "ready", items: readList(body.bookmarks) });
    } catch {
      setLoad({ phase: "error" });
    }
  }, []);

  // ---- Load, and stay in step with every BookmarkButton on the page ----
  useEffect(() => {
    if (onCanvas) return;
    void fetchList();

    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ bookmarks?: unknown; source?: string }>).detail;
      if (!detail || detail.source === STORE_ID) return;
      setLoad({ phase: "ready", items: readList(detail.bookmarks) });
    };
    const onSession = () => void fetchList();
    window.addEventListener(UPDATED_EVENT, onUpdated);
    window.addEventListener("memberframe:session-updated", onSession);
    return () => {
      window.removeEventListener(UPDATED_EVENT, onUpdated);
      window.removeEventListener("memberframe:session-updated", onSession);
    };
  }, [onCanvas, fetchList]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    // Focus goes back to where it came from, per the dialog pattern.
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  // ---- Modal behaviour: focus in, Tab trapped, Escape closes, page does not scroll ----
  useEffect(() => {
    if (!open || onCanvas) return;
    const panel = panelRef.current;
    const first = searchRef.current ?? (panel?.querySelector(FOCUSABLE) as HTMLElement | null);
    first?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(panel.querySelectorAll(FOCUSABLE)) as HTMLElement[];
      if (focusable.length === 0) return;
      const firstItem = focusable[0];
      const lastItem = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onCanvas, close]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const remove = useCallback(
    async (item: BookmarkItem) => {
      if (onCanvas || load.phase !== "ready" || removing.has(item.itemSlug)) return;
      const before = load.items;
      // Optimistic: gone at once, back if the server says no.
      setLoad({ phase: "ready", items: before.filter((entry) => entry.itemSlug !== item.itemSlug) });
      setRemoving((current) => new Set(current).add(item.itemSlug));

      try {
        const response = await timedFetch("/api/member/bookmarks", {
          method: "PATCH",
          headers: apiHeaders(true),
          body: JSON.stringify({ action: "remove", item: { itemSlug: item.itemSlug, title: item.title, url: item.url } }),
        });
        if (response.status === 401) {
          setLoad({ phase: "guest" });
          return;
        }
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { bookmarks?: unknown };
        const list = readList(body.bookmarks);
        setLoad({ phase: "ready", items: list });
        window.dispatchEvent(new CustomEvent(UPDATED_EVENT, { detail: { bookmarks: list, source: STORE_ID } }));
      } catch {
        setLoad({ phase: "ready", items: before });
        setToast(t("removeFailed"));
      } finally {
        setRemoving((current) => {
          const next = new Set(current);
          next.delete(item.itemSlug);
          return next;
        });
      }
    },
    // `t` reads the labels prop; the copy is read when the toast is set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onCanvas, load, removing]
  );

  const signIn = () => {
    rememberReturn();
    const target = safePath(loginPath) ? loginPath : CONFIG.loginPath;
    if (window.location.pathname !== target) window.location.assign(target);
  };

  const items = load.phase === "ready" ? load.items : [];
  const count = items.length;
  const limit = Math.round(mfNumber(maxItems, 10, 200, CONFIG.maxItems));
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? items.filter((item) => item.title.toLowerCase().includes(needle) || item.url.toLowerCase().includes(needle))
    : items;
  const visible = matches.slice(0, limit);

  const scopedCss =
    `[data-mf-tray="${scope}"] { ` +
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

  const side = drawerSide === "left" ? "left" : "right";
  const showDrawer = onCanvas ? canvasPreview === "open" : open;

  function panelBody(): React.ReactNode {
    if (load.phase === "loading") {
      return (
        <div className="mf-tray-state" role="status">
          <p>{t("loading")}</p>
        </div>
      );
    }
    if (load.phase === "guest") {
      return (
        <div className="mf-tray-state">
          <RibbonIcon />
          <p>{t("signedOut")}</p>
          <button type="button" className="mf-tray-cta" onClick={signIn}>
            {t("signIn")}
          </button>
        </div>
      );
    }
    if (load.phase === "error") {
      return (
        <div className="mf-tray-state" role="alert">
          <p>{t("failed")}</p>
          <button type="button" className="mf-tray-cta" onClick={() => void fetchList()}>
            {t("retry")}
          </button>
        </div>
      );
    }
    if (count === 0) {
      return (
        <div className="mf-tray-state">
          <RibbonIcon />
          <p>{emptyStateText || CONFIG.emptyStateText}</p>
        </div>
      );
    }
    return (
      <React.Fragment>
        {showSearch ? (
          <label className="mf-tray-search">
            <SearchIcon />
            <input
              ref={searchRef}
              type="search"
              value={query}
              placeholder={t("search")}
              aria-label={t("search")}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        ) : null}
        {toast ? (
          <p className="mf-tray-toast" role="alert">
            {toast}
          </p>
        ) : null}
        {visible.length === 0 ? (
          <div className="mf-tray-state">
            <p>{t("noMatch", { query: query.trim() })}</p>
          </div>
        ) : (
          <ul className="mf-tray-list">
            {visible.map((item) => {
              const href = safeHref(item.url);
              const when = savedWhen(item.savedAt, {
                today: t("savedToday"),
                yesterday: t("savedYesterday"),
                days: t("savedDays"),
              });
              return (
                <li key={item.itemSlug} className={`mf-tray-item${removing.has(item.itemSlug) ? " is-removing" : ""}`}>
                  {href ? (
                    <a className="mf-tray-link" href={onCanvas ? undefined : href} onClick={() => !onCanvas && setOpen(false)}>
                      <span className="mf-tray-item-title">{item.title}</span>
                      <span className="mf-tray-item-meta">{when}</span>
                    </a>
                  ) : (
                    <span className="mf-tray-link">
                      <span className="mf-tray-item-title">{item.title}</span>
                      <span className="mf-tray-item-meta">{when}</span>
                    </span>
                  )}
                  <button
                    type="button"
                    className="mf-tray-icon-button"
                    aria-label={t("remove", { title: item.title })}
                    onClick={() => void remove(item)}
                  >
                    <TrashIcon />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {matches.length > visible.length ? (
          <p className="mf-tray-more">{t("more", { shown: visible.length, total: matches.length })}</p>
        ) : null}
      </React.Fragment>
    );
  }

  const drawer = showDrawer ? (
    <div className={`mf-tray is-drawer ${mfThemeClass(theme)}`} data-mf-tray={scope}>
      <div className={`mf-tray-layer is-${side}${onCanvas ? " is-inline" : ""}`}>
        {onCanvas ? null : <div className="mf-tray-backdrop" aria-hidden={true} onClick={close} />}
        <div
          ref={panelRef}
          className="mf-tray-panel"
          role="dialog"
          aria-modal={onCanvas ? undefined : true}
          aria-labelledby={titleId}
        >
          <div className="mf-tray-head">
            <h2 className="mf-tray-title" id={titleId}>
              {t("title")} {load.phase === "ready" ? <span className="mf-tray-count">({count})</span> : null}
            </h2>
            <button type="button" className="mf-tray-icon-button" aria-label={t("close")} onClick={() => !onCanvas && close()}>
              <CloseIcon />
            </button>
          </div>
          {panelBody()}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className={`mf-tray ${mfThemeClass(theme)}`} data-mf-tray={scope}>
      <style>{mfThemeCss(".mf-tray")}</style>
      <style>{cssContent}</style>
      <style>{scopedCss}</style>
      <button
        ref={triggerRef}
        type="button"
        className="mf-tray-trigger"
        aria-haspopup="dialog"
        aria-expanded={showDrawer}
        aria-label={showLabel ? undefined : t("open", { count })}
        onClick={() => !onCanvas && setOpen(true)}
      >
        <RibbonIcon />
        {showLabel ? <span>{triggerLabel}</span> : null}
        {showBadge && count > 0 ? (
          <span className="mf-tray-badge" aria-hidden={true}>
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>
      {/* The drawer renders under document.body on the site, so no transformed
          or clipped ancestor in the navigation bar can trap it. Its own copy of
          the theme rules travels with it. */}
      {drawer && !onCanvas && typeof document !== "undefined"
        ? createPortal(
            <React.Fragment>
              <style>{mfThemeCss(".mf-tray")}</style>
              <style>{cssContent}</style>
              <style>{scopedCss}</style>
              {drawer}
            </React.Fragment>,
            document.body
          )
        : drawer}
      {IS_LOCKED ? <div className="mf-tray-prolock">Locked</div> : null}
      {IS_TRIAL && !IS_LOCKED ? (
        <a className="mf-tray-watermark" href="https://framefic.com" target="_blank" rel="noopener noreferrer">
          Trial
        </a>
      ) : null}
    </div>
  );
}

// ============================================================================
// PROPERTY CONTROLS, PRD F14
// ============================================================================

addPropertyControls(BookmarksTray, {
  drawerSide: {
    type: ControlType.Enum,
    title: "Drawer Side",
    options: ["right", "left"],
    optionTitles: ["Right Slide-Out", "Left Slide-Out"],
    defaultValue: CONFIG.drawerSide,
  },
  emptyStateText: {
    type: ControlType.String,
    title: "Empty Message",
    defaultValue: CONFIG.emptyStateText,
  },
  maxItems: {
    type: ControlType.Number,
    title: "Max Visible",
    min: 10,
    max: 200,
    step: 1,
    defaultValue: CONFIG.maxItems,
  },
  showBadge: {
    type: ControlType.Boolean,
    title: "Count Badge",
    defaultValue: CONFIG.showBadge,
  },
  showSearch: {
    type: ControlType.Boolean,
    title: "Search",
    defaultValue: true,
  },
  showLabel: {
    type: ControlType.Boolean,
    title: "Show Label",
    defaultValue: false,
  },
  triggerLabel: {
    type: ControlType.String,
    title: "Button Label",
    defaultValue: "Saved",
    hidden: (props) => !props.showLabel,
  },
  loginPath: {
    type: ControlType.String,
    title: "Sign In Page",
    defaultValue: CONFIG.loginPath,
  },
  canvasPreview: {
    type: ControlType.Enum,
    title: "Canvas Preview",
    options: ["closed", "open"],
    optionTitles: ["Closed", "Open"],
    displaySegmentedControl: true,
    defaultValue: "closed",
  },
  accentColor: {
    type: ControlType.Color,
    title: "Accent Color",
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
  ...mfAppearanceControls({ padding: 20, gap: 12, shadow: true }),
  labels: mfLabelControls(TRAY_LABELS),
});
