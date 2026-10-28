/**
 * `<ProtectedDownload>`, Upgrade to Download. PRD feature F10, feature plan
 * FP-12, task 5.5.
 *
 * A download button for a protected file. The creator drops the file into
 * File in Framer's sidebar, and Framer stores it (32-canvas-downloads.md).
 * While the MemberFrame plugin is open it moves the file's address, and any
 * password, to MemberFrame's server, writes the opaque Asset ID here, and
 * clears both from this component. The published page then holds only the
 * Asset ID: the server checks access and streams the file, so its Framer
 * address never reaches a visitor.
 *
 *   - Signed out: the button reads "Sign in to Download" and takes the visitor
 *     to the sign in page, then back here.
 *   - Signed in below the file's plan: "Upgrade to Download", to the pricing
 *     page, with the plan it needs underneath.
 *   - On the plan: "Download", with the file type and size. Pressing it asks
 *     the server to check again and sign a link that works for 60 seconds; the
 *     browser downloads through it, and the link is dead a minute later.
 *   - Access set to Password: a password field. Anyone who types it gets the
 *     same 60 second link, with no account.
 *
 * ## The rule is enforced on the server
 *
 * Access, Who Can Download, and Password are set here, like a page or section
 * lock, and the plugin copies them to the file on the server. A rule in
 * published page code is one any visitor can edit, so the component only
 * shows the server's answer and the server enforces it on every download.
 *
 * ## This file leaves the repository
 *
 * Written into the creator's project by the code generator. Imports only
 * `react`, `framer`, and icons Framer is known to provide.
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
// shared by every Framefic plugin; an ended trial or plan blurs the component
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
  // The "Status" row: the one thing a locked component shows in the panel.
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

  // The countdown: a running trial locks at the second it ends, on the
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

// The generator writes the API address into CONFIG. No import.meta here: a
// Framer code file has no Vite env, and Framer reports the read as an error.
const ENV_API_BASE_URL = "";

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

type Access = "granted" | "upgrade" | "sign_in" | "password";

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

/**
 * FNV-1a of a file's address: the plugin's `shortHash` in
 * services/downloadVault.ts, held to it by test.
 */
function mfFileHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
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
  // Lucide shapes, copied exactly; test/canvasIcons.test.ts checks them.
  if (type === "file") {
    return (
      <svg {...common} data-lucide="file-text">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        <path d="M10 9H8" />
        <path d="M16 13H8" />
        <path d="M16 17H8" />
      </svg>
    );
  }
  if (type === "archive") {
    return (
      <svg {...common} data-lucide="archive">
        <rect width="20" height="5" x="2" y="3" rx="1" />
        <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
        <path d="M10 12h4" />
      </svg>
    );
  }
  if (type === "code") {
    return (
      <svg {...common} data-lucide="code">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    );
  }
  return (
    <svg {...common} data-lucide="arrow-down-to-line">
      <path d="M12 17V3" />
      <path d="m6 11 6 6 6-6" />
      <path d="M19 21H5" />
    </svg>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const cssContent = `
.mf-download {
  position: relative;
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
.mf-download-layer {
  position: fixed; inset: 0; z-index: 2147483000; box-sizing: border-box;
  display: flex; align-items: center; justify-content: center; padding: 16px;
  color: var(--mf-c-text); font-family: var(--mf-c-font); font-size: calc(14px * var(--mf-text-scale, 1)); line-height: 1.45;
}
.mf-download-backdrop {
  position: absolute; inset: 0; background: var(--mf-c-backdrop);
  -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); animation: mf-download-fade 0.18s ease-out;
}
.mf-download-dialog {
  position: relative; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; gap: 10px;
  width: min(380px, 100%); margin: 0; padding: 28px 24px 22px; text-align: center;
  background: var(--mf-c-surface); border: 1px solid var(--mf-c-border); border-radius: max(12px, var(--mf-c-radius));
  box-shadow: 0 24px 60px rgba(16, 24, 40, 0.28); animation: mf-download-rise 0.2s ease-out;
}
.mf-download-dialog-icon {
  display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; margin-bottom: 4px;
  border-radius: 999px; color: var(--mf-c-accent); background: color-mix(in srgb, var(--mf-c-accent) 12%, transparent);
}
.mf-download-dialog-icon svg { width: 20px; height: 20px; }
.mf-download-dialog-title { margin: 0; font-size: calc(17px * var(--mf-text-scale, 1)); font-weight: 600; line-height: 1.3; }
.mf-download-dialog-text { margin: 0 0 6px; color: var(--mf-c-muted); }
.mf-download-password {
  box-sizing: border-box; width: 100%; margin: 0; padding: 11px 12px;
  border: 1px solid var(--mf-c-border); border-radius: max(8px, calc(var(--mf-c-radius) * 0.7));
  background: var(--mf-c-field); color: var(--mf-c-text); font: inherit;
}
.mf-download-password:focus-visible { outline: 2px solid var(--mf-c-accent); outline-offset: 1px; }
.mf-download-password.is-error { border-color: var(--mf-c-danger); }
.mf-download-dialog-error { margin: 0; width: 100%; text-align: left; color: var(--mf-c-danger); font-size: calc(13px * var(--mf-text-scale, 1)); }
.mf-download-dialog-actions { display: flex; gap: 10px; width: 100%; margin-top: 6px; }
.mf-download-dialog-cancel, .mf-download-dialog-submit {
  appearance: none; flex: 1 1 0; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 10px 14px; border-radius: max(8px, calc(var(--mf-c-radius) * 0.7)); font: inherit; font-weight: 600; cursor: pointer;
}
.mf-download-dialog-cancel { border: 1px solid var(--mf-c-border); background: transparent; color: var(--mf-c-text); }
.mf-download-dialog-submit { border: 1px solid var(--mf-c-accent); background: var(--mf-c-accent); color: var(--mf-c-on-accent); }
.mf-download-dialog-submit svg { width: 16px; height: 16px; }
.mf-download-dialog-cancel:disabled, .mf-download-dialog-submit:disabled { opacity: 0.6; cursor: default; }
.mf-download-dialog-cancel:focus-visible, .mf-download-dialog-submit:focus-visible { outline: 2px solid var(--mf-c-accent); outline-offset: 2px; }
@keyframes mf-download-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes mf-download-rise { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .mf-download-backdrop, .mf-download-dialog { animation: none; } }
.mf-download-note { margin: 0; font-size: calc(12px * var(--mf-text-scale, 1)); color: var(--mf-c-muted); text-align: center; }
.mf-download-note.is-error { color: var(--mf-c-danger); }
.mf-download-spin { animation: mf-download-spin 0.9s linear infinite; }
@keyframes mf-download-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .mf-download-spin { animation: none; } }
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
  noAsset: ["No file", "Upload a file in the sidebar"],
  unsecured: ["Not secured", "Open MemberFrame to secure this file before publishing"],
  clearFile: ["Saved, clear File", "Saved. Clear the File field before publishing, so its address stays private"],
  notReady: ["Not ready", "This file is not ready yet"],
  passwordTitle: ["Password title", "Enter the password"],
  passwordText: ["Password text", "This file is password protected. Enter the password to download it."],
  passwordField: ["Password field", "Password"],
  passwordSubmit: ["Password button", "Download"],
  passwordCancel: ["Cancel button", "Cancel"],
  wrongPassword: ["Wrong password", "Incorrect password. Try again."],
};

export interface ProtectedDownloadProps extends MfAppearanceProps {
  /**
   * The file Framer stores, dropped in the sidebar. Read only to tell whether
   * it still waits for the plugin; never put in a link or a request.
   */
  file?: string;
  /** What the visitor's browser saves it as. Automatic when empty. */
  fileName?: string;
  access?: "members" | "password";
  /** With Members: the same choices as page and section locks. */
  whoCanDownload?: string;
  /** With Only chosen tiers: exactly these. */
  chosenTiers?: ReadonlyArray<string>;
  /** With Password. Moved to the server by the plugin, then cleared; never sent from here. */
  password?: string;
  /** Set by the plugin once the file is secured. */
  assetId?: string;
  /** Set by the plugin: a fingerprint of the file it saved, to tell it from a newly dropped one. */
  fileSecured?: string;
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

/** Set by the MemberFrame Builder on insert, never by hand (27-instance-seal.md). */
interface MfSealProps {
  mfSeal?: string;
}

/**
 * @framerIntrinsicWidth 340
 * @framerIntrinsicHeight 88
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
export default function ProtectedDownload(props: ProtectedDownloadProps & MfSealProps) {
  const {
    file = "",
    access: accessChoice = "members",
    assetId = "",
    fileSecured = "",
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
  const license = useMfLicense(CONFIG.apiBaseUrl, CONFIG.siteKey, props.mfSeal);
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
  /** What the visitor typed for a password file. Sent only to sign this one download. */
  const [typedPassword, setTypedPassword] = useState("");
  /** The password popup, opened by the button of a password file. */
  const [asking, setAsking] = useState(false);
  const passwordInput = useRef<HTMLInputElement | null>(null);
  /** A file still in the sidebar: its address is in this component's props until it is cleared. */
  const unsecured = typeof file === "string" && file.trim() !== "";
  /** That file is the one the plugin saved: only clearing the field is left. */
  const savedButShown = unsecured && fileSecured !== "" && mfFileHash(file.trim()) === fileSecured;

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
        body: JSON.stringify(load.access === "password" ? { assetId: id, password: typedPassword } : { assetId: id }),
      });

      if (response.status === 401 && load.access === "password") {
        setAction({ phase: "error", message: t("wrongPassword") });
        return;
      }
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
      setAsking(false);
      setTypedPassword("");
    } catch {
      setAction({ phase: "error", message: t("error") });
    } finally {
      busy.current = false;
    }
    // `t` reads the labels prop; the copy is read when each message is set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, load, typedPassword]);

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
      // Dropped in the sidebar but not secured yet: its address is still in
      // this component, so say so before the creator publishes.
      if (unsecured) return { ...base, meta: fileMetaLabel || "", note: t(savedButShown ? "clearFile" : "unsecured"), noteError: true };
      if (id === "") return { ...base, meta: t("noAsset") };
      const locked = canvasPreview === "locked" && accessChoice !== "password";
      return {
        ...base,
        title: locked ? lockedButtonText : buttonText,
        meta: fileMetaLabel || (canvasAsset ? fileMeta(canvasAsset) : "ZIP, 42 MB"),
        note: locked ? t("upgradeNote", { tier: canvasAsset ? canvasAsset.requiredTierName : "Gold" }) : "",
        locked,
      };
    }

    // Never secured: the component has no Asset ID, and never uses the file's address.
    if (id === "" && unsecured) return { ...base, title: t("notReady"), disabled: true, locked: true };
    if (load.phase === "loading") return { ...base, title: t("checking"), disabled: true, spinning: true };
    if (load.phase === "missing") return { ...base, title: t("missing"), disabled: true, locked: true };
    if (load.phase === "failed") {
      return { ...base, title: buttonText, disabled: true, note: t("failed"), noteError: true, locked: true };
    }

    const { asset, access } = load;
    const meta = fileMetaLabel || fileMeta(asset);

    // Set to Password here, still a members file on the server: the plugin has
    // not sent the password yet. Never send a visitor to sign in for it.
    if (accessChoice === "password" && (access === "sign_in" || access === "upgrade")) {
      return { ...base, title: t("notReady"), meta, disabled: true, locked: true };
    }

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

    if (access === "password") {
      // The password is asked for in a popup; its errors show there.
      return {
        ...base,
        meta,
        note: action.phase === "started" ? t("started") : "",
        onPress: () => {
          setTypedPassword("");
          setAction({ phase: "idle" });
          setAsking(true);
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
    `[data-mf-download="${MF_SCOPE_SLOT}"] { ` +
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
  const styled = mfStyleScope("mfx", scopedCss);

  const buttonClass = [
    "mf-download-button",
    view.locked ? "is-locked" : buttonStyle === "outline" ? "is-outline" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Escape closes the popup, and the field takes focus when it opens.
  useEffect(() => {
    if (!asking) return;
    passwordInput.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy.current) setAsking(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [asking]);

  const signing = action.phase === "signing";
  const closePopup = () => {
    if (!busy.current) setAsking(false);
  };
  /*
    The password popup. Rendered into the page's body, so a transformed or
    clipped ancestor (a Framer appear effect, a stack with overflow hidden)
    cannot trap or cut it; its own copy of the theme and the instance's
    variables travels with it.
  */
  const popup =
    asking && !onCanvas && typeof document !== "undefined"
      ? createPortal(
          <div className={`mf-download-layer ${MF_THEME_CLASS}`} data-mf-download={styled.scope}>
            <style>{mfThemeCss(".mf-download-layer")}</style>
            <style>{cssContent}</style>
            <style>{styled.css}</style>
            <div className="mf-download-backdrop" onClick={closePopup} />
            <form
              className="mf-download-dialog"
              role="dialog"
              aria-modal={true}
              aria-labelledby={`${scope}-password-title`}
              aria-describedby={`${scope}-password-text`}
              onSubmit={(event) => {
                event.preventDefault();
                if (typedPassword !== "" && !signing) void download();
              }}
            >
              <span className="mf-download-dialog-icon">
                <Lock aria-hidden={true} />
              </span>
              <h3 className="mf-download-dialog-title" id={`${scope}-password-title`}>
                {t("passwordTitle")}
              </h3>
              <p className="mf-download-dialog-text" id={`${scope}-password-text`}>
                {t("passwordText")}
              </p>
              <input
                ref={passwordInput}
                type="password"
                className={`mf-download-password${action.phase === "error" ? " is-error" : ""}`}
                placeholder={t("passwordField")}
                aria-label={t("passwordField")}
                aria-invalid={action.phase === "error" ? true : undefined}
                autoComplete="off"
                value={typedPassword}
                onChange={(event) => {
                  setTypedPassword(event.target.value);
                  if (action.phase === "error") setAction({ phase: "idle" });
                }}
              />
              {action.phase === "error" ? (
                <p className="mf-download-dialog-error" role="alert">
                  {action.message}
                </p>
              ) : null}
              <div className="mf-download-dialog-actions">
                <button type="button" className="mf-download-dialog-cancel" onClick={closePopup} disabled={signing}>
                  {t("passwordCancel")}
                </button>
                <button type="submit" className="mf-download-dialog-submit" disabled={typedPassword === "" || signing} aria-busy={signing ? true : undefined}>
                  {signing ? <Loader2 className="mf-download-spin" aria-hidden={true} /> : null}
                  {signing ? t("preparing") : t("passwordSubmit")}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )
      : null;

  return (
    <div className={`mf-download ${MF_THEME_CLASS}`} data-mf-download={styled.scope}>
      <style>{mfThemeCss(".mf-download")}</style>
      <style>{cssContent}</style>
      <style>{styled.css}</style>
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
      {popup}
      <MfLicenseLayer license={license} />
    </div>
  );
}

// ============================================================================
// PROPERTY CONTROLS, PRD F10
// ============================================================================

addPropertyControls(ProtectedDownload, mfControls({
  // The Builder's seal for this instance (27-instance-seal.md). Hidden: it is
  // set on insert and a pasted copy loses it.
  mfSeal: { type: ControlType.String, title: "Seal", hidden: () => true },
  file: {
    type: ControlType.File,
    title: "File",
    allowedFileTypes: [
      "zip", "pdf", "png", "jpg", "jpeg", "gif", "webp", "svg", "mp3", "wav", "mp4", "mov", "txt", "csv", "json", "epub",
      "psd", "ai", "fig", "sketch", "xd", "rar", "7z", "tar", "gz", "docx", "xlsx", "pptx", "key", "ttf", "otf", "woff2",
    ],
  },
  fileName: {
    type: ControlType.String,
    title: "File Name",
    placeholder: "Automatic, e.g. brand-kit.zip",
    defaultValue: "",
  },
  access: {
    type: ControlType.Enum,
    title: "Access",
    options: ["members", "password"],
    optionTitles: ["Members", "Password"],
    displaySegmentedControl: true,
    defaultValue: "members",
  },
  whoCanDownload: {
    type: ControlType.Enum,
    title: "Who Can Download",
    // The generator replaces these two lines with the site's own tiers, by
    // rank, after the first two. Keep them on one line each.
    options: ["signed_in", "any_paid", "tier_1", "tier_2", "vip", "chosen"],
    optionTitles: ["Any signed-in member", "Any paid plan", "Silver members or higher", "Gold members or higher", "VIP members or higher", "Only chosen tiers…"],
    defaultValue: "signed_in",
    hidden: (props) => props.access === "password",
  },
  chosenTiers: {
    type: ControlType.Array,
    title: "Chosen Tiers",
    control: {
      type: ControlType.Enum,
      // The generator replaces these two lines with the site's tiers. Keep them on one line each.
      options: ["free_member", "tier_1", "tier_2", "vip"],
      optionTitles: ["Free Member", "Tier 1: Silver", "Tier 2: Gold", "VIP Member"],
    },
    defaultValue: [],
    hidden: (props) => props.access === "password" || props.whoCanDownload !== "chosen",
  },
  password: {
    type: ControlType.String,
    title: "Password",
    placeholder: "Any letters, numbers, or symbols",
    // Shown as dots, like any password field.
    obscured: true,
    defaultValue: "",
    hidden: (props) => props.access !== "password",
  },
  // Set by the plugin once the file is secured; an older instance's pasted ID still works.
  assetId: {
    type: ControlType.String,
    title: "Asset ID",
    defaultValue: CONFIG.defaultAssetId || "",
    hidden: () => true,
  },
  fileSecured: { type: ControlType.String, title: "Saved File", defaultValue: "", hidden: () => true },
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
}));

// ============================================================================
// ICONS
// ============================================================================
// Inline, tagged with their Lucide names. Framer cannot resolve a lucide-react
// import from a code file: the file fails to load and Add to canvas stalls
// (test/canvasIconImports.test.ts). test/canvasIcons.test.ts holds each shape
// equal to Lucide's. Each draws as lucide-react does: 24px, stroke 2.

interface InlineIconProps {
  className?: string | undefined;
  stroke?: string;
  "aria-hidden"?: boolean;
}

function iconClass(name: string, className: string | undefined): string {
  return className ? `lucide lucide-${name} ${className}` : `lucide lucide-${name}`;
}

function Loader2({ className }: InlineIconProps): React.ReactElement {
  return (
    <svg className={iconClass("loader-circle", className)} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden={true} data-lucide="loader-circle">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function Lock({ className }: InlineIconProps): React.ReactElement {
  return (
    <svg className={iconClass("lock", className)} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden={true} data-lucide="lock">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
