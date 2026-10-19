/**
 * `<MeteredPaywall>`, the soft paywall. PRD features F07 and F08, feature plan
 * FP-07, tasks 3.4 to 3.6.
 *
 * Two kinds of soft paywall, one component:
 *
 *   - Metered: a visitor reads a set number of articles free each week or
 *     month. Each new article shows a counter pill; the one past the limit is
 *     cut after its opening paragraphs, frosted, and topped with a lock card.
 *     Re-opening an article already counted is free.
 *   - Read More: every visitor without access sees the opening paragraphs and
 *     the lock card, always. The classic teaser.
 *
 * Members on the plan chosen in Full Access For read everything, with no pill.
 *
 * ## Two ways to give it the article
 *
 *   - Slotted: the article is a frame connected to Article Body. Works on any
 *     page whose article can be a top-level frame, /about for example.
 *   - Linked: Article Body is left empty and the post body on the page gets
 *     the `PaywallArticle` code override (file MemberArticle). This is the
 *     way for a CMS post, whose body is bound to the current item inside the
 *     page and so can never be a slot's content. The component sits below the
 *     post, is styled in the sidebar like any component, and on the published
 *     site cuts and frosts the tagged body with CSS and shows its own card.
 *     The CSS is in the first render, so a locked post never flashes whole.
 *
 * ## Where the count lives
 *
 * A signed-out visitor is metered on their device, in obfuscated storage
 * (`mf_metered_v1:<site>`). Clearing it or opening a private window resets
 * the count: PRD F07 accepts that, as every metered publisher does. A signed-in
 * member is metered on the server (`POST /api/member/meter`), which is exact
 * across devices; the device's count for the current cycle is folded in the
 * first time, so signing in never hands out extra articles.
 *
 * ## SEO, F08
 *
 * The article stays in the page, whole, for every visitor. It is cut and
 * frosted with CSS, never removed, so a crawler and a person receive the same
 * markup and nothing is cloaked. The component adds Schema.org JSON-LD to the
 * head, `isAccessibleForFree: False` with `hasPart` pointing at
 * `.memberframe-gated-body`, which is how Google recognises a legitimate
 * paywall. A determined visitor can read the text in developer tools; content
 * that must stay secret belongs on a locked page or in a protected download.
 *
 * ## This file leaves the repository
 *
 * Written into the creator's project by the code generator and run on their
 * published site. It imports only `react`, `framer`, and icons Framer is known
 * to provide; the meter's rules and the schema helper are local copies, held
 * to their twins by tests.
 */

import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { addPropertyControls, ControlType, RenderTarget } from "framer";
import { Lock } from "lucide-react";

// ============================================================================
// LICENSING AND TRIAL STATE
// ============================================================================
// Rewritten in place by F19's `enforceLockState` regex patcher.
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
//
// The server is asked again every half minute and when the tab regains focus,
// so a trial that ends while a page is open locks it. Each instance also sends
// the seal the Builder gave it (27-instance-seal.md): a pasted copy, or one
// that never came from the Builder, is answered "copied" and shows an insert
// card instead. An instance from before seals sends none and is held to the
// license alone.

type MfLicense = "trial" | "active" | "locked" | "copied";

const MF_LICENSE_CACHE_MS = 60000;
const MF_LICENSE_RECHECK_MS = 30000;

function mfBakedLicense(): MfLicense {
  return IS_LOCKED ? "locked" : IS_TRIAL ? "trial" : "active";
}

function mfFetchLicense(apiBaseUrl: string, siteKey: string, seal: string | undefined): Promise<MfLicense | null> {
  if (typeof window === "undefined" || !apiBaseUrl || !siteKey) return Promise.resolve(null);
  const host = window as unknown as { __mfLicense?: Record<string, { at: number; answer: Promise<MfLicense | null> }> };
  const cache = (host.__mfLicense = host.__mfLicense || {});
  const base = String(apiBaseUrl).replace(/\/+$/, "");
  const key = base + "|" + siteKey + "|" + (seal === undefined ? "-" : seal);
  const hit = cache[key];
  if (hit && Date.now() - hit.at < MF_LICENSE_CACHE_MS) return hit.answer;
  const headers: Record<string, string> = {};
  if (base.indexOf(".ngrok") !== -1) headers["ngrok-skip-browser-warning"] = "1";
  const query = "?site=" + encodeURIComponent(siteKey) + (seal === undefined ? "" : "&seal=" + encodeURIComponent(seal));
  const answer = fetch(base + "/api/license" + query, { credentials: "omit", headers, cache: "no-store" })
    .then((response) => {
      // No such site on this server: built against another server, or the
      // site is gone. Lock it rather than trust the state baked into the file.
      // Only the server's own answer counts: a proxy's 404 page says nothing.
      if (response.status === 404) {
        return response
          .json()
          .then((body: { reason?: unknown } | null) => (body && body.reason === "site_not_found" ? { state: "copied" } : null))
          .catch(() => null);
      }
      return response.ok ? response.json() : null;
    })
    .then((data: { state?: unknown } | null): MfLicense | null => {
      const state = data ? data.state : null;
      if (state === "copied" || state === "foreign") return "copied";
      return state === "active" ? "active" : state === "trial" ? "trial" : state === "expired" ? "locked" : null;
    })
    .catch(() => null);
  cache[key] = { at: Date.now(), answer };
  return answer;
}

function useMfLicense(apiBaseUrl: string, siteKey: string, seal?: string): MfLicense {
  const [license, setLicense] = useState<MfLicense>(mfBakedLicense);
  useEffect(() => {
    let live = true;
    const check = () => {
      void mfFetchLicense(apiBaseUrl, siteKey, seal).then((answer) => {
        if (live && answer) setLicense(answer);
      });
    };
    check();
    if (typeof window === "undefined") return () => undefined;
    // Instances on one page share the cached answer, so this is one request a
    // minute per page, not one per component.
    const timer = window.setInterval(check, MF_LICENSE_RECHECK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [apiBaseUrl, siteKey, seal]);
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

function MfLockOverlay(props: { copied: boolean }): React.ReactElement {
  return (
    <div className="mf-lock" role="note" aria-label={props.copied ? "Insert from MemberFrame" : "Upgrade to Pro"}>
      <div className="mf-lock-card">
        <span className="mf-lock-icon" aria-hidden={true}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#708AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </span>
        <p className="mf-lock-title">{props.copied ? "Insert from MemberFrame" : "Upgrade to Pro"}</p>
        <p className="mf-lock-text">
          {props.copied
            ? "This component was copied, not inserted. Add it from the Builder in the MemberFrame plugin."
            : "This site's MemberFrame plan has ended. Upgrade in the MemberFrame plugin to restore it."}
        </p>
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
      {props.license === "trial" ? <MfWatermark /> : <MfLockOverlay copied={props.license === "copied"} />}
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

// @memberframe-schema-start
// ============================================================================
// SCHEMA.ORG PAYWALL MARKUP, PRD F08
// ============================================================================
// Held to its expected shape by `test/softPaywall.test.ts`. One script per page, added to the head on the
// published site only: the canvas is not a page Google reads.

const MF_GATED_BODY_CLASS = "memberframe-gated-body";
/** Added by the PaywallArticle override in MemberArticle.tsx. One per page. */
const MF_LINKED_ARTICLE_CLASS = "mf-paywall-article";
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

// @memberframe-meter-start
// ============================================================================
// THE METER, PRD F07
// ============================================================================
// The same rule as `decideMeter` in the API's `services/meterService.ts`, so a
// signed-out visitor and a signed-in member are counted alike. Pure, and run
// by `test/softPaywall.test.ts`.

interface MeterState {
  slugs: string[];
  cycleStart: number;
}

interface MeterAnswer {
  allowed: boolean;
  alreadyRead: boolean;
  count: number;
  limit: number;
  remaining: number;
  position: number | null;
  cycleStart: number;
  resetsAt: number;
}

const METER_DAY_MS = 86400000;
const METER_MAX_SLUGS = 500;
/** The most free articles a meter allows. The server holds the same cap. */
const METER_MAX_QUOTA = 100;
/** Above this the pill shows the count in words only: a row of 50 dots is noise. */
const METER_MAX_DOTS = 10;

function decideMeter(
  state: MeterState | null,
  slug: string,
  limit: number,
  periodDays: number,
  now: number,
  deviceReads: ReadonlyArray<string> = []
): { state: MeterState; answer: MeterAnswer } {
  const windowMs = periodDays * METER_DAY_MS;
  let current = state && now - state.cycleStart < windowMs && now >= state.cycleStart ? state : null;

  if (!current) {
    const carried = Array.from(new Set(deviceReads)).slice(0, limit);
    current = { slugs: carried, cycleStart: now };
  }

  const slugs = current.slugs.slice();
  let index = slugs.indexOf(slug);
  const alreadyRead = index !== -1;

  if (!alreadyRead && slugs.length < limit) {
    slugs.push(slug);
    index = slugs.length - 1;
  }

  const allowed = index !== -1;
  const next = { slugs: slugs.slice(-METER_MAX_SLUGS), cycleStart: current.cycleStart };

  return {
    state: next,
    answer: {
      allowed,
      alreadyRead,
      count: Math.min(next.slugs.length, limit),
      limit,
      remaining: Math.max(0, limit - next.slugs.length),
      position: allowed ? index + 1 : null,
      cycleStart: next.cycleStart,
      resetsAt: next.cycleStart + windowMs,
    },
  };
}

/** What the device keeps. */
interface DeviceMeter {
  deviceId: string;
  periodDays: number;
  slugs: string[];
  cycleStart: number;
}

/** FNV-1a, 32 bit, as hex. A tamper check, not a secret. */
function meterChecksum(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** XOR with a stream seeded from the site, so the stored value is not plain JSON a visitor can edit. */
function meterXor(text: string, seed: string): string {
  let state = parseInt(meterChecksum(seed), 16) || 1;
  let out = "";
  for (let index = 0; index < text.length; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    out += String.fromCharCode(text.charCodeAt(index) ^ (state & 0xff));
  }
  return out;
}

function encodeMeter(record: DeviceMeter, seed: string): string {
  const plain = JSON.stringify(record);
  // encodeURIComponent first so every character is one byte before the XOR.
  const bytes = meterXor(encodeURIComponent(plain), seed);
  return `v1.${btoa(bytes)}.${meterChecksum(plain + seed)}`;
}

/** The stored meter, or null when it is missing, edited, or from another site. */
function decodeMeter(raw: string | null, seed: string): DeviceMeter | null {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  try {
    const plain = decodeURIComponent(meterXor(atob(parts[1]), seed));
    if (meterChecksum(plain + seed) !== parts[2]) return null;
    const value = JSON.parse(plain) as DeviceMeter;
    if (
      typeof value.deviceId !== "string" ||
      typeof value.cycleStart !== "number" ||
      typeof value.periodDays !== "number" ||
      !Array.isArray(value.slugs)
    ) {
      return null;
    }
    value.slugs = value.slugs.filter((slug) => typeof slug === "string").slice(-METER_MAX_SLUGS);
    return value;
  } catch {
    return null;
  }
}

/** The slugs counted in the device's current cycle, for folding into a member's server meter. */
function currentDeviceReads(record: DeviceMeter | null, periodDays: number, now: number): string[] {
  if (!record || record.periodDays !== periodDays) return [];
  if (now - record.cycleStart >= periodDays * METER_DAY_MS || now < record.cycleStart) return [];
  return record.slugs.slice(0, METER_MAX_QUOTA);
}

/**
 * Which counter wording fits: "Article 2 of 3" or, with a limit of one, "Your
 * free article"; then "2 free articles remaining", "1 free article remaining",
 * or "Last free article". Label keys, so a creator's own copy still applies.
 */
function meterPillKeys(answer: MeterAnswer): { main: string; sub: string } {
  return {
    main: answer.limit === 1 ? "pillCountOne" : "pillCount",
    sub: answer.remaining === 0 ? "pillLast" : answer.remaining === 1 ? "pillRemainingOne" : "pillRemaining",
  };
}

/** An article's identity: the creator's Article ID, or the page path. */
function articleSlug(articleId: string, pathname: string): string {
  const source = articleId.trim() !== "" ? articleId.trim() : pathname.replace(/\/+$/, "") || "/";
  return source.replace(/[^A-Za-z0-9\-_./:]/g, "-").slice(0, 191) || "/";
}
// @memberframe-meter-end

/**
 * `useLayoutEffect` in the browser, `useEffect` while Framer pre-renders the
 * page on its server, where a layout effect cannot run and only warns.
 */
const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

// ============================================================================
// DATA CONTRACTS
// ============================================================================

type TierKey = "free_member" | "tier_1" | "tier_2" | "vip" | (string & {});
type RequiredTier = "anyone" | "signed_in" | TierKey;
type MemberStatus = "active" | "trialing" | "past_due" | "canceled";
/** Who reads without a meter: any paid plan, any signed-in member, or a tier and up. */
type UnlimitedTier = "any_paid" | "signed_in" | TierKey;
type PaywallMode = "metered" | "teaser";
type QuotaPeriod = "weekly" | "monthly";

interface MemberSessionData {
  memberId: string;
  email: string;
  name: string | null;
  activeTier: TierKey;
  status: MemberStatus;
  currentPeriodEnd: number;
  gracePeriodEndsAt: number;
  siteId: string;
}

interface TierLadderEntry {
  key: TierKey;
  rank: number;
  name: string;
}

const DEFAULT_SITE_TIERS: ReadonlyArray<TierLadderEntry> = [
  { key: "free_member", rank: 0, name: "Free" },
  { key: "tier_1", rank: 1, name: "Silver" },
  { key: "tier_2", rank: 2, name: "Gold" },
  { key: "vip", rank: 3, name: "VIP" },
];

interface PaywallConfig {
  freeQuotaCount: number;
  quotaPeriod: QuotaPeriod;
  blurIntensity: number;
  showCounterPill: boolean;
  ctaLabel: string;
  cardTitle: string;
  cardDescription: string;
  accentColor: string;
  borderRadius: number;
  apiBaseUrl: string;
  sessionTtlMs: number;
  /** Public. Identifies the tenant; the request's Origin is what authorizes. */
  siteKey: string;
  loginPath: string;
  pricingPath: string;
}

const ENV_API_BASE_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_APP_BASE_URL)) ||
  "";

// @memberframe-config-start
const CONFIG: PaywallConfig = {
  freeQuotaCount: 3,
  quotaPeriod: "monthly",
  blurIntensity: 8,
  showCounterPill: true,
  ctaLabel: "Subscribe to continue reading",
  cardTitle: "Enjoying this article?",
  cardDescription: "You have reached your free reading limit for this {period}.",
  accentColor: "#5271ff",
  borderRadius: 14,
  apiBaseUrl: ENV_API_BASE_URL,
  sessionTtlMs: 60000,
  siteKey: "",
  loginPath: "/login",
  pricingPath: "/pricing",
};
// @memberframe-config-end

/** Shared with MemberAuth, the Route Shield, and the other components. Change together. */
const HINT_KEY = `memberframe:signed-in:${CONFIG.siteKey}`;
const RETURN_KEY = `memberframe:return-to:${CONFIG.siteKey}`;
const METER_STORAGE_KEY = `mf_metered_v1:${CONFIG.siteKey}`;
const METER_SEED = `memberframe-meter:${CONFIG.siteKey}`;

const PERIOD_DAYS: Record<QuotaPeriod, number> = { weekly: 7, monthly: 30 };

// ============================================================================
// ENTITLEMENT
// ============================================================================
// `isEntitled` is the plugin's resolver, verbatim, held to it by
// `test/entitlementParity.test.ts`. `readsUnlimited` adds "any paid plan".

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

/**
 * "Any paid plan" is every tier above the site's lowest, which is the free
 * tier on every ladder MemberFrame creates. A member whose tier the ladder does
 * not know is not paid, which fails toward the meter rather than toward free.
 */
function readsUnlimited(
  session: MemberSessionData | null,
  unlimited: UnlimitedTier,
  tiers: ReadonlyArray<TierLadderEntry>
): boolean {
  if (unlimited !== "any_paid") return isEntitled(session, unlimited, tiers);
  if (!session || !isEntitled(session, "signed_in", tiers)) return false;
  const lowest = tiers.reduce((min, tier) => Math.min(min, tier.rank), Infinity);
  const held = tiers.find((tier) => tier.key === session.activeTier);
  return held !== undefined && held.rank > lowest;
}

// ============================================================================
// SESSION AND METER CALLS
// ============================================================================

type SessionResult =
  | { kind: "member"; session: MemberSessionData; tiers: ReadonlyArray<TierLadderEntry> }
  | { kind: "guest"; tiers: ReadonlyArray<TierLadderEntry> }
  | { kind: "unavailable" };

function readLadder(value: unknown): ReadonlyArray<TierLadderEntry> {
  if (!Array.isArray(value)) return DEFAULT_SITE_TIERS;
  const tiers = value.filter(
    (entry): entry is TierLadderEntry =>
      Boolean(entry) && typeof entry.key === "string" && typeof entry.rank === "number"
  );
  return tiers.length > 0 ? tiers : DEFAULT_SITE_TIERS;
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

/** One session request per page, however many paywalls it carries. */
let cachedSession: { at: number; value: Promise<SessionResult> } | null = null;

async function requestSession(): Promise<SessionResult> {
  try {
    const response = await fetch(`${CONFIG.apiBaseUrl}/api/member/session`, {
      credentials: "include",
      headers: apiHeaders(false),
    });
    const body = (await response.json().catch(() => ({}))) as { member?: MemberSessionData; tiers?: unknown };
    const tiers = readLadder(body.tiers);
    if (response.status === 401) return { kind: "guest", tiers };
    if (!response.ok || !body.member || typeof body.member.status !== "string") return { kind: "unavailable" };
    return { kind: "member", session: body.member, tiers };
  } catch {
    return { kind: "unavailable" };
  }
}

function loadSession(): Promise<SessionResult> {
  const now = Date.now();
  if (cachedSession && now - cachedSession.at < CONFIG.sessionTtlMs) return cachedSession.value;
  const value = requestSession();
  cachedSession = { at: now, value };
  return value;
}

/** The exact meter for a signed-in member. Null when it cannot be reached. */
async function serverMeter(
  slug: string,
  limit: number,
  period: QuotaPeriod,
  deviceReads: string[]
): Promise<MeterAnswer | null> {
  try {
    const response = await fetch(`${CONFIG.apiBaseUrl}/api/member/meter`, {
      method: "POST",
      credentials: "include",
      headers: apiHeaders(true),
      body: JSON.stringify({ slug, limit, period, deviceReads }),
    });
    if (!response.ok) return null;
    const answer = (await response.json()) as MeterAnswer;
    return typeof answer.allowed === "boolean" ? answer : null;
  } catch {
    return null;
  }
}

function readDevice(): DeviceMeter | null {
  try {
    return decodeMeter(window.localStorage.getItem(METER_STORAGE_KEY), METER_SEED);
  } catch {
    return null;
  }
}

function writeDevice(record: DeviceMeter): void {
  try {
    window.localStorage.setItem(METER_STORAGE_KEY, encodeMeter(record, METER_SEED));
  } catch {
    // Blocked storage meters nothing, which is the same as a private window.
  }
}

function randomDeviceId(): string {
  const bytes = new Uint8Array(12);
  try {
    window.crypto.getRandomValues(bytes);
  } catch {
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Count this article on the device and say whether it may be read. */
function deviceMeter(slug: string, limit: number, period: QuotaPeriod): MeterAnswer {
  const periodDays = PERIOD_DAYS[period];
  const stored = readDevice();
  const state = stored && stored.periodDays === periodDays ? { slugs: stored.slugs, cycleStart: stored.cycleStart } : null;
  const { state: next, answer } = decideMeter(state, slug, limit, periodDays, Date.now());
  writeDevice({ deviceId: stored?.deviceId ?? randomDeviceId(), periodDays, slugs: next.slugs, cycleStart: next.cycleStart });
  return answer;
}

function signedInHint(): boolean {
  try {
    return window.localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
}

function safePath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//") && value.indexOf("\\") === -1;
}

/** Remember this page, so signing in brings the reader back to the article. */
function rememberReturn(): void {
  try {
    const path = `${window.location.pathname}${window.location.search}`;
    if (safePath(path)) window.sessionStorage.setItem(RETURN_KEY, JSON.stringify({ path, ts: Date.now() }));
  } catch {
    // Without storage the reader lands on the site's after-sign-in page.
  }
}

// ============================================================================
// STYLES
// ============================================================================

const cssContent = `
.mf-meter {
  --mf-meter-blur: 8px;
  --mf-meter-cut: 320px;
  box-sizing: border-box;
  position: relative;
  width: 100%;
  min-width: 240px;
  color: var(--mf-c-text);
  font-size: calc(14px * var(--mf-text-scale, 1));
  line-height: 1.5;
}
/* On the canvas the frame always has a body to grab, even before an article is connected. */
.mf-meter.is-canvas { min-height: 120px; }
.mf-meter.is-linked { min-width: 0; }
.mf-meter.is-linked .mf-meter-card { margin-top: 0; }
.mf-meter.is-canvas.is-linked { display: flex; flex-direction: column; gap: 12px; }
.mf-meter-body { position: relative; width: 100%; }
.mf-meter-body.is-cut { max-height: var(--mf-meter-cut); overflow: hidden; }
.mf-meter-fade {
  position: absolute; left: 0; right: 0; bottom: 0; height: min(200px, 70%);
  pointer-events: none;
  background: linear-gradient(to bottom, transparent 0%, var(--mf-c-surface) 92%);
  backdrop-filter: blur(var(--mf-meter-blur));
  -webkit-backdrop-filter: blur(var(--mf-meter-blur));
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.85) 45%, rgba(0, 0, 0, 1) 100%);
  mask-image: linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.85) 45%, rgba(0, 0, 0, 1) 100%);
}
.mf-meter-card {
  box-sizing: border-box; position: relative; z-index: 2;
  display: flex; flex-direction: column; align-items: center; gap: var(--mf-gap, 10px);
  max-width: 420px; margin: -48px auto 0; padding: var(--mf-pad, 24px);
  text-align: center; color: var(--mf-c-text); background: var(--mf-c-surface);
  border: var(--mf-border-width, 1px) solid var(--mf-c-border); border-radius: var(--mf-c-radius);
  box-shadow: var(--mf-c-shadow);
}
.mf-meter-icon {
  display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 999px;
  color: var(--mf-c-accent); background: color-mix(in srgb, var(--mf-c-accent) 12%, transparent);
}
.mf-meter-icon svg { width: 18px; height: 18px; stroke: currentColor; }
.mf-meter-title { margin: 0; font-size: calc(17px * var(--mf-text-scale, 1)); font-weight: 600; line-height: 1.3; }
.mf-meter-text { margin: 0; color: var(--mf-c-muted); }
.mf-meter-cta {
  appearance: none; display: inline-flex; align-items: center; justify-content: center; margin-top: 4px;
  padding: 10px 20px; border: 0; border-radius: max(0px, calc(var(--mf-c-radius) * 0.6));
  background: var(--mf-c-accent); color: var(--mf-c-on-accent);
  font: inherit; font-weight: 600; cursor: pointer; text-decoration: none;
}
.mf-meter-cta:hover { filter: brightness(1.06); }
.mf-meter-cta:focus-visible, .mf-meter-link:focus-visible, .mf-meter-pill button:focus-visible, .mf-meter-pill a:focus-visible {
  outline: 2px solid var(--mf-c-accent); outline-offset: 2px;
}
.mf-meter-link {
  appearance: none; border: 0; padding: 0; margin: 0; background: transparent; color: var(--mf-c-muted);
  font: inherit; font-size: calc(13px * var(--mf-text-scale, 1)); text-decoration: underline; cursor: pointer;
}
.mf-meter-pill {
  position: fixed; left: 50%; bottom: 20px; z-index: 2147483000; transform: translateX(-50%);
  box-sizing: border-box; display: flex; align-items: center; gap: 12px; max-width: calc(100vw - 24px);
  padding: 8px 8px 8px 16px; border-radius: 999px;
  color: var(--mf-c-text); background: var(--mf-c-surface); border: 1px solid var(--mf-c-border);
  box-shadow: 0 10px 30px rgba(16, 24, 40, 0.18);
  font-size: calc(13px * var(--mf-text-scale, 1)); line-height: 1.35;
  animation: mf-meter-rise 0.28s ease-out;
}
.mf-meter-pill-text { display: flex; flex-direction: column; min-width: 0; }
.mf-meter-pill-main { font-weight: 600; }
.mf-meter-pill-sub { color: var(--mf-c-muted); font-size: calc(12px * var(--mf-text-scale, 1)); }
.mf-meter-dots { display: inline-flex; gap: 4px; flex: 0 0 auto; }
.mf-meter-dot { width: 7px; height: 7px; border-radius: 999px; background: var(--mf-c-border); }
.mf-meter-dot.is-used { background: var(--mf-c-accent); }
.mf-meter-pill a {
  flex: 0 0 auto; padding: 6px 12px; border-radius: 999px; background: var(--mf-c-accent); color: var(--mf-c-on-accent);
  font-weight: 600; text-decoration: none;
}
.mf-meter-close {
  appearance: none; flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; padding: 0; border: 0; border-radius: 999px; background: transparent; color: var(--mf-c-muted); cursor: pointer;
}
.mf-meter-close svg { width: 14px; height: 14px; }
@keyframes mf-meter-rise { from { opacity: 0; transform: translate(-50%, 12px); } to { opacity: 1; transform: translate(-50%, 0); } }
@media (prefers-reduced-motion: reduce) { .mf-meter-pill { animation: none; } }
.mf-meter-badge {
  position: absolute; top: 8px; left: 8px; z-index: 20; display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 999px; font-size: calc(11px * var(--mf-text-scale, 1)); font-weight: 600;
  color: var(--mf-c-on-accent); background: var(--mf-c-accent); box-shadow: var(--mf-c-shadow);
}
.mf-meter-badge svg { width: 11px; height: 11px; stroke: currentColor; }
.mf-meter-placeholder {
  box-sizing: border-box; display: flex; flex-direction: column; gap: 6px; padding: 16px;
  border: 1px dashed var(--mf-c-border); border-radius: 12px; background: var(--mf-c-surface); color: var(--mf-c-muted);
  font-size: calc(12px * var(--mf-text-scale, 1));
}
.mf-meter-placeholder strong { color: var(--mf-c-text); font-size: calc(13px * var(--mf-text-scale, 1)); }
`;

// ============================================================================
// COMPONENT
// ============================================================================

const METER_LABELS: Record<string, readonly [string, string]> = {
  pillCount: ["Counter", "Article {n} of {limit} free articles this {period}"],
  pillCountOne: ["Counter, one article", "Your free article this {period}"],
  pillRemaining: ["Articles left", "{remaining} free articles remaining"],
  pillRemainingOne: ["One article left", "1 free article remaining"],
  pillLast: ["Last article", "Last free article"],
  pillSubscribe: ["Counter button", "Subscribe"],
  pillClose: ["Close counter", "Close"],
  periodWeek: ["Week word", "week"],
  periodMonth: ["Month word", "month"],
  teaserTitle: ["Read More title", "Keep reading"],
  teaserText: ["Read More text", "Join to unlock the rest of this article."],
  upgradeTitle: ["Upgrade title", "Upgrade to keep reading"],
  upgradeText: ["Upgrade text", "Your plan does not include this article."],
  signInLink: ["Sign in link", "Already a member? Sign in"],
  checking: ["Checking", "Checking your access"],
};

/** The lock card's reason. */
type LockReason = "meter" | "teaser" | "upgrade";

type View =
  | { phase: "checking" }
  | { phase: "open"; meter: MeterAnswer | null }
  | { phase: "locked"; reason: LockReason; signedIn: boolean };

export interface MeteredPaywallProps extends MfAppearanceProps {
  /** `ControlType.ComponentInstance`. The article body being protected. */
  contentSlot?: React.ReactNode;
  mode?: PaywallMode;
  freeQuotaCount?: number;
  quotaPeriod?: QuotaPeriod;
  unlimitedTier?: UnlimitedTier;
  articleId?: string;
  previewParagraphs?: number;
  previewHeight?: number;
  blurIntensity?: number;
  showCounterPill?: boolean;
  ctaLabel?: string;
  cardTitle?: string;
  cardDescription?: string;
  showSignInLink?: boolean;
  pricingPath?: string;
  loginPath?: string;
  seoMarkup?: boolean;
  schemaType?: string;
  canvasPreview?: "open" | "locked";
  accentColor?: string;
  borderRadius?: number;
}

const BLUR_MIN = 2;
const BLUR_MAX = 20;

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden={true}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/** Set by the MemberFrame Builder on insert, never by hand (27-instance-seal.md). */
interface MfSealProps {
  mfSeal?: string;
}

/**
 * Fit height is the natural setting: the component is as tall as the article.
 * Fixed stays available for a teaser box of a set size.
 *
 * @framerIntrinsicWidth 640
 * @framerIntrinsicHeight 520
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
export default function MeteredPaywall(props: MeteredPaywallProps & MfSealProps) {
  const {
    contentSlot,
    mode = "metered",
    freeQuotaCount = CONFIG.freeQuotaCount,
    quotaPeriod = CONFIG.quotaPeriod,
    unlimitedTier = "any_paid",
    articleId = "",
    previewParagraphs = 2,
    previewHeight = 320,
    blurIntensity = CONFIG.blurIntensity,
    showCounterPill = CONFIG.showCounterPill,
    ctaLabel = CONFIG.ctaLabel,
    cardTitle = CONFIG.cardTitle,
    cardDescription = CONFIG.cardDescription,
    showSignInLink = true,
    pricingPath = CONFIG.pricingPath,
    loginPath = CONFIG.loginPath,
    seoMarkup = true,
    schemaType = "Article",
    canvasPreview = "open",
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
    mfFill(mfLabel(labels, METER_LABELS, key), values);

  const rawId = useId();
  const scope = useMemo(() => `mfm${rawId.replace(/[^a-zA-Z0-9]/g, "")}`, [rawId]);
  const license = useMfLicense(CONFIG.apiBaseUrl, CONFIG.siteKey, props.mfSeal);
  const onCanvas = useMemo(() => {
    const target = RenderTarget.current();
    return target === RenderTarget.canvas || target === RenderTarget.thumbnail;
  }, []);

  const hasArticle = React.Children.toArray(contentSlot).length > 0;
  // No slot: the article is a layer on the page tagged by PaywallArticle.
  const linked = !hasArticle;
  const limit = Math.round(mfNumber(freeQuotaCount, 1, METER_MAX_QUOTA, 3));
  const period: QuotaPeriod = quotaPeriod === "weekly" ? "weekly" : "monthly";
  const periodWord = t(period === "weekly" ? "periodWeek" : "periodMonth");
  const slug = useMemo(
    () => articleSlug(String(articleId ?? ""), typeof window === "undefined" ? "/" : window.location.pathname),
    [articleId]
  );

  const [view, setView] = useState<View>({ phase: "checking" });
  const [pillClosed, setPillClosed] = useState(false);
  const counted = useRef<string | null>(null);

  // ---- Decide, once per article and visitor ----
  useEffect(() => {
    if (onCanvas) return;
    let active = true;

    const settle = (next: View) => {
      if (active) setView(next);
    };
    const fromAnswer = (answer: MeterAnswer, signedIn: boolean): View =>
      answer.allowed ? { phase: "open", meter: answer } : { phase: "locked", reason: "meter", signedIn };

    async function decide(force: boolean) {
      const key = `${slug}|${mode}|${limit}|${period}|${unlimitedTier}`;
      if (!force && counted.current === key) return;
      counted.current = key;

      const hinted = signedInHint();
      let deviceAnswer: MeterAnswer | null = null;

      // A visitor with no sign-in hint is almost certainly signed out, so the
      // device decides at once and the article does not wait on the network.
      if (!hinted) {
        if (mode === "teaser") settle({ phase: "locked", reason: "teaser", signedIn: false });
        else {
          deviceAnswer = deviceMeter(slug, limit, period);
          settle(fromAnswer(deviceAnswer, false));
        }
      }

      const result = await loadSession();
      if (!active) return;

      if (result.kind === "member") {
        if (readsUnlimited(result.session, unlimitedTier, result.tiers)) {
          settle({ phase: "open", meter: null });
          return;
        }
        if (mode === "teaser") {
          settle({ phase: "locked", reason: "upgrade", signedIn: true });
          return;
        }
        const reads = currentDeviceReads(readDevice(), PERIOD_DAYS[period], Date.now());
        const answer = await serverMeter(slug, limit, period, reads);
        if (!active) return;
        if (answer) settle(fromAnswer(answer, true));
        else settle(fromAnswer(deviceAnswer ?? deviceMeter(slug, limit, period), true));
        return;
      }

      // Signed out, or the check failed: the device's count stands.
      if (hinted) {
        if (mode === "teaser") settle({ phase: "locked", reason: "teaser", signedIn: false });
        else settle(fromAnswer(deviceMeter(slug, limit, period), false));
      }
    }

    void decide(false);

    const onSession = () => {
      cachedSession = null;
      void decide(true);
    };
    window.addEventListener("memberframe:session-updated", onSession);
    return () => {
      active = false;
      window.removeEventListener("memberframe:session-updated", onSession);
    };
  }, [onCanvas, slug, mode, limit, period, unlimitedTier]);

  // ---- F08: the paywall markup, the same for every visitor ----
  useEffect(() => {
    if (onCanvas || !seoMarkup) return;
    mfInjectPaywallSchema(schemaType);
  }, [onCanvas, seoMarkup, schemaType]);

  const effective: View = onCanvas
    ? canvasPreview === "locked"
      ? { phase: "locked", reason: mode === "teaser" ? "teaser" : "meter", signedIn: false }
      : { phase: "open", meter: null }
    : view;
  const cut = effective.phase !== "open";

  // ---- Where the preview ends: after N paragraphs, or at the preview height ----
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [linkedArticle, setLinkedArticle] = useState<HTMLElement | null>(null);

  // Linked: the tagged layer nearest above this component, else the first one.
  // Framer renders the page in one pass, so it is there by the first effect.
  useBrowserLayoutEffect(() => {
    if (!linked || onCanvas) {
      setLinkedArticle(null);
      return;
    }
    const root = rootRef.current;
    const tagged = Array.from(document.querySelectorAll<HTMLElement>(`.${MF_LINKED_ARTICLE_CLASS}`));
    const above = root
      ? tagged.filter((element) => element.compareDocumentPosition(root) & Node.DOCUMENT_POSITION_FOLLOWING)
      : [];
    setLinkedArticle(above[above.length - 1] ?? tagged[0] ?? null);
  }, [linked, onCanvas]);

  /** The element holding the article text: the slot's wrapper, or the tagged layer. */
  const articleElement = (): HTMLElement | null => (linked ? linkedArticle : bodyRef.current);
  const [cutAt, setCutAt] = useState<number>(() => Math.round(mfNumber(previewHeight, 80, 2000, 320)));

  // Locked text is visible as a teaser but not reachable: `inert` keeps focus
  // and screen readers out of what the frost covers (F08), and the lock card
  // is the next thing they reach. Set on the node, which every React accepts.
  const locked = effective.phase === "locked";
  useBrowserLayoutEffect(() => {
    const body = articleElement();
    if (!body) return;
    if (locked) body.setAttribute("inert", "");
    else body.removeAttribute("inert");
  }, [locked, contentSlot, linkedArticle]);

  useBrowserLayoutEffect(() => {
    const fallback = Math.round(mfNumber(previewHeight, 80, 2000, 320));
    const body = articleElement();
    if (!cut || !body) {
      setCutAt(fallback);
      return;
    }
    const wanted = Math.round(mfNumber(previewParagraphs, 1, 20, 2));
    const paragraphs = body.querySelectorAll("p");
    const last = paragraphs[wanted - 1] as HTMLElement | undefined;
    if (!last || paragraphs.length <= wanted) {
      setCutAt(fallback);
      return;
    }
    const top = body.getBoundingClientRect().top;
    const bottom = last.getBoundingClientRect().bottom;
    // A little of the next paragraph shows under the frost, as a teaser should.
    setCutAt(Math.max(80, Math.round(bottom - top + 56)));
  }, [cut, previewParagraphs, previewHeight, contentSlot, linkedArticle]);

  const blur = Math.round(mfNumber(blurIntensity, BLUR_MIN, BLUR_MAX, CONFIG.blurIntensity));
  const scopedCss =
    `[data-mf-meter="${scope}"] { --mf-meter-blur: ${blur}px; --mf-meter-cut: ${cutAt}px; ` +
    mfAppearanceVars({
      accent: accentColor,
      radius: borderRadius,
      radiusMax: 32,
      shadowByDefault: true,
      colors,
      typography,
      layout,
      spacing,
    }) +
    " }";

  /*
    Linked and not open: cut the tagged layer at the preview, fade its last
    lines into whatever is behind it, and frost them. A mask rather than a
    colour, so it suits any page background without a setting. In the first
    render (phase "checking"), so a locked post is never shown whole.
  */
  const linkedCss =
    linked && !onCanvas && cut
      ? `.${MF_LINKED_ARTICLE_CLASS} { max-height: ${cutAt}px !important; overflow: hidden !important; position: relative !important; ` +
        `-webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 120px), transparent); ` +
        `mask-image: linear-gradient(to bottom, #000 calc(100% - 120px), transparent); } ` +
        `.${MF_LINKED_ARTICLE_CLASS}::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: min(200px, 70%); ` +
        `pointer-events: none; backdrop-filter: blur(${blur}px); -webkit-backdrop-filter: blur(${blur}px); ` +
        `-webkit-mask-image: linear-gradient(to bottom, transparent, #000); mask-image: linear-gradient(to bottom, transparent, #000); }`
      : "";

  const goPricing = () => {
    if (onCanvas) return;
    rememberReturn();
    const target = safePath(pricingPath) ? pricingPath : CONFIG.pricingPath;
    if (target && window.location.pathname !== target) window.location.assign(target);
  };

  const goSignIn = () => {
    if (onCanvas) return;
    rememberReturn();
    window.dispatchEvent(new CustomEvent("memberframe:open-auth", { detail: { reason: "paywall" } }));
    const target = safePath(loginPath) ? loginPath : CONFIG.loginPath;
    if (target && window.location.pathname !== target) window.location.assign(target);
  };

  function lockCard(reason: LockReason, signedIn: boolean) {
    const values = { period: periodWord, limit };
    const title = reason === "meter" ? mfFill(cardTitle, values) : reason === "upgrade" ? t("upgradeTitle") : t("teaserTitle");
    const text =
      reason === "meter" ? mfFill(cardDescription, values) : reason === "upgrade" ? t("upgradeText") : t("teaserText");
    return (
      <div className="mf-meter-card" role="region" aria-label={title}>
        <span className="mf-meter-icon">
          <Lock aria-hidden={true} />
        </span>
        <h3 className="mf-meter-title">{title}</h3>
        <p className="mf-meter-text">{text}</p>
        <button type="button" className="mf-meter-cta" onClick={goPricing}>
          {ctaLabel || CONFIG.ctaLabel}
        </button>
        {showSignInLink && !signedIn ? (
          <button type="button" className="mf-meter-link" onClick={goSignIn}>
            {t("signInLink")}
          </button>
        ) : null}
      </div>
    );
  }

  function pill(meter: MeterAnswer) {
    if (!showCounterPill || pillClosed || meter.position === null) return null;
    const values = { n: meter.position, limit: meter.limit, period: periodWord, remaining: meter.remaining };
    const keys = meterPillKeys(meter);
    const main = t(keys.main, values);
    const sub = t(keys.sub, values);
    const dots = meter.limit <= METER_MAX_DOTS ? Array.from({ length: meter.limit }, (_, index) => index < meter.count) : [];
    return (
      <div className="mf-meter-pill" role="status" aria-live="polite">
        {dots.length > 0 ? (
          <span className="mf-meter-dots" aria-hidden={true}>
            {dots.map((used, index) => (
              <span key={index} className={`mf-meter-dot${used ? " is-used" : ""}`} />
            ))}
          </span>
        ) : null}
        <span className="mf-meter-pill-text">
          <span className="mf-meter-pill-main">{main}</span>
          <span className="mf-meter-pill-sub">{sub}</span>
        </span>
        <a
          href={safePath(pricingPath) ? pricingPath : CONFIG.pricingPath}
          onClick={() => rememberReturn()}
        >
          {t("pillSubscribe")}
        </a>
        <button type="button" className="mf-meter-close" aria-label={t("pillClose")} onClick={() => setPillClosed(true)}>
          <CloseIcon />
        </button>
      </div>
    );
  }

  function body(): React.ReactNode {
    // An unconnected slot arrives as an empty array, not undefined, so a
    // truthiness check took it for an article and rendered a body with no
    // height: only the absolute badge showed, outside a frame too small to grab.
    if (linked) {
      if (onCanvas) {
        // The card the visitor will see, so it can be designed here with the
        // sidebar's Theme, Colors, Typography, Layout, and Labels.
        return (
          <React.Fragment>
            <div className="mf-meter-placeholder">
              <strong>Paywall card</strong>
              <span>
                On a CMS page, place this below the post and give the post body the PaywallArticle override (Code
                overrides, File MemberArticle). On any other page, connect the article in Article Body instead.
              </span>
            </div>
            {lockCard(mode === "teaser" ? "teaser" : "meter", false)}
          </React.Fragment>
        );
      }
      // No tagged post body on this page: nothing to lock, so no card under a
      // post anyone can read in full, and no pill counting it.
      if (!linkedArticle) return null;
      return (
        <React.Fragment>
          {locked ? lockCard(effective.reason, effective.signedIn) : null}
          {effective.phase === "open" && effective.meter ? pill(effective.meter) : null}
        </React.Fragment>
      );
    }

    return (
      <React.Fragment>
        {onCanvas ? (
          <span className="mf-meter-badge">
            <Lock aria-hidden={true} />
            <span>
              {mode === "teaser" ? "Read More paywall" : `${limit} free per ${period === "weekly" ? "week" : "month"}`}
            </span>
          </span>
        ) : null}
        <div
          ref={bodyRef}
          className={`mf-meter-body ${MF_GATED_BODY_CLASS}${cut ? " is-cut" : ""}`}
          aria-busy={effective.phase === "checking" ? true : undefined}
        >
          {contentSlot}
          {cut ? <div className="mf-meter-fade" aria-hidden={true} /> : null}
        </div>
        {locked ? lockCard(effective.reason, effective.signedIn) : null}
        {effective.phase === "open" && effective.meter ? pill(effective.meter) : null}
      </React.Fragment>
    );
  }

  return (
    <div
      ref={rootRef}
      className={`mf-meter ${mfThemeClass(theme)}${onCanvas ? " is-canvas" : ""}${linked ? " is-linked" : ""}`}
      data-mf-meter={scope}
    >
      <style>{mfThemeCss(".mf-meter")}</style>
      <style>{cssContent}</style>
      <style>{scopedCss}</style>
      {linkedCss ? <style>{linkedCss}</style> : null}
      {body()}
      <MfLicenseLayer license={license} />
    </div>
  );
}

// ============================================================================
// PROPERTY CONTROLS, PRD F07
// ============================================================================

addPropertyControls(MeteredPaywall, {
  // The Builder's seal for this instance (27-instance-seal.md). Hidden: it is
  // set on insert and a pasted copy loses it.
  mfSeal: { type: ControlType.String, title: "Seal", hidden: () => true },
  contentSlot: {
    type: ControlType.ComponentInstance,
    title: "Article Body",
  },
  mode: {
    type: ControlType.Enum,
    title: "Paywall Type",
    options: ["metered", "teaser"],
    optionTitles: ["Free Articles Meter", "Read More Teaser"],
    defaultValue: "metered",
  },
  freeQuotaCount: {
    type: ControlType.Number,
    title: "Free Articles",
    min: 1,
    max: 100,
    step: 1,
    displayStepper: true,
    defaultValue: CONFIG.freeQuotaCount,
    hidden: (props) => props.mode === "teaser",
  },
  quotaPeriod: {
    type: ControlType.Enum,
    title: "Reset Window",
    options: ["weekly", "monthly"],
    optionTitles: ["Every 7 Days", "Every 30 Days"],
    defaultValue: CONFIG.quotaPeriod,
    hidden: (props) => props.mode === "teaser",
  },
  unlimitedTier: {
    type: ControlType.Enum,
    title: "Full Access For",
    // The generator replaces these two lines with the site's own tiers, by
    // rank, after the first two. Keep them on one line each.
    options: ["any_paid", "signed_in", "free_member", "tier_1", "tier_2", "vip"],
    optionTitles: ["Any Paid Plan", "Any Signed In", "Free Member", "Tier 1: Silver", "Tier 2: Gold", "VIP Member"],
    defaultValue: "any_paid",
  },
  articleId: {
    type: ControlType.String,
    title: "Article ID",
    placeholder: "Page path",
    defaultValue: "",
  },
  previewParagraphs: {
    type: ControlType.Number,
    title: "Free Paragraphs",
    min: 1,
    max: 20,
    step: 1,
    displayStepper: true,
    defaultValue: 2,
  },
  previewHeight: {
    type: ControlType.Number,
    title: "Preview Height",
    min: 80,
    max: 2000,
    step: 10,
    unit: "px",
    defaultValue: 320,
  },
  blurIntensity: {
    type: ControlType.Number,
    title: "Blur Amount",
    min: BLUR_MIN,
    max: BLUR_MAX,
    step: 1,
    unit: "px",
    defaultValue: CONFIG.blurIntensity,
  },
  showCounterPill: {
    type: ControlType.Boolean,
    title: "Show Counter",
    defaultValue: CONFIG.showCounterPill,
    hidden: (props) => props.mode === "teaser",
  },

  /* ---- Lock card ---- */

  cardTitle: {
    type: ControlType.String,
    title: "Lock Title",
    defaultValue: CONFIG.cardTitle,
    hidden: (props) => props.mode === "teaser",
  },
  cardDescription: {
    type: ControlType.String,
    title: "Lock Message",
    displayTextArea: true,
    defaultValue: CONFIG.cardDescription,
    hidden: (props) => props.mode === "teaser",
  },
  ctaLabel: {
    type: ControlType.String,
    title: "Unlock Button",
    defaultValue: CONFIG.ctaLabel,
  },
  showSignInLink: {
    type: ControlType.Boolean,
    title: "Sign In Link",
    defaultValue: true,
  },
  pricingPath: {
    type: ControlType.String,
    title: "Pricing Page",
    defaultValue: CONFIG.pricingPath,
  },
  loginPath: {
    type: ControlType.String,
    title: "Sign In Page",
    defaultValue: CONFIG.loginPath,
    hidden: (props) => props.showSignInLink === false,
  },

  /* ---- SEO, F08 ---- */

  seoMarkup: {
    type: ControlType.Boolean,
    title: "SEO Paywall Markup",
    defaultValue: true,
  },
  schemaType: {
    type: ControlType.Enum,
    title: "Content Type",
    options: ["Article", "NewsArticle", "BlogPosting", "CreativeWork"],
    optionTitles: ["Article", "News Article", "Blog Post", "Other Content"],
    defaultValue: "Article",
    hidden: (props) => props.seoMarkup === false,
  },
  canvasPreview: {
    type: ControlType.Enum,
    title: "Canvas Preview",
    options: ["open", "locked"],
    optionTitles: ["Open", "Locked"],
    displaySegmentedControl: true,
    defaultValue: "open",
  },

  /* ---- Style, then the shared appearance groups and Labels ---- */

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
  ...mfAppearanceControls({ padding: 24, gap: 10, shadow: true }),
  labels: mfLabelControls(METER_LABELS),
});
