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
// Every canvas component is licensed (2026-10-25, replacing the 2026-10-18
// decision that left the bookmarks out): locked when the trial or plan ends or
// the plugin is signed out, the Framefic mark while a trial runs, shrunk to fit.

// @memberframe-license-start
// ============================================================================
// LICENSE: THE TRIAL WATERMARK AND THE LOCK
// ============================================================================
// Byte-identical in every licensed component, held so by
// `test/canvasLicenseParity.test.ts`. F19, 19-pro-lock-and-trial.md.
//
// The four lines above are this file's state when it was written, and they are
// rewritten in place by the plugin whenever the license changes, and set to
// locked when the creator signs out of the plugin. The component also asks the
// server: trial shows the "Made with Framefic" mark, the bottom right corner
// copied from the BEAF slider; an ended trial or plan blurs the component
// behind an Upgrade card. On the published site the server's answer wins. On
// the canvas the stricter of the two wins, so a signed-out plugin locks the
// canvas even though the site's plan is still paid, and a locked component
// hides its settings in Framer's right panel. The server refuses an unlicensed
// site's member requests on its own, so removing these lines unlocks nothing.
//
// The server is asked once when the component mounts, and again only when the
// tab comes back after ten minutes or more: nothing polls. On the canvas the
// open plugin hears every license change from the server and rewrites the
// four lines above, which remounts the component with the new state. Each
// instance also sends
// the seal the Builder gave it (27-instance-seal.md): a pasted copy, or one
// that never came from the Builder, is answered "copied" and shows an insert
// card instead. An instance from before seals sends none and is held to the
// license alone.

type MfLicense = "trial" | "active" | "locked" | "copied" | "domain";

const MF_LICENSE_CACHE_MS = 60000;
const MF_LICENSE_STALE_MS = 600000;

function mfBakedLicense(): MfLicense {
  return IS_LOCKED ? "locked" : IS_TRIAL ? "trial" : "active";
}

function mfFetchLicense(apiBaseUrl: string, siteKey: string, seal: string | undefined): Promise<MfLicense | null> {
  if (typeof window === "undefined" || !apiBaseUrl || !siteKey) return Promise.resolve(null);
  const host = window as unknown as { __mfLicense?: Record<string, { at: number; answer: Promise<MfLicense | null> }> };
  const cache = (host.__mfLicense = host.__mfLicense || {});
  const base = String(apiBaseUrl).replace(/\/+$/, "");
  // The baked state is part of the key: once the plugin rewrites it, the
  // remounted component asks afresh instead of reusing the old answer.
  const key = base + "|" + siteKey + "|" + (seal === undefined ? "-" : seal) + "|" + mfBakedLicense();
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
    .then((data: { state?: unknown; trialEndsAt?: unknown } | null): MfLicense | null => {
      const state = data ? data.state : null;
      const ends = (host as unknown as { __mfTrialEnds?: Record<string, number> });
      ends.__mfTrialEnds = ends.__mfTrialEnds || {};
      const endsAt = data && typeof data.trialEndsAt === "string" ? Date.parse(data.trialEndsAt) : NaN;
      if (state === "trial" && !isNaN(endsAt)) ends.__mfTrialEnds[base + "|" + siteKey] = endsAt;
      if (state === "copied") return "copied";
      // Published at an address the site does not allow yet. Not a copy: the
      // plugin adds the address the next time it is open in this project.
      if (state === "foreign") return "domain";
      return state === "active" ? "active" : state === "trial" ? "trial" : state === "expired" ? "locked" : null;
    })
    .catch(() => null);
  cache[key] = { at: Date.now(), answer };
  return answer;
}

const MF_STRICTNESS: Record<string, number> = { active: 0, trial: 1, locked: 2 };

/**
 * What to draw from the file's lines and the server's answer. A copy or a
 * foreign domain always shows its own card. On the published site the server
 * wins, so a paid site never locks because its creator signed out. On the
 * canvas the stricter one wins: the plugin's sign-out lock holds there, and so
 * does a lapse the server knows about before the plugin is next opened.
 */
function mfEffectiveLicense(baked: MfLicense, answer: MfLicense, onCanvas: boolean): MfLicense {
  if (answer === "copied" || answer === "domain" || !onCanvas) return answer;
  return (MF_STRICTNESS[baked] ?? 0) > (MF_STRICTNESS[answer] ?? 0) ? baked : answer;
}

/**
 * The component's property controls, or, while the file is locked, the same
 * controls all hidden from Framer's right panel: nothing can be set until the
 * creator signs in or upgrades. The seal stays, so the instance keeps it.
 */
function mfControls<T extends object>(controls: T): T {
  if (!IS_LOCKED) return controls;
  // BEAF's "Status" row: the one thing a locked component shows in the panel.
  const locked: Record<string, unknown> = {
    mfLockedStatus: {
      type: ControlType.Enum,
      title: "Status",
      options: ["locked"],
      optionTitles: ["Sign in or upgrade to customize"],
      defaultValue: "locked",
    },
  };
  for (const [key, control] of Object.entries(controls)) {
    locked[key] = key === "mfSeal" ? control : { ...(control as object), hidden: () => true };
  }
  return locked as T;
}

function useMfLicense(apiBaseUrl: string, siteKey: string, seal?: string): MfLicense {
  const [license, setLicense] = useState<MfLicense>(mfBakedLicense);
  // Bumped on every server answer, so the countdown below re-arms even when
  // the answer matches the file (trial and trial): it brings the end time.
  const [answeredAt, setAnsweredAt] = useState(0);
  useEffect(() => {
    let live = true;
    let checkedAt = 0;
    const target = RenderTarget.current();
    const onCanvas = target === RenderTarget.canvas || target === RenderTarget.thumbnail;
    const check = () => {
      checkedAt = Date.now();
      void mfFetchLicense(apiBaseUrl, siteKey, seal).then((answer) => {
        if (live && answer) {
          setLicense(mfEffectiveLicense(mfBakedLicense(), answer, onCanvas));
          setAnsweredAt(Date.now());
        }
      });
    };
    check();
    if (typeof window === "undefined") return () => undefined;
    // Instances on one page share the cached answer, so a return to the tab is
    // at most one request per page, not one per component.
    const onReturn = () => {
      if (document.visibilityState === "visible" && Date.now() - checkedAt >= MF_LICENSE_STALE_MS) check();
    };
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      live = false;
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [apiBaseUrl, siteKey, seal]);

  // BEAF's countdown: a running trial locks at the second it ends, on the
  // canvas and the live site, without waiting for a reload or the next check.
  useEffect(() => {
    if (license !== "trial" || typeof window === "undefined") return () => undefined;
    const ends = (window as unknown as { __mfTrialEnds?: Record<string, number> }).__mfTrialEnds || {};
    const endsAt = ends[String(apiBaseUrl).replace(/\/+$/, "") + "|" + siteKey];
    if (typeof endsAt !== "number") return () => undefined;
    // setTimeout holds at most about 24 days; a longer wait re-arms on the next check.
    const timer = window.setTimeout(() => setLicense("locked"), Math.min(Math.max(0, endsAt - Date.now()), 2147483647));
    return () => window.clearTimeout(timer);
  }, [license, answeredAt, apiBaseUrl, siteKey]);

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
.mf-lock { position: absolute; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center; padding: 12px; box-sizing: border-box; background: rgba(15, 16, 20, 0.28); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); border-radius: inherit; container-type: size; }
.mf-lock-card { display: flex; flex-direction: column; align-items: center; gap: 8px; max-width: 320px; padding: 18px 20px; border-radius: 14px; background: #121214; border: 1px dashed rgba(255, 255, 255, 0.25); color: #ffffff; text-align: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, Helvetica, Arial, sans-serif; box-shadow: 0 12px 32px -12px rgba(0, 0, 0, 0.5); }
.mf-lock-icon { width: 40px; height: 40px; border-radius: 50%; background: rgba(255, 255, 255, 0.1); display: flex; align-items: center; justify-content: center; }
.mf-lock-title { margin: 0; font-size: 14px; font-weight: 700; line-height: 1.3; }
.mf-lock-text { margin: 0; font-size: 12px; line-height: 1.5; color: #94a3b8; }
@container (max-height: 150px) { .mf-lock-card { flex-direction: row; padding: 8px 12px; gap: 8px; } .mf-lock-icon { width: 24px; height: 24px; } .mf-lock-icon svg { width: 14px; height: 14px; } .mf-lock-text { display: none; } .mf-lock-title { font-size: 12px; } }
@container (max-height: 64px) or (max-width: 140px) { .mf-lock { padding: 0; } .mf-lock-card { padding: 0; background: transparent; border: 0; box-shadow: none; } .mf-lock-title, .mf-lock-text { display: none; } .mf-lock-icon { width: 24px; height: 24px; background: rgba(18, 18, 20, 0.85); } .mf-lock-icon svg { width: 14px; height: 14px; } }
.mf-wm-frame { position: absolute; inset: 0; z-index: 30; pointer-events: none; container-type: size; }
@container (max-height: 64px) or (max-width: 200px) { .mf-wm { bottom: 2px; right: 2px; padding: 3px; gap: 0; } .mf-wm-text, .mf-wm-brand { display: none; } }
`;

function MfWatermark(): React.ReactElement {
  return (
    <a className="mf-wm" href="https://framefic.com" target="_blank" rel="noopener noreferrer">
      <span className="mf-wm-icon" aria-hidden={true}>
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" data-brand="framefic">
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

const MF_LOCK_COPY: Record<"locked" | "copied" | "domain", { title: string; text: string }> = {
  locked: { title: "Upgrade to Pro", text: "MemberFrame is locked: the trial or plan has ended, or the plugin is signed out. Open the MemberFrame plugin to sign in or upgrade." },
  copied: { title: "Insert from MemberFrame", text: "This component was copied, not inserted. Add it from the Builder in the MemberFrame plugin." },
  domain: { title: "Domain not allowed yet", text: "This address is not allowed for this site. Open the MemberFrame plugin in this project, then publish again." },
};

function MfLockOverlay(props: { kind: "locked" | "copied" | "domain" }): React.ReactElement {
  const copy = MF_LOCK_COPY[props.kind];
  return (
    <div className="mf-lock" role="note" aria-label={copy.title}>
      <div className="mf-lock-card">
        <span className="mf-lock-icon" aria-hidden={true}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#708AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="lock">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </span>
        <p className="mf-lock-title">{copy.title}</p>
        <p className="mf-lock-text">{copy.text}</p>
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
      {props.license === "trial" ? (
        // A frame the size of the component, so the mark can shrink to the
        // Framefic icon alone on a small one (a bookmark button).
        <div className="mf-wm-frame">
          <MfWatermark />
        </div>
      ) : (
        <MfLockOverlay kind={props.license} />
      )}
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
 * Applied whenever the creator picks a font: there is no Custom font switch
 * any more (2026-10-27), which ignored a font chosen while it was off. Framer
 * loads the chosen font itself, in the editor and on the published site.
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
  // Any name a font can have (accents, digits, "&"), but nothing that can end
  // the declaration, open a rule or a comment, or load a url.
  if (/[;{}<>()\\@\n\r]|\/\*/.test(family)) return null;
  // An untouched Font control can hand over only the generic fallback: keep
  // the component's own default rather than the browser's.
  if (/^(sans-serif|serif|monospace|system-ui)$/i.test(family.replace(/["']/g, ""))) return null;
  return family;
}

/** The root class for a theme. Anything unknown is Light, the editor's look. */
function mfThemeClass(theme: unknown): string {
  if (theme === "dark") return "is-dark";
  if (theme === "auto") return "is-auto";
  return "is-light";
}

/**
 * Always Light: the Theme control was removed (product owner, 2026-10-27).
 * Every colour is in the Colors group, so a dark card is set there. A value
 * an older instance saved is ignored.
 */
const MF_THEME_CLASS = mfThemeClass("light");

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
  set("--mf-font", mfFontFamily(typography.font));
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
  --mf-c-font: var(--mf-font, "Inter", "Inter Placeholder", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
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
    colors: {
      type: ControlType.Object as typeof ControlType.Object,
      title: "Colors",
      buttonTitle: "Colors",
      controls: {
        surface: { type: ControlType.Color as typeof ControlType.Color, title: "Background", optional: true },
        text: { type: ControlType.Color as typeof ControlType.Color, title: "Text", optional: true },
        muted: { type: ControlType.Color as typeof ControlType.Color, title: "Muted text", optional: true },
        border: { type: ControlType.Color as typeof ControlType.Color, title: "Border", optional: true },
        field: { type: ControlType.Color as typeof ControlType.Color, title: "Field", optional: true },
        onAccent: { type: ControlType.Color as typeof ControlType.Color, title: "Button text", optional: true },
      },
    },
    typography: {
      type: ControlType.Object as typeof ControlType.Object,
      title: "Typography",
      buttonTitle: "Typography",
      controls: {
        font: {
          type: ControlType.Font as typeof ControlType.Font,
          title: "Font",
          controls: "basic" as const,
          defaultFontType: "sans-serif" as const,
        },
        textScale: {
          type: ControlType.Number as typeof ControlType.Number,
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
      type: ControlType.Object as typeof ControlType.Object,
      title: "Layout",
      buttonTitle: "Layout",
      controls: {
        padding: {
          type: ControlType.Number as typeof ControlType.Number,
          title: "Padding",
          min: 0,
          max: 64,
          step: 1,
          unit: "px",
          defaultValue: defaults.padding,
        },
        gap: {
          type: ControlType.Number as typeof ControlType.Number,
          title: "Spacing",
          min: 0,
          max: 48,
          step: 1,
          unit: "px",
          defaultValue: defaults.gap,
        },
        borderWidth: {
          type: ControlType.Number as typeof ControlType.Number,
          title: "Border",
          min: 0,
          max: 4,
          step: 1,
          unit: "px",
          defaultValue: 1,
        },
        shadow: { type: ControlType.Boolean as typeof ControlType.Boolean, title: "Shadow", defaultValue: defaults.shadow },
      },
    },
    spacing: {
      type: ControlType.Object as typeof ControlType.Object,
      title: "Spacing",
      buttonTitle: "Spacing",
      controls: {
        margin: { type: ControlType.Padding as typeof ControlType.Padding, title: "Margin", defaultValue: "0px" },
        customPadding: { type: ControlType.Boolean as typeof ControlType.Boolean, title: "Custom padding", defaultValue: false },
        padding: {
          type: ControlType.Padding as typeof ControlType.Padding,
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
    controls[key] = { type: ControlType.String as typeof ControlType.String, title: defaults[key][0], defaultValue: defaults[key][1] };
  }
  return { type: ControlType.Object as typeof ControlType.Object, title: "Labels", buttonTitle: "Labels", controls };
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

// The generator writes the API address into CONFIG. No import.meta here: a
// Framer code file has no Vite env, and Framer reports the read as an error.
const ENV_API_BASE_URL = "";

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

// Lucide shapes, copied exactly (a canvas file may import nothing); test/canvasIcons.test.ts checks them.
function RibbonIcon() {
  return (
    <svg {...ICON} data-lucide="bookmark">
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
    </svg>
  );
}

type TrayIconShape = "bookmark" | "heart" | "star";

/** The Bookmark Button's three shapes, so the tray's icon can match it. */
function TriggerIcon({ shape }: { shape: TrayIconShape }) {
  if (shape === "heart") {
    return (
      <svg {...ICON} data-lucide="heart">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
    );
  }
  if (shape === "star") {
    return (
      <svg {...ICON} data-lucide="star">
        <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
      </svg>
    );
  }
  return <RibbonIcon />;
}

function CloseIcon() {
  return (
    <svg {...ICON} data-lucide="x">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg {...ICON} data-lucide="search">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg {...ICON} data-lucide="trash-2">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
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
  width: 100%; height: 100%; min-width: 36px; min-height: 36px; margin: 0; padding: 0 12px;
  white-space: nowrap;
  border: var(--mf-border-width, 1px) solid var(--mf-c-border); border-radius: 999px;
  background: var(--mf-c-surface); color: var(--mf-c-text); font: inherit; font-weight: 600; cursor: pointer;
}
.mf-tray-trigger:hover { border-color: var(--mf-c-accent); }
.mf-tray-trigger:focus-visible { outline: 2px solid var(--mf-c-accent); outline-offset: 2px; }
.mf-tray-trigger svg { width: var(--mf-tray-icon, 18px); height: var(--mf-tray-icon, 18px); flex: 0 0 auto; }
/* Button Style, the same three as the Bookmark Button. */
.mf-tray-trigger.is-soft { border-color: transparent; background: color-mix(in srgb, var(--mf-c-accent) 10%, var(--mf-c-surface)); }
.mf-tray-trigger.is-soft:hover { border-color: transparent; background: color-mix(in srgb, var(--mf-c-accent) 18%, var(--mf-c-surface)); }
.mf-tray-trigger.is-ghost { border-color: transparent; background: transparent; padding: 0 4px; }
.mf-tray-trigger.is-ghost:hover { border-color: transparent; color: var(--mf-c-accent); }
.mf-tray-badge {
  position: absolute; top: -6px; right: -6px; min-width: 18px; height: 18px; padding: 0 5px; box-sizing: border-box;
  display: inline-flex; align-items: center; justify-content: center; border-radius: 999px;
  background: var(--mf-tray-badge, var(--mf-c-accent)); color: var(--mf-c-on-accent); font-size: calc(11px * var(--mf-text-scale, 1)); font-weight: 700;
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
.mf-tray-backdrop.is-blur { -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); }
.mf-tray-backdrop.is-none { background: transparent; }
.mf-tray-panel {
  position: relative; box-sizing: border-box; display: flex; flex-direction: column; gap: var(--mf-gap, 12px);
  width: min(var(--mf-tray-width, 400px), 100vw); height: 100%; padding: var(--mf-pad, 20px);
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
  /** 27-instance-seal.md: written by the Builder on insert, read only by the license check. */
  mfSeal?: string;
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
  buttonStyle?: "outline" | "soft" | "ghost";
  iconShape?: TrayIconShape;
  iconSize?: number;
  badgeColor?: string;
  drawerWidth?: number;
  showDates?: boolean;
  backdrop?: "dim" | "blur" | "none";
}

/**
 * @framerIntrinsicWidth 44
 * @framerIntrinsicHeight 44
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
export default function BookmarksTray(props: BookmarksTrayProps) {
  const license = useMfLicense(CONFIG.apiBaseUrl, CONFIG.siteKey, props.mfSeal);
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
    buttonStyle = "outline",
    iconShape = "bookmark",
    iconSize = 18,
    badgeColor,
    drawerWidth = 400,
    showDates = true,
    backdrop = "dim",
    colors,
    typography,
    layout,
    spacing,
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
    `[data-mf-tray="${MF_SCOPE_SLOT}"] { --mf-tray-icon: ${Math.round(mfNumber(iconSize, 12, 48, 18))}px; ` +
    `--mf-tray-width: ${Math.round(mfNumber(drawerWidth, 280, 640, 400))}px; ` +
    (badgeColor && mfSafeColor(badgeColor, "") ? `--mf-tray-badge: ${mfSafeColor(badgeColor, "")}; ` : "") +
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
  const styled = mfStyleScope("mft", scopedCss);

  const side = drawerSide === "left" ? "left" : "right";
  const triggerStyle = buttonStyle === "soft" || buttonStyle === "ghost" ? buttonStyle : "outline";
  const shade = backdrop === "blur" || backdrop === "none" ? backdrop : "dim";
  // A locked tray never opens: the drawer renders outside the trigger, where
  // the lock card does not reach.
  const usable = license === "active" || license === "trial";
  const showDrawer = usable && (onCanvas ? canvasPreview === "open" : open);

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
              // The path tells apart two pages with the same title.
              const path = item.url.startsWith("/") ? item.url.split(/[?#]/)[0] : "";
              const meta = [showDates ? when : "", path].filter(Boolean).join(" · ");
              return (
                <li key={item.itemSlug} className={`mf-tray-item${removing.has(item.itemSlug) ? " is-removing" : ""}`}>
                  {href ? (
                    <a className="mf-tray-link" href={onCanvas ? undefined : href} onClick={() => !onCanvas && setOpen(false)}>
                      <span className="mf-tray-item-title">{item.title}</span>
                      {meta ? <span className="mf-tray-item-meta">{meta}</span> : null}
                    </a>
                  ) : (
                    <span className="mf-tray-link">
                      <span className="mf-tray-item-title">{item.title}</span>
                      {meta ? <span className="mf-tray-item-meta">{meta}</span> : null}
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
    <div className={`mf-tray is-drawer ${MF_THEME_CLASS}`} data-mf-tray={styled.scope}>
      <div className={`mf-tray-layer is-${side}${onCanvas ? " is-inline" : ""}`}>
        {onCanvas ? null : <div className={`mf-tray-backdrop is-${shade}`} aria-hidden={true} onClick={close} />}
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
    <div className={`mf-tray ${MF_THEME_CLASS}`} data-mf-tray={styled.scope}>
      <style>{mfThemeCss(".mf-tray")}</style>
      <style>{cssContent}</style>
      <style>{styled.css}</style>
      <button
        ref={triggerRef}
        type="button"
        className={`mf-tray-trigger is-${triggerStyle}`}
        aria-haspopup="dialog"
        aria-expanded={showDrawer}
        aria-label={showLabel ? undefined : t("open", { count })}
        onClick={() => !onCanvas && setOpen(true)}
      >
        <TriggerIcon shape={iconShape === "heart" || iconShape === "star" ? iconShape : "bookmark"} />
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
              <style>{styled.css}</style>
              {drawer}
            </React.Fragment>,
            document.body
          )
        : drawer}
      <MfLicenseLayer license={license} />
    </div>
  );
}

// ============================================================================
// PROPERTY CONTROLS, PRD F14
// ============================================================================

addPropertyControls(BookmarksTray, mfControls({
  mfSeal: { type: ControlType.String, title: "Seal", hidden: () => true },
  drawerSide: {
    type: ControlType.Enum,
    title: "Drawer Side",
    options: ["right", "left"],
    optionTitles: ["Right Slide-Out", "Left Slide-Out"],
    defaultValue: CONFIG.drawerSide,
  },
  drawerWidth: {
    type: ControlType.Number,
    title: "Drawer Width",
    min: 280,
    max: 640,
    step: 10,
    unit: "px",
    defaultValue: 400,
  },
  backdrop: {
    type: ControlType.Enum,
    title: "Backdrop",
    options: ["dim", "blur", "none"],
    optionTitles: ["Dim", "Blur", "None"],
    displaySegmentedControl: true,
    defaultValue: "dim",
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
  badgeColor: {
    type: ControlType.Color,
    title: "Badge Color",
    optional: true,
    hidden: (props) => props.showBadge === false,
  },
  showSearch: {
    type: ControlType.Boolean,
    title: "Search",
    defaultValue: true,
  },
  showDates: {
    type: ControlType.Boolean,
    title: "Saved Date",
    defaultValue: true,
  },
  buttonStyle: {
    type: ControlType.Enum,
    title: "Button Style",
    options: ["outline", "soft", "ghost"],
    optionTitles: ["Outline", "Soft", "Icon Only"],
    defaultValue: "outline",
  },
  iconShape: {
    type: ControlType.Enum,
    title: "Icon",
    options: ["bookmark", "heart", "star"],
    optionTitles: ["Bookmark Ribbon", "Heart", "Star"],
    defaultValue: "bookmark",
  },
  iconSize: {
    type: ControlType.Number,
    title: "Icon Size",
    min: 12,
    max: 48,
    step: 1,
    unit: "px",
    defaultValue: 18,
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
}));
