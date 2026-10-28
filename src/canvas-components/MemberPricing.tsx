/**
 * `<MemberPricing>`, the pricing table a visitor buys from. Feature plan FP-16
 * section 9.1.
 *
 * ## This file leaves the repository
 *
 * Like the other canvas components it is written into the creator's Framer
 * project and runs on their published site, so it may import only `react`
 * and `framer`, all styling goes through one `cssContent`
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
  // {host} is this page's own address, from the visitor's browser: the domain
  // the creator has to add. Nothing is read from Framer.
  domain: {
    title: "Add this domain to MemberFrame",
    text: "{host} is not on this site's list of domains, so sign in, payments, and locked content are off here. In Framer, open MemberFrame, then Profile, Site Domains, add {host}, and reload this page.",
  },
};

/** This page's host, for the domain lock: what the creator types in Site Domains. */
function mfPageHost(): string {
  return typeof window !== "undefined" && window.location && window.location.host ? window.location.host : "This address";
}

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
        <p className="mf-lock-text">{copy.text.split("{host}").join(mfPageHost())}</p>
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

// The generator writes the API address into CONFIG. No import.meta here: a
// Framer code file has no Vite env, and Framer reports the read as an error.
const ENV_API_BASE_URL = "";

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
/** The order summary and payment methods for the chooser (29-checkout-methods.md). */
const OPTIONS_PATH = "/api/checkout/options";
const STATUS_PATH = "/api/checkout/status/";
const SESSION_PATH = "/api/member/session";

/** How long the return page waits for the gateway's webhook before saying so. */
const CONFIRM_TIMEOUT_MS = 30_000;
/** Paying in a new tab can take a while (a card form, a bank's 3-D Secure, UPI on a phone). */
const TAB_TIMEOUT_MS = 20 * 60_000;
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
  payTitle: ["Payment chooser title", "Choose how to pay"],
  payContinue: ["Continue button", "Continue to payment"],
  renewsMonth: ["Monthly renewal note", "Renews every month"],
  renewsYear: ["Yearly renewal note", "Renews every year"],
  payOnce: ["One payment note", "One payment"],
  payClose: ["Close chooser", "Close"],
  payInTab: ["Paying in a new tab", "Finish paying in the new tab. This page updates by itself."],
  methodFailed: ["Method failed", "That payment method could not start. Choose another one."],
  backToPlans: ["Back to plans button", "Back to plans"],
  rateLimited: ["Too many attempts", "Too many checkout attempts. Try again in {minutes} min."],
  creditLine: ["Credit line", "Credit for unused {plan}"],
  dueToday: ["Due today", "Due today"],
  thenEvery: ["Renewal line", "Then {price} every {period}"],
  scheduled: ["Downgrade scheduled", "Your plan changes to {tier} on {date}. Nothing is charged today."],
};

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
  /** The tier's own card lines, from Manage, Tiers. Absent from an older server. */
  features?: Array<{ text: string; included: boolean }>;
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

/** One payment method in the chooser, as the server words it. */
interface PayMethod {
  gateway: string;
  title: string;
  description: string;
  /** False when it cannot sell this price; shown, greyed, with the reason. */
  available?: boolean;
  reason?: string | null;
}

const canUse = (method: PayMethod) => method.available !== false;

/** An open chooser: what is being bought, the methods, and the one ticked. */
interface PayChoice {
  tierKey: string;
  interval: PricingInterval;
  summary: {
    tierName: string;
    interval: PricingInterval;
    amountMinor: number;
    currency: string;
    /** Unused credit from the plan being upgraded (30-plan-changes.md). Absent from an older server. */
    creditMinor?: number;
    dueMinor?: number;
    creditFrom?: string | null;
  };
  methods: PayMethod[];
  selected: string;
}

type Flow =
  | { phase: "idle"; message: string | null; tone: "info" | "error" }
  | { phase: "opening"; tierKey: string }
  | { phase: "confirming"; checkoutId: string }
  | { phase: "confirmed"; tierName: string }
  | { phase: "pending"; checkoutId: string }
  /** The buyer is paying in another tab; this page polls until it completes. */
  | { phase: "waiting"; checkoutId: string };

/** What the canvas shows: a creator designs against real-looking plans. */
const PREVIEW_PRICING: PublicPricing = {
  mode: "test",
  pricingPath: "/pricing",
  afterPurchasePath: "/dashboard",
  tiers: [
    { key: "free_member", name: "Free", rank: 0, currency: "USD", prices: { month: null, year: null, lifetime: null }, purchasable: { month: false, year: false, lifetime: false }, features: [{ text: "Members only posts", included: true }, { text: "Community access", included: true }] },
    { key: "tier_1", name: "Silver", rank: 1, currency: "USD", prices: { month: 900, year: 9000, lifetime: null }, purchasable: { month: true, year: true, lifetime: false }, features: [{ text: "Everything in Free", included: true }, { text: "All courses", included: true }, { text: "Monthly live session", included: true }] },
    { key: "tier_2", name: "Gold", rank: 2, currency: "USD", prices: { month: 1900, year: 19000, lifetime: null }, purchasable: { month: true, year: true, lifetime: false }, features: [{ text: "Everything in Silver", included: true }, { text: "Downloadable resources", included: true }, { text: "Priority support", included: true }] },
    { key: "vip", name: "VIP", rank: 3, currency: "USD", prices: { month: null, year: null, lifetime: 29900 }, purchasable: { month: false, year: false, lifetime: true }, features: [{ text: "Everything, forever", included: true }, { text: "One payment, no renewals", included: true }] },
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

/** A card's lines: the tier's own list from MemberFrame, Manage, Tiers (28-tier-features.md). */
function featuresFor(tier: PublicTier): Array<{ text: string; included: boolean }> {
  const own = Array.isArray(tier.features)
    ? tier.features.filter((feature) => feature && typeof feature.text === "string" && feature.text.trim() !== "")
    : [];
  return own.slice(0, 20).map((feature) => ({ text: feature.text.trim(), included: feature.included !== false }));
}

/**
 * The "not included" mark. Drawn here rather than imported: Framer cannot
 * resolve a lucide-react import, and the file would not load (test/canvasIconImports.test.ts).
 */
function MfCross(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden={true} data-lucide="x">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
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
.mf-pricing-feature.is-excluded { opacity: 0.6; }
.mf-pricing-feature.is-excluded svg { color: var(--mf-c-muted); }
.mf-visually-hidden { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
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
.mf-pay {
  position: fixed; inset: 0; z-index: 2147483000; display: flex; align-items: center; justify-content: center;
  padding: 24px; background: var(--mf-c-backdrop, rgba(15, 18, 24, 0.55));
}
.mf-pay-card {
  box-sizing: border-box; width: 100%; max-width: 420px; max-height: 100%; overflow-y: auto;
  display: flex; flex-direction: column; gap: 16px; padding: 24px;
  color: var(--mf-c-text); background: var(--mf-c-surface); border: 1px solid var(--mf-c-border);
  border-radius: var(--mf-c-radius); box-shadow: 0 24px 48px -12px rgba(15, 18, 24, 0.35);
}
.mf-pay-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.mf-pay-title { margin: 0; font-size: calc(18px * var(--mf-text-scale, 1)); font-weight: 700; }
.mf-pay-close {
  appearance: none; display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px;
  padding: 0; border: 0; border-radius: 8px; background: transparent; color: var(--mf-c-muted); cursor: pointer;
}
.mf-pay-close:hover { background: var(--mf-c-field); color: var(--mf-c-text); }
.mf-pay-close svg { width: 16px; height: 16px; stroke: currentColor; }
.mf-pay-summary {
  display: grid; grid-template-columns: 1fr auto; gap: 2px 12px; padding: 12px 14px;
  border-radius: max(0px, calc(var(--mf-c-radius) - 6px)); background: var(--mf-c-field);
}
.mf-pay-plan { font-weight: 600; }
.mf-pay-amount { font-weight: 700; text-align: right; }
.mf-pay-period { grid-column: 1 / -1; color: var(--mf-c-muted); font-size: calc(12px * var(--mf-text-scale, 1)); }
.mf-pay-credit { color: var(--mf-c-muted); }
.mf-pay-amount-credit { text-align: right; }
.mf-pay-methods { display: flex; flex-direction: column; gap: 8px; }
.mf-pay-method {
  appearance: none; display: flex; align-items: flex-start; gap: 12px; width: 100%; margin: 0; padding: 12px 14px;
  text-align: left; font: inherit; color: var(--mf-c-text); background: transparent; cursor: pointer;
  border: 1px solid var(--mf-c-border); border-radius: max(0px, calc(var(--mf-c-radius) - 6px));
}
.mf-pay-method.is-selected { border-color: var(--mf-c-accent); box-shadow: 0 0 0 1px var(--mf-c-accent); }
.mf-pay-method:focus-visible { outline: 2px solid var(--mf-c-accent); outline-offset: 2px; }
.mf-pay-method.is-unavailable { opacity: 0.55; cursor: not-allowed; }
.mf-pay-radio {
  flex: 0 0 16px; width: 16px; height: 16px; margin-top: 2px; box-sizing: border-box;
  border: 1.5px solid var(--mf-c-border); border-radius: 50%;
}
.mf-pay-method.is-selected .mf-pay-radio { border: 5px solid var(--mf-c-accent); }
.mf-pay-method-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.mf-pay-method-title { font-weight: 600; }
.mf-pay-method-desc { color: var(--mf-c-muted); font-size: calc(12px * var(--mf-text-scale, 1)); }
.mf-pay-continue { margin-top: 4px; }
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

/** Set by the MemberFrame Builder on insert, never by hand (27-instance-seal.md). */
interface MfSealProps {
  mfSeal?: string;
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
  props: Partial<PricingConfig> & MfAppearanceProps & MfSealProps
): React.ReactElement {
  const config: PricingConfig = { ...CONFIG, ...props };
  const { colors, typography, layout, spacing, labels } = props;
  const t = (key: string, values?: Record<string, string | number>) => {
    const text = mfLabel(labels, PRICING_LABELS, key);
    return values ? mfFill(text, values) : text;
  };

  const rawId = useId();
  const scope = useMemo(() => `mfp${rawId.replace(/[^a-zA-Z0-9]/g, "")}`, [rawId]);
  const license = useMfLicense(CONFIG.apiBaseUrl, CONFIG.siteKey, props.mfSeal);
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
  /** The payment method chooser, open when two or more methods can sell the price. */
  const [choice, setChoice] = useState<PayChoice | null>(null);
  const choiceRef = useRef<HTMLDivElement>(null);

  // Keep the switch on the creator's choice while they edit it on the canvas.
  useEffect(() => {
    setBillingInterval(config.defaultInterval === "year" ? "year" : "month");
  }, [config.defaultInterval]);

  // ------------------------------------------------------------------------
  // Load the plans and who is looking
  // ------------------------------------------------------------------------

  // On the canvas: the site's real plans once they arrive, the samples until
  // then, and the samples for good if the site has none or is not connected.
  //
  // Asked again every MF_PREVIEW_TTL_MS and when the window regains focus: the
  // canvas keeps a component mounted, so a tier created in the plugin after it
  // was inserted would otherwise never appear until the project reloads.
  useEffect(() => {
    if (!onCanvas) return;
    let active = true;
    let shown = "";
    const refresh = () => {
      void mfCanvasPreview(base, CONFIG.siteKey).then((data) => {
        const pricing = data ? (data["pricing"] as PublicPricing | undefined) : undefined;
        if (!active || !pricing || !Array.isArray(pricing.tiers) || pricing.tiers.length === 0) return;
        // Redraw only when something changed, so the canvas does not flicker.
        const next = JSON.stringify(pricing);
        if (next === shown) return;
        shown = next;
        setLoad({ phase: "ready", pricing });
      });
    };
    refresh();
    const timer = window.setInterval(refresh, MF_PREVIEW_TTL_MS);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
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
    async (checkoutId: string, waitingInTab = false) => {
      setFlow(waitingInTab ? { phase: "waiting", checkoutId } : { phase: "confirming", checkoutId });
      const started = Date.now();
      const deadline = waitingInTab ? TAB_TIMEOUT_MS : CONFIRM_TIMEOUT_MS;

      while (Date.now() - started < deadline) {
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

  /** Create the checkout on the chosen gateway (none: the server picks) and open it. */
  /**
   * A refused checkout in words. In Test mode the gateway's own reason follows
   * ("Your Lemon Squeezy store charges in BDT..."), so the creator sees what to
   * fix; live buyers get the plain message.
   */
  const describeFailure = (
    payload: { reason?: string; detail?: string; retryAfterSeconds?: number },
    chosenGateway?: string
  ): string => {
    if (payload.reason === "rate_limited") {
      return t("rateLimited", { minutes: Math.max(1, Math.ceil(Number(payload.retryAfterSeconds ?? 60) / 60)) });
    }
    const message =
      payload.reason === "no_gateway"
        ? t("noGateway")
        : payload.reason === "already_subscribed"
          ? t("already")
          : chosenGateway && (payload.reason === "gateway_error" || payload.reason === "method_unavailable")
            ? t("methodFailed")
            : t("error");
    const testing = load.phase === "ready" && load.pricing.mode === "test";
    const detail = testing && typeof payload.detail === "string" ? ` ${payload.detail.slice(0, 300)}` : "";
    return message + detail;
  };

  const openCheckout = useCallback(
    async (tierKey: string, chosen: PricingInterval, gateway?: string, tab?: Window | null) => {
      const returnPath = typeof window !== "undefined" ? window.location.pathname : "/";
      setFlow({ phase: "opening", tierKey });
      // A tab opened for this payment that ends up unused is closed again.
      const dropTab = () => {
        if (tab && !tab.closed) tab.close();
      };

      try {
        const response = await fetch(`${base}${CHECKOUT_PATH}`, {
          method: "POST",
          credentials: "include",
          headers: apiHeaders(true),
          body: JSON.stringify(gateway ? { tierKey, interval: chosen, returnPath, gateway } : { tierKey, interval: chosen, returnPath }),
        });

        if (response.ok) {
          const body = (await response.json()) as {
            kind?: string;
            url?: string;
            checkoutId?: string;
            tierName?: string;
            /** Sent by the server for in-page checkout; unused: every gateway opens its own page. */
            embed?: unknown;
          };

          // Switched in place by the gateway, prorated: no checkout page at all.
          if (body.kind === "changed") {
            dropTab();
            finishPurchase(body.tierName ?? "");
            return;
          }

          // A downgrade waits for the end of the paid period (30-plan-changes.md).
          if (body.kind === "scheduled") {
            dropTab();
            const scheduled = body as { tierName?: string; effectiveAt?: string | null };
            const date = scheduled.effectiveAt ? new Date(scheduled.effectiveAt).toLocaleDateString() : "";
            setFlow({ phase: "idle", message: t("scheduled", { tier: scheduled.tierName ?? "", date }), tone: "info" });
            return;
          }

          if (body.url && /^https:\/\//.test(body.url)) {
            // Chosen in the chooser: pay in the new tab, and this page waits
            // for the gateway to confirm (29-checkout-methods.md).
            if (tab && !tab.closed && body.checkoutId) {
              tab.location.href = body.url;
              void confirm(body.checkoutId, true);
              return;
            }
            // The gateway's own checkout page, as Stripe's always was: Lemon
            // Squeezy's overlay and Razorpay's in-page window are gone (2026-10-20).
            // It returns to this page, which confirms and goes to After purchase.
            window.location.assign(body.url);
            return;
          }
        }

        if (response.status === 401) {
          saveIntent({ tierKey, interval: chosen, returnPath, ts: Date.now() });
          if (safePath(config.signupPath)) window.location.assign(config.signupPath);
          return;
        }

        dropTab();
        const payload = (await response.json().catch(() => ({}))) as {
          reason?: string;
          detail?: string;
          retryAfterSeconds?: number;
        };
        setFlow({ phase: "idle", message: describeFailure(payload, gateway), tone: "error" });
      } catch {
        dropTab();
        setFlow({ phase: "idle", message: t("error"), tone: "error" });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, config.signupPath, confirm, finishPurchase, load]
  );

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

      // Which methods can sell this (29-checkout-methods.md): none, a message;
      // one, straight to its checkout; more, the chooser. A switch made in place
      // and a server without the route both go straight on, as before.
      try {
        const response = await fetch(`${base}${OPTIONS_PATH}`, {
          method: "POST",
          credentials: "include",
          headers: apiHeaders(true),
          body: JSON.stringify({ tierKey, interval: chosen }),
        });
        if (response.status === 401) {
          saveIntent({ tierKey, interval: chosen, returnPath, ts: Date.now() });
          if (safePath(config.signupPath)) window.location.assign(config.signupPath);
          return;
        }
        if (response.ok) {
          const body = (await response.json()) as {
            kind?: string;
            summary?: PayChoice["summary"];
            methods?: PayMethod[];
            recommended?: string | null;
          };
          const methods = Array.isArray(body.methods) ? body.methods : [];
          if (body.kind === "choose" && body.summary) {
            // Exactly one gateway shown at checkout: straight into it, on this
            // page. Two or more: the chooser, every one listed.
            if (methods.length === 0 || (methods.length === 1 && !canUse(methods[0]))) {
              setFlow({ phase: "idle", message: t("noGateway"), tone: "error" });
              return;
            }
            if (methods.length > 1) {
              const usable = methods.filter(canUse);
              const selected = usable.some((method) => method.gateway === body.recommended)
                ? String(body.recommended)
                : usable[0]?.gateway ?? "";
              setChoice({ tierKey, interval: chosen, summary: body.summary, methods, selected });
              setFlow({ phase: "idle", message: null, tone: "info" });
              return;
            }
            await openCheckout(tierKey, chosen, methods[0].gateway);
            return;
          }
        } else if (response.status !== 404) {
          // Any refusal is shown, and the chooser is never skipped for it
          // (2026-10-20): only a server without the route goes straight on.
          const payload = (await response.json().catch(() => ({}))) as {
            reason?: string;
            detail?: string;
            retryAfterSeconds?: number;
          };
          setFlow({ phase: "idle", message: describeFailure(payload), tone: "error" });
          return;
        }
      } catch {
        setFlow({ phase: "idle", message: t("error"), tone: "error" });
        return;
      }
      // A switch made in place, or a server without the route: today's path.
      await openCheckout(tierKey, chosen);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, config.signupPath, onCanvas, openCheckout, viewer.kind]
  );

  // The chooser: focus its ticked method on open, and keep the page still behind it.
  useEffect(() => {
    if (!choice || typeof document === "undefined") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    choiceRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
    // Only on open and close, not on each change of the ticked method.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choice !== null]);

  const closeChoice = useCallback(() => {
    setChoice(null);
    setFlow({ phase: "idle", message: t("closed"), tone: "info" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmChoice = useCallback(() => {
    if (!choice || choice.selected === "") return;
    const { tierKey, interval: chosen, selected } = choice;
    // Opened here, inside the click, so a popup blocker allows it; the
    // checkout address is filled in once the server answers. Blocked anyway:
    // the checkout opens on this page instead.
    const tab = window.open("", "_blank");
    setChoice(null);
    void openCheckout(tierKey, chosen, selected, tab);
  }, [choice, openCheckout]);

  /** Arrow keys move the tick, as a radio group does. */
  const onChoiceKey = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!choice) return;
      if (event.key === "Escape") {
        event.stopPropagation();
        closeChoice();
        return;
      }
      if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(event.key)) return;
      event.preventDefault();
      const usable = choice.methods.filter(canUse);
      if (usable.length === 0) return;
      const index = usable.findIndex((method) => method.gateway === choice.selected);
      const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
      const next = usable[(index + step + usable.length) % usable.length];
      setChoice({ ...choice, selected: next.gateway });
      choiceRef.current?.querySelector<HTMLElement>(`[data-gateway="${next.gateway}"]`)?.focus();
    },
    [choice, closeChoice]
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
    `[data-mf-pricing="${MF_SCOPE_SLOT}"] { ` +
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
  const styled = mfStyleScope("mfp", scopedVars);
  const rootClass = `mf-pricing ${MF_THEME_CLASS}`;
  const style = (
    <>
      <style>{mfThemeCss(".mf-pricing")}</style>
      <style>{cssContent}</style>
      <style>{styled.css}</style>
    </>
  );

  const shell = (body: React.ReactNode) => (
    <div className={rootClass} data-mf-pricing={styled.scope}>
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

  if (flow.phase === "confirming" || flow.phase === "confirmed" || flow.phase === "pending" || flow.phase === "waiting") {
    return shell(
      <div className="mf-pricing-state" role="status" aria-live="polite">
        {flow.phase === "confirmed" ? (
          <Check aria-hidden={true} />
        ) : (
          <Loader2 className={flow.phase === "confirming" || flow.phase === "waiting" ? "mf-pricing-spin" : undefined} aria-hidden={true} />
        )}
        <p>
          {flow.phase === "waiting"
            ? t("payInTab")
            : flow.phase === "confirming"
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
        {flow.phase === "waiting" ? (
          // Closed the payment tab, or want another method: back to the cards.
          // A payment that still completes is picked up by the next check.
          <button type="button" className="mf-pricing-button" onClick={() => setFlow({ phase: "idle", message: null, tone: "info" })}>
            {t("backToPlans")}
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

      {choice ? (
        <div
          className="mf-pay"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeChoice();
          }}
          onKeyDown={onChoiceKey}
        >
          <div className="mf-pay-card" ref={choiceRef} role="dialog" aria-modal={true} aria-labelledby={`${scope}-pay-title`}>
            <div className="mf-pay-head">
              <h3 className="mf-pay-title" id={`${scope}-pay-title`}>
                {t("payTitle")}
              </h3>
              <button type="button" className="mf-pay-close" aria-label={t("payClose")} onClick={closeChoice}>
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" aria-hidden={true} data-lucide="x">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="mf-pay-summary">
              <span className="mf-pay-plan">{choice.summary.tierName}</span>
              <span className="mf-pay-amount">{formatPrice(choice.summary.amountMinor, choice.summary.currency)}</span>
              {(choice.summary.creditMinor ?? 0) > 0 ? (
                // An upgrade: the unused part of the current plan comes off today's charge.
                <>
                  <span className="mf-pay-credit">{t("creditLine", { plan: choice.summary.creditFrom ?? "" })}</span>
                  <span className="mf-pay-credit mf-pay-amount-credit">
                    -{formatPrice(choice.summary.creditMinor ?? 0, choice.summary.currency)}
                  </span>
                  <span className="mf-pay-plan">{t("dueToday")}</span>
                  <span className="mf-pay-amount">
                    {formatPrice(choice.summary.dueMinor ?? choice.summary.amountMinor, choice.summary.currency)}
                  </span>
                  <span className="mf-pay-period">
                    {choice.summary.interval === "lifetime"
                      ? t("payOnce")
                      : t("thenEvery", {
                          price: formatPrice(choice.summary.amountMinor, choice.summary.currency),
                          period: choice.summary.interval === "year" ? "year" : "month",
                        })}
                  </span>
                </>
              ) : (
                <span className="mf-pay-period">
                  {choice.summary.interval === "lifetime"
                    ? t("payOnce")
                    : choice.summary.interval === "year"
                      ? t("renewsYear")
                      : t("renewsMonth")}
                </span>
              )}
            </div>

            <div className="mf-pay-methods" role="radiogroup" aria-label={t("payTitle")}>
              {choice.methods.map((method) => {
                const selected = method.gateway === choice.selected;
                const usable = canUse(method);
                return (
                  <button
                    key={method.gateway}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-disabled={!usable || undefined}
                    disabled={!usable}
                    tabIndex={selected ? 0 : -1}
                    data-gateway={method.gateway}
                    className={`mf-pay-method${selected ? " is-selected" : ""}${usable ? "" : " is-unavailable"}`}
                    onClick={() => usable && setChoice({ ...choice, selected: method.gateway })}
                  >
                    <span className="mf-pay-radio" aria-hidden={true} />
                    <span className="mf-pay-method-text">
                      <span className="mf-pay-method-title">{method.title}</span>
                      {usable ? (
                        method.description ? <span className="mf-pay-method-desc">{method.description}</span> : null
                      ) : (
                        <span className="mf-pay-method-desc">{method.reason || t("unavailable")}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="mf-pricing-button is-primary mf-pay-continue"
              disabled={choice.selected === ""}
              onClick={confirmChoice}
            >
              {t("payContinue")}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mf-pricing-grid">
        {cards.map(({ tier, recurring, recurringInterval, lifetime, free }) => {
          const highlighted =
            highlight !== "" && (tier.name.toLowerCase() === highlight || tier.key.toLowerCase() === highlight);
          const current = viewer.kind === "member" && viewer.activeTier === tier.key;
          const lines = featuresFor(tier);
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
                    <li key={index} className={`mf-pricing-feature${line.included ? "" : " is-excluded"}`}>
                      {line.included ? <Check aria-hidden={true} /> : <MfCross />}
                      <span>{line.text}</span>
                      {line.included ? null : <span className="mf-visually-hidden"> (not included)</span>}
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

addPropertyControls(MemberPricing, mfControls({
  // The Builder's seal for this instance (27-instance-seal.md). Hidden: it is
  // set on insert and a pasted copy loses it.
  mfSeal: { type: ControlType.String, title: "Seal", hidden: () => true },
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

function Check({ className }: InlineIconProps): React.ReactElement {
  return (
    <svg className={iconClass("check", className)} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden={true} data-lucide="check">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function Loader2({ className }: InlineIconProps): React.ReactElement {
  return (
    <svg className={iconClass("loader-circle", className)} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden={true} data-lucide="loader-circle">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function ShieldCheck({ className }: InlineIconProps): React.ReactElement {
  return (
    <svg className={iconClass("shield-check", className)} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden={true} data-lucide="shield-check">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
