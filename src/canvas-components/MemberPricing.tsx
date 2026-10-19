/**
 * `<MemberPricing>`, the pricing table a visitor buys from. Feature plan FP-16
 * section 9.1.
 *
 * ## This file leaves the repository
 *
 * Like the other canvas components it is written into the creator's Framer
 * project and runs on their published site, so it may import only `react`,
 * `framer`, and `lucide-react`, all styling goes through one `cssContent`
 * string, and the marked config block is the only region the generator
 * rewrites.
 *
 * ## What it does
 *
 * It shows the site's tiers, read live from the API, so a price changed in
 * the plugin's Tiers view shows here without redeploying. Each card's button
 * starts a checkout on the gateway the server picks for this buyer:
 *
 *   signed out     the choice is kept, the visitor signs up, and the checkout
 *                  starts by itself when they come back to this page
 *   signed in      straight to the gateway's checkout page
 *   current plan   no button
 *
 * When the gateway sends the buyer back, this component confirms the payment
 * with the server (the gateway's webhook and the buyer's return race each
 * other, so it polls) and then sends them to the After purchase page.
 *
 * Access never comes from here. The webhook moves the member to their tier on
 * the server, and gates read that. This component only starts and confirms.
 */

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { addPropertyControls, ControlType, RenderTarget } from "framer";
import { Check, Loader2, ShieldCheck } from "lucide-react";

// ============================================================================
// LICENSING AND TRIAL STATE
// ============================================================================
// Rewritten in place by F19's `enforceLockState` regex patcher, so the four
// lines below must keep this exact shape. PRD section 9.3 requirement 3.
const IS_LOCKED = false;
const IS_TRIAL = false;
// @plugin-lock-state: unlocked
// @plugin-trial-state: paid

// @memberframe-license-start
// ============================================================================
// LICENSE: THE TRIAL WATERMARK AND THE LOCK
// ============================================================================
// Byte-identical in every licensed component, held so by
// `test/canvasLicenseParity.test.ts`. F19, 19-pro-lock-and-trial.md.
//
// The four lines above are this file's state when it was written, and they are
// rewritten in place by the plugin whenever the license changes. On the canvas
// and the published site the component also asks the server, and its answer
// wins: trial shows the "Made with Framefic" mark, the bottom right corner
// copied from the BEAF slider; an ended plan blurs the component behind an
// Upgrade card. The server refuses an unlicensed site's member requests on its
// own, so removing these lines unlocks nothing.

type MfLicense = "trial" | "active" | "locked";

const MF_LICENSE_CACHE_MS = 60000;

function mfBakedLicense(): MfLicense {
  return IS_LOCKED ? "locked" : IS_TRIAL ? "trial" : "active";
}

function mfFetchLicense(apiBaseUrl: string, siteKey: string): Promise<MfLicense | null> {
  if (typeof window === "undefined" || !apiBaseUrl || !siteKey) return Promise.resolve(null);
  const host = window as unknown as { __mfLicense?: Record<string, { at: number; answer: Promise<MfLicense | null> }> };
  const cache = (host.__mfLicense = host.__mfLicense || {});
  const base = String(apiBaseUrl).replace(/\/+$/, "");
  const key = base + "|" + siteKey;
  const hit = cache[key];
  if (hit && Date.now() - hit.at < MF_LICENSE_CACHE_MS) return hit.answer;
  const headers: Record<string, string> = {};
  if (base.indexOf(".ngrok") !== -1) headers["ngrok-skip-browser-warning"] = "1";
  const answer = fetch(base + "/api/license?site=" + encodeURIComponent(siteKey), { credentials: "omit", headers })
    .then((response) => (response.ok ? response.json() : null))
    .then((data: { state?: unknown } | null): MfLicense | null => {
      const state = data ? data.state : null;
      return state === "active" ? "active" : state === "trial" ? "trial" : state === "expired" ? "locked" : null;
    })
    .catch(() => null);
  cache[key] = { at: Date.now(), answer };
  return answer;
}

function useMfLicense(apiBaseUrl: string, siteKey: string): MfLicense {
  const [license, setLicense] = useState<MfLicense>(mfBakedLicense);
  useEffect(() => {
    let live = true;
    void mfFetchLicense(apiBaseUrl, siteKey).then((answer) => {
      if (live && answer) setLicense(answer);
    });
    return () => {
      live = false;
    };
  }, [apiBaseUrl, siteKey]);
  return license;
}

const MF_LICENSE_CSS = `
.mf-wm { position: absolute; bottom: 10px; right: 12px; z-index: 30; display: inline-flex; align-items: center; gap: 5px; padding: 4px 9px 4px 5px; border-radius: 999px; border: 1px solid rgba(255, 255, 255, 0.16); background: rgba(17, 17, 20, 0.72); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, Helvetica, Arial, sans-serif; font-size: 11px; line-height: 1; cursor: pointer; user-select: none; pointer-events: auto; transform: translateY(0) scale(1); transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1); }
.mf-wm:hover { transform: translateY(-1px) scale(1.02); border-color: rgba(82, 113, 255, 0.45); }
.mf-wm-icon { width: 14px; height: 14px; border-radius: 4px; background: linear-gradient(135deg, #5271ff 0%, #3557ff 100%); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 1px 3px rgba(82, 113, 255, 0.35), inset 0 0.5px 0.5px rgba(255, 255, 255, 0.4); transition: transform 0.22s ease, box-shadow 0.22s ease; }
.mf-wm:hover .mf-wm-icon { transform: scale(1.06); box-shadow: 0 2px 6px rgba(82, 113, 255, 0.55), inset 0 0.5px 0.5px rgba(255, 255, 255, 0.6); }
.mf-wm-text { color: #94a3b8; font-weight: 500; letter-spacing: 0.1px; transition: color 0.2s ease; }
.mf-wm:hover .mf-wm-text { color: rgba(255, 255, 255, 0.85); }
.mf-wm-brand { color: #ffffff; font-weight: 600; letter-spacing: 0.2px; }
.mf-lock { position: absolute; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center; padding: 12px; box-sizing: border-box; background: rgba(15, 16, 20, 0.28); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); border-radius: inherit; container-type: size; }
.mf-lock-card { display: flex; flex-direction: column; align-items: center; gap: 8px; max-width: 320px; padding: 18px 20px; border-radius: 14px; background: #121214; border: 1px dashed rgba(255, 255, 255, 0.25); color: #ffffff; text-align: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, Helvetica, Arial, sans-serif; box-shadow: 0 12px 32px -12px rgba(0, 0, 0, 0.5); }
.mf-lock-icon { width: 40px; height: 40px; border-radius: 50%; background: rgba(255, 255, 255, 0.1); display: flex; align-items: center; justify-content: center; }
.mf-lock-title { margin: 0; font-size: 14px; font-weight: 700; line-height: 1.3; }
.mf-lock-text { margin: 0; font-size: 12px; line-height: 1.5; color: #94a3b8; }
@container (max-height: 150px) { .mf-lock-card { flex-direction: row; padding: 8px 12px; gap: 8px; } .mf-lock-icon { width: 24px; height: 24px; } .mf-lock-icon svg { width: 14px; height: 14px; } .mf-lock-text { display: none; } .mf-lock-title { font-size: 12px; } }
`;

function MfWatermark(): React.ReactElement {
  return (
    <a className="mf-wm" href="https://framefic.com" target="_blank" rel="noopener noreferrer">
      <span className="mf-wm-icon" aria-hidden={true}>
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2.2 5V3.4C2.2 2.74 2.74 2.2 3.4 2.2H5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M11 2.2H12.6C13.26 2.2 13.8 2.74 13.8 3.4V5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2.2 11V12.6C2.2 13.26 2.74 13.8 3.4 13.8H5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M11 13.8H12.6C13.26 13.8 13.8 13.26 13.8 12.6V11" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="4.4" y="4.6" width="7.2" height="6.8" rx="1.6" fill="#ffffff" />
        </svg>
      </span>
      <span className="mf-wm-text">Made with</span>
      <span className="mf-wm-brand">Framefic</span>
    </a>
  );
}

function MfLockOverlay(): React.ReactElement {
  return (
    <div className="mf-lock" role="note" aria-label="Upgrade to Pro">
      <div className="mf-lock-card">
        <span className="mf-lock-icon" aria-hidden={true}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#708AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </span>
        <p className="mf-lock-title">Upgrade to Pro</p>
        <p className="mf-lock-text">This site's MemberFrame plan has ended. Upgrade in the MemberFrame plugin to restore it.</p>
      </div>
    </div>
  );
}

/** What a licensed component renders last inside its root: the mark, the lock, or nothing. */
function MfLicenseLayer(props: { license: MfLicense }): React.ReactElement | null {
  if (props.license === "active") return null;
  return (
    <>
      <style>{MF_LICENSE_CSS}</style>
      {props.license === "trial" ? <MfWatermark /> : <MfLockOverlay />}
    </>
  );
}
// @memberframe-license-end

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
// Byte-identical in MemberPricing, MemberDashboard, and ProtectedDownload,
// held so by `test/canvasRealData.test.ts`.
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
// CONFIGURATION
// ============================================================================

type PricingInterval = "month" | "year" | "lifetime";

interface PricingConfig {
  headline: string;
  subheadline: string;
  /** Which recurring period the switch starts on. */
  defaultInterval: "month" | "year";
  /** Offer one-time prices, as their own cards or as an "or pay once" link. */
  showLifetime: boolean;
  /** Show the free tier as a card, so the table doubles as a sign up page. */
  showFreeTier: boolean;
  /** A tier's name or key, marked "Most popular". Empty for none. */
  highlightTier: string;
  accentColor: string;
  borderRadius: number;
  apiBaseUrl: string;
  /** Public. Identifies the tenant; `Origin` is what authorizes. */
  siteKey: string;
  /** Where a signed-out visitor goes to make an account before buying. */
  signupPath: string;
}

const ENV_API_BASE_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_APP_BASE_URL)) ||
  "";

// @memberframe-config-start
const CONFIG: PricingConfig = {
  headline: "Choose your plan",
  subheadline: "Upgrade, switch, or cancel any time.",
  defaultInterval: "month",
  showLifetime: true,
  showFreeTier: true,
  highlightTier: "",
  accentColor: "#5271ff",
  borderRadius: 16,
  apiBaseUrl: ENV_API_BASE_URL,
  siteKey: "",
  signupPath: "/login",
};
// @memberframe-config-end

const PRICING_PATH = "/api/checkout/pricing";
const CHECKOUT_PATH = "/api/checkout/create-session";
const STATUS_PATH = "/api/checkout/status/";
const SESSION_PATH = "/api/member/session";

/** How long the return page waits for the gateway's webhook before saying so. */
const CONFIRM_TIMEOUT_MS = 30_000;
const CONFIRM_POLL_MS = 2_000;

/**
 * Keys shared with MemberAuth and the Route Shield. Change them together.
 *
 * The intent carries a signed-out visitor's choice through sign up, so the
 * checkout starts by itself when they are back. The hint and cache keep the
 * shield in step once a purchase changes the member's tier.
 */
const INTENT_KEY = `memberframe:checkout-intent:${CONFIG.siteKey}`;
const HINT_KEY = `memberframe:signed-in:${CONFIG.siteKey}`;
const SESSION_CACHE_KEY = `__mf_session_${CONFIG.siteKey}`;

/** An intent older than this is stale: the visitor has moved on. */
const INTENT_TTL_MS = 30 * 60 * 1000;

/**
 * Every visible string, as [sidebar title, default]. The Labels group edits
 * them; an empty field falls back. `{tier}`, `{price}`, and `{percent}` are
 * filled in.
 */
const PRICING_LABELS: Record<string, readonly [string, string]> = {
  monthly: ["Monthly switch", "Monthly"],
  yearly: ["Yearly switch", "Yearly"],
  save: ["Yearly saving", "Save {percent}%"],
  perMonth: ["Per month", "/month"],
  perYear: ["Per year", "/year"],
  once: ["One time", "once"],
  orOnce: ["Pay once link", "Or pay {price} once"],
  free: ["Free price", "Free"],
  mostPopular: ["Highlight badge", "Most popular"],
  getStarted: ["Free button", "Get started"],
  choose: ["Buy button", "Get {tier}"],
  upgrade: ["Upgrade button", "Upgrade to {tier}"],
  switchPlan: ["Switch button", "Switch to {tier}"],
  current: ["Current plan", "Current plan"],
  unavailable: ["Unavailable button", "Not available yet"],
  testMode: ["Test mode pill", "Test mode"],
  opening: ["Opening checkout", "Opening checkout"],
  confirming: ["Confirming", "Confirming your payment"],
  confirmed: ["Confirmed", "You are on {tier}"],
  pending: ["Still confirming", "Your payment is being confirmed. This can take a minute."],
  checkAgain: ["Check again button", "Check again"],
  cancelled: ["Cancelled checkout", "Checkout cancelled. You have not been charged."],
  loading: ["Loading", "Loading plans."],
  failed: ["Load failed", "Plans could not be loaded. Refresh the page to try again."],
  noGateway: ["No gateway", "Payments are not set up yet. Check back soon."],
  already: ["Already on plan", "You are already on this plan."],
  error: ["Checkout failed", "Checkout could not start. Try again in a moment."],
  confirmSwitch: ["Confirm switch button", "Confirm switch to {tier}"],
  switchNote: [
    "Switch note",
    "Switching plans: you pay for the new plan now and are credited for the time left on your current one.",
  ],
  closed: ["Checkout closed", "Checkout closed. You have not been charged."],
};

/** Feature lines per tier, matched by the tier's name or key. */
interface FeatureRow {
  tier?: string;
  lines?: string;
}

const DEFAULT_FEATURES: FeatureRow[] = [
  { tier: "Free", lines: "Members only posts\nCommunity access" },
  { tier: "Silver", lines: "Everything in Free\nAll courses\nMonthly live session" },
  { tier: "Gold", lines: "Everything in Silver\nDownloadable resources\nPriority support" },
  { tier: "VIP", lines: "Everything, forever\nOne payment, no renewals" },
];

// ============================================================================
// TYPES FROM THE API
// ============================================================================

interface PublicTier {
  key: string;
  name: string;
  rank: number;
  currency: string;
  prices: Record<PricingInterval, number | null>;
  purchasable: Record<PricingInterval, boolean>;
}

interface PublicPricing {
  mode: "test" | "live";
  pricingPath: string;
  afterPurchasePath: string;
  tiers: PublicTier[];
}

type LoadState =
  | { phase: "loading" }
  | { phase: "ready"; pricing: PublicPricing }
  | { phase: "failed" }
  | { phase: "misconfigured" };

type Viewer = { kind: "unknown" } | { kind: "guest" } | { kind: "member"; activeTier: string };

type Flow =
  | { phase: "idle"; message: string | null; tone: "info" | "error" }
  | { phase: "opening"; tierKey: string }
  | { phase: "confirming"; checkoutId: string }
  | { phase: "confirmed"; tierName: string }
  | { phase: "pending"; checkoutId: string };

/** What the canvas shows: a creator designs against real-looking plans. */
const PREVIEW_PRICING: PublicPricing = {
  mode: "test",
  pricingPath: "/pricing",
  afterPurchasePath: "/dashboard",
  tiers: [
    { key: "free_member", name: "Free", rank: 0, currency: "USD", prices: { month: null, year: null, lifetime: null }, purchasable: { month: false, year: false, lifetime: false } },
    { key: "tier_1", name: "Silver", rank: 1, currency: "USD", prices: { month: 900, year: 9000, lifetime: null }, purchasable: { month: true, year: true, lifetime: false } },
    { key: "tier_2", name: "Gold", rank: 2, currency: "USD", prices: { month: 1900, year: 19000, lifetime: null }, purchasable: { month: true, year: true, lifetime: false } },
    { key: "vip", name: "VIP", rank: 3, currency: "USD", prices: { month: null, year: null, lifetime: 29900 }, purchasable: { month: false, year: false, lifetime: true } },
  ],
};

// ============================================================================
// HELPERS
// ============================================================================

function safePath(value: string): boolean {
  if (value === "" || !value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  return value.indexOf("\\") === -1;
}

/**
 * `?mf_country=IN` on the pricing page, for a creator testing another
 * country's prices and gateway. The API honours it only while the site is in
 * test mode, so it can never move a real buyer.
 */
function testCountry(): string | null {
  const value = readParam("mf_country");
  return value && /^[A-Za-z]{2}$/.test(value) ? value.toUpperCase() : null;
}

function apiHeaders(withBody: boolean): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (withBody) headers["Content-Type"] = "application/json";
  if (CONFIG.siteKey !== "") headers["X-MemberFrame-Site"] = CONFIG.siteKey;
  // A free ngrok tunnel answers a browser with its warning page, not the API,
  // unless the request asks it not to. Only sent to an ngrok address.
  if (CONFIG.apiBaseUrl.indexOf(".ngrok") !== -1) headers["ngrok-skip-browser-warning"] = "1";
  const country = testCountry();
  if (country) headers["X-MemberFrame-Test-Country"] = country;
  return headers;
}

/** The gateways' own checkout scripts, for opening checkout on this page. */
const LEMON_SCRIPT = "https://app.lemonsqueezy.com/js/lemon.js";
const RAZORPAY_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

/** Load a script once. Resolves false when it cannot load, and the caller falls back to a redirect. */
function loadScript(src: string): Promise<boolean> {
  if (typeof document === "undefined") return Promise.resolve(false);
  const existing = document.querySelector(`script[data-mf-src="${src}"]`) as HTMLScriptElement | null;
  if (existing?.dataset.mfLoaded === "true") return Promise.resolve(true);

  return new Promise((resolve) => {
    const script = existing ?? document.createElement("script");
    const timer = window.setTimeout(() => resolve(false), 8000);
    script.addEventListener("load", () => {
      window.clearTimeout(timer);
      script.dataset.mfLoaded = "true";
      resolve(true);
    });
    script.addEventListener("error", () => {
      window.clearTimeout(timer);
      resolve(false);
    });
    if (!existing) {
      script.src = src;
      script.async = true;
      script.dataset.mfSrc = src;
      document.head.appendChild(script);
    }
  });
}

/** What the API sends to open a checkout on this page instead of leaving it. */
type CheckoutEmbed =
  | { kind: "lemonsqueezy" }
  | {
      kind: "razorpay";
      key: string;
      orderId?: string;
      subscriptionId?: string;
      name: string;
      description: string;
      prefill: { email: string; name: string };
    };

interface LemonSqueezyGlobal {
  Setup(options: { eventHandler: (event: { event?: string }) => void }): void;
  Url: { Open(url: string): void; Close?(): void };
}

type RazorpayConstructor = new (options: Record<string, unknown>) => { open(): void };

/*
  Decimal places per currency, so an amount in minor units reads right: 1500
  is 1,500 yen but 15.00 dollars. A copy of the exponents in the plugin's
  utils/currencies.ts, because this file may import nothing from it; a test
  holds the two lists equal.
*/
const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV",
  "XAF", "XOF", "XPF",
]);
const THREE_DECIMAL_CURRENCIES = new Set(["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"]);

function currencyExponent(currency: string): number {
  const code = currency.toUpperCase();
  return ZERO_DECIMAL_CURRENCIES.has(code) ? 0 : THREE_DECIMAL_CURRENCIES.has(code) ? 3 : 2;
}

function formatPrice(amountMinor: number, currency: string): string {
  const exponent = currencyExponent(currency);
  const amount = amountMinor / 10 ** exponent;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      // Whole amounts read cleaner on a pricing card: $19, not $19.00.
      minimumFractionDigits: Number.isInteger(amount) ? 0 : exponent,
      maximumFractionDigits: exponent,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

/** The biggest yearly saving across tiers, as a whole percent, or 0. */
function yearlySaving(tiers: ReadonlyArray<PublicTier>): number {
  let best = 0;
  for (const tier of tiers) {
    const month = tier.prices.month;
    const year = tier.prices.year;
    if (!month || !year) continue;
    const saving = Math.round((1 - year / (month * 12)) * 100);
    if (saving > best) best = saving;
  }
  return best;
}

function featuresFor(tier: PublicTier, rows: ReadonlyArray<FeatureRow>): string[] {
  const match = rows.find((row) => {
    const name = (row.tier ?? "").trim().toLowerCase();
    return name !== "" && (name === tier.name.toLowerCase() || name === tier.key.toLowerCase());
  });
  return (match?.lines ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .slice(0, 12);
}

function readParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

/** Strip the gateway's return parameters, so a refresh does not confirm twice. */
function clearReturnParams(): void {
  if (typeof window === "undefined" || !window.history?.replaceState) return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("mf_checkout");
    url.searchParams.delete("mf_checkout_cancelled");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // A sandboxed frame can refuse. The parameters are harmless if they stay.
  }
}

interface CheckoutIntent {
  tierKey: string;
  interval: PricingInterval;
  returnPath: string;
  ts: number;
}

function readIntent(): CheckoutIntent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(INTENT_KEY);
    if (!raw) return null;
    const intent = JSON.parse(raw) as CheckoutIntent;
    if (Date.now() - intent.ts > INTENT_TTL_MS) {
      window.sessionStorage.removeItem(INTENT_KEY);
      return null;
    }
    return intent;
  } catch {
    return null;
  }
}

function saveIntent(intent: CheckoutIntent | null): void {
  if (typeof window === "undefined") return;
  try {
    if (intent) window.sessionStorage.setItem(INTENT_KEY, JSON.stringify(intent));
    else window.sessionStorage.removeItem(INTENT_KEY);
  } catch {
    // Blocked storage: the visitor picks the plan again after signing up.
  }
}

/** The member's tier changed: drop the shield's copy and tell every component on the page. */
function announcePurchase(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SESSION_CACHE_KEY);
    window.localStorage.setItem(HINT_KEY, "1");
  } catch {
    // Storage blocked. The shield checks the server instead.
  }
  window.dispatchEvent(new CustomEvent("memberframe:session-updated", { detail: { signedIn: true } }));
}

// ============================================================================
// STYLES
// ============================================================================

const cssContent = `
.mf-pricing {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
  height: 100%;
  min-height: min-content;
  overflow-y: auto;
  padding: var(--mf-pad, 24px);
  color: var(--mf-c-text);
  background: var(--mf-c-surface);
  border: var(--mf-border-width, 1px) solid var(--mf-c-border);
  border-radius: var(--mf-c-radius);
  box-shadow: var(--mf-c-shadow);
  font-size: calc(14px * var(--mf-text-scale, 1));
  line-height: 1.5;
}
.mf-pricing-head { text-align: center; margin-bottom: var(--mf-gap, 20px); }
/* Canvas only: says the plans are samples, so a creator never mistakes them for theirs. */
.mf-pricing-sample { display: block; margin: 0 auto 8px; color: var(--mf-c-muted); font-size: calc(11px * var(--mf-text-scale, 1)); }
.mf-pricing-title { margin: 0; font-size: calc(26px * var(--mf-text-scale, 1)); font-weight: 700; letter-spacing: -0.01em; }
.mf-pricing-sub { margin: 6px 0 0; color: var(--mf-c-muted); }
.mf-pricing-pill {
  display: inline-flex; align-items: center; gap: 6px; margin-bottom: 10px; padding: 3px 10px;
  border-radius: 999px; font-size: calc(12px * var(--mf-text-scale, 1)); font-weight: 600;
  background: color-mix(in srgb, var(--mf-c-accent) 14%, transparent); color: var(--mf-c-text);
}
.mf-pricing-switch {
  display: flex; justify-content: center; align-items: center; gap: 10px; margin: 0 auto var(--mf-gap, 20px);
}
.mf-pricing-switch-track {
  display: inline-flex; padding: 3px; border-radius: 999px; background: var(--mf-c-field); border: 1px solid var(--mf-c-border);
}
.mf-pricing-switch-option {
  appearance: none; border: 0; margin: 0; padding: 7px 16px; border-radius: 999px; background: transparent;
  color: var(--mf-c-muted); font: inherit; font-weight: 600; cursor: pointer;
}
.mf-pricing-switch-option.is-active { background: var(--mf-c-surface); color: var(--mf-c-text); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12); }
.mf-pricing-switch-option:focus-visible { outline: 2px solid var(--mf-c-accent); outline-offset: 2px; }
.mf-pricing-save { font-size: calc(12px * var(--mf-text-scale, 1)); font-weight: 600; color: var(--mf-c-accent); }
.mf-pricing-grid {
  display: grid; gap: var(--mf-gap, 16px);
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  align-items: stretch;
}
.mf-pricing-card {
  position: relative; display: flex; flex-direction: column; gap: 14px; padding: 20px;
  border: var(--mf-border-width, 1px) solid var(--mf-c-border);
  border-radius: max(0px, calc(var(--mf-c-radius) - 4px));
  background: var(--mf-c-surface);
}
.mf-pricing-card.is-highlight { border-color: var(--mf-c-accent); box-shadow: 0 0 0 1px var(--mf-c-accent); }
.mf-pricing-card.is-current { background: var(--mf-c-field); }
.mf-pricing-badge {
  position: absolute; top: -11px; left: 20px; padding: 2px 10px; border-radius: 999px;
  background: var(--mf-c-accent); color: var(--mf-c-on-accent);
  font-size: calc(11px * var(--mf-text-scale, 1)); font-weight: 700;
}
.mf-pricing-name { margin: 0; font-size: calc(16px * var(--mf-text-scale, 1)); font-weight: 700; }
.mf-pricing-price { display: flex; align-items: baseline; gap: 4px; margin: 0; }
.mf-pricing-amount { font-size: calc(32px * var(--mf-text-scale, 1)); font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; }
.mf-pricing-period { color: var(--mf-c-muted); }
.mf-pricing-features { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; flex: 1 1 auto; }
.mf-pricing-feature { display: flex; gap: 8px; align-items: flex-start; color: var(--mf-c-muted); }
.mf-pricing-feature svg { flex: 0 0 16px; width: 16px; height: 16px; margin-top: 2px; color: var(--mf-c-accent); stroke: currentColor; }
.mf-pricing-button {
  appearance: none; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; margin: 0; padding: 11px 16px; border: 1px solid var(--mf-c-border);
  border-radius: max(0px, calc(var(--mf-c-radius) - 6px)); background: transparent; color: var(--mf-c-text);
  font: inherit; font-weight: 600; cursor: pointer;
}
.mf-pricing-button.is-primary { background: var(--mf-c-accent); border-color: var(--mf-c-accent); color: var(--mf-c-on-accent); }
.mf-pricing-button:hover:not(:disabled) { filter: brightness(1.06); }
.mf-pricing-button:disabled { opacity: 0.55; cursor: default; }
.mf-pricing-button:focus-visible { outline: 2px solid var(--mf-c-accent); outline-offset: 2px; }
.mf-pricing-button svg { width: 16px; height: 16px; stroke: currentColor; }
.mf-pricing-once {
  appearance: none; border: 0; margin: 0; padding: 0; background: transparent; color: var(--mf-c-muted);
  font: inherit; font-size: calc(13px * var(--mf-text-scale, 1)); text-decoration: underline; cursor: pointer; align-self: center;
}
.mf-pricing-once:disabled { opacity: 0.55; cursor: default; }
.mf-pricing-notice {
  margin: 0 0 var(--mf-gap, 16px); padding: 10px 12px; border-radius: max(0px, calc(var(--mf-c-radius) - 6px));
  background: var(--mf-c-field); text-align: center;
}
.mf-pricing-notice.is-error { color: var(--mf-c-danger); }
.mf-pricing-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
  min-height: 160px; text-align: center; color: var(--mf-c-muted);
}
.mf-pricing-state svg { width: 28px; height: 28px; color: var(--mf-c-accent); stroke: currentColor; }
.mf-pricing-spin { animation: mf-pricing-spin 0.9s linear infinite; }
@keyframes mf-pricing-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .mf-pricing-spin { animation: none; } }
`;

// ============================================================================
// COMPONENT
// ============================================================================

interface PricingDisplayProps {
  features?: FeatureRow[];
}

/**
 * Fixed size by default, so the frame the creator draws is the table they get.
 * Cards wrap to fit the width; the table scrolls if the frame is too short.
 *
 * @framerIntrinsicWidth 960
 * @framerIntrinsicHeight 600
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
export default function MemberPricing(
  props: Partial<PricingConfig> & MfAppearanceProps & PricingDisplayProps
): React.ReactElement {
  const config: PricingConfig = { ...CONFIG, ...props };
  const { theme = "light", colors, typography, layout, spacing, labels } = props;
  const features = Array.isArray(props.features) ? props.features : DEFAULT_FEATURES;
  const t = (key: string, values?: Record<string, string | number>) => {
    const text = mfLabel(labels, PRICING_LABELS, key);
    return values ? mfFill(text, values) : text;
  };

  const rawId = useId();
  const scope = useMemo(() => `mfp${rawId.replace(/[^a-zA-Z0-9]/g, "")}`, [rawId]);
  const license = useMfLicense(CONFIG.apiBaseUrl, CONFIG.siteKey);
  const onCanvas = RenderTarget.current() === RenderTarget.canvas;
  const base = (config.apiBaseUrl || ENV_API_BASE_URL || "").replace(/\/+$/, "");

  const [load, setLoad] = useState<LoadState>(() =>
    onCanvas ? { phase: "ready", pricing: PREVIEW_PRICING } : { phase: "loading" }
  );
  const [viewer, setViewer] = useState<Viewer>(() => (onCanvas ? { kind: "guest" } : { kind: "unknown" }));
  const [interval, setBillingInterval] = useState<"month" | "year">(config.defaultInterval === "year" ? "year" : "month");
  const [flow, setFlow] = useState<Flow>({ phase: "idle", message: null, tone: "info" });
  const resumed = useRef(false);
  /** A paid member's first press on another plan asks; the second switches. */
  const [pendingSwitch, setPendingSwitch] = useState<string | null>(null);

  // Keep the switch on the creator's choice while they edit it on the canvas.
  useEffect(() => {
    setBillingInterval(config.defaultInterval === "year" ? "year" : "month");
  }, [config.defaultInterval]);

  // ------------------------------------------------------------------------
  // Load the plans and who is looking
  // ------------------------------------------------------------------------

  // On the canvas: the site's real plans once they arrive, the samples until
  // then, and the samples for good if the site has none or is not connected.
  useEffect(() => {
    if (!onCanvas) return;
    let active = true;
    void mfCanvasPreview(base, CONFIG.siteKey).then((data) => {
      const pricing = data ? (data["pricing"] as PublicPricing | undefined) : undefined;
      if (active && pricing && Array.isArray(pricing.tiers) && pricing.tiers.length > 0) {
        setLoad({ phase: "ready", pricing });
      }
    });
    return () => {
      active = false;
    };
  }, [base, onCanvas]);

  useEffect(() => {
    if (onCanvas) return;
    if (base === "" || CONFIG.siteKey === "") {
      setLoad({ phase: "misconfigured" });
      return;
    }

    let active = true;

    void (async () => {
      try {
        const [pricingResponse, sessionResponse] = await Promise.all([
          fetch(`${base}${PRICING_PATH}`, { credentials: "include", headers: apiHeaders(false) }),
          fetch(`${base}${SESSION_PATH}`, { method: "POST", credentials: "include", headers: apiHeaders(true), body: "{}" }),
        ]);
        if (!active) return;

        if (!pricingResponse.ok) {
          setLoad({ phase: "failed" });
        } else {
          setLoad({ phase: "ready", pricing: (await pricingResponse.json()) as PublicPricing });
        }

        if (sessionResponse.ok) {
          const body = (await sessionResponse.json()) as { member?: { activeTier?: string } };
          setViewer(body.member?.activeTier ? { kind: "member", activeTier: body.member.activeTier } : { kind: "guest" });
        } else {
          setViewer({ kind: "guest" });
        }
      } catch {
        if (active) setLoad({ phase: "failed" });
      }
    })();

    return () => {
      active = false;
    };
  }, [base, onCanvas]);

  // ------------------------------------------------------------------------
  // Back from the gateway
  // ------------------------------------------------------------------------

  /** The tier is the member's now: say so, tell the page, go to the After purchase page. */
  const finishPurchase = useCallback(
    (tierName: string) => {
      announcePurchase();
      setFlow({ phase: "confirmed", tierName });
      const after = load.phase === "ready" ? load.pricing.afterPurchasePath : "";
      window.setTimeout(() => {
        if (safePath(after) && after !== window.location.pathname) window.location.assign(after);
        else window.location.reload();
      }, 1500);
    },
    [load]
  );

  const confirm = useCallback(
    async (checkoutId: string) => {
      setFlow({ phase: "confirming", checkoutId });
      const started = Date.now();

      while (Date.now() - started < CONFIRM_TIMEOUT_MS) {
        try {
          const response = await fetch(`${base}${STATUS_PATH}${encodeURIComponent(checkoutId)}`, {
            credentials: "include",
            headers: apiHeaders(false),
          });
          if (response.ok) {
            const status = (await response.json()) as { state?: string; tierName?: string };
            if (status.state === "complete") {
              finishPurchase(status.tierName ?? "");
              return;
            }
            if (status.state === "failed" || status.state === "expired") {
              setFlow({ phase: "idle", message: t("error"), tone: "error" });
              return;
            }
          }
        } catch {
          // A dropped request: keep polling until the deadline.
        }
        await new Promise((resolve) => window.setTimeout(resolve, CONFIRM_POLL_MS));
      }

      setFlow({ phase: "pending", checkoutId });
    },
    // `t` reads the labels prop; the copy is read when each message is set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, finishPurchase]
  );

  /**
   * Open the gateway's checkout on this page. Lemon Squeezy shows an overlay
   * through lemon.js; Razorpay opens Checkout with the UPI QR. Both confirm
   * through the same status poll as a redirect. False when the script cannot
   * load, and the caller sends the buyer to the hosted page instead.
   */
  const openEmbedded = useCallback(
    async (embed: CheckoutEmbed, url: string, checkoutId: string): Promise<boolean> => {
      const host = window as unknown as {
        createLemonSqueezy?: () => void;
        LemonSqueezy?: LemonSqueezyGlobal;
        Razorpay?: RazorpayConstructor;
      };

      if (embed.kind === "lemonsqueezy") {
        if (!(await loadScript(LEMON_SCRIPT))) return false;
        host.createLemonSqueezy?.();
        const lemon = host.LemonSqueezy;
        if (!lemon?.Url?.Open) return false;
        lemon.Setup({
          eventHandler: (event) => {
            if (event?.event === "Checkout.Success") {
              lemon.Url.Close?.();
              void confirm(checkoutId);
            }
          },
        });
        lemon.Url.Open(url);
        return true;
      }

      if (!(await loadScript(RAZORPAY_SCRIPT)) || !host.Razorpay) return false;
      const accent = /^#[0-9a-fA-F]{6}$/.test(config.accentColor) ? config.accentColor : undefined;
      new host.Razorpay({
        key: embed.key,
        ...(embed.orderId ? { order_id: embed.orderId } : {}),
        ...(embed.subscriptionId ? { subscription_id: embed.subscriptionId } : {}),
        name: embed.name,
        description: embed.description,
        prefill: embed.prefill,
        ...(accent ? { theme: { color: accent } } : {}),
        handler: () => void confirm(checkoutId),
        modal: { ondismiss: () => setFlow({ phase: "idle", message: t("closed"), tone: "info" }) },
      }).open();
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.accentColor, confirm]
  );

  useEffect(() => {
    if (onCanvas || load.phase !== "ready") return;

    const checkoutId = readParam("mf_checkout");
    if (checkoutId && flow.phase === "idle") {
      clearReturnParams();
      saveIntent(null);
      void confirm(checkoutId);
      return;
    }

    if (readParam("mf_checkout_cancelled")) {
      clearReturnParams();
      saveIntent(null);
      setFlow({ phase: "idle", message: t("cancelled"), tone: "info" });
    }
    // Runs once the plans are loaded; `confirm` and `flow` are read, not watched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load.phase, onCanvas]);

  // ------------------------------------------------------------------------
  // Buying
  // ------------------------------------------------------------------------

  const startCheckout = useCallback(
    async (tierKey: string, chosen: PricingInterval) => {
      if (onCanvas) return;
      const returnPath = typeof window !== "undefined" ? window.location.pathname : "/";

      if (viewer.kind !== "member") {
        // Keep the choice through sign up. MemberAuth sends the visitor back
        // here afterwards, and the effect below starts the checkout.
        saveIntent({ tierKey, interval: chosen, returnPath, ts: Date.now() });
        if (safePath(config.signupPath)) window.location.assign(config.signupPath);
        return;
      }

      saveIntent(null);
      setFlow({ phase: "opening", tierKey });

      try {
        const response = await fetch(`${base}${CHECKOUT_PATH}`, {
          method: "POST",
          credentials: "include",
          headers: apiHeaders(true),
          body: JSON.stringify({ tierKey, interval: chosen, returnPath }),
        });

        if (response.ok) {
          const body = (await response.json()) as {
            kind?: string;
            url?: string;
            checkoutId?: string;
            tierName?: string;
            embed?: CheckoutEmbed | null;
          };

          // Switched in place by the gateway, prorated: no checkout page at all.
          if (body.kind === "changed") {
            finishPurchase(body.tierName ?? "");
            return;
          }

          if (body.url && /^https:\/\//.test(body.url)) {
            if (body.embed && body.checkoutId && (await openEmbedded(body.embed, body.url, body.checkoutId))) {
              setFlow({ phase: "idle", message: null, tone: "info" });
              return;
            }
            window.location.assign(body.url);
            return;
          }
        }

        if (response.status === 401) {
          saveIntent({ tierKey, interval: chosen, returnPath, ts: Date.now() });
          if (safePath(config.signupPath)) window.location.assign(config.signupPath);
          return;
        }

        const payload = (await response.json().catch(() => ({}))) as { reason?: string };
        const message =
          payload.reason === "no_gateway"
            ? t("noGateway")
            : payload.reason === "already_subscribed"
              ? t("already")
              : t("error");
        setFlow({ phase: "idle", message, tone: "error" });
      } catch {
        setFlow({ phase: "idle", message: t("error"), tone: "error" });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, config.signupPath, finishPurchase, onCanvas, openEmbedded, viewer.kind]
  );

  // Back from sign up with a plan already chosen: carry on to checkout.
  useEffect(() => {
    if (onCanvas || resumed.current || viewer.kind !== "member" || load.phase !== "ready") return;
    if (readParam("mf_checkout")) return;
    const intent = readIntent();
    if (!intent || intent.returnPath !== window.location.pathname) return;
    resumed.current = true;
    void startCheckout(intent.tierKey, intent.interval);
  }, [load.phase, onCanvas, startCheckout, viewer.kind]);

  // ------------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------------

  const scopedVars =
    `[data-mf-pricing="${scope}"] { ` +
    mfAppearanceVars({
      accent: config.accentColor,
      radius: config.borderRadius,
      radiusMax: 40,
      shadowByDefault: false,
      colors,
      typography,
      layout,
      spacing,
    }) +
    " }";
  const rootClass = `mf-pricing ${mfThemeClass(theme)}`;
  const style = (
    <>
      <style>{mfThemeCss(".mf-pricing")}</style>
      <style>{cssContent}</style>
      <style>{scopedVars}</style>
    </>
  );

  const shell = (body: React.ReactNode) => (
    <div className={rootClass} data-mf-pricing={scope}>
      {style}
      {body}
      <MfLicenseLayer license={license} />
    </div>
  );

  if (load.phase === "misconfigured") {
    return shell(
      <div className="mf-pricing-state">
        <ShieldCheck aria-hidden={true} />
        <p>Connect this project in the MemberFrame plugin, then add this component again.</p>
      </div>
    );
  }

  if (load.phase === "loading") {
    return shell(
      <div className="mf-pricing-state" role="status">
        <Loader2 className="mf-pricing-spin" aria-hidden={true} />
        <p>{t("loading")}</p>
      </div>
    );
  }

  if (load.phase === "failed") {
    return shell(
      <div className="mf-pricing-state" role="alert">
        <p>{t("failed")}</p>
      </div>
    );
  }

  if (flow.phase === "confirming" || flow.phase === "confirmed" || flow.phase === "pending") {
    return shell(
      <div className="mf-pricing-state" role="status" aria-live="polite">
        {flow.phase === "confirmed" ? (
          <Check aria-hidden={true} />
        ) : (
          <Loader2 className={flow.phase === "confirming" ? "mf-pricing-spin" : undefined} aria-hidden={true} />
        )}
        <p>
          {flow.phase === "confirming"
            ? t("confirming")
            : flow.phase === "confirmed"
              ? t("confirmed", { tier: flow.tierName })
              : t("pending")}
        </p>
        {flow.phase === "pending" ? (
          <button type="button" className="mf-pricing-button" onClick={() => void confirm(flow.checkoutId)}>
            {t("checkAgain")}
          </button>
        ) : null}
      </div>
    );
  }

  const { pricing } = load;
  const ladder = pricing.tiers;
  const heldRank =
    viewer.kind === "member" ? ladder.find((tier) => tier.key === viewer.activeTier)?.rank ?? -1 : -1;
  const hasSwitch = ladder.some((tier) => tier.prices.month !== null && tier.prices.year !== null);
  const saving = yearlySaving(ladder);
  const highlight = config.highlightTier.trim().toLowerCase();
  const busyTier = flow.phase === "opening" ? flow.tierKey : null;
  // On a paid tier now, so another plan is a switch. Free tiers have no price.
  const heldTier = viewer.kind === "member" ? ladder.find((tier) => tier.key === viewer.activeTier) : undefined;
  const onPaidPlan =
    heldTier !== undefined &&
    (heldTier.prices.month !== null || heldTier.prices.year !== null || heldTier.prices.lifetime !== null);

  const cards = ladder
    .map((tier) => {
      const recurring = tier.prices[interval] ?? (hasSwitch ? null : tier.prices.month ?? tier.prices.year);
      const recurringInterval: PricingInterval | null =
        tier.prices[interval] !== null ? interval : recurring === null ? null : tier.prices.month !== null ? "month" : "year";
      const lifetime = config.showLifetime ? tier.prices.lifetime : null;
      const free = recurring === null && tier.prices.lifetime === null;

      if (free && !config.showFreeTier) return null;
      if (!free && recurring === null && lifetime === null) return null;

      return { tier, recurring, recurringInterval, lifetime, free };
    })
    .filter((card): card is NonNullable<typeof card> => card !== null);

  const buttonFor = (tier: PublicTier, chosen: PricingInterval | null, free: boolean, highlighted: boolean) => {
    const isCurrent = viewer.kind === "member" && viewer.activeTier === tier.key;
    if (isCurrent) {
      return (
        <button type="button" className="mf-pricing-button" disabled>
          <Check aria-hidden={true} />
          {t("current")}
        </button>
      );
    }

    if (free) {
      return (
        <button
          type="button"
          className={`mf-pricing-button${highlighted ? " is-primary" : ""}`}
          disabled={viewer.kind === "member" || onCanvas}
          onClick={() => {
            if (safePath(config.signupPath)) window.location.assign(config.signupPath);
          }}
        >
          {t("getStarted")}
        </button>
      );
    }

    if (chosen === null) return null;
    const sellable = onCanvas || tier.purchasable[chosen];
    const label = !sellable
      ? t("unavailable")
      : heldRank >= 0 && viewer.kind === "member"
        ? tier.rank > heldRank
          ? t("upgrade", { tier: tier.name })
          : t("switchPlan", { tier: tier.name })
        : t("choose", { tier: tier.name });

    // A member already paying is switching plans: the first press asks, so
    // nobody is charged by a stray click.
    const switchId = `${tier.key}:${chosen}`;
    const switching = onPaidPlan && pendingSwitch === switchId;

    return (
      <button
        type="button"
        className={`mf-pricing-button${highlighted || tier.rank > heldRank || switching ? " is-primary" : ""}`}
        disabled={!sellable || busyTier !== null}
        onClick={() => {
          if (onPaidPlan && !switching) {
            setPendingSwitch(switchId);
            return;
          }
          setPendingSwitch(null);
          void startCheckout(tier.key, chosen);
        }}
      >
        {busyTier === tier.key ? <Loader2 className="mf-pricing-spin" aria-hidden={true} /> : null}
        {busyTier === tier.key ? t("opening") : switching ? t("confirmSwitch", { tier: tier.name }) : label}
      </button>
    );
  };

  return shell(
    <>
      <div className="mf-pricing-head">
        {onCanvas && pricing === PREVIEW_PRICING ? (
          <span className="mf-pricing-sample">
            Sample plans. Your own appear here when this project is connected and the MemberFrame API is reachable.
          </span>
        ) : null}
        {pricing.mode === "test" ? (
          <span className="mf-pricing-pill">
            {t("testMode")}
          </span>
        ) : null}
        {config.headline ? <h2 className="mf-pricing-title">{config.headline}</h2> : null}
        {config.subheadline ? <p className="mf-pricing-sub">{config.subheadline}</p> : null}
      </div>

      {hasSwitch ? (
        <div className="mf-pricing-switch">
          <div className="mf-pricing-switch-track" role="radiogroup" aria-label={`${t("monthly")} or ${t("yearly")}`}>
            {(["month", "year"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={interval === option}
                className={`mf-pricing-switch-option${interval === option ? " is-active" : ""}`}
                onClick={() => setBillingInterval(option)}
              >
                {option === "month" ? t("monthly") : t("yearly")}
              </button>
            ))}
          </div>
          {saving > 0 ? <span className="mf-pricing-save">{t("save", { percent: saving })}</span> : null}
        </div>
      ) : null}

      {pendingSwitch ? <p className="mf-pricing-notice">{t("switchNote")}</p> : null}

      {flow.phase === "idle" && flow.message ? (
        <p className={`mf-pricing-notice${flow.tone === "error" ? " is-error" : ""}`} role={flow.tone === "error" ? "alert" : "status"}>
          {flow.message}
        </p>
      ) : null}

      <div className="mf-pricing-grid">
        {cards.map(({ tier, recurring, recurringInterval, lifetime, free }) => {
          const highlighted =
            highlight !== "" && (tier.name.toLowerCase() === highlight || tier.key.toLowerCase() === highlight);
          const current = viewer.kind === "member" && viewer.activeTier === tier.key;
          const lines = featuresFor(tier, features);
          const lifetimeOnly = recurring === null && lifetime !== null;

          return (
            <div
              key={tier.key}
              className={`mf-pricing-card${highlighted ? " is-highlight" : ""}${current ? " is-current" : ""}`}
            >
              {highlighted ? <span className="mf-pricing-badge">{t("mostPopular")}</span> : null}
              <h3 className="mf-pricing-name">{tier.name}</h3>

              <p className="mf-pricing-price">
                {free ? (
                  <span className="mf-pricing-amount">{t("free")}</span>
                ) : lifetimeOnly ? (
                  <>
                    <span className="mf-pricing-amount">{formatPrice(lifetime!, tier.currency)}</span>
                    <span className="mf-pricing-period">{t("once")}</span>
                  </>
                ) : (
                  <>
                    <span className="mf-pricing-amount">{formatPrice(recurring!, tier.currency)}</span>
                    <span className="mf-pricing-period">
                      {recurringInterval === "year" ? t("perYear") : t("perMonth")}
                    </span>
                  </>
                )}
              </p>

              {lines.length > 0 ? (
                <ul className="mf-pricing-features">
                  {lines.map((line, index) => (
                    <li key={index} className="mf-pricing-feature">
                      <Check aria-hidden={true} />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mf-pricing-features" />
              )}

              {buttonFor(tier, free ? null : lifetimeOnly ? "lifetime" : recurringInterval, free, highlighted)}

              {!free && !lifetimeOnly && lifetime !== null && !current ? (
                <button
                  type="button"
                  className="mf-pricing-once"
                  disabled={busyTier !== null || !(onCanvas || tier.purchasable.lifetime)}
                  onClick={() => void startCheckout(tier.key, "lifetime")}
                >
                  {t("orOnce", { price: formatPrice(lifetime, tier.currency) })}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ============================================================================
// PROPERTY CONTROLS
// ============================================================================
// `apiBaseUrl` and `siteKey` are absent, as on every component: they belong to
// the connection and the generator bakes them in. Prices are absent too: they
// are the tiers' own, edited in the plugin's Manage, Tiers view and read live.

addPropertyControls(MemberPricing, {
  headline: {
    type: ControlType.String,
    title: "Headline",
    defaultValue: CONFIG.headline,
  },
  subheadline: {
    type: ControlType.String,
    title: "Subheadline",
    defaultValue: CONFIG.subheadline,
    displayTextArea: true,
  },

  /* ---- Plans ---- */

  defaultInterval: {
    type: ControlType.Enum,
    title: "Starts On",
    options: ["month", "year"],
    optionTitles: ["Monthly", "Yearly"],
    displaySegmentedControl: true,
    defaultValue: CONFIG.defaultInterval,
  },
  showLifetime: {
    type: ControlType.Boolean,
    title: "One Time Prices",
    defaultValue: CONFIG.showLifetime,
  },
  showFreeTier: {
    type: ControlType.Boolean,
    title: "Free Tier Card",
    defaultValue: CONFIG.showFreeTier,
  },
  highlightTier: {
    type: ControlType.String,
    title: "Highlight Tier",
    placeholder: "Gold",
    defaultValue: CONFIG.highlightTier,
  },
  features: {
    type: ControlType.Array,
    title: "Features",
    maxCount: 12,
    control: {
      type: ControlType.Object,
      controls: {
        tier: { type: ControlType.String, title: "Tier", placeholder: "Gold" },
        lines: { type: ControlType.String, title: "Lines", displayTextArea: true, placeholder: "One feature per line" },
      },
    },
    defaultValue: DEFAULT_FEATURES,
  },

  /* ---- Navigation ---- */

  signupPath: {
    type: ControlType.String,
    title: "Sign Up Page",
    defaultValue: CONFIG.signupPath,
  },

  /* ---- Style ---- */

  accentColor: {
    type: ControlType.Color,
    title: "Accent Color",
    defaultValue: CONFIG.accentColor,
  },
  borderRadius: {
    type: ControlType.Number,
    title: "Corner Radius",
    defaultValue: CONFIG.borderRadius,
    min: 0,
    max: 40,
    unit: "px",
  },

  /* ---- Shared appearance: Theme, Colors, Typography, Layout, then Labels ---- */

  ...mfAppearanceControls({ padding: 24, gap: 16, shadow: false }),
  labels: mfLabelControls(PRICING_LABELS),
});
