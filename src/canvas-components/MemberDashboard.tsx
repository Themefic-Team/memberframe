/**
 * `<MemberDashboard>`, the member's own account page. Feature plan FP-08,
 * PRD feature F06.
 *
 * ## This file leaves the repository
 *
 * Everything in `<MemberAuth>`'s header applies here. It is written into the creator's Framer project
 * and runs on their published site, so it may import only `react` and `framer`,
 * all styling goes through one `cssContent` string, and the
 * marked config block is the only region the generator rewrites.
 *
 * ## What it is actually for
 *
 * Two jobs, and the second is the one that was missing from the product.
 *
 * **It is the page a member lands on.** `afterLoginPath` points here, so it is
 * the first thing a member sees after signing in, and it has to say something
 * true and useful rather than being a blank protected frame.
 *
 * **It makes session state legible.** Until now nothing on a creator's site
 * told a visitor whether they were signed in. A locked page or section says
 * something about the content and nothing about the person: a visitor turned
 * away cannot tell whether they are signed out, signed in at the wrong tier,
 * or looking at a broken page. This component names the state in words, every
 * time, in all five cases.
 *
 * ## An account area with sections (2026-10-27)
 *
 * A section menu (a sidebar, a top row below 720px of width) over Overview,
 * Membership, Billing, Bookmarks, Profile, and Security, in the shape of a
 * WooCommerce account page. docs/development-docs/33-member-account.md has the
 * sections, the endpoints behind each, and the rules. The address carries the
 * section as `#account-<name>`, so a link opens one and Back returns.
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
// CONTRACTS
// ============================================================================

type MemberStatus = "active" | "trialing" | "past_due" | "canceled";

interface MemberSessionData {
  memberId: string;
  email: string;
  name: string | null;
  activeTier: string;
  status: MemberStatus;
  currentPeriodEnd: number;
  gracePeriodEndsAt: number;
  siteId: string;
}

interface TierLadderEntry {
  key: string;
  rank: number;
  name: string;
}

/**
 * Every visible string, as [sidebar title, default]. The Labels group edits
 * them; an empty field falls back. Save and validation errors stay fixed: they
 * are feedback, not design copy. The misconfigured notice is addressed to the
 * creator and stays fixed too.
 */
const DASH_LABELS: Record<string, readonly [string, string]> = {
  emailRow: ["Email row", "Email"],
  membershipRow: ["Membership row", "Membership"],
  statusRow: ["Status row", "Status"],
  statusActive: ["Status: active", "Active"],
  statusTrialing: ["Status: trial", "In trial"],
  statusPastDue: ["Status: payment failed", "Payment failed"],
  statusCanceled: ["Status: canceled", "Canceled"],
  profileTitle: ["Profile title", "Profile"],
  nameLabel: ["Name label", "Name"],
  optional: ["Optional marker", "Optional"],
  chooseOne: ["Select placeholder", "Choose one"],
  saveProfile: ["Save button", "Save profile"],
  saving: ["Saving", "Saving"],
  saved: ["Saved message", "Profile saved."],
  profileLoading: ["Profile loading", "Loading your profile."],
  profileUnavailable: ["Profile failed", "Your profile could not be loaded. Refresh the page to try again."],
  loading: ["Account loading", "Checking your account."],
  unavailable: ["Account failed", "Your account could not be loaded. Check your connection and try again."],
  billingTitle: ["Billing title", "Billing"],
  renewsOn: ["Renews on", "Renews on {date}"],
  endsOn: ["Ends on", "Your plan ends on {date}"],
  lifetime: ["Lifetime access", "Lifetime access, no renewals"],
  pastDue: [
    "Payment failed",
    "Your latest payment was unsuccessful. Update your billing details by {date} to keep your access.",
  ],
  manageBilling: ["Manage billing button", "Manage billing"],
  updatePayment: ["Update payment button", "Update payment"],
  cancelPlan: ["Cancel button", "Cancel plan"],
  confirmCancel: ["Confirm cancel button", "Cancel plan"],
  resumePlan: ["Resume button", "Resume plan"],
  noPlan: ["No paid plan", "You are on the free plan."],
  seePlans: ["See plans button", "See plans"],
  history: ["Payment history title", "Payment history"],
  receipt: ["Receipt link", "Receipt"],
  refunded: ["Refunded", "Refunded"],
  billingFailed: ["Billing failed", "Billing details could not be loaded."],
  subscriptionTitle: ["Subscription popup title", "Your subscription"],
  paidWith: ["Paid with", "Paid with {gateway}"],
  updateMethod: ["Update payment method button", "Update payment method"],
  changePlan: ["Change plan title", "Change plan"],
  upgrade: ["Upgrade button", "Upgrade"],
  downgrade: ["Downgrade button", "Downgrade"],
  confirmChange: ["Confirm change button", "Confirm"],
  changeNote: ["Change note", "You pay the difference now, credited for the time left on your plan."],
  planChanged: ["Plan changed", "You are now on {tier}."],
  changeFailed: ["Change failed", "The plan could not be changed. Try again in a moment."],
  closeBilling: ["Close popup", "Close"],
  cancelQuestion: ["Cancel question", "Cancel your {tier} plan?"],
  cancelKeeps: ["Cancel note", "You keep access until {date}. It does not renew after that."],
  keepPlan: ["Keep plan button", "Keep plan"],
  renewalPending: ["Renewal pending", "Renewal is being processed."],
  creditLine: ["Credit line", "Credit for unused {plan}"],
  dueToday: ["Due today", "Due today"],
  thenEvery: ["Renewal line", "Then {price} every {period}"],
  downgradeNote: ["Downgrade note", "Switches to {tier} on {date}. Nothing is charged today."],
  confirmDowngrade: ["Confirm downgrade button", "Confirm downgrade"],
  confirmUpgrade: ["Confirm upgrade button", "Pay and upgrade"],
  notNow: ["Cancel change button", "Not now"],
  changesTo: ["Scheduled change", "Changes to {tier} on {date}"],
  undoChange: ["Undo change button", "Undo"],
  scheduledDone: ["Downgrade scheduled", "Your plan changes to {tier} on {date}."],
  plansTitle: ["Plans history title", "Plans"],
  planActive: ["Plan active", "Active"],
  planEnded: ["Plan ended", "Ended"],
  creditedLine: ["Credit history line", "Credit for unused time"],
  testPurchase: ["Test purchase", "Test purchase"],
  signIn: ["Sign in button", "Sign in"],
  signOut: ["Sign out button", "Sign out"],
  signingOut: ["Signing out", "Signing out"],
  // The account area (33-member-account.md).
  navOverview: ["Menu: overview", "Overview"],
  navMembership: ["Menu: membership", "Membership"],
  navBilling: ["Menu: billing", "Billing"],
  navBookmarks: ["Menu: bookmarks", "Bookmarks"],
  navProfile: ["Menu: profile", "Profile"],
  navSecurity: ["Menu: security", "Security"],
  overviewTitle: ["Overview title", "Welcome back, {name}"],
  overviewDesc: ["Overview description", "Your membership at a glance."],
  statPlan: ["Stat: plan", "Plan"],
  statSaved: ["Stat: saved", "Saved items"],
  statSince: ["Stat: member since", "Member since"],
  recentSaved: ["Recently saved title", "Recently saved"],
  seeAll: ["See all link", "See all"],
  managePlan: ["Manage plan button", "Manage plan"],
  membershipDesc: ["Membership description", "Your plan, its renewal, and plan changes."],
  billingDesc: ["Billing description", "Payments, receipts, and your payment method."],
  noPayments: ["No payments", "No payments yet."],
  bookmarksDesc: ["Bookmarks description", "Everything you saved on this site."],
  searchSaved: ["Search placeholder", "Search saved items"],
  noBookmarks: ["No bookmarks", "Nothing saved yet. Use the bookmark button on any page to keep it here."],
  noMatches: ["No search results", "No saved items match your search."],
  removeBookmark: ["Remove bookmark button", "Remove"],
  bookmarksFailed: ["Bookmarks failed", "Your saved items could not be loaded."],
  savedOn: ["Saved on", "Saved {date}"],
  profileDesc: ["Profile description", "Your name, photo, and details."],
  photoTitle: ["Photo title", "Photo"],
  uploadPhoto: ["Upload photo button", "Upload photo"],
  changePhoto: ["Change photo button", "Change photo"],
  removePhoto: ["Remove photo button", "Remove"],
  photoHint: ["Photo hint", "PNG, JPEG, or WebP, up to 2 MB."],
  photoTooLarge: ["Photo too large", "That photo is larger than 2 MB."],
  photoWrongType: ["Photo wrong type", "Use a PNG, JPEG, or WebP image."],
  photoFailed: ["Photo failed", "The photo could not be saved. Try again."],
  removePhotoQuestion: ["Remove photo question", "Remove your photo?"],
  emailLabel: ["Email label", "Email"],
  emailFixed: ["Email note", "Contact the site owner to change your email."],
  securityDesc: ["Security description", "Your password, sign-in methods, and devices."],
  passwordTitle: ["Password title", "Password"],
  passwordSetNote: ["Set password note", "You sign in with a connected account. Set a password to sign in with your email too."],
  currentPassword: ["Current password label", "Current password"],
  newPassword: ["New password label", "New password"],
  confirmPassword: ["Confirm password label", "Confirm new password"],
  changePassword: ["Change password button", "Change password"],
  setPassword: ["Set password button", "Set password"],
  passwordMismatch: ["Passwords differ", "The new passwords do not match."],
  passwordWrong: ["Wrong password", "Your current password is not right."],
  passwordWeak: ["Weak password", "Choose a stronger password."],
  passwordChanged: ["Password changed", "Password saved. Your other devices were signed out."],
  passwordFailed: ["Password failed", "Your password could not be saved. Try again."],
  methodsTitle: ["Sign-in methods title", "Sign-in methods"],
  methodsNone: ["No sign-in methods", "You sign in with your email."],
  connectedOn: ["Connected on", "Connected {date}"],
  unlink: ["Unlink button", "Unlink"],
  unlinkLast: ["Last sign-in method", "Set a password first: this is your only way to sign in."],
  unlinkQuestion: ["Unlink question", "Unlink {provider}?"],
  unlinkNote: ["Unlink note", "You will no longer be able to sign in with {provider}."],
  devicesTitle: ["Devices title", "Devices"],
  thisDevice: ["This device", "This device"],
  lastActive: ["Last active", "Last active {date}"],
  signOutDevice: ["Sign out device button", "Sign out"],
  signOutDeviceQuestion: ["Sign out device question", "Sign out {device}?"],
  signOutEverywhere: ["Sign out everywhere button", "Sign out everywhere"],
  signOutDeviceNote: ["Sign out device note", "That device will need to sign in again."],
  signOutEverywhereNote: ["Sign out everywhere note", "Every device, this one included, will need to sign in again."],
  dangerTitle: ["Delete account title", "Delete account"],
  deleteNote: ["Delete account note", "Deletes your account and saved items for good. This cannot be undone."],
  deleteButton: ["Delete account button", "Delete account"],
  deleteConfirmLabel: ["Delete confirm label", "Type {email} to confirm"],
  deleteFinal: ["Delete for good button", "Delete for good"],
  deleteBlocked: ["Delete blocked", "Cancel your plan in Membership first. Your account can be deleted once it no longer renews."],
  deleteFailed: ["Delete failed", "Your account could not be deleted. Try again."],
  cancelAction: ["Cancel button in dialogs", "Cancel"],
  actionFailed: ["Action failed", "That did not work. Try again in a moment."],
  sessionExpired: ["Session expired", "Your session has expired. Please sign in to access your dashboard."],
};

interface DashboardConfig {
  headline: string;
  showTier: boolean;
  showBilling: boolean;
  showSignOut: boolean;
  /** FP-09. The member's editable profile: name plus the site's custom fields. */
  showProfile: boolean;
  signedOutMessage: string;
  accentColor: string;
  borderRadius: number;
  apiBaseUrl: string;
  /** Public. Identifies the tenant; `Origin` is what authorizes. */
  siteKey: string;
  /** Where "Sign in" sends a signed-out visitor. Site-relative. */
  loginPath: string;
  /** Where signing out lands. Site-relative. */
  afterLogoutPath: string;
}

/**
 * Display options with no field in the plugin, so they are not part of CONFIG
 * and the generator never writes them. Their defaults live in the component
 * and in the controls below, and match the panel as it looked before them.
 */
interface DashboardDisplayProps {
  showAvatar?: boolean;
  showEmail?: boolean;
  showStatus?: boolean;
  signOutStyle?: "outline" | "filled" | "text";
  /** FP-16. The member's past payments under the plan. */
  showPaymentHistory?: boolean;
  /** FP-16. A member may cancel from here, at the end of the period. */
  allowCancel?: boolean;
}

/** `GET /api/member/billing`, FP-16. */
interface BillingPlanOption {
  key: string;
  name: string;
  rank: number;
  currency: string;
  prices: { month: number | null; year: number | null; lifetime: number | null };
}

interface BillingSummary {
  subscription: {
    tierKey?: string;
    tierName: string;
    interval: string;
    /** The gateway it is paid through. Absent from an older server. */
    gateway?: string;
    /** A downgrade waiting for the period end (30-plan-changes.md). */
    scheduledTierName?: string | null;
    scheduledInterval?: string | null;
    status: string;
    amountMinor: number;
    currency: string;
    currentPeriodEnd: string | null;
    gracePeriodEndsAt: string | null;
    cancelAtPeriodEnd: boolean;
    mode: string;
    canCancel: boolean;
    canResume: boolean;
    canManage: boolean;
  } | null;
  payments: Array<{
    id: string;
    amountMinor: number;
    currency: string;
    status: string;
    receiptUrl: string | null;
    paidAt: string;
    /** Every gateway's payments are listed; each names its own. Absent from an older server. */
    gateway?: string;
    mode?: string;
    planName?: string | null;
    interval?: string | null;
  }>;
  /** The plans a member can switch to. Absent from an older server. */
  plans?: BillingPlanOption[];
  /** Every plan held and every credit given (30-plan-changes.md). Absent from an older server. */
  history?: {
    plans: Array<{ planName: string; interval: string; gateway: string; mode: string; status: string; startedAt: string; endedAt: string | null }>;
    credits: Array<{ planName: string; gateway: string; mode: string; amountMinor: number; currency: string; at: string | null }>;
  };
  pricingPath: string;
}

const GATEWAY_NAMES: Record<string, string> = { stripe: "Stripe", lemonsqueezy: "Lemon Squeezy", razorpay: "Razorpay" };
const gatewayName = (gateway: string | undefined) => (gateway ? GATEWAY_NAMES[gateway] ?? gateway : "");

const OPTIONS_PATH = "/api/checkout/options";
const CHECKOUT_PATH = "/api/checkout/create-session";

type BillingState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "ready"; summary: BillingSummary }
  | { phase: "failed" };

const BILLING_PATH = "/api/member/billing";

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

function formatMoney(amountMinor: number, currency: string): string {
  const exponent = currencyExponent(currency);
  const amount = amountMinor / 10 ** exponent;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: exponent,
      maximumFractionDigits: exponent,
    }).format(amount);
  } catch {
    return `${amount.toFixed(exponent)} ${currency}`;
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// The generator writes the API address into CONFIG. No import.meta here: a
// Framer code file has no Vite env, and Framer reports the read as an error.
const ENV_API_BASE_URL = "";

// @memberframe-config-start
const CONFIG: DashboardConfig = {
  headline: "Your account",
  showTier: true,
  showBilling: true,
  showSignOut: true,
  showProfile: true,
  signedOutMessage: "Sign in to see your account.",
  accentColor: "#5271ff",
  borderRadius: 12,
  apiBaseUrl: ENV_API_BASE_URL,
  siteKey: "",
  loginPath: "/login",
  afterLogoutPath: "/",
};
// @memberframe-config-end

const SESSION_PATH = "/api/member/session";
const LOGOUT_PATH = "/api/member/logout";

/**
 * Keep the Route Shield in step with this browser's session. The hint lets
 * the shield move a signed-in member off the sign in page before it paints;
 * the cache is its 30 second session copy, which must not outlive a sign out.
 * Same keys as MemberAuth and the shield script. Change them together.
 */
function syncShieldSession(signedIn: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(`__mf_session_${CONFIG.siteKey}`);
    if (signedIn) window.localStorage.setItem(`memberframe:signed-in:${CONFIG.siteKey}`, "1");
    else window.localStorage.removeItem(`memberframe:signed-in:${CONFIG.siteKey}`);
  } catch {
    // Storage can be blocked. The hint only saves a flash.
  }
}
const PROFILE_PATH = "/api/member/profile";

// ============================================================================
// PROFILE FIELDS, DUPLICATED FROM src/utils/customFields.ts
// ============================================================================
// FP-09 section 3.2. Every function in this block is held identical to the
// plugin's copy by `test/customFieldsParity.test.ts`, and the plugin's copy to
// the server's by the backend's parity test. Edit all of them or none.

type CustomFieldType = "text" | "textarea" | "url" | "phone" | "select" | "boolean" | "number";

interface FieldCondition {
  key: string;
  value: string;
}

interface CustomFieldDefinition {
  key: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  options: string[];
  placeholder: string;
  showWhen?: FieldCondition | null;
}

type MetadataValue = string | number | boolean | null;
type MemberMetadata = Record<string, MetadataValue>;

interface ProfileValidation {
  metadata: MemberMetadata;
  problems: Record<string, string>;
}

const MAX_TEXT_LENGTH = 255;
const MAX_TEXTAREA_LENGTH = 2000;
const MAX_URL_LENGTH = 2048;

function isSafeUrl(value: string): boolean {
  if (value.length > MAX_URL_LENGTH) return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isPhoneLike(value: string): boolean {
  return /^\+?[0-9][0-9\s\-().]{5,24}$/.test(value);
}

function checkValue(
  field: CustomFieldDefinition,
  raw: unknown
): { value: MetadataValue } | { problem: string } {
  if (raw === null || raw === undefined) {
    return field.required ? { problem: `${field.label} is required.` } : { value: null };
  }

  switch (field.type) {
    case "boolean": {
      if (typeof raw !== "boolean") return { problem: `${field.label} must be on or off.` };
      if (field.required && !raw) return { problem: `${field.label} is required.` };
      return { value: raw };
    }

    case "number": {
      if (typeof raw !== "number" || !Number.isFinite(raw)) {
        return { problem: `${field.label} must be a number.` };
      }
      return { value: raw };
    }

    case "select": {
      if (typeof raw !== "string") return { problem: `${field.label} must be one of the options.` };
      if (raw === "") {
        return field.required ? { problem: `${field.label} is required.` } : { value: null };
      }
      if (!field.options.includes(raw)) {
        return { problem: `${field.label} must be one of the options.` };
      }
      return { value: raw };
    }

    case "url": {
      if (typeof raw !== "string") return { problem: `${field.label} must be a web address.` };
      const trimmed = raw.trim();
      if (trimmed === "") {
        return field.required ? { problem: `${field.label} is required.` } : { value: null };
      }
      if (!isSafeUrl(trimmed)) {
        return { problem: `${field.label} must be a web address starting with https://.` };
      }
      return { value: trimmed };
    }

    case "phone": {
      if (typeof raw !== "string") return { problem: `${field.label} must be a phone number.` };
      const trimmed = raw.trim();
      if (trimmed === "") {
        return field.required ? { problem: `${field.label} is required.` } : { value: null };
      }
      if (!isPhoneLike(trimmed)) return { problem: `${field.label} does not look like a number.` };
      return { value: trimmed };
    }

    case "textarea":
    case "text": {
      if (typeof raw !== "string") return { problem: `${field.label} must be text.` };
      const trimmed = raw.trim();
      if (trimmed === "") {
        return field.required ? { problem: `${field.label} is required.` } : { value: null };
      }
      const limit = field.type === "textarea" ? MAX_TEXTAREA_LENGTH : MAX_TEXT_LENGTH;
      if (trimmed.length > limit) return { problem: `${field.label} is too long.` };
      return { value: trimmed };
    }

    default:
      return { problem: `${field.label} cannot be saved.` };
  }
}

function isFieldVisible(
  field: CustomFieldDefinition,
  values: Readonly<Record<string, MetadataValue | undefined>>
): boolean {
  if (!field.showWhen) return true;

  const parent = values[field.showWhen.key];
  if (parent === null || parent === undefined) return false;

  return String(parent) === field.showWhen.value;
}

function toSubmittedValue(
  field: CustomFieldDefinition,
  raw: string | boolean | number | null | undefined
): MetadataValue {
  if (raw === null || raw === undefined) return null;

  if (field.type === "boolean") return raw === true;

  if (field.type === "number") {
    if (typeof raw === "number") return raw;
    const trimmed = String(raw).trim();
    if (trimmed === "") return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : trimmed;
  }

  return String(raw);
}

function validateProfile(
  fields: ReadonlyArray<CustomFieldDefinition>,
  values: Readonly<Record<string, MetadataValue | undefined>>,
  keys?: ReadonlyArray<string>
): ProfileValidation {
  const metadata: MemberMetadata = {};
  const problems: Record<string, string> = {};

  for (const field of fields) {
    if (keys && !keys.includes(field.key)) continue;
    if (!isFieldVisible(field, values)) continue;

    const result = checkValue(field, toSubmittedValue(field, values[field.key]));

    if ("problem" in result) {
      problems[field.key] = result.problem;
      continue;
    }

    metadata[field.key] = result.value;
  }

  return { metadata, problems };
}

/** The definitions out of a response this component did not write. Malformed entries are dropped. */
function readFields(value: unknown): CustomFieldDefinition[] {
  if (!Array.isArray(value)) return [];

  const types = ["text", "textarea", "url", "phone", "select", "boolean", "number"];
  const fields: CustomFieldDefinition[] = [];

  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;

    const key = record["key"];
    const label = record["label"];
    const type = record["type"];
    if (typeof key !== "string" || typeof label !== "string") continue;
    if (typeof type !== "string" || types.indexOf(type) === -1) continue;

    const rawCondition = record["showWhen"] as Record<string, unknown> | null | undefined;
    const showWhen =
      rawCondition &&
      typeof rawCondition["key"] === "string" &&
      typeof rawCondition["value"] === "string"
        ? { key: rawCondition["key"], value: rawCondition["value"] }
        : null;

    fields.push({
      key,
      label,
      type: type as CustomFieldType,
      required: record["required"] === true,
      options: Array.isArray(record["options"])
        ? (record["options"] as unknown[]).filter((option): option is string => typeof option === "string")
        : [],
      placeholder: typeof record["placeholder"] === "string" ? record["placeholder"] : "",
      showWhen,
    });
  }

  return fields;
}

function readMetadata(value: unknown): MemberMetadata {
  const out: MemberMetadata = {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) return out;

  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (
      entry === null ||
      typeof entry === "string" ||
      typeof entry === "number" ||
      typeof entry === "boolean"
    ) {
      out[key] = entry as MetadataValue;
    }
  }

  return out;
}

/** What the canvas shows a creator laying the dashboard out, since there is no member there. */
const PREVIEW_FIELDS: CustomFieldDefinition[] = [
  { key: "company", label: "Company", type: "text", required: true, options: [], placeholder: "" },
  { key: "portfolio_url", label: "Portfolio URL", type: "url", required: false, options: [], placeholder: "https://" },
  {
    key: "experience",
    label: "Experience level",
    type: "select",
    required: false,
    options: ["Junior", "Mid-level", "Senior (5+ years)"],
    placeholder: "",
  },
];

const PREVIEW_VALUES: MemberMetadata = {
  company: "Acme Design Co",
  portfolio_url: "https://jordan.design",
  experience: "Senior (5+ years)",
};

// ============================================================================
// SHARED HELPERS, DUPLICATED FROM THE PLUGIN
// ============================================================================
// This file is compiled by Framer alone on a published site, so it cannot
// import from this repository. Each of these has a counterpart in `src/` and
// the counterpart is the original.

/**
 * Status in words a member can read.
 *
 * PRD section 7.6 rule 4 forbids surfacing a raw enum value to a user, and
 * `past_due` is the clearest example of why: it reads as jargon to a member and
 * as an accusation to one whose card simply expired.
 */
function statusLabel(status: MemberStatus, labels: Record<string, unknown> | null | undefined): string {
  switch (status) {
    case "active":
      return mfLabel(labels, DASH_LABELS, "statusActive");
    case "trialing":
      return mfLabel(labels, DASH_LABELS, "statusTrialing");
    case "past_due":
      return mfLabel(labels, DASH_LABELS, "statusPastDue");
    case "canceled":
      return mfLabel(labels, DASH_LABELS, "statusCanceled");
    default:
      return "Unknown";
  }
}

/**
 * A tier's display name, from the ladder the server sent.
 *
 * Falls back to the key only when the ladder does not contain it, which means
 * the member holds a tier the site has deleted. Showing the raw key there is
 * the lesser evil: it is wrong-looking, which is correct, because the situation
 * is wrong and the creator needs to notice.
 */
function tierName(key: string, tiers: ReadonlyArray<TierLadderEntry>): string {
  const match = tiers.find((tier) => tier.key === key);
  if (match && match.name) return match.name;
  switch (key) {
    case "free_member":
      return "Free";
    case "tier_1":
      return "Tier 1";
    case "tier_2":
      return "Tier 2";
    case "vip":
      return "VIP";
    default:
      return key ? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Free";
  }
}

/**
 * Is this a path we are willing to send a visitor to?
 *
 * The same check `<MemberAuth>` carries, and the reason is the same: a value
 * that could be an absolute URL turns this component into an open redirect.
 * `//evil.com` begins with a slash and is not a path, because a browser reads
 * it as protocol-relative and leaves the site.
 */
function safePath(value: string): boolean {
  if (value === "" || !value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  if (value.indexOf("\\") !== -1) return false;
  return true;
}

/**
 * An auto-renewing plan whose date has passed: the gateway is renewing it,
 * and the server checks with the gateway if it does not hear (30-plan-changes.md).
 * Saying "Renews on" a past date would read as an error.
 */
function renewalOverdue(periodEnd: string | null): boolean {
  if (!periodEnd) return false;
  const end = new Date(periodEnd).getTime();
  return Number.isFinite(end) && end < Date.now();
}

function navigate(path: string): void {
  if (!safePath(path)) return;
  if (typeof window === "undefined") return;
  window.location.assign(path);
}

/**
 * Headers for every call.
 *
 * One place, so a route added later cannot forget the site key. The key is
 * omitted rather than sent blank when it is empty: the server tells "no key"
 * from "unknown key" and a blank one lands in the wrong branch.
 */
function apiHeaders(withBody: boolean): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };

  if (withBody) headers["Content-Type"] = "application/json";
  if (CONFIG.siteKey !== "") headers["X-MemberFrame-Site"] = CONFIG.siteKey;
  // A free ngrok tunnel answers a browser with its warning page, not the API,
  // unless the request asks it not to. Only sent to an ngrok address.
  if (CONFIG.apiBaseUrl.indexOf(".ngrok") !== -1) headers["ngrok-skip-browser-warning"] = "1";

  return headers;
}


// ============================================================================
// STATE
// ============================================================================

/**
 * Five states, one union, no booleans.
 *
 * The point of a union here is that "loading and also signed in" is not
 * representable, and that every branch has to be rendered for the component to
 * typecheck. A pair of booleans is how a component ends up showing a spinner
 * over a stale account.
 *
 * `unavailable` is separate from `signed_out` and that distinction is the whole
 * reason this component is worth having. A visitor who is signed out should be
 * asked to sign in; a visitor whose network failed should be told to try again.
 * Telling the first to try again, or the second to sign in, sends them down a
 * path that cannot work.
 */
type DashboardState =
  | { phase: "loading" }
  | { phase: "signed_out" }
  | { phase: "signed_in"; member: MemberSessionData; tiers: ReadonlyArray<TierLadderEntry> }
  | { phase: "unavailable" }
  | { phase: "misconfigured" };

/**
 * The profile section's own state, separate from the account's.
 *
 * Separate so that a profile request failing leaves the account above it
 * intact: a member whose email, tier, and status loaded should still see them,
 * with one line saying the profile could not be loaded, rather than an account
 * page that has gone blank over a secondary call.
 */
type ProfileState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "ready"; fields: CustomFieldDefinition[] }
  | { phase: "unavailable" };

// ============================================================================
// ONE PROFILE CONTROL
// ============================================================================

interface ProfileControlProps {
  id: string;
  field: CustomFieldDefinition;
  value: MetadataValue | undefined;
  error: string | undefined;
  disabled: boolean;
  onChange: (value: MetadataValue) => void;
  /** From the Labels group. */
  optionalLabel: string;
  chooseLabel: string;
}

function ProfileControl({
  id,
  field,
  value,
  error,
  disabled,
  onChange,
  optionalLabel,
  chooseLabel,
}: ProfileControlProps): React.ReactElement {
  const errorId = `${id}-error`;
  const described = error ? errorId : undefined;
  const text = value === null || value === undefined ? "" : String(value);
  const inputClass = `mf-dash-input${error ? " is-invalid" : ""}`;

  const errorLine = error ? (
    <p className="mf-dash-error" id={errorId}>
      {error}
    </p>
  ) : null;

  if (field.type === "boolean") {
    return (
      <div className="mf-dash-field">
        <label className="mf-dash-check" htmlFor={id}>
          <input
            id={id}
            type="checkbox"
            checked={value === true}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={described}
            onChange={(event) => onChange(event.currentTarget.checked)}
          />
          <span>{field.label}</span>
        </label>
        {errorLine}
      </div>
    );
  }

  const common = {
    id,
    className: inputClass,
    disabled,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": described,
    "aria-required": field.required || undefined,
  };

  let control: React.ReactElement;

  if (field.type === "textarea") {
    control = (
      <textarea
        {...common}
        value={text}
        placeholder={field.placeholder}
        maxLength={MAX_TEXTAREA_LENGTH}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    );
  } else if (field.type === "select") {
    control = (
      <select {...common} value={text} onChange={(event) => onChange(event.currentTarget.value)}>
        <option value="">{chooseLabel}</option>
        {field.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  } else {
    const inputType =
      field.type === "url" ? "url" : field.type === "phone" ? "tel" : field.type === "number" ? "number" : "text";

    control = (
      <input
        {...common}
        type={inputType}
        inputMode={field.type === "number" ? "decimal" : undefined}
        value={text}
        placeholder={field.placeholder}
        maxLength={field.type === "url" ? MAX_URL_LENGTH : field.type === "number" ? undefined : MAX_TEXT_LENGTH}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    );
  }

  return (
    <div className="mf-dash-field">
      <label className="mf-dash-label" htmlFor={id}>
        {field.label}
        {field.required ? null : <span className="mf-dash-optional">{optionalLabel}</span>}
      </label>
      {control}
      {errorLine}
    </div>
  );
}

// ============================================================================
// STYLES
// ============================================================================
// One string, injected once. PRD section 9.3 requirement 1: a canvas component
// consolidates its styling rather than using inline style objects, which the
// repository's `lint:css` gate forbids everywhere.
//
// Every rule reads the shared appearance variables (--mf-c-* and --mf-*), so
// Colors, Typography, Layout, and Spacing style every section.

/** The top menu, for Navigation: Top, and for Auto below 720px of width. */
function topNavRules(root: string): string {
  return `
${root} { grid-template-columns: minmax(0, 1fr); }
${root} .mf-acct-side { flex-direction: column; gap: 12px; padding: 16px 16px 0; border-right: 0; border-bottom: 1px solid var(--mf-c-border); }
${root} .mf-acct-who { padding: 0; margin: 0; border-bottom: 0; }
${root} .mf-acct-caption { display: none; }
${root} .mf-acct-nav { flex: none; flex-direction: row; gap: 2px; overflow-x: auto; scrollbar-width: none; margin: 0 -4px; }
${root} .mf-acct-nav::-webkit-scrollbar { display: none; }
${root} .mf-acct-tab { flex: 0 0 auto; width: auto; padding: 10px 12px 12px; border-radius: 0; }
${root} .mf-acct-tab.is-active { background: transparent; }
${root} .mf-acct-tab.is-active::before { left: 10px; right: 10px; top: auto; bottom: 0; width: auto; height: 2px; border-radius: 2px 2px 0 0; }
${root} .mf-acct-signout { margin: 0; }
${root} .mf-acct-main { padding: 20px 16px; }
`;
}

const cssContent = `
.mf-dash {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  max-width: 1040px;
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
  container-type: inline-size;
  /* Set here, not inherited: the published page's own line-height differs from
     the canvas, and the canvas must match the site exactly. */
  line-height: 1.4;
}
.mf-dash.is-account { padding: 0; max-width: none; overflow-x: hidden; }
.mf-dash * { box-sizing: border-box; }

/* ---- The shell: menu and content ---- */
.mf-acct { display: grid; grid-template-columns: 248px minmax(0, 1fr); min-height: 100%; }
.mf-acct-side {
  display: flex; flex-direction: column; gap: 6px; padding: 22px 14px;
  border-right: 1px solid var(--mf-c-border);
  background: color-mix(in srgb, var(--mf-c-field) 55%, var(--mf-c-surface));
  border-radius: var(--mf-c-radius) 0 0 var(--mf-c-radius);
}
.mf-acct-who { display: flex; align-items: center; gap: 12px; padding: 0 8px 18px; margin-bottom: 6px; border-bottom: 1px solid var(--mf-c-border); min-width: 0; }
.mf-acct-who-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.mf-acct-name { margin: 0; font-size: calc(15px * var(--mf-text-scale, 1)); font-weight: 650; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mf-acct-email { margin: 0; font-size: calc(12px * var(--mf-text-scale, 1)); color: var(--mf-c-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mf-acct-caption { margin: 8px 12px 4px; font-size: calc(11px * var(--mf-text-scale, 1)); font-weight: 600; letter-spacing: 0.02em; color: var(--mf-c-muted); }
.mf-acct-avatar {
  position: relative; display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto;
  width: 44px; height: 44px; border-radius: 999px; overflow: hidden;
  background: var(--mf-c-accent); color: var(--mf-c-on-accent);
  font-weight: 650; font-size: calc(16px * var(--mf-text-scale, 1));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--mf-c-accent) 18%, transparent);
}
.mf-acct-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.mf-acct-avatar.is-large { width: 72px; height: 72px; font-size: calc(24px * var(--mf-text-scale, 1)); }
.mf-acct-nav { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.mf-acct-tab {
  appearance: none; position: relative; display: flex; align-items: center; gap: 10px; width: 100%;
  padding: 10px 12px; border: 0; border-radius: max(0px, calc(var(--mf-c-radius) - 4px));
  background: transparent; color: var(--mf-c-muted); font: inherit; font-size: calc(14px * var(--mf-text-scale, 1));
  font-weight: 550; text-align: left; cursor: pointer; transition: background 0.15s ease, color 0.15s ease;
}
.mf-acct-tab:hover { background: var(--mf-c-field); color: var(--mf-c-text); }
.mf-acct-tab:focus-visible { outline: 2px solid var(--mf-c-accent); outline-offset: 1px; }
.mf-acct-tab.is-active { background: color-mix(in srgb, var(--mf-c-accent) 12%, transparent); color: var(--mf-c-accent); }
.mf-acct-tab.is-active::before {
  content: ""; position: absolute; left: -14px; top: 9px; bottom: 9px; width: 3px;
  border-radius: 0 3px 3px 0; background: var(--mf-c-accent);
}
.mf-acct-tab svg, .mf-acct-ico { width: 18px; height: 18px; flex: 0 0 18px; stroke: currentColor; stroke-width: 2; fill: none; }
.mf-acct-signout { margin-top: auto; }
.mf-acct-signout.is-outline { border: 1px solid var(--mf-c-border); justify-content: center; }
.mf-acct-signout.is-filled { background: var(--mf-c-accent); color: var(--mf-c-on-accent); justify-content: center; }
.mf-acct-signout.is-filled:hover { background: var(--mf-c-accent); color: var(--mf-c-on-accent); filter: brightness(1.07); }
.mf-acct-main { display: flex; flex-direction: column; gap: var(--mf-gap, 20px); min-width: 0; padding: var(--mf-pad, 28px); }

/* ---- Section content ---- */
.mf-acct-heading { display: flex; flex-direction: column; gap: 4px; }
.mf-acct-title { margin: 0; font-size: calc(22px * var(--mf-text-scale, 1)); font-weight: 650; letter-spacing: -0.01em; line-height: 1.2; }
.mf-acct-desc { margin: 0; font-size: calc(14px * var(--mf-text-scale, 1)); color: var(--mf-c-muted); line-height: 1.5; }
.mf-acct-card {
  display: flex; flex-direction: column; gap: 14px; padding: 20px;
  border: 1px solid var(--mf-c-border); border-radius: var(--mf-c-radius); background: var(--mf-c-surface);
  box-shadow: 0 1px 2px rgba(15, 18, 24, 0.04), 0 8px 24px -16px rgba(15, 18, 24, 0.18);
}
.mf-acct-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.mf-acct-card-title { margin: 0; font-size: calc(15px * var(--mf-text-scale, 1)); font-weight: 600; }
.mf-acct-card.is-danger { border-color: color-mix(in srgb, var(--mf-c-danger) 40%, var(--mf-c-border)); }
.mf-acct-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.mf-acct-stat {
  display: flex; flex-direction: column; gap: 10px; padding: 16px; min-width: 0;
  border: 1px solid var(--mf-c-border); border-radius: var(--mf-c-radius); background: var(--mf-c-surface);
}
.mf-acct-stat-icon {
  display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 10px;
  background: color-mix(in srgb, var(--mf-c-accent) 12%, transparent); color: var(--mf-c-accent);
}
.mf-acct-stat-icon svg { width: 17px; height: 17px; stroke: currentColor; fill: none; }
.mf-acct-stat-label { margin: 0; font-size: calc(12px * var(--mf-text-scale, 1)); color: var(--mf-c-muted); }
.mf-acct-stat .mf-acct-pill { align-self: flex-start; }
.mf-acct-stat-value { margin: 0; font-size: calc(18px * var(--mf-text-scale, 1)); font-weight: 650; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mf-acct-plan { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.mf-acct-plan-name { margin: 0; font-size: calc(17px * var(--mf-text-scale, 1)); font-weight: 650; display: flex; align-items: center; gap: 8px; }
.mf-acct-plan-price { margin: 0; font-size: calc(14px * var(--mf-text-scale, 1)); color: var(--mf-c-muted); }
.mf-acct-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.mf-acct-list { display: flex; flex-direction: column; }
.mf-acct-item {
  display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0;
  border-top: 1px solid var(--mf-c-border); font-size: calc(14px * var(--mf-text-scale, 1)); min-width: 0;
}
.mf-acct-item:first-child { border-top: 0; padding-top: 0; }
.mf-acct-item-main { display: flex; align-items: center; gap: 12px; min-width: 0; }
.mf-acct-item-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.mf-acct-item-title { font-weight: 550; color: var(--mf-c-text); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
a.mf-acct-item-title:hover { color: var(--mf-c-accent); }
.mf-acct-item-sub { font-size: calc(12px * var(--mf-text-scale, 1)); color: var(--mf-c-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mf-acct-item-icon {
  display: inline-flex; align-items: center; justify-content: center; flex: 0 0 36px; width: 36px; height: 36px;
  border-radius: 10px; background: var(--mf-c-field); color: var(--mf-c-muted);
}
.mf-acct-item-icon svg { width: 17px; height: 17px; stroke: currentColor; fill: none; }
.mf-acct-item-end { display: flex; align-items: center; gap: 8px; flex-shrink: 0; font-weight: 550; }
.mf-acct-pill {
  display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px;
  font-size: calc(11px * var(--mf-text-scale, 1)); font-weight: 600; background: var(--mf-c-field); color: var(--mf-c-muted);
}
.mf-acct-pill.is-good { background: color-mix(in srgb, #16a34a 14%, transparent); color: #15803d; }
.mf-acct-pill.is-accent { background: color-mix(in srgb, var(--mf-c-accent) 14%, transparent); color: var(--mf-c-accent); }
.mf-acct-search { position: relative; }
.mf-acct-search svg { position: absolute; left: 12px; top: 50%; width: 16px; height: 16px; transform: translateY(-50%); stroke: var(--mf-c-muted); fill: none; pointer-events: none; }
.mf-acct-search .mf-dash-input { padding-left: 36px; }
.mf-acct-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 28px 12px; text-align: center; }
.mf-acct-empty p { margin: 0; max-width: 360px; font-size: calc(14px * var(--mf-text-scale, 1)); color: var(--mf-c-muted); line-height: 1.5; }
.mf-acct-empty .mf-acct-item-icon { width: 44px; height: 44px; flex-basis: 44px; border-radius: 12px; }
.mf-acct-photo { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.mf-acct-photo-text { display: flex; flex-direction: column; gap: 8px; }
.mf-acct-file { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.mf-acct-form { display: flex; flex-direction: column; gap: var(--mf-gap, 14px); }
.mf-acct-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.mf-acct-readonly { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: max(0px, calc(var(--mf-c-radius) - 4px)); background: var(--mf-c-field); }
.mf-acct-readonly strong { font-weight: 550; font-size: calc(14px * var(--mf-text-scale, 1)); }
.mf-acct-readonly span { font-size: calc(12px * var(--mf-text-scale, 1)); color: var(--mf-c-muted); }
.mf-acct-skel { height: 14px; border-radius: 6px; background: linear-gradient(90deg, var(--mf-c-field), color-mix(in srgb, var(--mf-c-field) 40%, var(--mf-c-surface)), var(--mf-c-field)); background-size: 200% 100%; animation: mf-acct-shimmer 1.2s ease-in-out infinite; }
.mf-acct-skel.is-wide { width: 70%; }
.mf-acct-skel.is-mid { width: 45%; }
@keyframes mf-acct-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .mf-acct-skel { animation: none; } .mf-acct-tab { transition: none; } }
.mf-acct .mf-dash-button { width: auto; margin-top: 0; }
.mf-acct .mf-dash-button.is-block { width: 100%; }
.mf-acct .mf-dash-confirm-actions { grid-template-columns: auto auto; justify-content: start; }
.mf-acct .mf-dash-saved, .mf-acct .mf-dash-error { font-size: calc(13px * var(--mf-text-scale, 1)); }
.mf-acct-link { appearance: none; padding: 0; border: 0; background: none; color: var(--mf-c-accent); font: inherit; font-size: calc(13px * var(--mf-text-scale, 1)); font-weight: 550; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; }
.mf-acct-link svg { width: 14px; height: 14px; stroke: currentColor; }
${topNavRules(".mf-acct.is-nav-top")}
@container (max-width: 719px) {
${topNavRules(".mf-acct.is-nav-auto")}
}
@container (max-width: 560px) {
  .mf-acct-stats { grid-template-columns: minmax(0, 1fr); }
  .mf-acct-grid { grid-template-columns: minmax(0, 1fr); }
  .mf-acct-item { flex-wrap: wrap; }
}

/* ---- Shared controls (kept from the single-card layout) ---- */
.mf-dash-avatar {
  display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; flex: 0 0 40px;
  border-radius: 999px; background: var(--mf-c-accent); color: var(--mf-c-on-accent); font-weight: 600;
  font-size: calc(15px * var(--mf-text-scale, 1));
}
.mf-dash-row {
  display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 0;
  border-top: 1px solid var(--mf-c-border); font-size: calc(14px * var(--mf-text-scale, 1));
}
.mf-dash-row-label { color: var(--mf-c-muted); }
.mf-dash-row-value { font-weight: 500; text-align: right; }
.mf-dash-badge {
  display: inline-block; padding: 3px 10px; border-radius: 999px; background: var(--mf-c-accent); color: var(--mf-c-on-accent);
  font-size: calc(12px * var(--mf-text-scale, 1)); font-weight: 600; width: fit-content;
}
.mf-dash-note {
  margin: 0; padding: 12px; border-radius: max(0px, calc(var(--mf-c-radius) - 4px)); background: var(--mf-c-field);
  color: var(--mf-c-muted); font-size: calc(13px * var(--mf-text-scale, 1)); line-height: 1.5;
}
.mf-dash-button {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; margin-top: var(--mf-gap, 20px);
  padding: 10px 16px; border: 1px solid var(--mf-c-border); border-radius: max(0px, calc(var(--mf-c-radius) - 4px));
  background: transparent; color: inherit; font: inherit; font-size: calc(14px * var(--mf-text-scale, 1)); font-weight: 550; cursor: pointer;
}
.mf-dash-button:hover:not(:disabled) { background: var(--mf-c-field); }
.mf-dash-button:disabled { opacity: 0.55; cursor: default; }
.mf-dash-button svg { width: 16px; height: 16px; stroke: currentColor; fill: none; }
.mf-dash-button:focus-visible { outline: 2px solid var(--mf-c-accent); outline-offset: 2px; }
.mf-dash-button-primary { background: var(--mf-c-accent); border-color: var(--mf-c-accent); color: var(--mf-c-on-accent); }
.mf-dash-button-primary:hover:not(:disabled) { background: var(--mf-c-accent); filter: brightness(1.07); }
.mf-dash-button-text { border-color: transparent; color: var(--mf-c-muted); }
.mf-dash-button-text:hover:not(:disabled) { background: transparent; color: var(--mf-c-text); }
.mf-dash-button.mf-dash-button-small { width: auto; margin-top: 0; padding: 6px 12px; flex-shrink: 0; font-size: calc(13px * var(--mf-text-scale, 1)); }
.mf-dash-button-danger { color: var(--mf-c-danger); border-color: var(--mf-c-border); }
.mf-dash-button-danger:hover:not(:disabled) { border-color: var(--mf-c-danger); background: transparent; }
.mf-dash-button-danger.is-solid { color: #ffffff; background: var(--mf-c-danger); border-color: var(--mf-c-danger); }
.mf-dash-button-danger.is-solid:hover:not(:disabled) { background: var(--mf-c-danger); filter: brightness(1.06); }
.mf-dash-state { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; padding: 16px 0; }
.mf-dash-state svg { width: 26px; height: 26px; stroke: currentColor; color: var(--mf-c-muted); }
.mf-dash-state p { margin: 0; font-size: calc(14px * var(--mf-text-scale, 1)); line-height: 1.5; color: var(--mf-c-muted); }
.mf-dash-state + .mf-dash-button { margin-top: 8px; }
.mf-dash-field { display: flex; flex-direction: column; gap: 6px; }
.mf-dash-label { font-size: calc(13px * var(--mf-text-scale, 1)); font-weight: 550; }
.mf-dash-optional { margin-left: 6px; font-weight: 400; color: var(--mf-c-muted); }
.mf-dash-input {
  width: 100%; min-height: 40px; padding: 9px 12px; border: 1px solid var(--mf-c-border);
  border-radius: max(0px, calc(var(--mf-c-radius) - 4px)); background: var(--mf-c-field); color: inherit; font: inherit;
  font-size: calc(14px * var(--mf-text-scale, 1));
}
textarea.mf-dash-input { min-height: 88px; resize: vertical; }
.mf-dash-input:focus-visible { outline: none; border-color: var(--mf-c-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--mf-c-accent) 25%, transparent); }
.mf-dash-input.is-invalid { border-color: var(--mf-c-danger); }
.mf-dash-check { display: flex; align-items: flex-start; gap: 10px; font-size: calc(14px * var(--mf-text-scale, 1)); cursor: pointer; }
.mf-dash-check input { width: 18px; height: 18px; margin: 1px 0 0; accent-color: var(--mf-c-accent); }
.mf-dash-check input:focus-visible { outline: 2px solid var(--mf-c-accent); outline-offset: 2px; }
.mf-dash-error { margin: 0; font-size: calc(12px * var(--mf-text-scale, 1)); line-height: 1.4; color: var(--mf-c-danger); }
.mf-dash-saved { margin: 0; font-size: calc(13px * var(--mf-text-scale, 1)); color: var(--mf-c-muted); }
.mf-dash-confirm {
  display: flex; flex-direction: column; gap: 6px; padding: 12px 14px;
  border: 1px solid var(--mf-c-danger); border-radius: max(0px, calc(var(--mf-c-radius) - 4px));
}
.mf-dash-confirm-title { margin: 0; font-weight: 600; }
.mf-dash-confirm .mf-dash-note { margin: 0; }
.mf-dash-confirm-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px; }
.mf-dash-confirm-actions .mf-dash-button { margin-top: 0; }
.mf-dash-confirm-change { border-color: var(--mf-c-accent); }
.mf-dash-breakdown { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; }
.mf-dash-breakdown > :nth-child(even) { text-align: right; }
.mf-dash-breakdown-wide { grid-column: 1 / -1; }
.mf-dash-muted { color: var(--mf-c-muted); }
.mf-dash-scheduled {
  display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px;
  border-radius: max(0px, calc(var(--mf-c-radius) - 4px)); background: var(--mf-c-field); font-size: calc(12px * var(--mf-text-scale, 1));
}
.mf-dash-history-row .mf-dash-row-label { display: flex; flex-direction: column; gap: 2px; }
.mf-dash-link { color: var(--mf-c-accent); text-decoration: underline; }
`;

// @memberframe-account-start
// ============================================================================
// THE ACCOUNT AREA: SECTIONS, ADDRESS, AND CHECKS
// ============================================================================
// Pure, so test/memberAccountArea.test.ts runs each one (33-member-account.md).

type AccountSection = "overview" | "membership" | "billing" | "bookmarks" | "profile" | "security";

const ACCOUNT_SECTIONS: ReadonlyArray<AccountSection> = ["overview", "membership", "billing", "bookmarks", "profile", "security"];

interface AccountSectionToggles {
  overview?: boolean;
  membership?: boolean;
  billing?: boolean;
  bookmarks?: boolean;
  profile?: boolean;
  security?: boolean;
  photoUpload?: boolean;
  deleteAccount?: boolean;
}

/**
 * The sections shown, in menu order. Each toggle in Sections hides one, and
 * the older controls still apply: Billing off hides Membership and Billing,
 * Profile Form off hides Profile. Overview stays when everything else is off.
 */
function visibleSections(toggles: AccountSectionToggles | null | undefined, legacy: { showBilling: boolean; showProfile: boolean }): AccountSection[] {
  const shown = ACCOUNT_SECTIONS.filter((section) => {
    if (toggles && toggles[section] === false) return false;
    if ((section === "membership" || section === "billing") && !legacy.showBilling) return false;
    if (section === "profile" && !legacy.showProfile) return false;
    return true;
  });
  return shown.length > 0 ? shown : ["overview"];
}

const ACCOUNT_HASH_PREFIX = "#account-";

/** The section an address names (`#account-billing`), when it is one that shows. */
function sectionFromHash(hash: string, shown: ReadonlyArray<AccountSection>): AccountSection | null {
  if (typeof hash !== "string" || !hash.startsWith(ACCOUNT_HASH_PREFIX)) return null;
  const name = hash.slice(ACCOUNT_HASH_PREFIX.length) as AccountSection;
  return shown.includes(name) ? name : null;
}

/** The preferred section when it shows, otherwise the first that does. */
function pickSection(preferred: unknown, shown: ReadonlyArray<AccountSection>): AccountSection {
  return shown.includes(preferred as AccountSection) ? (preferred as AccountSection) : shown[0] ?? "overview";
}

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES: ReadonlyArray<string> = ["image/png", "image/jpeg", "image/webp"];

/** Why a chosen photo cannot be uploaded, before sending it. The server checks again. */
function avatarProblem(file: { type: string; size: number }): "type" | "size" | null {
  if (!AVATAR_TYPES.includes(file.type)) return "type";
  if (file.size > AVATAR_MAX_BYTES) return "size";
  return null;
}

/** Deleting the account asks for the member's own address, typed in. */
function confirmsDeleteEmail(typed: string, email: string): boolean {
  return typed.trim().toLowerCase() === email.trim().toLowerCase() && email.trim() !== "";
}

const PROVIDER_NAMES: Record<string, string> = { google: "Google", github: "GitHub", apple: "Apple", discord: "Discord" };

function providerName(provider: string): string {
  return PROVIDER_NAMES[provider] ?? provider;
}

/** A link a saved item may open: an https address or a page on this site. */
function safeItemHref(url: string): string | null {
  if (/^https:\/\//i.test(url)) return url;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  return null;
}
// @memberframe-account-end

// ============================================================================
// ICONS
// ============================================================================
// Inline, tagged with their Lucide names: Framer cannot resolve a lucide-react
// import, and the file would not load
// (test/canvasIconImports.test.ts). test/canvasIcons.test.ts holds each shape
// equal to Lucide's.

function OverviewIcon(): React.ReactElement {
  return (
    <svg className="mf-acct-ico" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden={true} data-lucide="layout-dashboard">
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  );
}

function ReceiptIcon(): React.ReactElement {
  return (
    <svg className="mf-acct-ico" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden={true} data-lucide="receipt">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
      <path d="M12 17.5v-11" />
    </svg>
  );
}

function BookmarkIcon(): React.ReactElement {
  return (
    <svg className="mf-acct-ico" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden={true} data-lucide="bookmark">
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
    </svg>
  );
}

function ShieldIcon(): React.ReactElement {
  return (
    <svg className="mf-acct-ico" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden={true} data-lucide="shield">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}

function SearchIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden={true} data-lucide="search">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function TrashIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden={true} data-lucide="trash-2">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

function CameraIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden={true} data-lucide="camera">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

function KeyIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden={true} data-lucide="key-round">
      <path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" />
      <circle cx="16.5" cy="7.5" r=".5" fill="currentColor" />
    </svg>
  );
}

function MonitorIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden={true} data-lucide="monitor">
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  );
}

function PhoneIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden={true} data-lucide="smartphone">
      <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
      <path d="M12 18h.01" />
    </svg>
  );
}

function LinkIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden={true} data-lucide="link-2">
      <path d="M9 17H7A5 5 0 0 1 7 7h2" />
      <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
      <line x1="8" x2="16" y1="12" y2="12" />
    </svg>
  );
}

function AlertIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden={true} data-lucide="triangle-alert">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function ExternalIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden={true} data-lucide="external-link">
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

/** Set by the MemberFrame Builder on insert, never by hand (27-instance-seal.md). */
interface MfSealProps {
  mfSeal?: string;
}

/** The account area's own controls (33-member-account.md section 4). */
interface AccountProps {
  sections?: AccountSectionToggles | null;
  defaultSection?: AccountSection;
  navigation?: "auto" | "sidebar" | "top";
  canvasSection?: AccountSection;
}

interface BookmarkItem {
  itemSlug: string;
  title: string;
  url: string;
  savedAt: number;
}

type BookmarksState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "ready"; items: BookmarkItem[] }
  | { phase: "failed" };

interface AccountSummary {
  hasPassword: boolean;
  memberSince: string | null;
  avatarUrl: string | null;
  identities: Array<{ provider: string; email: string; createdAt: string }>;
  sessions: Array<{ id: string; current: boolean; device: string; lastSeenAt: string | null; createdAt: string }>;
}

type AccountState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "ready"; account: AccountSummary }
  | { phase: "failed" };

type ConfirmState =
  | { kind: "unlink"; provider: string }
  | { kind: "device"; id: string; device: string }
  | { kind: "everywhere" }
  | { kind: "photo" }
  | { kind: "delete" }
  | null;

const BOOKMARKS_PATH = "/api/member/bookmarks";
const ACCOUNT_PATH = "/api/member/account";
const PASSWORD_PATH = "/api/member/password";
const IDENTITIES_PATH = "/api/member/identities/";
const SESSIONS_PATH = "/api/member/sessions/";
const AVATAR_PATH = "/api/member/avatar";
const LOGOUT_EVERYWHERE_PATH = "/api/member/logout-everywhere";

function readBookmarks(value: unknown): BookmarkItem[] {
  const list = value && typeof value === "object" ? (value as { bookmarks?: unknown }).bookmarks : null;
  if (!Array.isArray(list)) return [];
  return list.flatMap((entry) => {
    const item = entry as Partial<BookmarkItem>;
    if (typeof item.itemSlug !== "string") return [];
    return [{
      itemSlug: item.itemSlug,
      title: typeof item.title === "string" && item.title.trim() !== "" ? item.title : item.itemSlug,
      url: typeof item.url === "string" ? item.url : "",
      savedAt: typeof item.savedAt === "number" ? item.savedAt : 0,
    }];
  });
}

function readAccount(value: unknown): AccountSummary | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const text = (input: unknown) => (typeof input === "string" ? input : "");
  return {
    hasPassword: body["hasPassword"] === true,
    memberSince: typeof body["memberSince"] === "string" ? (body["memberSince"] as string) : null,
    avatarUrl: typeof body["avatarUrl"] === "string" && /^https:\/\//.test(body["avatarUrl"] as string) ? (body["avatarUrl"] as string) : null,
    identities: Array.isArray(body["identities"])
      ? (body["identities"] as Array<Record<string, unknown>>).map((row) => ({ provider: text(row["provider"]), email: text(row["email"]), createdAt: text(row["createdAt"]) }))
      : [],
    sessions: Array.isArray(body["sessions"])
      ? (body["sessions"] as Array<Record<string, unknown>>).map((row) => ({
          id: text(row["id"]),
          current: row["current"] === true,
          device: text(row["device"]) || "Unknown device",
          lastSeenAt: typeof row["lastSeenAt"] === "string" ? (row["lastSeenAt"] as string) : null,
          createdAt: text(row["createdAt"]),
        }))
      : [],
  };
}

/** A sample account for the canvas, so every section can be designed. */
const PREVIEW_ACCOUNT: AccountSummary = {
  hasPassword: true,
  memberSince: "2026-02-14T09:00:00.000Z",
  avatarUrl: null,
  identities: [{ provider: "google", email: "member@example.com", createdAt: "2026-02-14T09:00:00.000Z" }],
  sessions: [
    { id: "preview-1", current: true, device: "Chrome on Mac", lastSeenAt: null, createdAt: "2026-10-20T09:00:00.000Z" },
    { id: "preview-2", current: false, device: "Safari on iPhone", lastSeenAt: "2026-10-24T18:30:00.000Z", createdAt: "2026-09-02T09:00:00.000Z" },
  ],
};

const PREVIEW_BOOKMARKS: BookmarkItem[] = [
  { itemSlug: "designing-for-members", title: "Designing for members", url: "/articles/designing-for-members", savedAt: Date.parse("2026-10-22T10:00:00Z") },
  { itemSlug: "pricing-that-converts", title: "Pricing that converts", url: "/articles/pricing-that-converts", savedAt: Date.parse("2026-10-18T10:00:00Z") },
  { itemSlug: "a-calmer-inbox", title: "A calmer inbox", url: "/articles/a-calmer-inbox", savedAt: Date.parse("2026-10-09T10:00:00Z") },
  { itemSlug: "writing-weekly", title: "Writing weekly", url: "/articles/writing-weekly", savedAt: Date.parse("2026-09-30T10:00:00Z") },
];

/** The site's tiers as `GET /api/preview` lists them, or [] when the answer is not that shape. */
function readPreviewPlans(data: Record<string, unknown> | null): BillingPlanOption[] {
  const pricing = data ? (data["pricing"] as { tiers?: unknown } | undefined) : undefined;
  if (!pricing || !Array.isArray(pricing.tiers)) return [];
  const price = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  return (pricing.tiers as Array<Record<string, unknown>>).flatMap((tier) => {
    if (typeof tier["key"] !== "string" || typeof tier["name"] !== "string" || typeof tier["rank"] !== "number") return [];
    const prices = (tier["prices"] && typeof tier["prices"] === "object" ? tier["prices"] : {}) as Record<string, unknown>;
    return [{
      key: tier["key"],
      name: tier["name"],
      rank: tier["rank"],
      currency: typeof tier["currency"] === "string" ? tier["currency"] : "USD",
      prices: { month: price(prices["month"]), year: price(prices["year"]), lifetime: price(prices["lifetime"]) },
    }];
  });
}

/**
 * The billing the canvas shows: the preview member on the site's top tier, at
 * that tier's own price, so the canvas looks like the published page for that
 * member. A top tier with no price is a free plan, shown as the published page
 * shows one. Before the site answers (or when it cannot), a sample paid plan.
 */
function previewBilling(plans: BillingPlanOption[] | null): BillingSummary {
  const day = 86_400_000;
  const paid = (amountMinor: number, currency: string, planName: string, count: number) =>
    Array.from({ length: count }, (_, index) => ({
      id: `p${index + 1}`, amountMinor, currency, status: "paid", receiptUrl: null,
      paidAt: new Date(Date.now() - (12 + index * 30) * day).toISOString(), gateway: "stripe", planName,
    }));
  const subscription = (tierKey: string, tierName: string, interval: string, amountMinor: number, currency: string) => ({
    tierKey, tierName, interval, gateway: "stripe", status: "active", amountMinor, currency,
    currentPeriodEnd: interval === "lifetime" ? null : new Date(Date.now() + 18 * day).toISOString(),
    gracePeriodEndsAt: null, cancelAtPeriodEnd: false, mode: "live",
    canCancel: interval !== "lifetime", canResume: false, canManage: true,
  });

  if (!plans || plans.length === 0) {
    return { subscription: subscription("tier_1", "Silver", "month", 900, "USD"), payments: paid(900, "USD", "Silver", 3), pricingPath: "/pricing" };
  }

  const top = plans.reduce((best, tier) => (tier.rank > best.rank ? tier : best), plans[0]);
  const interval = top.prices.month !== null ? "month" : top.prices.year !== null ? "year" : top.prices.lifetime !== null ? "lifetime" : null;
  if (top.rank === 0 || interval === null) return { subscription: null, payments: [], plans, pricingPath: "/pricing" };

  const amount = top.prices[interval as "month" | "year" | "lifetime"] as number;
  return {
    subscription: subscription(top.key, top.name, interval, amount, top.currency),
    payments: paid(amount, top.currency, top.name, interval === "lifetime" ? 1 : 3),
    plans,
    pricingPath: "/pricing",
  };
}

/**
 * The account area: a section menu and one section at a time. 960 wide by
 * default; below 720px of its own width the menu becomes a row on top. Height
 * from its content (2026-10-20): the page scrolls, not the panel. A fixed
 * height chosen in the sidebar still works, and scrolls inside.
 *
 * @framerIntrinsicWidth 960
 * @framerIntrinsicHeight 640
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-auto
 */
export default function MemberDashboard(
  props: Partial<DashboardConfig> & MfAppearanceProps & DashboardDisplayProps & MfSealProps & AccountProps
): React.ReactElement {
  const config: DashboardConfig = { ...CONFIG, ...props };
  const { colors, typography, layout, spacing, labels } = props;
  const { showAvatar = true, showEmail = true, showStatus = true, signOutStyle = "outline" } = props;
  const { showPaymentHistory = true, allowCancel = true } = props;
  const { sections, defaultSection = "overview", navigation = "auto", canvasSection = "overview" } = props;
  const t = (key: string) => mfLabel(labels, DASH_LABELS, key);

  /** A CSS-safe per-instance scope, as in the other three components. */
  const rawId = useId();
  const scope = useMemo(() => `mfd${rawId.replace(/[^a-zA-Z0-9]/g, "")}`, [rawId]);

  const [state, setState] = useState<DashboardState>({ phase: "loading" });
  /** Canvas only: the site's tiers and prices, once `GET /api/preview` answers. */
  const [previewPlans, setPreviewPlans] = useState<BillingPlanOption[] | null>(null);
  const [busy, setBusy] = useState(false);
  /** Signed out by the server mid-visit (a 401 after signing in): says so. */
  const [expired, setExpired] = useState(false);

  const [profile, setProfile] = useState<ProfileState>({ phase: "idle" });
  const [profileName, setProfileName] = useState("");
  const [profileValues, setProfileValues] = useState<MemberMetadata>({});
  const [profileProblems, setProfileProblems] = useState<Record<string, string>>({});
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const [billing, setBilling] = useState<BillingState>({ phase: "idle" });
  const [billingBusy, setBillingBusy] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  /** A plan picked to switch to: loading its numbers, then waiting for Confirm. */
  const [switchTo, setSwitchTo] = useState<{
    key: string;
    name: string;
    kind: "loading" | "change" | "downgrade" | "choose";
    summary?: { amountMinor: number; currency: string; creditMinor?: number; dueMinor?: number; creditFrom?: string | null; interval: string };
    effectiveAt?: string | null;
  } | null>(null);
  const [billingNotice, setBillingNotice] = useState<{ text: string; error: boolean } | null>(null);

  const [bookmarks, setBookmarks] = useState<BookmarksState>({ phase: "idle" });
  const [bookmarkQuery, setBookmarkQuery] = useState("");
  const [account, setAccount] = useState<AccountState>({ phase: "idle" });
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountNotice, setAccountNotice] = useState<{ text: string; error: boolean; where: string } | null>(null);
  const [password, setPassword] = useState({ current: "", next: "", again: "" });
  const [deleteEmail, setDeleteEmail] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const license = useMfLicense(CONFIG.apiBaseUrl, CONFIG.siteKey, props.mfSeal);
  const onCanvas = RenderTarget.current() === RenderTarget.canvas;
  const apiBase = (config.apiBaseUrl || ENV_API_BASE_URL || "").replace(/\/+$/, "");

  // ------------------------------------------------------------------------
  // Sections and the address
  // ------------------------------------------------------------------------

  const shown = visibleSections(sections, { showBilling: config.showBilling, showProfile: config.showProfile });
  const shownKey = shown.join(",");
  const photoUpload = sections?.photoUpload !== false;
  const deleteAllowed = sections?.deleteAccount !== false;

  const [section, setSection] = useState<AccountSection>(() =>
    typeof window === "undefined" ? pickSection(defaultSection, shown) : sectionFromHash(window.location.hash, shown) ?? pickSection(defaultSection, shown)
  );
  // The canvas shows the section the creator picked; the published site the one chosen.
  const active: AccountSection = onCanvas ? pickSection(canvasSection, shown) : shown.includes(section) ? section : pickSection(defaultSection, shown);

  const goTo = useCallback(
    (next: AccountSection) => {
      setSection(next);
      setConfirm(null);
      setAccountNotice(null);
      if (onCanvas || typeof window === "undefined") return;
      try {
        // Framer's own history state is kept, so its router is not disturbed.
        if (window.location.hash !== ACCOUNT_HASH_PREFIX + next) {
          window.history.pushState(window.history.state, "", window.location.pathname + window.location.search + ACCOUNT_HASH_PREFIX + next);
        }
      } catch {
        // A sandboxed frame can refuse; the section still changes.
      }
    },
    [onCanvas]
  );

  // Back and Forward, and a link to another section on the same page.
  useEffect(() => {
    if (onCanvas || typeof window === "undefined") return;
    const follow = () => {
      const list = shownKey.split(",") as AccountSection[];
      const named = sectionFromHash(window.location.hash, list);
      setSection(named ?? pickSection(defaultSection, list));
    };
    window.addEventListener("popstate", follow);
    window.addEventListener("hashchange", follow);
    return () => {
      window.removeEventListener("popstate", follow);
      window.removeEventListener("hashchange", follow);
    };
  }, [defaultSection, onCanvas, shownKey]);

  /** One request for the member's own data. A 401 means the session ended: say so. */
  const memberCall = useCallback(
    async (path: string, init: { method?: string; json?: unknown; raw?: Blob } = {}): Promise<{ status: number; body: Record<string, unknown> } | null> => {
      if (onCanvas || apiBase === "") return null;
      try {
        const headers = init.raw
          ? { ...apiHeaders(false), "Content-Type": init.raw.type || "application/octet-stream" }
          : apiHeaders(init.json !== undefined);
        const response = await fetch(`${apiBase}${path}`, {
          method: init.method ?? "GET",
          credentials: "include",
          headers,
          body: init.raw ?? (init.json !== undefined ? JSON.stringify(init.json) : undefined),
        });
        const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        if (response.status === 401) {
          setExpired(true);
          setState({ phase: "signed_out" });
          syncShieldSession(false);
        }
        return { status: response.status, body };
      } catch {
        return null;
      }
    },
    [apiBase, onCanvas]
  );

  // ------------------------------------------------------------------------
  // Load the session
  // ------------------------------------------------------------------------

  useEffect(() => {
    // On the Framer canvas there is no visitor and no cookie, so a real request
    // would always resolve signed out and a creator would be designing against
    // an empty state they can never leave. A representative signed-in preview
    // is what they need to lay the component out.
    if (onCanvas) {
      setState({
        phase: "signed_in",
        member: {
          memberId: "preview",
          email: "member@example.com",
          name: "Jordan Okafor",
          activeTier: "tier_1",
          status: "active",
          currentPeriodEnd: 0,
          gracePeriodEndsAt: 0,
          siteId: "preview",
        },
        tiers: [
          { key: "free_member", rank: 0, name: "Free" },
          { key: "tier_1", rank: 1, name: "Silver" },
          { key: "tier_2", rank: 2, name: "Gold" },
          { key: "vip", rank: 3, name: "VIP" },
        ],
      });
      // The site's own tiers, with the preview member on the top one. Asked
      // again on a timer and on focus, so a tier created in the plugin shows
      // up on a component that is already on the canvas.
      let active = true;
      let shown = "";
      const refresh = () => {
        void mfCanvasPreview(config.apiBaseUrl || ENV_API_BASE_URL || "", config.siteKey || CONFIG.siteKey).then((data) => {
          const pricing = data ? (data["pricing"] as { tiers?: Array<{ key: string; rank: number; name: string }> } | undefined) : undefined;
          const tiers = pricing && Array.isArray(pricing.tiers) ? pricing.tiers.map((tier) => ({ key: tier.key, rank: tier.rank, name: tier.name })) : [];
          if (!active || tiers.length === 0) return;
          const plans = readPreviewPlans(data);
          const next = JSON.stringify(plans.length > 0 ? plans : tiers);
          if (next === shown) return;
          shown = next;
          if (plans.length > 0) setPreviewPlans(plans);
          const top = tiers.reduce((best, tier) => (tier.rank > best.rank ? tier : best), tiers[0]);
          setState((current) =>
            current.phase === "signed_in" && current.member.memberId === "preview"
              ? { ...current, member: { ...current.member, activeTier: top.key }, tiers }
              : current
          );
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
    }

    let active = true;
    const base = (config.apiBaseUrl || ENV_API_BASE_URL || "").replace(/\/+$/, "");

    // Deployed before the project was connected. Never fall back to a local
    // address: on a published site that asks every visitor for permission to
    // reach their own machine.
    if (base === "") {
      setState({ phase: "misconfigured" });
      return;
    }

    void (async () => {
      try {
        const response = await fetch(`${base}${SESSION_PATH}`, {
          // The session is an HTTP-only cookie, per PRD section 14.1 S2. This
          // component never sees it, which is the point.
          credentials: "include",
          headers: apiHeaders(false),
        });

        if (!active) return;

        // A 401 is the ordinary answer for a visitor who is not signed in, not
        // an error. Treating it as one is how a signed-out member is shown
        // "something went wrong" on a page that is working perfectly.
        if (response.status === 401) {
          syncShieldSession(false);
          setState({ phase: "signed_out" });
          return;
        }

        if (!response.ok) {
          setState({ phase: "unavailable" });
          return;
        }

        const body = (await response.json()) as {
          member?: MemberSessionData;
          tiers?: ReadonlyArray<TierLadderEntry>;
        };

        if (!active) return;

        if (!body.member) {
          setState({ phase: "signed_out" });
          return;
        }

        // Signed in: keep the hint, so the sign in page can send this member on.
        try {
          window.localStorage.setItem(`memberframe:signed-in:${CONFIG.siteKey}`, "1");
        } catch {
          // Blocked storage only costs the shortcut.
        }
        setState({ phase: "signed_in", member: body.member, tiers: body.tiers ?? [] });
      } catch {
        if (active) setState({ phase: "unavailable" });
      }
    })();

    return () => {
      active = false;
    };
  }, [config.apiBaseUrl, config.siteKey, onCanvas]);

  // ------------------------------------------------------------------------
  // Load the profile, FP-09 section 3.2
  // ------------------------------------------------------------------------

  const signedInMemberId = state.phase === "signed_in" ? state.member.memberId : null;
  const signedInName = state.phase === "signed_in" ? state.member.name : null;

  useEffect(() => {
    if (!config.showProfile || signedInMemberId === null) {
      setProfile({ phase: "idle" });
      return;
    }

    if (onCanvas) {
      setProfileName(signedInName ?? "");
      setProfileValues(PREVIEW_VALUES);
      setProfile({ phase: "ready", fields: PREVIEW_FIELDS });
      // The site's own questions from Settings, Fields, unanswered.
      let active = true;
      void mfCanvasPreview(config.apiBaseUrl || ENV_API_BASE_URL || "", config.siteKey || CONFIG.siteKey).then((data) => {
        const fields = data && Array.isArray(data["profileFields"]) ? (data["profileFields"] as CustomFieldDefinition[]) : [];
        if (!active || fields.length === 0) return;
        setProfileValues({});
        setProfile({ phase: "ready", fields });
      });
      return () => {
        active = false;
      };
    }

    let active = true;
    const base = (config.apiBaseUrl || ENV_API_BASE_URL || "").replace(/\/+$/, "");

    // Same as the session load: no backend address, no request.
    if (base === "") {
      setProfile({ phase: "unavailable" });
      return;
    }

    setProfile({ phase: "loading" });

    void (async () => {
      try {
        const response = await fetch(`${base}${PROFILE_PATH}`, {
          credentials: "include",
          headers: apiHeaders(false),
        });

        if (!active) return;
        if (!response.ok) {
          setProfile({ phase: "unavailable" });
          return;
        }

        const body = (await response.json()) as {
          member?: { name?: string | null };
          fields?: unknown;
          metadata?: unknown;
        };
        if (!active) return;

        setProfileName(body.member?.name ?? signedInName ?? "");
        setProfileValues(readMetadata(body.metadata));
        setProfileProblems({});
        setProfile({ phase: "ready", fields: readFields(body.fields) });
      } catch {
        if (active) setProfile({ phase: "unavailable" });
      }
    })();

    return () => {
      active = false;
    };
  }, [config.apiBaseUrl, config.showProfile, onCanvas, signedInMemberId, signedInName]);

  const setProfileValue = useCallback((key: string, value: MetadataValue) => {
    setProfileValues((current) => ({ ...current, [key]: value }));
    setProfileNotice(null);
    setProfileProblems((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  const handleSaveProfile = useCallback(async () => {
    if (profile.phase !== "ready" || onCanvas) return;

    const checked = validateProfile(profile.fields, profileValues);

    if (Object.keys(checked.problems).length > 0) {
      setProfileProblems(checked.problems);
      setProfileNotice({ ok: false, text: "Check the highlighted fields." });
      return;
    }

    setProfileSaving(true);
    setProfileNotice(null);

    try {
      const base = (config.apiBaseUrl || ENV_API_BASE_URL || "").replace(/\/+$/, "");
      const response = await fetch(`${base}${PROFILE_PATH}`, {
        method: "PATCH",
        credentials: "include",
        headers: apiHeaders(true),
        // An empty name is sent as empty, which the server stores as no name.
        // That is how a member removes one, so it must not be dropped here.
        body: JSON.stringify({ name: profileName.trim(), metadata: checked.metadata }),
      });

      if (response.status === 400) {
        const body = (await response.json().catch(() => ({}))) as {
          problems?: Array<{ key?: string; message?: string }>;
        };
        const mapped: Record<string, string> = {};
        for (const problem of body.problems ?? []) {
          if (problem.key && problem.message) mapped[problem.key] = problem.message;
        }
        setProfileProblems(mapped);
        setProfileNotice({ ok: false, text: "Some answers could not be saved. Check them and try again." });
        return;
      }

      if (response.status === 401) {
        // The answers stay in the form for when the member signs in again.
        setExpired(true);
        setState({ phase: "signed_out" });
        return;
      }

      if (!response.ok) {
        setProfileNotice({ ok: false, text: "Your profile could not be saved. Try again in a moment." });
        return;
      }

      const body = (await response.json().catch(() => ({}))) as {
        member?: { name?: string | null };
        metadata?: unknown;
      };

      setProfileValues(readMetadata(body.metadata));
      setProfileName(body.member?.name ?? profileName.trim());
      setProfileProblems({});
      setProfileNotice({ ok: true, text: mfLabel(labels, DASH_LABELS, "saved") });

      // The header shows the name too, so it follows the save.
      setState((current) =>
        current.phase === "signed_in"
          ? { ...current, member: { ...current.member, name: body.member?.name ?? null } }
          : current
      );
    } catch {
      setProfileNotice({ ok: false, text: "Your profile could not be saved. Check your connection and try again." });
    } finally {
      setProfileSaving(false);
    }
  }, [config.apiBaseUrl, labels, onCanvas, profile, profileName, profileValues]);

  // ------------------------------------------------------------------------
  // Sign out
  // ------------------------------------------------------------------------

  /** Signed out here, or by a deleted account: the page says so, and moves on. */
  const finishSignOut = useCallback(() => {
    setExpired(false);
    setState({ phase: "signed_out" });
    syncShieldSession(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("memberframe:session-updated", { detail: { signedIn: false } }));
    }
    if (safePath(config.afterLogoutPath)) navigate(config.afterLogoutPath);
  }, [config.afterLogoutPath]);

  const handleSignOut = useCallback(async () => {
    if (onCanvas) return;

    setBusy(true);

    try {
      const base = (config.apiBaseUrl || ENV_API_BASE_URL || "").replace(/\/+$/, "");
      await fetch(`${base}${LOGOUT_PATH}`, {
        method: "POST",
        credentials: "include",
        headers: apiHeaders(false),
      });
    } catch {
      // The cookie may already be gone, the network may have dropped. Either
      // way the member asked to be signed out, and leaving them on an account
      // page that still shows their email would be the wrong answer to a
      // failure. The local state changes regardless.
    }

    setBusy(false);
    finishSignOut();
  }, [config.apiBaseUrl, finishSignOut, onCanvas]);

  // ------------------------------------------------------------------------
  // Billing, FP-16
  // ------------------------------------------------------------------------

  // `signedInMemberId` is declared with the profile effects above.
  const needsBilling = config.showBilling && (shown.includes("overview") || shown.includes("membership") || shown.includes("billing"));

  useEffect(() => {
    if (!needsBilling || signedInMemberId === null) return;

    // The preview member's plan, from the site's own tiers, so the canvas shows
    // what the published page shows a member on that plan.
    if (onCanvas) {
      setBilling({ phase: "ready", summary: previewBilling(previewPlans) });
      return;
    }

    const base = (config.apiBaseUrl || ENV_API_BASE_URL || "").replace(/\/+$/, "");
    if (base === "") return;

    let active = true;
    setBilling({ phase: "loading" });

    void fetch(`${base}${BILLING_PATH}`, { credentials: "include", headers: apiHeaders(false) })
      .then(async (response) => {
        if (!active) return;
        if (!response.ok) {
          setBilling({ phase: "failed" });
          return;
        }
        setBilling({ phase: "ready", summary: (await response.json()) as BillingSummary });
      })
      .catch(() => {
        if (active) setBilling({ phase: "failed" });
      });

    return () => {
      active = false;
    };
  }, [config.apiBaseUrl, needsBilling, onCanvas, previewPlans, signedInMemberId]);

  const billingAction = useCallback(
    async (action: "portal" | "cancel" | "resume" | "undo-change") => {
      if (onCanvas) return;
      const base = (config.apiBaseUrl || ENV_API_BASE_URL || "").replace(/\/+$/, "");
      if (base === "") return;

      setBillingBusy(true);
      try {
        const response = await fetch(`${base}${BILLING_PATH}/${action}`, {
          method: "POST",
          credentials: "include",
          headers: apiHeaders(true),
          body: JSON.stringify({ returnPath: typeof window !== "undefined" ? window.location.pathname : "/" }),
        });
        if (!response.ok) {
          setBilling({ phase: "failed" });
          return;
        }
        if (action === "portal") {
          const body = (await response.json()) as { url?: string | null };
          if (body.url && /^https:\/\//.test(body.url)) window.location.assign(body.url);
          return;
        }
        setBilling({ phase: "ready", summary: (await response.json()) as BillingSummary });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("memberframe:session-updated", { detail: { signedIn: true } }));
        }
      } catch {
        setBilling({ phase: "failed" });
      } finally {
        setBillingBusy(false);
        setConfirmingCancel(false);
      }
    },
    [config.apiBaseUrl, onCanvas]
  );

  /** Ask what a switch to this plan costs (30-plan-changes.md), before confirming it. */
  const previewChange = useCallback(
    async (key: string, name: string, interval: string) => {
      if (onCanvas) return;
      const base = (config.apiBaseUrl || ENV_API_BASE_URL || "").replace(/\/+$/, "");
      if (base === "") return;
      setBillingNotice(null);
      setSwitchTo({ key, name, kind: "loading" });
      try {
        const response = await fetch(`${base}${OPTIONS_PATH}`, {
          method: "POST",
          credentials: "include",
          headers: apiHeaders(true),
          body: JSON.stringify({ tierKey: key, interval }),
        });
        const body = response.ok
          ? ((await response.json()) as { kind?: string; summary?: NonNullable<typeof switchTo>["summary"]; effectiveAt?: string | null })
          : null;
        if (!body || (body.kind !== "change" && body.kind !== "downgrade" && body.kind !== "choose")) {
          setSwitchTo(null);
          setBillingNotice({ text: t("changeFailed"), error: true });
          return;
        }
        setSwitchTo({ key, name, kind: body.kind, summary: body.summary, effectiveAt: body.effectiveAt ?? null });
      } catch {
        setSwitchTo(null);
        setBillingNotice({ text: t("changeFailed"), error: true });
      }
    },
    // `t` reads the labels prop; the copy is read when each message is set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.apiBaseUrl, onCanvas]
  );

  /**
   * Do the previewed switch: an upgrade in place (Stripe, credited), a
   * downgrade scheduled for the period end, or, where neither applies, the
   * pricing page, where the buyer chooses how to pay with the credit shown.
   */
  const confirmChange = useCallback(
    async (pricingPath: string) => {
      if (onCanvas || !switchTo || switchTo.kind === "loading") return;
      if (switchTo.kind === "choose") {
        if (safePath(pricingPath)) navigate(pricingPath);
        return;
      }
      const base = (config.apiBaseUrl || ENV_API_BASE_URL || "").replace(/\/+$/, "");
      if (base === "") return;
      setBillingBusy(true);
      try {
        const response = await fetch(`${base}${CHECKOUT_PATH}`, {
          method: "POST",
          credentials: "include",
          headers: apiHeaders(true),
          body: JSON.stringify({
            tierKey: switchTo.key,
            interval: switchTo.summary?.interval ?? "month",
            returnPath: typeof window !== "undefined" ? window.location.pathname : "/",
          }),
        });
        const result = response.ok ? ((await response.json()) as { kind?: string; tierName?: string; effectiveAt?: string | null }) : null;
        if (result?.kind === "changed") {
          setBillingNotice({ text: t("planChanged").split("{tier}").join(result.tierName || switchTo.name), error: false });
        } else if (result?.kind === "scheduled") {
          setBillingNotice({
            text: t("scheduledDone").split("{tier}").join(result.tierName || switchTo.name).split("{date}").join(formatDate(result.effectiveAt ?? null)),
            error: false,
          });
        } else {
          setBillingNotice({ text: t("changeFailed"), error: true });
          return;
        }
        const refreshed = await fetch(`${base}${BILLING_PATH}`, { credentials: "include", headers: apiHeaders(false) });
        if (refreshed.ok) setBilling({ phase: "ready", summary: (await refreshed.json()) as BillingSummary });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("memberframe:session-updated", { detail: { signedIn: true } }));
        }
      } catch {
        setBillingNotice({ text: t("changeFailed"), error: true });
      } finally {
        setBillingBusy(false);
        setSwitchTo(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.apiBaseUrl, onCanvas, switchTo]
  );

  // ------------------------------------------------------------------------
  // Bookmarks, FP-10, and the account itself (33-member-account.md)
  // ------------------------------------------------------------------------

  const needsBookmarks = shown.includes("overview") || shown.includes("bookmarks");

  const loadAccount = useCallback(async () => {
    const answer = await memberCall(ACCOUNT_PATH);
    const parsed = answer && answer.status === 200 ? readAccount(answer.body) : null;
    setAccount(parsed ? { phase: "ready", account: parsed } : { phase: "failed" });
  }, [memberCall]);

  useEffect(() => {
    if (signedInMemberId === null) return;
    if (onCanvas) {
      setAccount({ phase: "ready", account: PREVIEW_ACCOUNT });
      setBookmarks({ phase: "ready", items: PREVIEW_BOOKMARKS });
      return;
    }
    setAccount({ phase: "loading" });
    void loadAccount();
    if (!needsBookmarks) return;
    setBookmarks({ phase: "loading" });
    void memberCall(BOOKMARKS_PATH).then((answer) => {
      setBookmarks(answer && answer.status === 200 ? { phase: "ready", items: readBookmarks(answer.body) } : { phase: "failed" });
    });
  }, [loadAccount, memberCall, needsBookmarks, onCanvas, signedInMemberId]);

  const removeBookmark = useCallback(
    async (item: BookmarkItem) => {
      if (onCanvas) return;
      const answer = await memberCall(BOOKMARKS_PATH, {
        method: "PATCH",
        json: { action: "remove", item: { itemSlug: item.itemSlug, title: item.title, url: item.url } },
      });
      if (answer && answer.status === 200) {
        setBookmarks({ phase: "ready", items: readBookmarks(answer.body) });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("memberframe:bookmarks-updated", { detail: { itemSlug: item.itemSlug, saved: false } }));
        }
      } else if (answer?.status !== 401) {
        setAccountNotice({ text: t("actionFailed"), error: true, where: "bookmarks" });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [memberCall, onCanvas]
  );

  const changePassword = useCallback(
    async (hasPassword: boolean) => {
      if (onCanvas) return;
      if (password.next !== password.again) {
        setAccountNotice({ text: t("passwordMismatch"), error: true, where: "password" });
        return;
      }
      setAccountBusy(true);
      setAccountNotice(null);
      const answer = await memberCall(PASSWORD_PATH, {
        method: "POST",
        json: { ...(hasPassword ? { currentPassword: password.current } : {}), newPassword: password.next },
      });
      setAccountBusy(false);
      if (answer?.status === 200) {
        setPassword({ current: "", next: "", again: "" });
        setAccountNotice({ text: t("passwordChanged"), error: false, where: "password" });
        void loadAccount();
        return;
      }
      if (answer?.status === 401) return;
      const reason = answer?.body["reason"];
      setAccountNotice({
        text: reason === "wrong_password" ? t("passwordWrong") : reason === "weak_password" ? t("passwordWeak") : t("passwordFailed"),
        error: true,
        where: "password",
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadAccount, memberCall, onCanvas, password]
  );

  /** Every confirmed action in Security and Profile: unlink, sign out a device or all, the photo, the account. */
  const runConfirmed = useCallback(
    async (memberEmail: string) => {
      if (onCanvas || !confirm) return;
      setAccountBusy(true);
      setAccountNotice(null);
      const current = confirm;
      let answer: { status: number; body: Record<string, unknown> } | null = null;
      if (current.kind === "unlink") answer = await memberCall(IDENTITIES_PATH + encodeURIComponent(current.provider), { method: "DELETE" });
      if (current.kind === "device") answer = await memberCall(SESSIONS_PATH + encodeURIComponent(current.id), { method: "DELETE" });
      if (current.kind === "everywhere") answer = await memberCall(LOGOUT_EVERYWHERE_PATH, { method: "POST" });
      if (current.kind === "photo") answer = await memberCall(AVATAR_PATH, { method: "DELETE" });
      if (current.kind === "delete") {
        if (!confirmsDeleteEmail(deleteEmail, memberEmail)) {
          setAccountBusy(false);
          return;
        }
        answer = await memberCall(ACCOUNT_PATH, { method: "DELETE", json: { confirmEmail: deleteEmail } });
      }
      setAccountBusy(false);

      if (answer?.status === 200) {
        setConfirm(null);
        setDeleteEmail("");
        if (current.kind === "everywhere" || current.kind === "delete") {
          finishSignOut();
          return;
        }
        void loadAccount();
        return;
      }
      if (answer?.status === 401) return;
      const reason = answer?.body["reason"];
      const where = current.kind === "photo" ? "photo" : current.kind === "delete" ? "delete" : "security";
      setAccountNotice({
        text:
          reason === "last_sign_in_method"
            ? t("unlinkLast")
            : reason === "active_plan"
              ? t("deleteBlocked")
              : current.kind === "delete"
                ? t("deleteFailed")
                : t("actionFailed"),
        error: true,
        where,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [confirm, deleteEmail, finishSignOut, loadAccount, memberCall, onCanvas]
  );

  const uploadPhoto = useCallback(
    async (file: File) => {
      if (onCanvas) return;
      const problem = avatarProblem(file);
      if (problem) {
        setAccountNotice({ text: problem === "size" ? t("photoTooLarge") : t("photoWrongType"), error: true, where: "photo" });
        return;
      }
      setAccountBusy(true);
      setAccountNotice(null);
      const answer = await memberCall(AVATAR_PATH, { method: "POST", raw: file });
      setAccountBusy(false);
      if (answer?.status === 200) {
        void loadAccount();
        return;
      }
      if (answer?.status === 401) return;
      const reason = answer?.body["reason"];
      setAccountNotice({
        text: reason === "image_too_large" ? t("photoTooLarge") : reason === "unsupported_image" ? t("photoWrongType") : t("photoFailed"),
        error: true,
        where: "photo",
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadAccount, memberCall, onCanvas]
  );

  // ------------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------------

  // Accent, radius, Colors, Typography, and Layout, sanitized by the shared
  // appearance block and scoped to this instance.
  const scopedVars =
    `[data-mf-dash="${MF_SCOPE_SLOT}"] { ` +
    mfAppearanceVars({
      accent: config.accentColor,
      radius: config.borderRadius,
      radiusMax: 32,
      shadowByDefault: false,
      colors,
      typography,
      layout,
      spacing,
    }) +
    " }";
  const styled = mfStyleScope("mfd", scopedVars);
  const rootClass = `mf-dash ${MF_THEME_CLASS}`;
  const style = (
    <>
      <style>{mfThemeCss(".mf-dash")}</style>
      <style>{cssContent}</style>
      <style>{styled.css}</style>
      <MfLicenseLayer license={license} />
    </>
  );

  if (state.phase === "loading") {
    return (
      <div className={rootClass} data-mf-dash={styled.scope}>
        {style}
        <div className="mf-dash-state">
          <p>{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (state.phase === "misconfigured") {
    // Addressed to the creator, not the visitor, because only a creator can
    // fix it and only a creator sees it before the site is published.
    return (
      <div className={rootClass} data-mf-dash={styled.scope}>
        {style}
        <div className="mf-dash-state">
          <ShieldCheck aria-hidden={true} />
          <p>Connect this project in the MemberFrame plugin, then add this component again.</p>
        </div>
      </div>
    );
  }

  if (state.phase === "unavailable") {
    return (
      <div className={rootClass} data-mf-dash={styled.scope}>
        {style}
        <div className="mf-dash-state">
          <p>{t("unavailable")}</p>
        </div>
      </div>
    );
  }

  if (state.phase === "signed_out") {
    return (
      <div className={rootClass} data-mf-dash={styled.scope}>
        {style}
        <div className="mf-dash-state">
          <User aria-hidden={true} />
          <p>{expired ? t("sessionExpired") : config.signedOutMessage}</p>
        </div>
        {safePath(config.loginPath) ? (
          <button
            type="button"
            className="mf-dash-button mf-dash-button-primary"
            onClick={() => navigate(config.loginPath)}
          >
            {t("signIn")}
          </button>
        ) : null}
      </div>
    );
  }

  const { member, tiers } = state;
  const displayName = member.name && member.name.trim() !== "" ? member.name : member.email;
  const firstName = displayName.includes("@") ? displayName : displayName.trim().split(/\s+/)[0];
  const initial = displayName.trim().charAt(0).toUpperCase() || "M";
  const accountData = account.phase === "ready" ? account.account : null;
  const avatarUrl = accountData?.avatarUrl ?? null;
  const memberTier = tierName(member.activeTier, tiers);
  const summary = billing.phase === "ready" ? billing.summary : null;
  const plan = summary?.subscription ?? null;
  const savedItems = bookmarks.phase === "ready" ? bookmarks.items : [];

  const avatar = (large: boolean) => (
    <span className={large ? "mf-acct-avatar is-large" : "mf-acct-avatar"} aria-hidden={true}>
      {avatarUrl ? <img src={avatarUrl} alt="" /> : initial}
    </span>
  );

  const skeleton = (
    <div className="mf-acct-card" aria-busy={true}>
      <div className="mf-acct-skel is-mid" />
      <div className="mf-acct-skel is-wide" />
      <div className="mf-acct-skel" />
    </div>
  );

  const notice = (where: string) =>
    accountNotice && accountNotice.where === where ? (
      <p className={accountNotice.error ? "mf-dash-error" : "mf-dash-saved"} role={accountNotice.error ? "alert" : "status"}>
        {accountNotice.text}
      </p>
    ) : null;

  /** Asks once, in place, before anything is removed or signed out. */
  const confirmBlock = (title: string, note: string, action: string, extra?: React.ReactNode) => (
    <div className="mf-dash-confirm" role="group" aria-label={title}>
      <p className="mf-dash-confirm-title">{title}</p>
      <p className="mf-dash-note">{note}</p>
      {extra}
      <div className="mf-dash-confirm-actions">
        <button type="button" className="mf-dash-button" disabled={accountBusy} onClick={() => setConfirm(null)}>
          {t("cancelAction")}
        </button>
        <button
          type="button"
          className="mf-dash-button mf-dash-button-danger is-solid"
          disabled={accountBusy || onCanvas || (confirm?.kind === "delete" && !confirmsDeleteEmail(deleteEmail, member.email))}
          onClick={() => void runConfirmed(member.email)}
        >
          {action}
        </button>
      </div>
    </div>
  );

  const heading = (title: string, description: string) => (
    <div className="mf-acct-heading">
      <p className="mf-acct-title">{title}</p>
      <p className="mf-acct-desc">{description}</p>
    </div>
  );

  const periodSuffix = (interval: string) => (interval === "month" ? " / month" : interval === "year" ? " / year" : "");

  /** When the plan renews, ends, or is past due, in one line. */
  const renewalLine = (current: NonNullable<BillingSummary["subscription"]>) =>
    current.status === "past_due"
      ? t("pastDue").split("{date}").join(formatDate(current.gracePeriodEndsAt))
      : current.interval === "lifetime"
        ? t("lifetime")
        : current.cancelAtPeriodEnd
          ? t("endsOn").split("{date}").join(formatDate(current.currentPeriodEnd))
          : renewalOverdue(current.currentPeriodEnd)
            ? t("renewalPending")
            : t("renewsOn").split("{date}").join(formatDate(current.currentPeriodEnd));

  const noPlanCard = (current: BillingSummary) => (
    <div className="mf-acct-card">
      <p className="mf-dash-saved">{t("noPlan")}</p>
      {safePath(current.pricingPath) ? (
        <div className="mf-acct-actions">
          <button type="button" className="mf-dash-button mf-dash-button-primary" onClick={() => navigate(current.pricingPath)}>
            {t("seePlans")}
            <ArrowRight aria-hidden={true} />
          </button>
        </div>
      ) : null}
    </div>
  );

  const navLabel: Record<AccountSection, string> = {
    overview: t("navOverview"),
    membership: t("navMembership"),
    billing: t("navBilling"),
    bookmarks: t("navBookmarks"),
    profile: t("navProfile"),
    security: t("navSecurity"),
  };
  const navIcon: Record<AccountSection, React.ReactNode> = {
    overview: <OverviewIcon />,
    membership: <Crown aria-hidden={true} />,
    billing: <ReceiptIcon />,
    bookmarks: <BookmarkIcon />,
    profile: <User aria-hidden={true} />,
    security: <ShieldIcon />,
  };

  // ---- Overview ----------------------------------------------------------

  const overviewSection = () => (
    <>
      {heading(t("overviewTitle").split("{name}").join(firstName), t("overviewDesc"))}
      <div className="mf-acct-stats">
        {config.showTier ? (
          <div className="mf-acct-stat">
            <span className="mf-acct-stat-icon"><Crown aria-hidden={true} /></span>
            <div>
              <p className="mf-acct-stat-label">{t("statPlan")}</p>
              <p className="mf-acct-stat-value">{memberTier}</p>
            </div>
            {showStatus ? <span className={`mf-acct-pill${member.status === "active" ? " is-good" : ""}`}>{statusLabel(member.status, labels)}</span> : null}
          </div>
        ) : null}
        {shown.includes("bookmarks") ? (
          <div className="mf-acct-stat">
            <span className="mf-acct-stat-icon"><BookmarkIcon /></span>
            <div>
              <p className="mf-acct-stat-label">{t("statSaved")}</p>
              <p className="mf-acct-stat-value">{bookmarks.phase === "ready" ? savedItems.length : ""}</p>
            </div>
          </div>
        ) : null}
        <div className="mf-acct-stat">
          <span className="mf-acct-stat-icon"><Check aria-hidden={true} /></span>
          <div>
            <p className="mf-acct-stat-label">{t("statSince")}</p>
            <p className="mf-acct-stat-value">{accountData ? formatDate(accountData.memberSince) : ""}</p>
          </div>
        </div>
      </div>

      {config.showBilling ? (
        billing.phase === "loading" || billing.phase === "idle" ? (
          skeleton
        ) : summary && plan ? (
          <div className="mf-acct-card">
            <div className="mf-acct-plan">
              <div>
                <p className="mf-acct-plan-name">
                  {plan.tierName}
                  {plan.mode === "test" ? <span className="mf-acct-pill">{t("testPurchase")}</span> : null}
                </p>
                <p className="mf-acct-plan-price">
                  {formatMoney(plan.amountMinor, plan.currency)}
                  {periodSuffix(plan.interval)}
                </p>
              </div>
              {shown.includes("membership") ? (
                <button type="button" className="mf-dash-button" onClick={() => goTo("membership")}>
                  {t("managePlan")}
                  <ArrowRight aria-hidden={true} />
                </button>
              ) : null}
            </div>
            <p className={plan.status === "past_due" ? "mf-dash-error" : "mf-dash-saved"}>{renewalLine(plan)}</p>
          </div>
        ) : summary ? (
          noPlanCard(summary)
        ) : null
      ) : null}

      {shown.includes("bookmarks") ? (
        <div className="mf-acct-card">
          <div className="mf-acct-card-head">
            <p className="mf-acct-card-title">{t("recentSaved")}</p>
            {savedItems.length > 0 ? (
              <button type="button" className="mf-acct-link" onClick={() => goTo("bookmarks")}>
                {t("seeAll")}
                <ArrowRight aria-hidden={true} />
              </button>
            ) : null}
          </div>
          {bookmarks.phase === "loading" ? (
            <div className="mf-acct-skel is-wide" />
          ) : savedItems.length === 0 ? (
            <p className="mf-dash-saved">{bookmarks.phase === "failed" ? t("bookmarksFailed") : t("noBookmarks")}</p>
          ) : (
            <div className="mf-acct-list">
              {savedItems.slice(0, 3).map((item) => {
                const href = safeItemHref(item.url);
                return (
                  <div className="mf-acct-item" key={item.itemSlug}>
                    <div className="mf-acct-item-main">
                      <span className="mf-acct-item-icon"><BookmarkIcon /></span>
                      <div className="mf-acct-item-text">
                        {href ? <a className="mf-acct-item-title" href={href}>{item.title}</a> : <span className="mf-acct-item-title">{item.title}</span>}
                        <span className="mf-acct-item-sub">{t("savedOn").split("{date}").join(formatDate(item.savedAt ? new Date(item.savedAt).toISOString() : null))}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </>
  );

  // ---- Membership --------------------------------------------------------

  const membershipSection = () => {
    if (billing.phase === "loading" || billing.phase === "idle") return <>{heading(t("navMembership"), t("membershipDesc"))}{skeleton}</>;
    if (billing.phase === "failed") {
      return (
        <>
          {heading(t("navMembership"), t("membershipDesc"))}
          <div className="mf-acct-card"><p className="mf-dash-saved">{t("billingFailed")}</p></div>
        </>
      );
    }
    const current = billing.summary;
    if (!current.subscription) return <>{heading(t("navMembership"), t("membershipDesc"))}{noPlanCard(current)}</>;
    const subscription = current.subscription;
    const pastDue = subscription.status === "past_due";
    const currentRank = (current.plans ?? []).find((option) => option.key === subscription.tierKey)?.rank ?? -1;
    // Paid plans priced for this period, other than the current one.
    const period = subscription.interval === "year" ? "year" : subscription.interval === "lifetime" ? "lifetime" : "month";
    const others = (current.plans ?? []).filter(
      (option) => option.rank > 0 && option.key !== subscription.tierKey && option.prices[period] !== null
    );
    return (
      <>
        {heading(t("navMembership"), t("membershipDesc"))}
        <div className="mf-acct-card">
          <div className="mf-acct-plan">
            <div>
              <p className="mf-acct-plan-name">
                <Crown aria-hidden={true} />
                {subscription.tierName}
                {subscription.mode === "test" ? <span className="mf-acct-pill">{t("testPurchase")}</span> : null}
              </p>
              <p className="mf-acct-plan-price">
                {formatMoney(subscription.amountMinor, subscription.currency)}
                {periodSuffix(subscription.interval)}
                {subscription.gateway ? ` · ${t("paidWith").split("{gateway}").join(gatewayName(subscription.gateway))}` : ""}
              </p>
            </div>
            {showStatus || pastDue ? <span className={`mf-acct-pill${pastDue ? "" : " is-good"}`}>{statusLabel(pastDue ? "past_due" : member.status, labels)}</span> : null}
          </div>

          <p className={pastDue ? "mf-dash-error" : "mf-dash-saved"} role={pastDue ? "alert" : undefined}>
            {renewalLine(subscription)}
          </p>

          {subscription.scheduledTierName ? (
            <div className="mf-dash-scheduled" role="status">
              <span>
                {t("changesTo").split("{tier}").join(subscription.scheduledTierName).split("{date}").join(formatDate(subscription.currentPeriodEnd))}
              </span>
              <button
                type="button"
                className="mf-dash-button mf-dash-button-small"
                disabled={billingBusy}
                onClick={() => void billingAction("undo-change")}
              >
                {t("undoChange")}
              </button>
            </div>
          ) : null}

          <div className="mf-acct-actions">
            {/* A failed payment goes straight to the card update. */}
            {pastDue && subscription.canManage ? (
              <button
                type="button"
                className="mf-dash-button mf-dash-button-primary"
                disabled={billingBusy || onCanvas}
                onClick={() => void billingAction("portal")}
              >
                <CreditCard aria-hidden={true} />
                {t("updatePayment")}
              </button>
            ) : null}
            {subscription.canResume ? (
              <button
                type="button"
                className="mf-dash-button mf-dash-button-primary"
                disabled={billingBusy}
                onClick={() => void billingAction("resume")}
              >
                {t("resumePlan")}
              </button>
            ) : null}
            {allowCancel && subscription.canCancel && !confirmingCancel ? (
              <button
                type="button"
                className="mf-dash-button mf-dash-button-danger"
                disabled={billingBusy}
                onClick={() => setConfirmingCancel(true)}
              >
                {t("cancelPlan")}
              </button>
            ) : null}
          </div>

          {allowCancel && subscription.canCancel && confirmingCancel ? (
            // Cancel asks once, in place, with what it means.
            <div className="mf-dash-confirm" role="group" aria-label={t("cancelPlan")}>
              <p className="mf-dash-confirm-title">{t("cancelQuestion").split("{tier}").join(subscription.tierName)}</p>
              <p className="mf-dash-note">{t("cancelKeeps").split("{date}").join(formatDate(subscription.currentPeriodEnd))}</p>
              <div className="mf-dash-confirm-actions">
                <button
                  type="button"
                  className="mf-dash-button"
                  disabled={billingBusy}
                  onClick={() => setConfirmingCancel(false)}
                >
                  {t("keepPlan")}
                </button>
                <button
                  type="button"
                  className="mf-dash-button mf-dash-button-danger is-solid"
                  disabled={billingBusy}
                  onClick={() => void billingAction("cancel")}
                >
                  {t("confirmCancel")}
                </button>
              </div>
            </div>
          ) : null}

          {billingNotice ? (
            <p className={billingNotice.error ? "mf-dash-error" : "mf-dash-saved"} role={billingNotice.error ? "alert" : "status"}>
              {billingNotice.text}
            </p>
          ) : null}
        </div>

        {others.length > 0 && subscription.interval !== "lifetime" ? (
          <div className="mf-acct-card">
            <p className="mf-acct-card-title">{t("changePlan")}</p>
            <div className="mf-acct-list">
              {others.map((option) => {
                const up = option.rank > currentRank;
                return (
                  <div className="mf-acct-item" key={option.key}>
                    <div className="mf-acct-item-text">
                      <span className="mf-acct-item-title">{option.name}</span>
                      <span className="mf-acct-item-sub">
                        {formatMoney(option.prices[period] ?? 0, option.currency)}
                        {period === "month" ? " / month" : " / year"}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={`mf-dash-button mf-dash-button-small${up ? " mf-dash-button-primary" : ""}`}
                      disabled={billingBusy || switchTo?.kind === "loading" || Boolean(subscription.scheduledTierName && !up)}
                      onClick={() => void previewChange(option.key, option.name, period)}
                    >
                      {up ? t("upgrade") : t("downgrade")}
                    </button>
                  </div>
                );
              })}
            </div>

            {switchTo && switchTo.kind !== "loading" ? (
              // What the switch costs, before it happens.
              <div className="mf-dash-confirm mf-dash-confirm-change" role="group" aria-label={switchTo.name}>
                {switchTo.kind === "downgrade" ? (
                  <p className="mf-dash-note">
                    {t("downgradeNote").split("{tier}").join(switchTo.name).split("{date}").join(formatDate(switchTo.effectiveAt ?? null))}
                  </p>
                ) : switchTo.summary ? (
                  <div className="mf-dash-breakdown">
                    <span>{switchTo.name}</span>
                    <span>{formatMoney(switchTo.summary.amountMinor, switchTo.summary.currency)}</span>
                    {(switchTo.summary.creditMinor ?? 0) > 0 ? (
                      <>
                        <span className="mf-dash-muted">{t("creditLine").split("{plan}").join(switchTo.summary.creditFrom ?? subscription.tierName)}</span>
                        <span className="mf-dash-muted">-{formatMoney(switchTo.summary.creditMinor ?? 0, switchTo.summary.currency)}</span>
                      </>
                    ) : null}
                    <strong>{t("dueToday")}</strong>
                    <strong>{formatMoney(switchTo.summary.dueMinor ?? switchTo.summary.amountMinor, switchTo.summary.currency)}</strong>
                    <span className="mf-dash-muted mf-dash-breakdown-wide">
                      {t("thenEvery")
                        .split("{price}")
                        .join(formatMoney(switchTo.summary.amountMinor, switchTo.summary.currency))
                        .split("{period}")
                        .join(switchTo.summary.interval === "year" ? "year" : "month")}
                    </span>
                  </div>
                ) : null}
                <div className="mf-dash-confirm-actions">
                  <button type="button" className="mf-dash-button" disabled={billingBusy} onClick={() => setSwitchTo(null)}>
                    {t("notNow")}
                  </button>
                  <button
                    type="button"
                    className="mf-dash-button mf-dash-button-primary"
                    disabled={billingBusy}
                    onClick={() => void confirmChange(current.pricingPath)}
                  >
                    {switchTo.kind === "downgrade" ? t("confirmDowngrade") : t("confirmUpgrade")}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </>
    );
  };

  // ---- Billing -----------------------------------------------------------

  const billingSection = () => {
    if (billing.phase === "loading" || billing.phase === "idle") return <>{heading(t("navBilling"), t("billingDesc"))}{skeleton}</>;
    if (billing.phase === "failed") {
      return (
        <>
          {heading(t("navBilling"), t("billingDesc"))}
          <div className="mf-acct-card"><p className="mf-dash-saved">{t("billingFailed")}</p></div>
        </>
      );
    }
    const current = billing.summary;
    const subscription = current.subscription;
    const historyPlans = current.history?.plans ?? [];
    const credits = current.history?.credits ?? [];
    return (
      <>
        {heading(t("navBilling"), t("billingDesc"))}
        {subscription && subscription.canManage ? (
          <div className="mf-acct-card">
            <div className="mf-acct-plan">
              <div className="mf-acct-item-main">
                <span className="mf-acct-item-icon"><CreditCard aria-hidden={true} /></span>
                <div className="mf-acct-item-text">
                  <span className="mf-acct-item-title">{t("updateMethod")}</span>
                  {subscription.gateway ? <span className="mf-acct-item-sub">{t("paidWith").split("{gateway}").join(gatewayName(subscription.gateway))}</span> : null}
                </div>
              </div>
              <button type="button" className="mf-dash-button" disabled={billingBusy || onCanvas} onClick={() => void billingAction("portal")}>
                {t("manageBilling")}
                <ExternalIcon />
              </button>
            </div>
          </div>
        ) : null}

        {showPaymentHistory ? (
          <div className="mf-acct-card">
            <p className="mf-acct-card-title">{t("history")}</p>
            {current.payments.length === 0 ? (
              <p className="mf-dash-saved">{t("noPayments")}</p>
            ) : (
              <div className="mf-acct-list">
                {current.payments.map((payment) => (
                  <div className="mf-acct-item" key={payment.id}>
                    <div className="mf-acct-item-main">
                      <span className="mf-acct-item-icon"><ReceiptIcon /></span>
                      <div className="mf-acct-item-text">
                        <span className="mf-acct-item-title">{formatDate(payment.paidAt)}</span>
                        <span className="mf-acct-item-sub">
                          {[payment.planName, gatewayName(payment.gateway), payment.mode === "test" ? t("testPurchase") : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </div>
                    </div>
                    <div className="mf-acct-item-end">
                      {payment.status === "refunded" ? <span className="mf-acct-pill">{t("refunded")}</span> : null}
                      <span>
                        {payment.status === "credited" ? "-" : ""}
                        {formatMoney(payment.amountMinor, payment.currency)}
                      </span>
                      {payment.receiptUrl && /^https:\/\//.test(payment.receiptUrl) ? (
                        <a className="mf-dash-link" href={payment.receiptUrl} target="_blank" rel="noopener noreferrer">
                          {t("receipt")}
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {showPaymentHistory && historyPlans.length > 0 ? (
          <div className="mf-acct-card">
            <p className="mf-acct-card-title">{t("plansTitle")}</p>
            <div className="mf-acct-list">
              {current.history!.plans.map((entry, index) => (
                <div className="mf-acct-item" key={`plan-${index}`}>
                  <div className="mf-acct-item-text">
                    <span className="mf-acct-item-title">
                      {entry.planName}
                      {entry.interval === "month" ? ", monthly" : entry.interval === "year" ? ", yearly" : ", lifetime"}
                    </span>
                    <span className="mf-acct-item-sub">
                      {[gatewayName(entry.gateway), formatDate(entry.startedAt), entry.mode === "test" ? t("testPurchase") : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                  <span className={`mf-acct-pill${entry.status === "ended" ? "" : " is-good"}`}>{entry.status === "ended" ? t("planEnded") : t("planActive")}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {showPaymentHistory && credits.length > 0 ? (
          <div className="mf-acct-card">
            <div className="mf-acct-list">
              {current.history!.credits.map((credit, index) => (
                <div className="mf-acct-item" key={`credit-${index}`}>
                  <div className="mf-acct-item-text">
                    <span className="mf-acct-item-title">{t("creditedLine")}</span>
                    <span className="mf-acct-item-sub">
                      {[credit.planName, gatewayName(credit.gateway), formatDate(credit.at)].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <span className="mf-acct-item-end">-{formatMoney(credit.amountMinor, credit.currency)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </>
    );
  };

  // ---- Bookmarks ---------------------------------------------------------

  const bookmarksSection = () => {
    const query = bookmarkQuery.trim().toLowerCase();
    const matching = query === "" ? savedItems : savedItems.filter((item) => `${item.title} ${item.url}`.toLowerCase().includes(query));
    return (
      <>
        {heading(t("navBookmarks"), t("bookmarksDesc"))}
        <div className="mf-acct-card">
          {savedItems.length > 0 ? (
            <div className="mf-acct-search">
              <SearchIcon />
              <input
                className="mf-dash-input"
                type="search"
                placeholder={t("searchSaved")}
                aria-label={t("searchSaved")}
                value={bookmarkQuery}
                onChange={(event) => setBookmarkQuery(event.currentTarget.value)}
              />
            </div>
          ) : null}
          {notice("bookmarks")}
          {bookmarks.phase === "loading" || bookmarks.phase === "idle" ? (
            <>
              <div className="mf-acct-skel is-wide" />
              <div className="mf-acct-skel is-mid" />
            </>
          ) : bookmarks.phase === "failed" ? (
            <p className="mf-dash-saved">{t("bookmarksFailed")}</p>
          ) : matching.length === 0 ? (
            <div className="mf-acct-empty">
              <span className="mf-acct-item-icon"><BookmarkIcon /></span>
              <p>{savedItems.length === 0 ? t("noBookmarks") : t("noMatches")}</p>
            </div>
          ) : (
            <div className="mf-acct-list">
              {matching.map((item) => {
                const href = safeItemHref(item.url);
                return (
                  <div className="mf-acct-item" key={item.itemSlug}>
                    <div className="mf-acct-item-main">
                      <span className="mf-acct-item-icon"><BookmarkIcon /></span>
                      <div className="mf-acct-item-text">
                        {href ? <a className="mf-acct-item-title" href={href}>{item.title}</a> : <span className="mf-acct-item-title">{item.title}</span>}
                        <span className="mf-acct-item-sub">{t("savedOn").split("{date}").join(formatDate(item.savedAt ? new Date(item.savedAt).toISOString() : null))}</span>
                      </div>
                    </div>
                    <div className="mf-acct-item-end">
                      <button
                        type="button"
                        className="mf-dash-button mf-dash-button-small mf-dash-button-danger"
                        disabled={onCanvas}
                        aria-label={`${t("removeBookmark")} ${item.title}`}
                        onClick={() => void removeBookmark(item)}
                      >
                        <TrashIcon />
                        {t("removeBookmark")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </>
    );
  };

  // ---- Profile -----------------------------------------------------------

  const profileSection = () => (
    <>
      {heading(t("navProfile"), t("profileDesc"))}

      {photoUpload ? (
        <div className="mf-acct-card">
          <p className="mf-acct-card-title">{t("photoTitle")}</p>
          <div className="mf-acct-photo">
            {avatar(true)}
            <div className="mf-acct-photo-text">
              <div className="mf-acct-actions">
                <button type="button" className="mf-dash-button" disabled={accountBusy || onCanvas} onClick={() => fileRef.current?.click()}>
                  <CameraIcon />
                  {avatarUrl ? t("changePhoto") : t("uploadPhoto")}
                </button>
                {avatarUrl ? (
                  <button type="button" className="mf-dash-button mf-dash-button-danger" disabled={accountBusy} onClick={() => setConfirm({ kind: "photo" })}>
                    {t("removePhoto")}
                  </button>
                ) : null}
              </div>
              <p className="mf-dash-saved">{t("photoHint")}</p>
            </div>
            <input
              ref={fileRef}
              className="mf-acct-file"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              tabIndex={-1}
              aria-hidden={true}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (file) void uploadPhoto(file);
              }}
            />
          </div>
          {confirm?.kind === "photo" ? confirmBlock(t("removePhotoQuestion"), t("photoHint"), t("removePhoto")) : null}
          {notice("photo")}
        </div>
      ) : null}

      <form
        className="mf-acct-card mf-acct-form"
        noValidate
        aria-labelledby={`mf-dash-profile-${member.memberId}`}
        onSubmit={(event) => {
          event.preventDefault();
          void handleSaveProfile();
        }}
      >
        <p className="mf-acct-card-title" id={`mf-dash-profile-${member.memberId}`}>
          {t("profileTitle")}
        </p>

        {profile.phase === "loading" || profile.phase === "idle" ? (
          <p className="mf-dash-saved">{t("profileLoading")}</p>
        ) : profile.phase === "unavailable" ? (
          <p className="mf-dash-saved">{t("profileUnavailable")}</p>
        ) : (
          <>
            <div className="mf-acct-grid">
              <div className="mf-dash-field">
                <label className="mf-dash-label" htmlFor={`mf-dash-name-${member.memberId}`}>
                  {t("nameLabel")}
                </label>
                <input
                  id={`mf-dash-name-${member.memberId}`}
                  className="mf-dash-input"
                  type="text"
                  autoComplete="name"
                  maxLength={255}
                  value={profileName}
                  disabled={profileSaving}
                  onChange={(event) => {
                    setProfileName(event.currentTarget.value);
                    setProfileNotice(null);
                  }}
                />
              </div>
              {showEmail ? (
                <div className="mf-dash-field">
                  <span className="mf-dash-label">{t("emailLabel")}</span>
                  <div className="mf-acct-readonly">
                    <strong>{member.email}</strong>
                    <span>{t("emailFixed")}</span>
                  </div>
                </div>
              ) : null}
            </div>

            {profile.fields
              .filter((field) => isFieldVisible(field, profileValues))
              .map((field) => (
                <ProfileControl
                  key={field.key}
                  id={`mf-dash-${member.memberId}-${field.key}`}
                  field={field}
                  value={profileValues[field.key]}
                  error={profileProblems[field.key]}
                  disabled={profileSaving}
                  onChange={(value) => setProfileValue(field.key, value)}
                  optionalLabel={t("optional")}
                  chooseLabel={t("chooseOne")}
                />
              ))}

            {profileNotice ? (
              <p className={profileNotice.ok ? "mf-dash-saved" : "mf-dash-error"} role="status">
                {profileNotice.text}
              </p>
            ) : null}

            <div className="mf-acct-actions">
              <button
                type="submit"
                className="mf-dash-button mf-dash-button-primary"
                disabled={profileSaving || onCanvas}
              >
                {profileSaving ? t("saving") : t("saveProfile")}
              </button>
            </div>
          </>
        )}
      </form>
    </>
  );

  // ---- Security ----------------------------------------------------------

  const securitySection = () => {
    if (!accountData) {
      return (
        <>
          {heading(t("navSecurity"), t("securityDesc"))}
          {account.phase === "failed" ? <div className="mf-acct-card"><p className="mf-dash-saved">{t("actionFailed")}</p></div> : skeleton}
        </>
      );
    }
    const hasPassword = accountData.hasPassword;
    const others = accountData.sessions.filter((entry) => !entry.current);
    return (
      <>
        {heading(t("navSecurity"), t("securityDesc"))}

        <form
          className="mf-acct-card mf-acct-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void changePassword(hasPassword);
          }}
        >
          <div className="mf-acct-card-head">
            <p className="mf-acct-card-title">{t("passwordTitle")}</p>
            <span className="mf-acct-item-icon"><KeyIcon /></span>
          </div>
          {!hasPassword ? <p className="mf-dash-saved">{t("passwordSetNote")}</p> : null}
          {hasPassword ? (
            <div className="mf-dash-field">
              <label className="mf-dash-label" htmlFor={`mf-acct-current-${member.memberId}`}>{t("currentPassword")}</label>
              <input
                id={`mf-acct-current-${member.memberId}`}
                className="mf-dash-input"
                type="password"
                autoComplete="current-password"
                value={password.current}
                disabled={accountBusy}
                onChange={(event) => setPassword({ ...password, current: event.currentTarget.value })}
              />
            </div>
          ) : null}
          <div className="mf-acct-grid">
            <div className="mf-dash-field">
              <label className="mf-dash-label" htmlFor={`mf-acct-new-${member.memberId}`}>{t("newPassword")}</label>
              <input
                id={`mf-acct-new-${member.memberId}`}
                className="mf-dash-input"
                type="password"
                autoComplete="new-password"
                value={password.next}
                disabled={accountBusy}
                onChange={(event) => setPassword({ ...password, next: event.currentTarget.value })}
              />
            </div>
            <div className="mf-dash-field">
              <label className="mf-dash-label" htmlFor={`mf-acct-again-${member.memberId}`}>{t("confirmPassword")}</label>
              <input
                id={`mf-acct-again-${member.memberId}`}
                className="mf-dash-input"
                type="password"
                autoComplete="new-password"
                value={password.again}
                disabled={accountBusy}
                onChange={(event) => setPassword({ ...password, again: event.currentTarget.value })}
              />
            </div>
          </div>
          {notice("password")}
          <div className="mf-acct-actions">
            <button
              type="submit"
              className="mf-dash-button mf-dash-button-primary"
              disabled={accountBusy || onCanvas || password.next === "" || (hasPassword && password.current === "")}
            >
              {hasPassword ? t("changePassword") : t("setPassword")}
            </button>
          </div>
        </form>

        <div className="mf-acct-card">
          <p className="mf-acct-card-title">{t("methodsTitle")}</p>
          {accountData.identities.length === 0 ? (
            <p className="mf-dash-saved">{t("methodsNone")}</p>
          ) : (
            <div className="mf-acct-list">
              {accountData.identities.map((identity) => {
                const lastWay = !hasPassword && accountData.identities.length === 1;
                return (
                  <div className="mf-acct-item" key={identity.provider}>
                    <div className="mf-acct-item-main">
                      <span className="mf-acct-item-icon"><LinkIcon /></span>
                      <div className="mf-acct-item-text">
                        <span className="mf-acct-item-title">{providerName(identity.provider)}</span>
                        <span className="mf-acct-item-sub">
                          {[identity.email, identity.createdAt ? t("connectedOn").split("{date}").join(formatDate(identity.createdAt)) : null].filter(Boolean).join(" · ")}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="mf-dash-button mf-dash-button-small"
                      disabled={accountBusy || lastWay}
                      title={lastWay ? t("unlinkLast") : undefined}
                      onClick={() => setConfirm({ kind: "unlink", provider: identity.provider })}
                    >
                      {t("unlink")}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {confirm?.kind === "unlink"
            ? confirmBlock(
                t("unlinkQuestion").split("{provider}").join(providerName(confirm.provider)),
                t("unlinkNote").split("{provider}").join(providerName(confirm.provider)),
                t("unlink")
              )
            : null}
          {notice("security")}
        </div>

        <div className="mf-acct-card">
          <div className="mf-acct-card-head">
            <p className="mf-acct-card-title">{t("devicesTitle")}</p>
            {others.length > 0 ? (
              <button type="button" className="mf-acct-link" disabled={accountBusy} onClick={() => setConfirm({ kind: "everywhere" })}>
                {t("signOutEverywhere")}
              </button>
            ) : null}
          </div>
          <div className="mf-acct-list">
            {accountData.sessions.map((entry) => {
              const phone = /iPhone|Android|iPad/.test(entry.device);
              return (
                <div className="mf-acct-item" key={entry.id}>
                  <div className="mf-acct-item-main">
                    <span className="mf-acct-item-icon">{phone ? <PhoneIcon /> : <MonitorIcon />}</span>
                    <div className="mf-acct-item-text">
                      <span className="mf-acct-item-title">{entry.device}</span>
                      <span className="mf-acct-item-sub">
                        {entry.current ? t("thisDevice") : t("lastActive").split("{date}").join(formatDate(entry.lastSeenAt ?? entry.createdAt))}
                      </span>
                    </div>
                  </div>
                  {entry.current ? (
                    <span className="mf-acct-pill is-accent">{t("thisDevice")}</span>
                  ) : (
                    <button
                      type="button"
                      className="mf-dash-button mf-dash-button-small"
                      disabled={accountBusy}
                      onClick={() => setConfirm({ kind: "device", id: entry.id, device: entry.device })}
                    >
                      {t("signOutDevice")}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {confirm?.kind === "device"
            ? confirmBlock(t("signOutDeviceQuestion").split("{device}").join(confirm.device), t("signOutDeviceNote"), t("signOutDevice"))
            : null}
          {confirm?.kind === "everywhere" ? confirmBlock(t("signOutEverywhere"), t("signOutEverywhereNote"), t("signOutEverywhere")) : null}
        </div>

        {deleteAllowed ? (
          <div className="mf-acct-card is-danger">
            <div className="mf-acct-card-head">
              <p className="mf-acct-card-title">{t("dangerTitle")}</p>
              <span className="mf-acct-item-icon"><AlertIcon /></span>
            </div>
            <p className="mf-dash-saved">{t("deleteNote")}</p>
            {confirm?.kind === "delete" ? (
              confirmBlock(
                t("dangerTitle"),
                t("deleteNote"),
                t("deleteFinal"),
                <div className="mf-dash-field">
                  <label className="mf-dash-label" htmlFor={`mf-acct-delete-${member.memberId}`}>
                    {t("deleteConfirmLabel").split("{email}").join(member.email)}
                  </label>
                  <input
                    id={`mf-acct-delete-${member.memberId}`}
                    className="mf-dash-input"
                    type="email"
                    autoComplete="off"
                    value={deleteEmail}
                    disabled={accountBusy}
                    onChange={(event) => setDeleteEmail(event.currentTarget.value)}
                  />
                </div>
              )
            ) : (
              <div className="mf-acct-actions">
                <button type="button" className="mf-dash-button mf-dash-button-danger" disabled={accountBusy} onClick={() => setConfirm({ kind: "delete" })}>
                  <TrashIcon />
                  {t("deleteButton")}
                </button>
              </div>
            )}
            {notice("delete")}
          </div>
        ) : null}
      </>
    );
  };

  const renderSection: Record<AccountSection, () => React.ReactNode> = {
    overview: overviewSection,
    membership: membershipSection,
    billing: billingSection,
    bookmarks: bookmarksSection,
    profile: profileSection,
    security: securitySection,
  };

  return (
    <div className={`${rootClass} is-account`} data-mf-dash={styled.scope} data-mf-instance={scope}>
      {style}
      <div className={`mf-acct is-nav-${navigation === "sidebar" || navigation === "top" ? navigation : "auto"}`}>
        <div className="mf-acct-side">
          <div className="mf-acct-who">
            {showAvatar ? avatar(false) : null}
            <div className="mf-acct-who-text">
              <p className="mf-acct-name">{displayName}</p>
              {showEmail && displayName !== member.email ? <p className="mf-acct-email">{member.email}</p> : null}
              {config.showTier ? <span className="mf-dash-badge">{memberTier}</span> : null}
            </div>
          </div>
          <p className="mf-acct-caption">{config.headline}</p>
          <nav className="mf-acct-nav" aria-label={config.headline}>
            {shown.map((name) => (
              <button
                key={name}
                type="button"
                className={`mf-acct-tab${active === name ? " is-active" : ""}`}
                aria-current={active === name ? "page" : undefined}
                onClick={() => goTo(name)}
              >
                {navIcon[name]}
                {navLabel[name]}
              </button>
            ))}
            {config.showSignOut ? (
              <button
                type="button"
                className={`mf-acct-tab mf-acct-signout is-${signOutStyle === "filled" ? "filled" : signOutStyle === "text" ? "text" : "outline"}`}
                disabled={busy}
                onClick={() => void handleSignOut()}
              >
                <LogOut aria-hidden={true} />
                {busy ? t("signingOut") : t("signOut")}
              </button>
            ) : null}
          </nav>
        </div>
        <div className="mf-acct-main" role="region" aria-label={navLabel[active]} aria-live="polite">
          {renderSection[active]()}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PROPERTY CONTROLS
// ============================================================================
// Every field a creator should reach from the Framer sidebar. `apiBaseUrl` and
// `siteKey` are deliberately absent: both are properties of the connection
// rather than of the component, the generator bakes them in at deploy time, and
// a creator editing either by hand would break the component with no way to
// know why.

const SECTION_OPTIONS = [...ACCOUNT_SECTIONS];
const SECTION_TITLES = ["Overview", "Membership", "Billing", "Bookmarks", "Profile", "Security"];

addPropertyControls(MemberDashboard, mfControls({
  // The Builder's seal for this instance (27-instance-seal.md). Hidden: it is
  // set on insert and a pasted copy loses it.
  mfSeal: { type: ControlType.String, title: "Seal", hidden: () => true },
  // First in the sidebar: the canvas cannot take clicks, so this is how a
  // creator sees and styles each tab. The published site ignores it.
  canvasSection: {
    type: ControlType.Enum,
    title: "Canvas Preview",
    options: SECTION_OPTIONS,
    optionTitles: SECTION_TITLES,
    defaultValue: "overview",
  },
  headline: {
    type: ControlType.String,
    title: "Headline",
    defaultValue: CONFIG.headline,
  },
  signedOutMessage: {
    type: ControlType.String,
    title: "Signed Out Text",
    defaultValue: CONFIG.signedOutMessage,
  },

  /* ---- The account area (33-member-account.md) ---- */

  sections: {
    type: ControlType.Object,
    title: "Sections",
    buttonTitle: "Sections",
    controls: {
      overview: { type: ControlType.Boolean, title: "Overview", defaultValue: true },
      membership: { type: ControlType.Boolean, title: "Membership", defaultValue: true },
      billing: { type: ControlType.Boolean, title: "Billing", defaultValue: true },
      bookmarks: { type: ControlType.Boolean, title: "Bookmarks", defaultValue: true },
      profile: { type: ControlType.Boolean, title: "Profile", defaultValue: true },
      security: { type: ControlType.Boolean, title: "Security", defaultValue: true },
      photoUpload: { type: ControlType.Boolean, title: "Photo Upload", defaultValue: true },
      deleteAccount: { type: ControlType.Boolean, title: "Delete Account", defaultValue: true },
    },
  },
  defaultSection: {
    type: ControlType.Enum,
    title: "Default Section",
    options: SECTION_OPTIONS,
    optionTitles: SECTION_TITLES,
    defaultValue: "overview",
  },
  navigation: {
    type: ControlType.Enum,
    title: "Navigation",
    options: ["auto", "sidebar", "top"],
    optionTitles: ["Auto", "Sidebar", "Top"],
    defaultValue: "auto",
  },

  /* ---- What the panel shows ---- */

  showAvatar: {
    type: ControlType.Boolean,
    title: "Avatar",
    defaultValue: true,
  },
  showEmail: {
    type: ControlType.Boolean,
    title: "Email",
    defaultValue: true,
  },
  showTier: {
    type: ControlType.Boolean,
    title: "Membership Badge",
    defaultValue: CONFIG.showTier,
  },
  showStatus: {
    type: ControlType.Boolean,
    title: "Status",
    defaultValue: true,
  },
  showProfile: {
    type: ControlType.Boolean,
    title: "Profile Form",
    defaultValue: CONFIG.showProfile,
  },
  showBilling: {
    type: ControlType.Boolean,
    title: "Billing",
    defaultValue: CONFIG.showBilling,
  },
  showPaymentHistory: {
    type: ControlType.Boolean,
    title: "Payment History",
    defaultValue: true,
    hidden: (props) => props.showBilling === false,
  },
  allowCancel: {
    type: ControlType.Boolean,
    title: "Allow Cancel",
    defaultValue: true,
    hidden: (props) => props.showBilling === false,
  },
  showSignOut: {
    type: ControlType.Boolean,
    title: "Sign Out",
    defaultValue: CONFIG.showSignOut,
  },
  signOutStyle: {
    type: ControlType.Enum,
    title: "Sign Out Style",
    options: ["outline", "filled", "text"],
    optionTitles: ["Outline", "Filled", "Text"],
    defaultValue: "outline",
    hidden: (props) => props.showSignOut === false,
  },

  /* ---- Navigation ---- */

  loginPath: {
    type: ControlType.String,
    title: "Sign In Page",
    defaultValue: CONFIG.loginPath,
  },
  afterLogoutPath: {
    type: ControlType.String,
    title: "After Sign Out",
    defaultValue: CONFIG.afterLogoutPath,
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
    max: 32,
    unit: "px",
  },

  /* ---- Shared appearance: Colors, Typography, Layout, then Labels ---- */

  ...mfAppearanceControls({ padding: 24, gap: 20, shadow: false }),
  labels: mfLabelControls(DASH_LABELS),
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

function ArrowRight({ className }: InlineIconProps): React.ReactElement {
  return (
    <svg className={iconClass("arrow-right", className)} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden={true} data-lucide="arrow-right">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function Check({ className }: InlineIconProps): React.ReactElement {
  return (
    <svg className={iconClass("check", className)} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden={true} data-lucide="check">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function CreditCard({ className }: InlineIconProps): React.ReactElement {
  return (
    <svg className={iconClass("credit-card", className)} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden={true} data-lucide="credit-card">
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}

function Crown({ className }: InlineIconProps): React.ReactElement {
  return (
    <svg className={iconClass("crown", className)} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden={true} data-lucide="crown">
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
      <path d="M5 21h14" />
    </svg>
  );
}

function LogOut({ className }: InlineIconProps): React.ReactElement {
  return (
    <svg className={iconClass("log-out", className)} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden={true} data-lucide="log-out">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
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

function User({ className }: InlineIconProps): React.ReactElement {
  return (
    <svg className={iconClass("user", className)} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden={true} data-lucide="user">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
