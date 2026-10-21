/**
 * `<BookmarkButton>`, save an item for later. PRD feature F14, feature plan
 * FP-10, task 7.1.
 *
 * Drop it on a CMS card or an article page. A member's click fills the icon at
 * once and syncs in the background (`PATCH /api/member/bookmarks`); a failed
 * sync puts the icon back and says so. `<BookmarksTray>` lists what was saved,
 * and the two keep each other current through the
 * `memberframe:bookmark-updated` event.
 *
 * ## Rapid clicks
 *
 * Each item has a desired state (what the icon shows) and a confirmed state
 * (what the server last said). One request per item is in flight at a time;
 * when it lands, the next request goes only if the two still differ. A double
 * click, or save, unsave, save in 200 ms, therefore ends exactly where the last
 * click left it, with at most one bookmark: the server's unique key is the
 * second guarantee.
 *
 * ## Signed out
 *
 * A click from a visitor who is not signed in does not fail quietly. The
 * button asks them to sign in, remembers the item, and saves it by itself
 * once they are back signed in.
 *
 * ## This file leaves the repository
 *
 * Written into the creator's project by the code generator. Imports only
 * `react`, `framer`, and icons drawn here.
 */

import React, { useEffect, useId, useMemo, useState } from "react";
import { addPropertyControls, ControlType, RenderTarget } from "framer";

// ============================================================================
// LICENSING AND TRIAL STATE
// ============================================================================
// Rewritten in place by F19's `enforceLockState` regex patcher.
const IS_LOCKED = false;
const IS_TRIAL = false;
// @plugin-lock-state: unlocked
// @plugin-trial-state: paid
// Bookmarks never show the trial watermark or the lock (product owner,
// 2026-10-18): they are too small to carry either. The lines stay because the
// generator asserts them in every file, and the patcher skips this one.
void IS_LOCKED;
void IS_TRIAL;

// @memberframe-appearance-start
// ============================================================================
// APPEARANCE, SHARED BY EVERY MEMBERFRAME CANVAS COMPONENT
// ============================================================================
// Byte-identical in every canvas component: MemberAuth, MemberDashboard,
// MemberPricing, MeteredPaywall, ProtectedDownload,
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
 *
 * Margin sits inside the instance's box, so a root that fills its frame
 * (`height: 100%`) shrinks by the top and bottom margin rather than spilling
 * past the frame Framer shows as selected. A root sized by its content
 * cannot resolve the percentage, and the browser treats it as `auto`.
 */
function mfSpacingCss(spacing: MfAppearanceProps["spacing"]): string {
  const input = spacing || {};
  const out: string[] = [];

  const margin = mfBox(input.margin, 400);
  if (margin) {
    const [t, r, b, l] = margin;
    if (t > 0) out.push(`margin-top: ${t}px;`);
    if (b > 0) out.push(`margin-bottom: ${b}px;`);
    if (t + b > 0) out.push(`height: calc(100% - ${t + b}px);`);
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
/** Scope named by a hash of the rule, not useId, so server and browser agree (00-canvas-appearance.md). */
const MF_SCOPE_SLOT = "@mf-scope";

function mfStyleScope(prefix: string, rule: string): { scope: string; css: string } {
  let hash = 5381;
  for (let index = 0; index < rule.length; index++) hash = ((hash << 5) + hash + rule.charCodeAt(index)) | 0;
  const scope = prefix + (hash >>> 0).toString(36);
  return { scope, css: rule.split(MF_SCOPE_SLOT).join(scope) };
}
// @memberframe-appearance-end

// ============================================================================
// CONFIG
// ============================================================================

type IconShape = "bookmark" | "heart" | "star";

interface BookmarkButtonConfig {
  iconShape: IconShape;
  activeFillColor: string;
  showLabel: boolean;
  labelText: string;
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
const CONFIG: BookmarkButtonConfig = {
  iconShape: "bookmark",
  activeFillColor: "#5271ff",
  showLabel: false,
  labelText: "Save",
  apiBaseUrl: ENV_API_BASE_URL,
  siteKey: "",
  loginPath: "/login",
};
// @memberframe-config-end

/** Shared with BookmarksTray and MemberAuth. Change together. */
const RETURN_KEY = `memberframe:return-to:${CONFIG.siteKey}`;
const PENDING_KEY = `memberframe:pending-bookmark:${CONFIG.siteKey}`;
const UPDATED_EVENT = "memberframe:bookmark-updated";
const PENDING_TTL_MS = 30 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;

interface BookmarkItem {
  itemSlug: string;
  title: string;
  url: string;
  savedAt: number;
}

// @memberframe-bookmark-sync-start
// ============================================================================
// SYNC RULE, PRD F14
// ============================================================================
// Pure, and run by `test/bookmarks.test.ts`.

interface SlugSync {
  /** What the icon shows. */
  desired: boolean;
  /** What the server last confirmed. */
  confirmed: boolean;
  inFlight: boolean;
}

/** The request to send next for one item, or null while one is in flight or nothing differs. */
function nextSyncAction(state: SlugSync): "add" | "remove" | null {
  if (state.inFlight || state.desired === state.confirmed) return null;
  return state.desired ? "add" : "remove";
}

/** A click: flip what the icon shows. */
function clickSync(state: SlugSync): SlugSync {
  return { desired: !state.desired, confirmed: state.confirmed, inFlight: state.inFlight };
}

/** The server answered: it now holds `saved`. */
function settleSync(state: SlugSync, saved: boolean): SlugSync {
  return { desired: state.desired, confirmed: saved, inFlight: false };
}

/** The request failed or was refused: the icon goes back to what the server holds. */
function revertSync(state: SlugSync): SlugSync {
  return { desired: state.confirmed, confirmed: state.confirmed, inFlight: false };
}
// @memberframe-bookmark-sync-end

// ============================================================================
// THE PAGE'S BOOKMARK STORE
// ============================================================================
// Module scope, so every button on a page shares one list and one request.

type Status = "unknown" | "loading" | "guest" | "member" | "error";

interface Notice {
  slug: string;
  kind: "failed" | "signin";
  at: number;
}

const STORE_ID = Math.random().toString(36).slice(2);

const store: {
  status: Status;
  saved: Map<string, BookmarkItem>;
  sync: Map<string, SlugSync & { item: BookmarkItem }>;
  notice: Notice | null;
  listeners: Set<() => void>;
} = {
  status: "unknown",
  saved: new Map(),
  sync: new Map(),
  notice: null,
  listeners: new Set(),
};

function notify(): void {
  for (const listener of store.listeners) listener();
}

function apiHeaders(withBody: boolean): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (withBody) headers["Content-Type"] = "application/json";
  if (CONFIG.siteKey !== "") headers["X-MemberFrame-Site"] = CONFIG.siteKey;
  // A free ngrok tunnel answers a browser with its warning page, not the API,
  // unless the request asks it not to. Only sent to an ngrok address.
  if (CONFIG.apiBaseUrl.indexOf(".ngrok") !== -1) headers["ngrok-skip-browser-warning"] = "1";
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

/** Take the server's list as the confirmed state, leaving items mid-sync alone. */
function applyList(list: BookmarkItem[]): void {
  store.saved = new Map(list.map((item) => [item.itemSlug, item]));
  for (const [slug, entry] of store.sync) {
    if (!entry.inFlight) {
      entry.confirmed = store.saved.has(slug);
      if (entry.desired === entry.confirmed) store.sync.delete(slug);
    }
  }
}

function broadcast(list: BookmarkItem[]): void {
  window.dispatchEvent(new CustomEvent(UPDATED_EVENT, { detail: { bookmarks: list, source: STORE_ID } }));
}

function isSaved(slug: string): boolean {
  const entry = store.sync.get(slug);
  return entry ? entry.desired : store.saved.has(slug);
}

function readPending(): BookmarkItem | null {
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const pending = JSON.parse(raw) as { item?: BookmarkItem; ts?: number };
    if (!pending.item || typeof pending.ts !== "number" || Date.now() - pending.ts > PENDING_TTL_MS) return null;
    return pending.item;
  } catch {
    return null;
  }
}

function writePending(item: BookmarkItem | null): void {
  try {
    if (item) window.sessionStorage.setItem(PENDING_KEY, JSON.stringify({ item, ts: Date.now() }));
    else window.sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // Without storage the visitor saves the item again after signing in.
  }
}

let loading: Promise<void> | null = null;

function loadBookmarks(fresh = false): Promise<void> {
  if (loading && !fresh) return loading;
  store.status = store.status === "member" ? "member" : "loading";
  notify();
  loading = (async () => {
    try {
      const response = await timedFetch("/api/member/bookmarks", { headers: apiHeaders(false) });
      if (response.status === 401) {
        store.status = "guest";
        return;
      }
      if (!response.ok) {
        store.status = "error";
        return;
      }
      const body = (await response.json()) as { bookmarks?: unknown };
      applyList(readList(body.bookmarks));
      store.status = "member";

      // Saved before signing in: finish it now.
      const pending = readPending();
      if (pending) {
        writePending(null);
        if (!isSaved(pending.itemSlug)) toggle(pending);
      }
    } catch {
      store.status = "error";
    } finally {
      notify();
    }
  })();
  return loading;
}

/** Send a saved item's title again; the server keeps the newest title for a slug. */
function retitle(slug: string, title: string): void {
  const saved = store.saved.get(slug);
  if (!saved || !title || saved.title === title || store.status !== "member") return;
  void timedFetch("/api/member/bookmarks", {
    method: "PATCH",
    headers: apiHeaders(true),
    body: JSON.stringify({ action: "add", item: { itemSlug: slug, title, url: saved.url } }),
  })
    .then(async (response) => {
      if (!response.ok) return;
      const list = readList(((await response.json()) as { bookmarks?: unknown }).bookmarks);
      applyList(list);
      broadcast(list);
      notify();
    })
    .catch(() => undefined);
}

/**
 * Saved before Framer set the new page's title: watch for it for a few
 * seconds, then send it, so the tray names the page, not the one before.
 */
function watchTitle(slug: string, path: string): void {
  let tries = 0;
  const check = () => {
    tries += 1;
    if (window.location.pathname !== path || tries > 20) return;
    if (store.sync.has(slug) || staleTitle(path, document.title)) {
      window.setTimeout(check, 250);
      return;
    }
    retitle(slug, pageTitle(path).slice(0, 255));
  };
  window.setTimeout(check, 250);
}

function pump(slug: string): void {
  const entry = store.sync.get(slug);
  if (!entry) return;
  const action = nextSyncAction(entry);
  if (!action) {
    if (!entry.inFlight && entry.desired === entry.confirmed) store.sync.delete(slug);
    notify();
    return;
  }

  entry.inFlight = true;
  const item = entry.item;

  void (async () => {
    let outcome: "ok" | "signin" | "failed" = "failed";
    let list: BookmarkItem[] | null = null;
    try {
      const response = await timedFetch("/api/member/bookmarks", {
        method: "PATCH",
        headers: apiHeaders(true),
        body: JSON.stringify({ action, item: { itemSlug: item.itemSlug, title: item.title, url: item.url } }),
      });
      if (response.ok) {
        const body = (await response.json()) as { bookmarks?: unknown };
        list = readList(body.bookmarks);
        outcome = "ok";
      } else if (response.status === 401) {
        outcome = "signin";
      }
    } catch {
      outcome = "failed";
    }

    const current = store.sync.get(slug);
    if (!current) return;

    if (outcome === "ok" && list) {
      const settled = settleSync(current, action === "add");
      Object.assign(current, settled);
      applyList(list);
      store.status = "member";
      broadcast(list);
      pump(slug);
      return;
    }

    Object.assign(current, revertSync(current));
    store.sync.delete(slug);
    if (outcome === "signin") {
      store.status = "guest";
      if (action === "add") writePending(item);
      store.notice = { slug, kind: "signin", at: Date.now() };
      window.dispatchEvent(new CustomEvent("memberframe:open-auth", { detail: { reason: "bookmark" } }));
    } else {
      store.notice = { slug, kind: "failed", at: Date.now() };
    }
    notify();
  })();
  notify();
}

function toggle(item: BookmarkItem): void {
  if (store.status === "guest") {
    // Known to be signed out: no request, straight to the sign in prompt.
    writePending(item);
    store.notice = { slug: item.itemSlug, kind: "signin", at: Date.now() };
    window.dispatchEvent(new CustomEvent("memberframe:open-auth", { detail: { reason: "bookmark" } }));
    notify();
    return;
  }

  const existing = store.sync.get(item.itemSlug);
  const base: SlugSync = existing ?? {
    desired: store.saved.has(item.itemSlug),
    confirmed: store.saved.has(item.itemSlug),
    inFlight: false,
  };
  const next = clickSync(base);
  store.sync.set(item.itemSlug, { ...base, ...next, inFlight: base.inFlight, item });
  if (store.notice?.slug === item.itemSlug) store.notice = null;
  pump(item.itemSlug);
}

let listening = false;

function listen(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener(UPDATED_EVENT, (event) => {
    const detail = (event as CustomEvent<{ bookmarks?: unknown; source?: string }>).detail;
    if (!detail || detail.source === STORE_ID) return;
    applyList(readList(detail.bookmarks));
    store.status = "member";
    notify();
  });
  window.addEventListener("memberframe:session-updated", () => {
    void loadBookmarks(true);
  });
}

// ============================================================================
// HELPERS
// ============================================================================

function safePath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//") && value.indexOf("\\") === -1;
}

function rememberReturn(): void {
  try {
    const path = `${window.location.pathname}${window.location.search}`;
    if (safePath(path)) window.sessionStorage.setItem(RETURN_KEY, JSON.stringify({ path, ts: Date.now() }));
  } catch {
    // Without storage the visitor lands on the site's after-sign-in page.
  }
}

/*
  Framer moves between pages with history.pushState, without a reload, and a
  button in a shared navigation bar never remounts. So the page is read when
  it changes and again at the click, never once at mount, or every page saves
  the first one the visitor opened.
*/
const LOCATION_EVENT = "memberframe:location";

/** The last navigation: where it went, and the title of the page it left. */
type MfNavHost = { __mfHistory?: boolean; __mfNav?: { path: string; title: string } };

/** Whether `title` is still the last page's: this page was navigated to and the title has not changed since. */
function staleTitle(path: string, title: string): boolean {
  const nav = (window as unknown as MfNavHost).__mfNav;
  return Boolean(nav && nav.path === path && nav.title === title);
}

/** Call `listener` after every client-side navigation. Returns the unsubscribe. */
function mfOnLocationChange(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const host = window as unknown as MfNavHost;
  if (!host.__mfHistory) {
    host.__mfHistory = true;
    for (const name of ["pushState", "replaceState"] as const) {
      const original = window.history[name];
      window.history[name] = function (this: History, ...args: Parameters<History["pushState"]>) {
        // The title now is still the page being left: Framer sets the new one after it renders.
        const before = document.title;
        const result = original.apply(this, args);
        host.__mfNav = { path: window.location.pathname, title: before };
        window.dispatchEvent(new Event(LOCATION_EVENT));
        return result;
      };
    }
    window.addEventListener("popstate", () => {
      host.__mfNav = { path: window.location.pathname, title: document.title };
      window.dispatchEvent(new Event(LOCATION_EVENT));
    });
  }
  window.addEventListener(LOCATION_EVENT, listener);
  return () => window.removeEventListener(LOCATION_EVENT, listener);
}

/** The document title seen on each path. A title seen on two paths is the site's, not a page's. */
const seenTitles = new Map<string, string>();

function noteTitle(): void {
  if (typeof document === "undefined" || !document.title) return;
  const path = window.location.pathname;
  if (!staleTitle(path, document.title)) seenTitles.set(path, document.title);
}

/** A title that names no page: one seen on another path (the site's), or this path in words. */
function genericTitle(title: string, path: string): boolean {
  if (title === slugWords(path)) return true;
  let shared = false;
  seenTitles.forEach((seen, seenPath) => {
    if (seen === title && seenPath !== path) shared = true;
  });
  // Or another saved page carries the same title: the site's, from before this fix.
  store.saved.forEach((other) => {
    if (other.title === title && other.url.split(/[?#]/)[0] !== path) shared = true;
  });
  return shared;
}

/** "/article/artificial-intelligence" as "Artificial Intelligence". */
function slugWords(path: string): string {
  const last = decodeURIComponent(path.split("/").filter(Boolean).pop() ?? "");
  return last.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()).trim();
}

/**
 * What names this page: its main heading (not one in the header or nav), else
 * its own document title, else its path in words. The site-wide title, which
 * Framer gives every page without an SEO title of its own, names only home.
 */
function pageTitle(path: string): string {
  if (typeof document === "undefined") return "";
  const title = document.title.trim();
  // Saved too soon after a navigation, the title still names the page left.
  const stale = staleTitle(path, document.title);
  if (path === "/") return stale ? "Home" : title;
  for (const heading of Array.from(document.querySelectorAll("h1"))) {
    const text = (heading.textContent ?? "").replace(/\s+/g, " ").trim();
    // Framer keeps hidden copies of a layer for other breakpoints; only a shown one counts.
    const shown = typeof heading.getClientRects !== "function" || heading.getClientRects().length > 0;
    if (text && shown && !heading.closest("header, nav")) return text;
  }
  let shared = false;
  seenTitles.forEach((seen, seenPath) => {
    if (seen === title && seenPath !== path) shared = true;
  });
  return (!shared && !stale && title) || slugWords(path) || title;
}

/** The item this button saves: the creator's values, or the page shown now. */
function itemFor(slug: string, title: string, url: string): BookmarkItem {
  const path = typeof window === "undefined" ? "/" : window.location.pathname;
  const cleanSlug = (slug.trim() || path.replace(/\/+$/, "") || "/").replace(/[^A-Za-z0-9\-_./:]/g, "-").slice(0, 191);
  const pageUrl = typeof window === "undefined" ? "/" : `${window.location.pathname}${window.location.search}`;
  const link = url.trim();
  return {
    itemSlug: cleanSlug || "/",
    title: (title.trim() || (slug.trim() ? slugWords(`/${slug.trim()}`) : pageTitle(path)) || cleanSlug).slice(0, 255),
    url: link.startsWith("/") || /^https?:\/\//.test(link) ? link : pageUrl,
    savedAt: Date.now(),
  };
}

function ShapeIcon({ shape, filled }: { shape: IconShape; filled: boolean }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: filled ? "currentColor" : "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (shape === "heart") {
    return (
      <svg {...common}>
        <path d="M19 14c1.5-1.5 3-3.3 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z" />
      </svg>
    );
  }
  if (shape === "star") {
    return (
      <svg {...common}>
        <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const cssContent = `
.mf-bookmark {
  --mf-bookmark-fill: #5271ff;
  box-sizing: border-box; position: relative;
  display: inline-flex; align-items: center; justify-content: center;
  width: 100%; height: 100%; min-width: 36px; min-height: 36px;
  color: var(--mf-c-text); font-size: calc(14px * var(--mf-text-scale, 1)); line-height: 1.3;
}
.mf-bookmark-button {
  appearance: none; box-sizing: border-box;
  display: inline-flex; align-items: center; justify-content: center; gap: var(--mf-gap, 6px);
  width: 100%; height: 100%; min-width: 36px; min-height: 36px; margin: 0; padding: 0 var(--mf-pad, 10px);
  white-space: nowrap;
  border: var(--mf-border-width, 1px) solid var(--mf-c-border); border-radius: var(--mf-c-radius);
  background: var(--mf-c-surface); color: var(--mf-c-text); box-shadow: var(--mf-c-shadow);
  font: inherit; font-weight: 600; cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}
.mf-bookmark-button:hover { border-color: var(--mf-bookmark-fill); }
.mf-bookmark-button:focus-visible { outline: 2px solid var(--mf-bookmark-fill); outline-offset: 2px; }
.mf-bookmark-button.is-saved { color: var(--mf-bookmark-fill); border-color: color-mix(in srgb, var(--mf-bookmark-fill) 45%, transparent); }
.mf-bookmark-button svg { flex: 0 0 auto; width: var(--mf-bookmark-icon, 20px); height: var(--mf-bookmark-icon, 20px); }
/* Button Style: Outline is the base above. Soft is a tint with no border; Icon Only is the bare icon. */
.mf-bookmark-button.is-soft { border-color: transparent; box-shadow: none; background: color-mix(in srgb, var(--mf-bookmark-fill) 10%, var(--mf-c-surface)); }
.mf-bookmark-button.is-soft:hover { border-color: transparent; background: color-mix(in srgb, var(--mf-bookmark-fill) 18%, var(--mf-c-surface)); }
.mf-bookmark-button.is-ghost { border-color: transparent; box-shadow: none; background: transparent; padding: 0; }
.mf-bookmark-button.is-ghost:hover { border-color: transparent; color: var(--mf-bookmark-fill); }
.mf-bookmark-button.is-saved.is-soft, .mf-bookmark-button.is-saved.is-ghost { border-color: transparent; }
.mf-bookmark-button.is-icon-right { flex-direction: row-reverse; }
.mf-bookmark-button.is-pulse svg { animation: mf-bookmark-pulse 0.32s ease-out; }
@keyframes mf-bookmark-pulse { 0% { transform: scale(1); } 45% { transform: scale(1.2); } 100% { transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .mf-bookmark-button.is-pulse svg { animation: none; } }
.mf-bookmark-pop {
  position: absolute; top: calc(100% + 8px); right: 0; z-index: 1000;
  box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; width: 248px; padding: 12px;
  border: 1px solid var(--mf-c-border); border-radius: 12px; background: var(--mf-c-surface); color: var(--mf-c-text);
  box-shadow: 0 12px 32px rgba(16, 24, 40, 0.18); font-size: calc(13px * var(--mf-text-scale, 1)); font-weight: 400; text-align: left;
}
.mf-bookmark-pop.is-error { color: var(--mf-c-danger); }
.mf-bookmark-pop p { margin: 0; }
.mf-bookmark-pop-actions { display: flex; gap: 8px; justify-content: flex-end; }
.mf-bookmark-pop button {
  appearance: none; padding: 6px 12px; border-radius: 8px; border: 1px solid var(--mf-c-border);
  background: transparent; color: var(--mf-c-text); font: inherit; font-weight: 600; cursor: pointer;
}
.mf-bookmark-pop button.is-primary { background: var(--mf-c-accent); border-color: var(--mf-c-accent); color: var(--mf-c-on-accent); }
.mf-bookmark-pop button:focus-visible { outline: 2px solid var(--mf-c-accent); outline-offset: 2px; }
.mf-bookmark-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
`;

// ============================================================================
// COMPONENT
// ============================================================================

const BOOKMARK_LABELS: Record<string, readonly [string, string]> = {
  savedLabel: ["Saved label", "Saved"],
  saveAria: ["Save, screen reader", "Save {title}"],
  removeAria: ["Remove, screen reader", "Remove {title} from saved items"],
  savedAnnounce: ["Saved, announced", "Saved to your bookmarks"],
  removedAnnounce: ["Removed, announced", "Removed from your bookmarks"],
  signInPrompt: ["Sign in prompt", "Sign in or create an account to save this item to your bookmarks."],
  signInButton: ["Sign in button", "Sign in"],
  dismiss: ["Dismiss button", "Not now"],
  failed: ["Sync failed", "Could not update your bookmarks. Try again."],
};

export interface BookmarkButtonProps extends MfAppearanceProps {
  itemSlug?: string;
  itemTitle?: string;
  itemUrl?: string;
  iconShape?: IconShape;
  activeFillColor?: string;
  showLabel?: boolean;
  labelText?: string;
  loginPath?: string;
  canvasPreview?: "unsaved" | "saved";
  accentColor?: string;
  borderRadius?: number;
  buttonStyle?: ButtonStyle;
  iconSize?: number;
  iconPosition?: "left" | "right";
  animateSave?: boolean;
}

type ButtonStyle = "outline" | "soft" | "ghost";
const BUTTON_STYLES: ReadonlyArray<ButtonStyle> = ["outline", "soft", "ghost"];

/**
 * @framerIntrinsicWidth 44
 * @framerIntrinsicHeight 44
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
export default function BookmarkButton(props: BookmarkButtonProps) {
  const {
    itemSlug = "",
    itemTitle = "",
    itemUrl = "",
    iconShape = CONFIG.iconShape,
    activeFillColor = CONFIG.activeFillColor,
    showLabel = CONFIG.showLabel,
    labelText = CONFIG.labelText,
    loginPath = CONFIG.loginPath,
    canvasPreview = "unsaved",
    accentColor = "#5271ff",
    borderRadius = 999,
    buttonStyle = "outline",
    iconSize = 20,
    iconPosition = "left",
    animateSave = true,
    theme = "light",
    colors,
    typography,
    layout,
    spacing,
    labels,
  } = props;

  const t = (key: string, values: Record<string, string | number> = {}) =>
    mfFill(mfLabel(labels, BOOKMARK_LABELS, key), values);

  const rawId = useId();
  const scope = useMemo(() => `mfb${rawId.replace(/[^a-zA-Z0-9]/g, "")}`, [rawId]);
  const onCanvas = useMemo(() => {
    const target = RenderTarget.current();
    return target === RenderTarget.canvas || target === RenderTarget.thumbnail;
  }, []);

  // The page shown now: a client-side navigation changes it without a remount.
  const [locationKey, setLocationKey] = useState(() => (typeof window === "undefined" ? "/" : window.location.pathname + window.location.search));
  useEffect(() => {
    if (onCanvas) return;
    noteTitle();
    let timer = 0;
    const off = mfOnLocationChange(() => {
      setLocationKey(window.location.pathname + window.location.search);
      // Framer sets the new page's title just after the navigation.
      window.clearTimeout(timer);
      timer = window.setTimeout(noteTitle, 600);
    });
    return () => {
      off();
      window.clearTimeout(timer);
    };
  }, [onCanvas]);
  const item = useMemo(
    () => itemFor(String(itemSlug ?? ""), String(itemTitle ?? ""), String(itemUrl ?? "")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itemSlug, itemTitle, itemUrl, locationKey]
  );
  const [, setVersion] = useState(0);
  const [pulsing, setPulsing] = useState(false);
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    if (onCanvas) return;
    listen();
    const listener = () => setVersion((value) => value + 1);
    store.listeners.add(listener);
    if (store.status === "unknown") void loadBookmarks();
    return () => {
      store.listeners.delete(listener);
    };
  }, [onCanvas]);

  const saved = onCanvas ? canvasPreview === "saved" : isSaved(item.itemSlug);
  const notice = !onCanvas && store.notice?.slug === item.itemSlug ? store.notice : null;

  // A bookmark of this page saved under the site's title, or under its path in
  // words, gets the page's real title once it is known.
  useEffect(() => {
    if (onCanvas || !saved || String(itemSlug ?? "").trim() || String(itemTitle ?? "").trim()) return;
    const timer = window.setTimeout(() => {
      const path = window.location.pathname;
      const stored = store.saved.get(item.itemSlug);
      if (!stored || path === "/" || staleTitle(path, document.title)) return;
      if (genericTitle(stored.title, path)) retitle(item.itemSlug, pageTitle(path).slice(0, 255));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [onCanvas, saved, item.itemSlug, itemSlug, itemTitle]);

  useEffect(() => {
    if (!pulsing) return;
    const timer = window.setTimeout(() => setPulsing(false), 360);
    return () => window.clearTimeout(timer);
  }, [pulsing]);

  // A failure note clears itself; the sign in prompt waits for the visitor.
  useEffect(() => {
    if (!notice || notice.kind !== "failed") return;
    const timer = window.setTimeout(() => {
      if (store.notice === notice) {
        store.notice = null;
        notify();
      }
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const onClick = () => {
    if (onCanvas) return;
    // Built now, from the page shown now, never from an earlier render.
    noteTitle();
    const current = itemFor(String(itemSlug ?? ""), String(itemTitle ?? ""), String(itemUrl ?? ""));
    const willSave = !isSaved(current.itemSlug);
    toggle(current);
    const path = window.location.pathname;
    if (willSave && !String(itemTitle ?? "").trim() && !String(itemSlug ?? "").trim() && staleTitle(path, document.title)) {
      watchTitle(current.itemSlug, path);
    }
    if (store.status !== "guest") {
      if (willSave && animateSave) {
        // Restart the pulse without remounting the button, which would drop
        // keyboard focus: off, then on in the next frame.
        setPulsing(false);
        window.requestAnimationFrame(() => setPulsing(true));
      }
      setAnnounce(t(willSave ? "savedAnnounce" : "removedAnnounce"));
    }
  };

  const signIn = () => {
    store.notice = null;
    notify();
    rememberReturn();
    const target = safePath(loginPath) ? loginPath : CONFIG.loginPath;
    if (window.location.pathname !== target) window.location.assign(target);
  };

  const dismiss = () => {
    store.notice = null;
    writePending(null);
    notify();
  };

  const fill = mfSafeColor(activeFillColor, CONFIG.activeFillColor);
  const scopedCss =
    `[data-mf-bookmark="${MF_SCOPE_SLOT}"] { --mf-bookmark-fill: ${fill}; --mf-bookmark-icon: ${Math.round(mfNumber(iconSize, 12, 48, 20))}px; ` +
    mfAppearanceVars({
      accent: accentColor,
      radius: borderRadius,
      radiusMax: 999,
      shadowByDefault: false,
      colors,
      typography,
      layout,
      spacing,
    }) +
    " }";
  const styled = mfStyleScope("mfb", scopedCss);

  const label = saved ? t("savedLabel") : labelText || CONFIG.labelText;
  const style: ButtonStyle = BUTTON_STYLES.indexOf(buttonStyle) === -1 ? "outline" : buttonStyle;
  const buttonClass =
    `mf-bookmark-button is-${style}${saved ? " is-saved" : ""}${pulsing ? " is-pulse" : ""}` +
    (showLabel && iconPosition === "right" ? " is-icon-right" : "");

  return (
    <div className={`mf-bookmark ${mfThemeClass(theme)}`} data-mf-bookmark={styled.scope}>
      <style>{mfThemeCss(".mf-bookmark")}</style>
      <style>{cssContent}</style>
      <style>{styled.css}</style>
      <button
        type="button"
        className={buttonClass}
        aria-pressed={saved}
        aria-label={showLabel ? undefined : t(saved ? "removeAria" : "saveAria", { title: item.title })}
        onClick={onClick}
      >
        <ShapeIcon shape={iconShape} filled={saved} />
        {showLabel ? <span>{label}</span> : null}
      </button>
      <span className="mf-bookmark-sr" role="status" aria-live="polite">
        {announce}
      </span>
      {notice?.kind === "signin" ? (
        <div className="mf-bookmark-pop" role="dialog" aria-label={t("signInButton")}>
          <p>{t("signInPrompt")}</p>
          <div className="mf-bookmark-pop-actions">
            <button type="button" onClick={dismiss}>
              {t("dismiss")}
            </button>
            <button type="button" className="is-primary" onClick={signIn}>
              {t("signInButton")}
            </button>
          </div>
        </div>
      ) : notice?.kind === "failed" ? (
        <div className="mf-bookmark-pop is-error" role="alert">
          <p>{t("failed")}</p>
        </div>
      ) : null}
    </div>
  );
}

// ============================================================================
// PROPERTY CONTROLS, PRD F14
// ============================================================================

addPropertyControls(BookmarkButton, {
  itemSlug: {
    type: ControlType.String,
    title: "Item Slug",
    placeholder: "Page path",
    description: "Bind to a CMS slug on a card. Empty saves the page it is on.",
    defaultValue: "",
  },
  itemTitle: {
    type: ControlType.String,
    title: "Item Title",
    placeholder: "Page title",
    defaultValue: "",
  },
  itemUrl: {
    type: ControlType.String,
    title: "Item Link",
    placeholder: "/templates/design-system",
    defaultValue: "",
  },
  iconShape: {
    type: ControlType.Enum,
    title: "Icon Style",
    options: ["bookmark", "heart", "star"],
    optionTitles: ["Bookmark Ribbon", "Heart", "Star"],
    defaultValue: CONFIG.iconShape,
  },
  activeFillColor: {
    type: ControlType.Color,
    title: "Filled Color",
    defaultValue: CONFIG.activeFillColor,
  },
  buttonStyle: {
    type: ControlType.Enum,
    title: "Button Style",
    options: ["outline", "soft", "ghost"],
    optionTitles: ["Outline", "Soft", "Icon Only"],
    defaultValue: "outline",
  },
  iconSize: {
    type: ControlType.Number,
    title: "Icon Size",
    min: 12,
    max: 48,
    step: 1,
    unit: "px",
    defaultValue: 20,
  },
  showLabel: {
    type: ControlType.Boolean,
    title: "Show Label",
    defaultValue: CONFIG.showLabel,
  },
  labelText: {
    type: ControlType.String,
    title: "Button Label",
    defaultValue: CONFIG.labelText,
    hidden: (props) => !props.showLabel,
  },
  iconPosition: {
    type: ControlType.Enum,
    title: "Icon Position",
    options: ["left", "right"],
    optionTitles: ["Left", "Right"],
    displaySegmentedControl: true,
    defaultValue: "left",
    hidden: (props) => !props.showLabel,
  },
  animateSave: {
    type: ControlType.Boolean,
    title: "Save Animation",
    defaultValue: true,
  },
  loginPath: {
    type: ControlType.String,
    title: "Sign In Page",
    defaultValue: CONFIG.loginPath,
  },
  canvasPreview: {
    type: ControlType.Enum,
    title: "Canvas Preview",
    options: ["unsaved", "saved"],
    optionTitles: ["Not Saved", "Saved"],
    displaySegmentedControl: true,
    defaultValue: "unsaved",
  },
  accentColor: {
    type: ControlType.Color,
    title: "Accent Color",
    defaultValue: "#5271ff",
  },
  borderRadius: {
    type: ControlType.Number,
    title: "Corner Radius",
    min: 0,
    max: 999,
    step: 1,
    unit: "px",
    defaultValue: 999,
  },
  ...mfAppearanceControls({ padding: 10, gap: 6, shadow: false }),
  labels: mfLabelControls(BOOKMARK_LABELS),
});
