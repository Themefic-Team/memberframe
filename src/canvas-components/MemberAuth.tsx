/**
 * `<MemberAuth>`, passwordless sign-in. PRD task 2.5, feature F05.
 *
 * ## This file leaves the repository
 *
 * It is written into the creator's Framer project and runs on
 * their published site, it may import only `react`, `react-dom` (for the
 * modal's portal), `framer`, and `lucide-react`, all styling is one `cssContent` string, and the marked config
 * block is the only part the generator rewrites.
 *
 * ## Two things make this riskier than most components
 *
 * **It accepts a message from another window.** OAuth uses a popup and a
 * `postMessage` callback so the visitor never leaves the page. PRD section 14.1
 * S8 requires every such handler to validate `event.origin` against an
 * allowlist, and section 16.4 repeats it. Without that check, any window with a
 * handle on this one can post a success message and the component will tell the
 * visitor they are signed in when they are not. The check is in `onMessage`
 * below and it is an equality comparison, deliberately: a suffix test matches
 * `api.memberframe.framefic.com.attacker.example`.
 *
 * **It writes a creator-supplied colour into a style block.** `accentColor`
 * comes from `ControlType.Color`, and a Framer variable can set a prop the code
 * generator never saw. A value like `red; } body { display: none } .x {` would
 * be CSS injection on the creator's own page, so `safeColor` whitelists the
 * three notations a colour can legitimately take and falls back otherwise.
 *
 * ## What it does not do
 *
 * No token is read or stored. PRD section 14.1 S2 puts the member session in an
 * HTTP-only cookie, so the browser holds it and this component never sees it.
 * There is no `localStorage` call in this file and there must not be one.
 * Attempt counts and rate limits are the server's (F05, F21); the resend lock
 * here is a courtesy.
 */

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addPropertyControls, ControlType, RenderTarget } from "framer";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  MailCheck,
  ShieldCheck,
  UserPlus,
} from "lucide-react";

// ============================================================================
// LICENSING AND TRIAL STATE
// ============================================================================
// Rewritten in place by F19's `enforceLockState` regex patcher, so these four
// lines must keep this exact shape. PRD section 9.3 requirement 3.
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
// CONTRACTS
// ============================================================================

type AuthDisplayMode = "inline" | "modal";
type OAuthProvider = "google" | "apple" | "github" | "discord";
type AuthMethod = "password" | "otp";

/**
 * Which flows this deployment offers.
 *
 * `all` is `<MemberAuth>` itself: every flow in one box, switched by tabs and
 * links. The other four are the dedicated components the plugin deploys from
 * this same file, `<MemberLogin>`, `<MemberRegister>`, `<MemberPasswordReset>`,
 * and `<MemberOtpVerify>`, one flow each and one page each.
 *
 * One authored file rather than five. The flows share the session cookie, the
 * site key header, the OAuth origin check, the password policy, and the open
 * redirect guard, and five copies of those are five places for a security fix
 * to be missed. The generator bakes the screen in and renames the export, so a
 * creator sees five separate components and the repository holds one.
 */
type AuthScreen = "all" | "login" | "register" | "reset" | "otp";

interface AuthConfig {
  authMode: AuthDisplayMode;
  modalTrigger: ModalTrigger;
  modalTriggerId: string;
  modalDelay: number;
  modalScrollPercent: number;
  modalOncePerSession: boolean;
  modalCanvasPreview: boolean;
  headline: string;
  welcomeMessage: string;
  emailEnabled: boolean;
  googleEnabled: boolean;
  appleEnabled: boolean;
  githubEnabled: boolean;
  discordEnabled: boolean;
  accentColor: string;
  borderRadius: number;
  enablePasswordAuth: boolean;
  defaultAuthMethod: AuthMethod;
  passwordPolicy: PasswordPolicy;
  apiBaseUrl: string;
  /**
   * Which MemberFrame site this component belongs to.
   *
   * Public, and baked in here exactly as `apiBaseUrl` already is: it is no
   * more secret than a Stripe publishable key, and it is readable in this
   * file's source on any published site. It IDENTIFIES the tenant. What
   * authorizes is the request's `Origin`, which the browser sets and a page
   * cannot forge, checked against that site's allowlist on the server.
   *
   * Empty when the component was deployed before the project was connected.
   * Every request then fails with `missing_site_key`, which is why the plugin
   * refuses to deploy while disconnected.
   */
  siteKey: string;
  /**
   * Where to send the visitor once they are signed in.
   *
   * A site-relative path, never a URL. The plugin validates that before
   * storing it and the server validates it again: a value that could carry an
   * absolute URL would make this component an open redirect, which is exactly
   * the shape a phishing hop wants.
   */
  afterLoginPath: string;
  /** See `AuthScreen`. Baked in by the generator, never a property control. */
  screen: AuthScreen;
  /**
   * The pages a dedicated screen links to, site-relative. Unused by `all`,
   * which switches views in place. An empty or unsafe value hides its link
   * rather than sending a visitor somewhere that may not exist.
   */
  loginPath: string;
  signupPath: string;
  resetPath: string;
  otpPath: string;
}

const ENV_API_BASE_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_APP_BASE_URL)) ||
  "";

// @memberframe-config-start
const CONFIG: AuthConfig = {
  authMode: "inline",
  modalTrigger: "click",
  modalTriggerId: "sign-in",
  modalDelay: 0,
  modalScrollPercent: 50,
  modalOncePerSession: true,
  modalCanvasPreview: true,
  headline: "Sign in to continue",
  welcomeMessage: "Use your email or a connected account.",
  emailEnabled: true,
  googleEnabled: true,
  appleEnabled: false,
  githubEnabled: false,
  discordEnabled: false,
  accentColor: "#5271ff",
  borderRadius: 10,
  enablePasswordAuth: true,
  defaultAuthMethod: "password",
  passwordPolicy: { minLength: 8, requireNumber: true, requireUppercase: false, requireLowercase: false, requireSymbol: false },
  apiBaseUrl: ENV_API_BASE_URL,
  siteKey: "",
  afterLoginPath: "",
  screen: "all",
  loginPath: "/login",
  signupPath: "",
  resetPath: "/reset-password",
  otpPath: "",
};
// @memberframe-config-end

/**
 * The endpoints this component calls.
 *
 * CONFLICT C11, and these are **proposals, not quotations**. PRD section 10.4
 * lists the member runtime endpoints and none of them sends or verifies an OTP.
 * The only OTP routes in the PRD are in section 10.2, which serves the plugin
 * panel: its send route takes a `framerUserId`, which a site visitor does not
 * have, and its verify route returns a token in the body where F05 requires an
 * HTTP-only cookie.
 *
 * Written up in `docs/development-docs/05-member-auth.md` section 5.1. They
 * need confirming before the backend routes are built.
 */
const SEND_OTP_PATH = "/api/member/send-otp";
const VERIFY_OTP_PATH = "/api/member/verify-otp";
const OAUTH_PATH_PREFIX = "/api/member/oauth/";

/**
 * The four password endpoints, feature plan FP-02 section 3.3.
 *
 * Same standing as the two above: **proposals, not quotations.** PRD section
 * 10.4 contains none of them, so conflict C11 now covers six routes. Written up
 * in `05-member-auth.md` section 9.8.
 *
 * No body carries a `siteId`. FP-02's contract includes one, and it is left out
 * deliberately: the backend knows which site a request came from by its origin,
 * and a client-supplied `siteId` is a cross-site read waiting to be tried.
 */
const REGISTER_PATH = "/api/member/register";
const LOGIN_PASSWORD_PATH = "/api/member/login-password";
const FORGOT_PASSWORD_PATH = "/api/member/forgot-password";
const RESET_PASSWORD_PATH = "/api/member/reset-password";
const SESSION_PATH = "/api/member/session";
const AUTH_CONFIG_PATH = "/api/member/auth-config";
/** Email confirmation for a new account. Confirms only; the member signs in next. */
const VERIFY_EMAIL_PATH = "/api/member/verify-email";
const RESEND_VERIFICATION_PATH = "/api/member/verify-email/resend";

/*
  Keys shared with the Route Shield script (the API's /shield.js). Change them
  together.

  The hint says this browser has a session here, so the shield hides the sign
  in page until it has sent a signed-in member on, rather than flashing the
  form first. The cache is the shield's 30 second session copy, dropped on any
  change so a signed-out visitor cannot ride it onto a locked page. The denied
  key is the page the shield just turned a signed-in member away from.
*/
const HINT_KEY = `memberframe:signed-in:${CONFIG.siteKey}`;
/** Modal triggers: the pages and triggers whose modal opened by itself this visit. Not a credential. */
const MODAL_SHOWN_KEY = "memberframe:modal-shown";
const SESSION_CACHE_KEY = `__mf_session_${CONFIG.siteKey}`;
const DENIED_KEY = `memberframe:denied:${CONFIG.siteKey}`;
/** Carries a just-confirmed address from a sign up page to the sign in page. */
const VERIFIED_KEY = `memberframe:verified:${CONFIG.siteKey}`;
/**
 * Written by `<MemberPricing>` when a signed-out visitor picks a plan: which
 * tier, and the pricing page to come back to. Signing in sends them there
 * instead of the After sign in page, and the checkout starts by itself.
 */
const CHECKOUT_INTENT_KEY = `memberframe:checkout-intent:${CONFIG.siteKey}`;
const CHECKOUT_INTENT_TTL_MS = 30 * 60 * 1000;
/**
 * Written by `<BookmarkButton>`, `<BookmarksTray>`, `<ProtectedDownload>`, and
 * `<MeteredPaywall>` when a signed-out visitor presses their sign in button:
 * the page they were on. Signing in sends them back to it, where the bookmark
 * saves itself, the download unlocks, or the article opens.
 */
const RETURN_KEY = `memberframe:return-to:${CONFIG.siteKey}`;

/** The pricing page a signed-out buyer started from, or null. */
function checkoutIntentPath(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CHECKOUT_INTENT_KEY);
    if (!raw) return null;
    const intent = JSON.parse(raw) as { returnPath?: unknown; ts?: unknown };
    if (typeof intent.ts !== "number" || Date.now() - intent.ts > CHECKOUT_INTENT_TTL_MS) return null;
    const path = typeof intent.returnPath === "string" ? intent.returnPath : "";
    return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") ? path : null;
  } catch {
    return null;
  }
}

/** The page a content component asked to come back to, once. Read clears it. */
function returnPath(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(RETURN_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(RETURN_KEY);
    const saved = JSON.parse(raw) as { path?: unknown; ts?: unknown };
    if (typeof saved.ts !== "number" || Date.now() - saved.ts > CHECKOUT_INTENT_TTL_MS) return null;
    const path = typeof saved.path === "string" ? saved.path : "";
    return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") ? path : null;
  } catch {
    return null;
  }
}

function notifySessionUpdated(signedIn = true): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(SESSION_CACHE_KEY);
    if (signedIn) window.localStorage.setItem(HINT_KEY, "1");
    else window.localStorage.removeItem(HINT_KEY);
  } catch {
    // Storage can be blocked. The hint only saves a flash; nothing depends on it.
  }

  window.dispatchEvent(
    new CustomEvent("memberframe:session-updated", { detail: { signedIn } })
  );
}

/**
 * Was a signed-in member just turned away from this page by the shield?
 * Sending them there again would bounce them straight back here, forever.
 */
function recentlyDenied(path: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(DENIED_KEY);
    if (!raw) return false;
    const denied = JSON.parse(raw) as { path?: unknown; ts?: unknown };
    return denied.path === path && typeof denied.ts === "number" && Date.now() - denied.ts < 60_000;
  } catch {
    return false;
  }
}

/**
 * Headers for every call this component makes.
 *
 * One place, so a route added later cannot forget the site key and fail with a
 * 400 that reads like a server problem. The key is omitted entirely when it is
 * empty rather than sent blank: the server distinguishes "no key" from "unknown
 * key", and a blank one would land in the wrong branch.
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

/**
 * Send the visitor on, once they are signed in.
 *
 * Guarded four ways, and each guard is load bearing:
 *
 *   1. An empty path means the creator wants the visitor to stay put, which is
 *      right for a sign-in form in a modal over the page they were reading.
 *   2. A path that is not site-relative is refused here as well as on the
 *      server. `//evil.com` begins with a slash and is NOT a path: a browser
 *      reads it as protocol-relative and leaves the site. This is the last
 *      place that value is checked before it reaches the address bar.
 *   3. A backslash is refused because some browsers normalise it to a slash,
 *      which turns `/\\evil.com` back into case 2.
 *   4. Navigating to the page you are already on would reload it and discard
 *      the state that was just established.
 */
/**
 * The site's After sign in page as the server last said it. Every sign in
 * answer carries it, so a change in Settings, Membership takes effect at once;
 * the path this file was written with is only the fallback. It was the only
 * source once, and a component written before the setting changed kept
 * sending members to the old page.
 */
let siteAfterLoginPath: string | null = null;

function noteAfterLoginPath(data: Record<string, unknown>): void {
  if (typeof data["afterLoginPath"] === "string") siteAfterLoginPath = data["afterLoginPath"];
}

function afterLoginTarget(): string {
  return (siteAfterLoginPath ?? CONFIG.afterLoginPath) || "/dashboard";
}

/**
 * A member already signed in, on a page meant for signing in: straight to the
 * site's After sign in page. Not to a remembered return page or plan: those
 * belong to a sign in that just happened, and a stale one sent members to
 * whatever page they last pressed Sign in on.
 */
function leaveForAfterLogin(): void {
  const path = afterLoginTarget();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return;
  if (typeof window === "undefined" || window.location.pathname === path) return;
  window.location.assign(path);
}

function redirectAfterAuth(): void {
  // A visitor who chose a plan before signing in goes back to finish buying
  // it; one who pressed a content component's sign in goes back to that page.
  const path = checkoutIntentPath() ?? returnPath() ?? afterLoginTarget();

  if (path === "" || !path.startsWith("/")) return;
  if (path.startsWith("//") || path.includes("\\")) return;
  if (typeof window === "undefined") return;
  if (`${window.location.pathname}${window.location.search}` === path || window.location.pathname === path) return;

  window.location.assign(path);
}

/**
 * Can a dedicated screen link to this page?
 *
 * The same four rules as `redirectAfterAuth`, for the same reason: the value
 * comes from a property control and ends up in the address bar. On the
 * published site a link to the page the visitor is already on is hidden too,
 * which is the common case of a creator who kept sign in and sign up on one
 * path: "Create an account" would only reload the sign in form.
 */
function linkablePath(path: string, onCanvas: boolean): boolean {
  if (path === "" || !path.startsWith("/")) return false;
  if (path.startsWith("//") || path.includes("\\")) return false;
  if (onCanvas || typeof window === "undefined") return true;
  return window.location.pathname !== path;
}

function goTo(path: string): void {
  if (!linkablePath(path, false)) return;
  window.location.assign(path);
}

/** The query parameter the emailed reset link carries. FP-02 section 2.3. */
const RESET_TOKEN_PARAM = "token";

/** F05: a six-digit code. */
const CODE_LENGTH = 6;

/** F05: "The resend button is disabled for 60 seconds with a visible countdown." */
const RESEND_LOCK_SECONDS = 60;

/** The message type the OAuth popup posts back. */
const OAUTH_MESSAGE_TYPE = "memberframe-auth-result";

/*
  The social sign-in tab flow.

  Sign in opens in a new tab. The provider's pages cut that tab's link back
  to this window (Google sets Cross-Origin-Opener-Policy), and a cookie set
  while the tab is on the API's own address lands in a different cookie
  partition from the one this site's requests read. So neither postMessage
  nor the API's cookie can finish the job.

  Instead the API sends the tab back to this same page with a one-time code
  in the fragment. MemberAuth on that page exchanges the code from the site's
  own context, where the session cookie lands in the right partition. Then it
  tells the original tab over a BroadcastChannel (same site, so the two tabs
  can talk), and closes itself once the original tab answers. The original
  tab goes to the configured After sign in page. If nobody answers, this tab
  goes there itself.
*/
const OAUTH_CHANNEL = "memberframe-oauth";
const OAUTH_EXCHANGE_PATH = "/api/member/oauth/exchange";
const HANDOFF_PARAM = "mf_oauth";
const HANDOFF_ERROR_PARAM = "mf_oauth_error";

type OAuthHandoff = { code: string } | { error: string };

/** The code or error the API put in this page's fragment, if any. */
function readOAuthHandoff(): OAuthHandoff | null {
  if (typeof window === "undefined") return null;

  const hash = window.location.hash.replace(/^#/, "");
  if (hash === "") return null;

  const params = new URLSearchParams(hash);
  const code = params.get(HANDOFF_PARAM);
  if (code) return { code };

  const error = params.get(HANDOFF_ERROR_PARAM);
  if (error !== null) return { error: error || "cancelled" };

  return null;
}

/** Plain words for the reasons the API can send back. */
function oauthFailureMessage(reason: string): string {
  if (reason.includes("not_configured")) {
    return "This sign in option is not set up yet. Use your email instead.";
  }
  if (reason === "access_denied" || reason === "cancelled") {
    return "Sign in was cancelled.";
  }
  // 31-sign-in-methods.md: an address the provider has not verified.
  if (reason === "email_unverified_link") return "This email already has an account. Sign in the way you first did.";
  if (reason.includes("email_unverified")) return "Verify your email with that provider first, then try again.";
  return "That sign in did not complete. Try again.";
}

/**
 * Tell the tab that started the sign in how it went.
 *
 * When it answers, this tab closes, which returns the visitor to it. When
 * nobody answers within a moment (the tab was closed, or the browser has no
 * BroadcastChannel), `fallback` runs here instead. `fallback` also runs if
 * the browser refuses to close this tab.
 */
function announceOAuthResult(ok: boolean, message: string, fallback: () => void): void {
  if (typeof BroadcastChannel === "undefined") {
    fallback();
    return;
  }

  const id = Math.random().toString(36).slice(2);
  const channel = new BroadcastChannel(OAUTH_CHANNEL);
  let answered = false;

  channel.onmessage = (event: MessageEvent) => {
    const data = event.data as { type?: unknown; id?: unknown } | null;
    if (!data || data.type !== "ack" || data.id !== id) return;

    answered = true;
    channel.close();
    window.close();
    window.setTimeout(fallback, 400);
  };

  channel.postMessage({ type: "result", ok, message, id });

  window.setTimeout(() => {
    if (answered) return;
    channel.close();
    fallback();
  }, 700);
}

/**
 * Why a code was refused.
 *
 * F05 requires an expired code to produce "a distinct message from a wrong
 * code", which a bare 401 cannot express, so the server returns a reason and
 * this maps it to copy.
 */
type VerifyFailure = "invalid_code" | "expired_code" | "too_many_attempts" | "unknown";

/**
 * The state machine.
 *
 * A union rather than four booleans, because the illegal combinations are the
 * dangerous ones: "sending" and "signed in" at once, or "code sent" with no
 * email, each render something incoherent to a visitor mid sign-in.
 */
type AuthState =
  | { phase: "idle" }
  | { phase: "sending" }
  | { phase: "code_sent"; email: string; resendAtMs: number; purpose?: CodePurpose }
  | { phase: "verifying"; email: string; resendAtMs: number; purpose?: CodePurpose }
  | { phase: "reset_requested"; email: string }
  | { phase: "signed_in" }
  | { phase: "error"; message: string; retryable: boolean };

/**
 * Where the visitor is, which is a different question from what the component
 * is doing.
 *
 * FP-02 adds four destinations to what was one flow. Folding them into
 * `AuthState` would multiply five views by six phases, and most of those cells
 * are identical: "sending" looks the same in sign-up as in forgot-password.
 * One axis for place, one for activity. See `05-member-auth.md` section 9.2.
 */
type AuthView = "otp" | "password_signin" | "password_signup" | "forgot" | "reset";

/**
 * What an emailed code is for. `signin` is the code sign in flow and ends in
 * a session; `verify` confirms a new account's address and ends on the sign
 * in form, with no session.
 */
type CodePurpose = "signin" | "verify";

/** Why a password submit was refused by the server. FP-02 section 3.3. */
type PasswordFailure =
  | "invalid_credentials"
  | "account_locked"
  | "email_already_exists"
  | "weak_password"
  | "token_expired"
  | "invalid_token"
  | "registration_closed"
  | "unknown";

// ============================================================================
// PURE HELPERS
// ============================================================================

/**
 * Good enough to catch a typo, not an attempt at RFC 5322.
 *
 * The server is the authority on whether an address can receive mail. A strict
 * client-side pattern rejects valid addresses, and the only cost of being
 * permissive here is one wasted request.
 */
function looksLikeEmail(value: string): boolean {
  const email = value.trim();
  if (email.length < 3 || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "").slice(0, CODE_LENGTH);
}

// ----------------------------------------------------------------------------
// PASSWORD POLICY, DUPLICATED FROM src/utils/credentials.ts
// ----------------------------------------------------------------------------
// This block is a verbatim copy, and it has to be. This file is compiled by
// Framer alone on a creator's published site, so it cannot import from this
// repository. `test/credentialsParity.test.ts` extracts both copies and fails
// when they diverge, the same arrangement `isEntitled` already has.
//
// Changing a rule here without changing it there breaks the build, which is the
// point. Changing it in both without telling the backend produces a form that
// accepts what the server refuses.

/** FP-02 section 2.1: "min 8-character validation". */
const PASSWORD_MIN_LENGTH = 8;

/**
 * An upper bound, which is about denial of service rather than strength.
 * Argon2id will hash a megabyte if asked. Conflict C15: bcrypt would silently
 * truncate at 72 bytes, so two different long passwords would unlock one
 * account.
 */
const PASSWORD_MAX_LENGTH = 128;

/** The longest minimum a site may ask for. */
const PASSWORD_POLICY_MAX_MIN = 64;

/** The rules a creator sets in Settings, Membership. Sign in never checks them. */
interface PasswordPolicy {
  minLength: number;
  requireNumber: boolean;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireSymbol: boolean;
}

/** Below three characters the email check fires on ordinary words. */
const EMAIL_FRAGMENT_MIN_LENGTH = 3;

/** Not a breach corpus. Those live on the server and weigh gigabytes. */
const COMMON_PASSWORDS: ReadonlyArray<string> = [
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "1234567890",
  "qwertyuiop",
  "qwerty123",
  "iloveyou",
  "sunshine",
  "princess",
  "football",
  "baseball",
  "welcome1",
  "admin123",
  "letmein1",
  "monkey12",
  "abc12345",
  "trustno1",
  "superman",
];

type PasswordProblem =
  | "too_short"
  | "too_long"
  | "needs_letter"
  | "needs_number"
  | "needs_uppercase"
  | "needs_lowercase"
  | "needs_symbol"
  | "contains_email"
  | "too_common";

type PasswordScore = 0 | 1 | 2 | 3 | 4;

function passwordProblems(
  password: string,
  email: string,
  policy: PasswordPolicy
): ReadonlyArray<PasswordProblem> {
  const problems: PasswordProblem[] = [];
  const value = String(password ?? "");
  const rules = readPasswordPolicy(policy);

  if (value.length < rules.minLength) problems.push("too_short");
  if (value.length > PASSWORD_MAX_LENGTH) problems.push("too_long");

  const lowered = value.toLowerCase();

  if (COMMON_PASSWORDS.includes(lowered)) problems.push("too_common");

  const localPart =
    String(email ?? "")
      .trim()
      .toLowerCase()
      .split("@")[0] ?? "";

  if (
    localPart.length >= EMAIL_FRAGMENT_MIN_LENGTH &&
    lowered.includes(localPart)
  ) {
    problems.push("contains_email");
  }

  // Always a letter; the rest as the site's rules say (05-member-auth.md 13).
  if (!/[a-zA-Z]/.test(value)) problems.push("needs_letter");
  if (rules.requireNumber && !/[0-9]/.test(value)) problems.push("needs_number");
  if (rules.requireUppercase && !/[A-Z]/.test(value)) problems.push("needs_uppercase");
  if (rules.requireLowercase && !/[a-z]/.test(value)) problems.push("needs_lowercase");
  if (rules.requireSymbol && !/[^a-zA-Z0-9]/.test(value)) problems.push("needs_symbol");

  return problems;
}

/**
 * The site's rules, read defensively: a length from 8 to 64, and a number
 * required unless the rules say otherwise, which is the rule before rules
 * could be set. Anything missing or malformed falls back to that.
 */
function readPasswordPolicy(value: unknown): PasswordPolicy {
  const raw = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof PasswordPolicy, unknown>>;
  const length = Math.round(Number(raw.minLength));
  return {
    minLength: Number.isFinite(length) ? Math.min(PASSWORD_POLICY_MAX_MIN, Math.max(PASSWORD_MIN_LENGTH, length)) : PASSWORD_MIN_LENGTH,
    requireNumber: raw.requireNumber !== false,
    requireUppercase: raw.requireUppercase === true,
    requireLowercase: raw.requireLowercase === true,
    requireSymbol: raw.requireSymbol === true,
  };
}

function passwordScore(password: string): PasswordScore {
  const value = String(password ?? "");
  if (value.length === 0) return 0;

  let score = 0;

  if (value.length >= PASSWORD_MIN_LENGTH) score += 1;
  if (value.length >= 12) score += 1;
  if (value.length >= 16) score += 1;

  const variety =
    (/[a-z]/.test(value) ? 1 : 0) +
    (/[A-Z]/.test(value) ? 1 : 0) +
    (/[0-9]/.test(value) ? 1 : 0) +
    (/[^a-zA-Z0-9]/.test(value) ? 1 : 0);

  if (variety >= 3) score += 1;

  if (COMMON_PASSWORDS.includes(value.toLowerCase())) return 0;

  return Math.min(4, score) as PasswordScore;
}

// ----------------------------------------------------------------------------
// COPY FOR THE RULES ABOVE
// ----------------------------------------------------------------------------
// Outside the parity test on purpose: this is wording, and wording drifting
// between the two copies is cosmetic where a rule drifting is a bug.

function passwordProblemMessage(problem: PasswordProblem, rules: PasswordPolicy): string {
  switch (problem) {
    case "too_short":
      return `Use at least ${rules.minLength} characters.`;
    case "too_long":
      return `Keep it under ${PASSWORD_MAX_LENGTH} characters.`;
    case "needs_letter":
      return "Add at least one letter.";
    case "needs_number":
      return "Add at least one number.";
    case "needs_uppercase":
      return "Add an uppercase letter.";
    case "needs_lowercase":
      return "Add a lowercase letter.";
    case "needs_symbol":
      return "Add a symbol, such as ! or #.";
    case "contains_email":
      return "Do not use your email address in your password.";
    case "too_common":
      return "That password is too easy to guess. Pick another.";
  }
}

/** The site's rules in one line, as a member meets them on sign up and reset. */
function passwordRulesLine(rules: PasswordPolicy): string {
  const extras = [
    rules.requireNumber ? "a number" : "",
    rules.requireUppercase ? "an uppercase letter" : "",
    rules.requireLowercase ? "a lowercase letter" : "",
    rules.requireSymbol ? "a symbol" : "",
  ].filter(Boolean);
  const list = extras.length > 1 ? `${extras.slice(0, -1).join(", ")} and ${extras[extras.length - 1]}` : extras[0] || "";
  return `At least ${rules.minLength} characters, with a letter${list ? `, ${list}` : ""}.`;
}

function passwordScoreLabel(score: PasswordScore): string {
  switch (score) {
    case 0:
      return "Too weak";
    case 1:
      return "Weak";
    case 2:
      return "Fair";
    case 3:
      return "Good";
    case 4:
      return "Strong";
  }
}

/**
 * What a password failure says to the visitor.
 *
 * `invalid_credentials` is one message for a wrong password and for an address
 * that was never registered. FP-02 section 3.4 rule 3, and it is the easiest
 * line in this file to break later by being helpful.
 *
 * `account_locked` deliberately reads differently. It leaks that the address
 * exists, which is a real if small cost, and the alternative is a member who
 * keeps guessing at an account that will refuse them for fifteen minutes
 * whatever they type. Recorded as a judgement call in `05-member-auth.md`
 * section 9.4.
 */
function passwordFailureMessage(reason: PasswordFailure): string {
  switch (reason) {
    case "invalid_credentials":
      return "Invalid email or password. Please try again.";
    case "account_locked":
      return "Too many failed attempts. Try again in about 15 minutes.";
    case "email_already_exists":
      return "An account with that email already exists. Sign in instead.";
    case "weak_password":
      return "That password does not meet the requirements. Pick another.";
    case "token_expired":
      return "That reset link has expired. Request a new one.";
    case "invalid_token":
      return "That reset link is not valid. Request a new one.";
    case "registration_closed":
      return "New sign ups are closed on this site.";
    case "unknown":
      return "We could not complete that just now. Try again shortly.";
  }
}

/**
 * The reset token, read from the URL once.
 *
 * FP-02 section 2.3 puts it in a query string, which is the weakest link in the
 * flow: a URL reaches browser history, the `Referer` header of anything the page
 * loads, and any analytics script that reads `location.search`. Nothing here can
 * fix that. What it can do is read the value once, never log it, and strip it
 * after use. See `05-member-auth.md` section 9.6.
 */
function readResetToken(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const token = new URLSearchParams(window.location.search).get(RESET_TOKEN_PARAM);
    return token !== null && token.trim() !== "" ? token : null;
  } catch {
    return null;
  }
}

/**
 * Seconds left on the resend lock.
 *
 * Derived from a deadline rather than decremented. A backgrounded tab stops
 * firing timers, and a counter that decrements resumes with a stale number, so
 * the button would unlock late or early.
 */
function secondsRemaining(resendAtMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((resendAtMs - nowMs) / 1000));
}

function verifyFailureMessage(reason: VerifyFailure): string {
  switch (reason) {
    case "invalid_code":
      return "That code is not right. Check it and try again.";
    case "expired_code":
      return "That code has expired. Send a new one.";
    case "too_many_attempts":
      return "Too many tries on that code. Send a new one.";
    case "unknown":
      return "We could not verify that code. Try again shortly.";
  }
}

/** The origin a popup message must come from. One entry, which is the right size. */
function apiOrigin(baseUrl: string): string | null {
  try {
    return new URL(baseUrl).origin;
  } catch {
    return null;
  }
}

// ============================================================================
// CONSOLIDATED CSS
// ============================================================================
// Same constraint as every canvas component: `design-tokens.css` is the plugin panel's and
// does not exist on a published site, so the palette is declared on the
// component root and every rule reads it. The two creator-controlled values
// arrive as scoped custom properties, which is why there is no `style={{ }}`
// here even though two values are dynamic.

const cssContent = `
/*
  The palette comes from the shared appearance block (mfThemeCss), which
  resolves Theme plus the creator's Colors into --mf-c-*. These names are
  kept so every rule below reads as it always did.
*/
.memberframe-auth-root {
  position: relative;
  --memberframe-auth-accent: var(--mf-c-accent);
  --memberframe-auth-radius: var(--mf-c-radius);
  --memberframe-auth-surface: var(--mf-c-surface);
  --memberframe-auth-border: var(--mf-c-border);
  --memberframe-auth-title: var(--mf-c-text);
  --memberframe-auth-body: var(--mf-c-muted);
  --memberframe-auth-field: var(--mf-c-field);
  --memberframe-auth-on-accent: var(--mf-c-on-accent);
  --memberframe-auth-danger: var(--mf-c-danger);
  --memberframe-auth-shadow: var(--mf-c-shadow);

  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  height: 100%;
  min-width: 320px;
  min-height: 0;
  /*
    No padding of its own: the frame is the card. It used to pad the card with
    48 to 80px, so the frame was taller than the card and the trial mark, pinned
    to the root's corner, sat in that empty band under the card. Space around
    the card is the Spacing group's margin, which the page scaffold sets.
  */
  padding: 0;
  border-radius: calc(var(--memberframe-auth-radius) + 4px);
}

.memberframe-auth-root.is-modal {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--mf-c-backdrop);
}

/*
  Inline, the card is the component: it fills the frame in both directions and
  scrolls if the creator makes the frame shorter than the form. In a modal it
  keeps a readable width over the page.
*/
.memberframe-auth-card {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  /* A fixed frame taller than the form centres it; "safe" keeps the top
     reachable when the form is taller and the card scrolls. */
  justify-content: safe center;
  flex: 1 1 auto;
  gap: var(--mf-gap, 14px);
  width: 100%;
  min-width: 320px;
  height: auto;
  min-height: 0;
  overflow-y: auto;
  padding: var(--mf-pad, 24px);
  border: var(--mf-border-width, 1px) solid var(--memberframe-auth-border);
  border-radius: calc(var(--memberframe-auth-radius) + 4px);
  background: var(--memberframe-auth-surface);
  box-shadow: var(--memberframe-auth-shadow);
}

/*
  The trial mark sits inside the card's bottom-right corner, so the card keeps
  room for it under the last line of the form.
*/
.memberframe-auth-root.has-mf-wm:not(.is-modal) .memberframe-auth-card {
  padding-bottom: calc(var(--mf-pad, 24px) + 20px);
}

.memberframe-auth-root.is-modal {
  border-radius: 0;
}

.memberframe-auth-root.is-modal .memberframe-auth-card {
  flex: 0 1 auto;
  max-width: 400px;
  height: auto;
  max-height: 100%;
}

.memberframe-auth-root.is-modal .memberframe-auth-card {
  position: relative;
}

/* Show On Canvas: No. A chip on the canvas in place of the popup's card. */
.memberframe-auth-root.is-chip {
  min-width: 0;
  align-items: center;
  justify-content: center;
}

.memberframe-auth-chip {
  box-sizing: border-box;
  max-width: 100%;
  padding: 4px 10px;
  overflow: hidden;
  border: 1px dashed var(--memberframe-auth-border);
  border-radius: 999px;
  background: var(--memberframe-auth-surface);
  color: var(--memberframe-auth-body);
  font-size: calc(12px * var(--mf-text-scale, 1));
  line-height: 1.4;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.memberframe-auth-close {
  position: absolute;
  top: 10px;
  right: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--mf-c-muted);
  cursor: pointer;
}

.memberframe-auth-close:hover {
  background: var(--mf-c-field);
  color: var(--mf-c-text);
}

.memberframe-auth-close:focus-visible {
  outline: 2px solid var(--mf-c-accent);
  outline-offset: 2px;
}

.memberframe-auth-close svg {
  width: 16px;
  height: 16px;
}

.memberframe-auth-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.memberframe-auth-headline {
  margin: 0;
  font-size: calc(18px * var(--mf-text-scale, 1));
  font-weight: 600;
  line-height: 1.3;
  color: var(--memberframe-auth-title);
}

.memberframe-auth-welcome {
  margin: 0;
  font-size: calc(13px * var(--mf-text-scale, 1));
  line-height: 1.5;
  color: var(--memberframe-auth-body);
}

.memberframe-auth-providers {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.memberframe-auth-provider {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 40px;
  padding: 0 14px;
  box-sizing: border-box;
  border: 1px solid var(--memberframe-auth-border);
  border-radius: var(--memberframe-auth-radius);
  background: var(--memberframe-auth-surface);
  color: var(--memberframe-auth-title);
  font-size: calc(13px * var(--mf-text-scale, 1));
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.15s ease, transform 0.1s ease;
}

.memberframe-auth-provider:hover {
  filter: brightness(0.94);
}

.memberframe-auth-provider:active {
  transform: translateY(1px);
}

.memberframe-auth-provider:disabled {
  opacity: 0.6;
  cursor: progress;
}

.memberframe-auth-provider svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

/* Each provider's brand colours; light-dark() follows the theme's color-scheme. */
.memberframe-auth-provider.is-google { background: light-dark(#ffffff, #131314); border-color: light-dark(#747775, #8e918f); color: light-dark(#1f1f1f, #e3e3e3); }
.memberframe-auth-provider.is-apple { background: light-dark(#000000, #ffffff); border-color: light-dark(#000000, #ffffff); color: light-dark(#ffffff, #000000); }
.memberframe-auth-provider.is-github { background: #24292f; border-color: light-dark(#24292f, rgba(255, 255, 255, 0.2)); color: #ffffff; }
.memberframe-auth-provider.is-discord { background: #5865f2; border-color: #5865f2; color: #ffffff; }

.memberframe-auth-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: calc(11px * var(--mf-text-scale, 1));
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--memberframe-auth-body);
}

.memberframe-auth-divider::before,
.memberframe-auth-divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--memberframe-auth-border);
}

.memberframe-auth-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.memberframe-auth-label {
  font-size: calc(12px * var(--mf-text-scale, 1));
  font-weight: 600;
  color: var(--memberframe-auth-title);
}

.memberframe-auth-input {
  box-sizing: border-box;
  width: 100%;
  min-height: 40px;
  padding: 0 12px;
  border: 1px solid var(--memberframe-auth-border);
  border-radius: var(--memberframe-auth-radius);
  background: var(--memberframe-auth-field);
  color: var(--memberframe-auth-title);
  font-family: inherit;
  font-size: calc(14px * var(--mf-text-scale, 1));
}

.memberframe-auth-input:focus-visible {
  outline: none;
  border-color: var(--memberframe-auth-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--memberframe-auth-accent) 25%, transparent);
}

.memberframe-auth-input.is-code {
  font-family: var(--framer-font-family-mono, ui-monospace, monospace);
  font-size: calc(20px * var(--mf-text-scale, 1));
  letter-spacing: 0.4em;
  text-align: center;
}

.memberframe-auth-input.is-invalid {
  border-color: var(--memberframe-auth-danger);
}

/* ---- FP-02: password field, meter, tabs, and the row of small links ---- */

/*
  The toggle sits inside the field's box rather than beside it, so the input
  keeps the full width the other fields have and the two forms do not shift
  when one gains a password row.
*/
.memberframe-auth-secret {
  position: relative;
  display: flex;
  align-items: center;
}

.memberframe-auth-secret .memberframe-auth-input {
  padding-right: 44px;
}

.memberframe-auth-peek {
  position: absolute;
  right: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--memberframe-auth-body);
  cursor: pointer;
}

.memberframe-auth-peek:hover {
  color: var(--memberframe-auth-title);
}

.memberframe-auth-peek:focus-visible {
  outline: 2px solid var(--memberframe-auth-accent);
  outline-offset: 1px;
}

.memberframe-auth-peek svg {
  width: 16px;
  height: 16px;
}

.memberframe-auth-meter {
  display: flex;
  align-items: center;
  gap: 6px;
}

.memberframe-auth-meter-track {
  display: flex;
  flex: 1;
  gap: 3px;
}

.memberframe-auth-meter-seg {
  height: 4px;
  flex: 1;
  border-radius: 2px;
  background: var(--memberframe-auth-border);
}

/*
  Four fixed segments with one filled class, rather than a width animation on a
  single bar. A width carries a precision this score does not have: it is a
  length-and-variety heuristic, not an entropy estimate.
*/
.memberframe-auth-meter-seg.is-on {
  background: var(--memberframe-auth-accent);
}

.memberframe-auth-meter-seg.is-weak {
  background: var(--memberframe-auth-danger);
}

.memberframe-auth-meter-label {
  min-width: 56px;
  font-size: calc(11px * var(--mf-text-scale, 1));
  font-weight: 600;
  text-align: right;
  color: var(--memberframe-auth-body);
}

.memberframe-auth-hints {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.memberframe-auth-hints li {
  font-size: calc(11px * var(--mf-text-scale, 1));
  line-height: 1.45;
  color: var(--memberframe-auth-danger);
}

/* The site's password rules, before the first submit (05-member-auth.md 13). */
.memberframe-auth-rules {
  margin: 0;
  font-size: calc(11px * var(--mf-text-scale, 1));
  line-height: 1.45;
  color: var(--memberframe-auth-body);
}

.memberframe-auth-tabs {
  display: flex;
  gap: 4px;
  padding: 3px;
  border-radius: var(--memberframe-auth-radius);
  background: var(--memberframe-auth-field);
}

.memberframe-auth-tab {
  flex: 1;
  min-height: 30px;
  padding: 0 10px;
  border: none;
  border-radius: calc(var(--memberframe-auth-radius) - 2px);
  background: none;
  color: var(--memberframe-auth-body);
  font-family: inherit;
  font-size: calc(13px * var(--mf-text-scale, 1));
  font-weight: 600;
  cursor: pointer;
}

.memberframe-auth-tab.is-active {
  background: var(--memberframe-auth-surface);
  color: var(--memberframe-auth-title);
}

.memberframe-auth-tab:focus-visible {
  outline: 2px solid var(--memberframe-auth-accent);
  outline-offset: 1px;
}

.memberframe-auth-remember {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: calc(12px * var(--mf-text-scale, 1));
  color: var(--memberframe-auth-body);
  cursor: pointer;
}

.memberframe-auth-remember input {
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: var(--memberframe-auth-accent);
}

.memberframe-auth-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px 10px;
}

.memberframe-auth-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 2px;
  border: none;
  background: none;
  color: var(--memberframe-auth-accent);
  font-family: inherit;
  font-size: calc(12px * var(--mf-text-scale, 1));
  font-weight: 600;
  text-align: center;
  cursor: pointer;
}

.memberframe-auth-link svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.memberframe-auth-link:focus-visible {
  outline: 2px solid var(--memberframe-auth-accent);
  outline-offset: 1px;
}

.memberframe-auth-submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 42px;
  padding: 0 16px;
  box-sizing: border-box;
  border: none;
  border-radius: var(--memberframe-auth-radius);
  background: var(--memberframe-auth-accent);
  color: var(--memberframe-auth-on-accent);
  font-size: calc(14px * var(--mf-text-scale, 1));
  font-weight: 600;
  cursor: pointer;
}

.memberframe-auth-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.memberframe-auth-submit svg {
  width: 16px;
  height: 16px;
}

.memberframe-auth-spin {
  animation: memberframe-auth-spin 0.9s linear infinite;
}

@keyframes memberframe-auth-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .memberframe-auth-spin {
    animation: none;
  }
}

.memberframe-auth-resend {
  align-self: center;
  padding: 4px 8px;
  border: none;
  background: none;
  color: var(--memberframe-auth-accent);
  font-family: inherit;
  font-size: calc(12px * var(--mf-text-scale, 1));
  font-weight: 600;
  cursor: pointer;
}

.memberframe-auth-resend:disabled {
  color: var(--memberframe-auth-body);
  cursor: default;
}

.memberframe-auth-error {
  margin: 0;
  font-size: calc(12px * var(--mf-text-scale, 1));
  line-height: 1.45;
  color: var(--memberframe-auth-danger);
}

.memberframe-auth-success {
  margin: 0;
  padding: 10px 12px;
  border-radius: max(0px, calc(var(--mf-c-radius) - 4px));
  background: color-mix(in srgb, var(--memberframe-auth-accent) 12%, transparent);
  color: var(--mf-c-text);
  font-size: calc(13px * var(--mf-text-scale, 1));
  line-height: 1.45;
}

.memberframe-auth-done {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  text-align: center;
}

.memberframe-auth-done svg {
  width: 28px;
  height: 28px;
  color: var(--memberframe-auth-accent);
}

.memberframe-auth-note {
  margin: 0;
  font-size: calc(11px * var(--mf-text-scale, 1));
  line-height: 1.45;
  text-align: center;
  color: var(--memberframe-auth-body);
}

`;

// ============================================================================
// PROVIDER MARKS
// ============================================================================
// The glyphs of the logo files in `public/` (`<name>-icon.svg`). Google's G
// keeps its full colour; the rest use `fill="currentColor"`, the button's text
// colour, so each stays legible on its own brand fill. Lucide has no brand marks,
// so these are filled SVG paths, never an emoji or a raster.
//
// Each provider publishes brand guidelines governing how its mark may appear on
// a sign-in button. That review is a human task, recorded in
// `docs/development-docs/05-member-auth.md` section 7.

const PROVIDER_MARKS: Record<OAuthProvider, React.ReactNode> = {
  google: (
    <svg viewBox="0 0 40 41" aria-hidden="true" focusable="false" data-brand="google">
      <mask id="memberframe-google-mask0" maskUnits="userSpaceOnUse" x="0" y="0" width="40" height="41">
      <path d="M39.146 16.4248H20.1838V24.1781H31.0796C30.9044 25.2753 30.5111 26.3547 29.9352 27.339C29.2753 28.4667 28.4595 29.3252 27.6234 29.979C25.1187 31.9375 22.1985 32.3379 20.1706 32.3379C15.0476 32.3379 10.6703 28.9593 8.97579 24.3684C8.90741 24.2018 8.862 24.0297 8.8067 23.8596C8.43225 22.6911 8.22765 21.4536 8.22765 20.1674C8.22765 18.8288 8.44921 17.5474 8.85317 16.3373C10.4466 11.5643 14.9225 7.99933 20.1742 7.99933C21.2306 7.99933 22.2478 8.12763 23.2124 8.38354C25.417 8.96838 26.9764 10.1202 27.932 11.0313L33.6976 5.26967C30.1904 1.98832 25.6184 4.96116e-09 20.1647 4.96116e-09C15.8047 -9.57542e-05 11.7794 1.38605 8.48088 3.72869C5.80583 5.62851 3.61192 8.17212 2.13129 11.1262C0.7541 13.8653 0 16.9007 0 20.1644C0 23.4282 0.755253 26.4951 2.13245 29.2089V29.2272C3.58711 32.1082 5.71432 34.5888 8.29972 36.4799C10.5583 38.1319 14.6083 40.3322 20.1647 40.3322C23.36 40.3322 26.1919 39.7444 28.6894 38.6427C30.4911 37.848 32.0874 36.8114 33.5327 35.4792C35.4423 33.719 36.9379 31.5417 37.9587 29.0367C38.9795 26.5316 39.5256 23.6989 39.5256 20.6277C39.5256 19.1974 39.3848 17.7449 39.146 16.4247V16.4248Z" fill="white" />
      </mask>
      <g mask="url(#memberframe-google-mask0)">
      <g filter="url(#memberframe-google-filter0_f)">
      <path d="M-0.290771 20.3013C-0.269812 23.5136 0.62721 26.8278 1.985 29.5033V29.5218C2.96607 31.4648 4.30691 32.9996 5.83411 34.5204L15.058 31.0861C13.3129 30.1815 13.0466 29.6273 11.7956 28.6159C10.5173 27.3005 9.5645 25.7905 8.97115 24.0199H8.94724L8.97115 24.0015C8.58079 22.8322 8.54229 21.5911 8.52789 20.3013H-0.290771Z" fill="url(#memberframe-google-paint0_radial)" />
      </g>
      <g filter="url(#memberframe-google-filter1_f)">
      <path d="M20.1839 -0.146729C19.2722 3.12152 19.6208 6.29835 20.1839 8.14678C21.2366 8.14758 22.2508 8.27563 23.2125 8.53075C25.417 9.11559 26.9763 10.2675 27.9318 11.1786L33.8451 5.26971C30.3421 1.99228 26.1264 -0.141565 20.1839 -0.146729Z" fill="url(#memberframe-google-paint1_radial)" />
      </g>
      <g filter="url(#memberframe-google-filter2_f)">
      <path d="M20.1641 -0.172607C15.6923 -0.172706 11.5637 1.24903 8.18043 3.65181C6.92422 4.54397 5.77143 5.57455 4.74494 6.72059C4.47603 9.2949 6.75798 12.459 11.277 12.4328C13.4695 9.83028 16.7123 8.14646 20.3215 8.14646C20.3248 8.14646 20.328 8.14673 20.3313 8.14675L20.1839 -0.172019C20.1772 -0.172023 20.1708 -0.172607 20.1641 -0.172607Z" fill="url(#memberframe-google-paint2_radial)" />
      </g>
      <g filter="url(#memberframe-google-filter3_f)">
      <path d="M34.9237 21.2328L30.9323 24.0308C30.7571 25.1281 30.3636 26.2075 29.7876 27.1917C29.1277 28.3194 28.312 29.178 27.4759 29.8318C24.9763 31.7862 22.064 32.1886 20.0365 32.1903C17.9409 35.8323 17.5735 37.6565 20.1839 40.5959C23.4139 40.5935 26.2775 39.9985 28.8034 38.8844C30.6293 38.079 32.2469 37.0285 33.7115 35.6784C35.6468 33.8945 37.1627 31.6879 38.1972 29.1493C39.2317 26.6107 39.7849 23.7401 39.7849 20.6277L34.9237 21.2328Z" fill="url(#memberframe-google-paint3_radial)" />
      </g>
      <g filter="url(#memberframe-google-filter4_f)">
      <path d="M19.8892 16.1301V24.4725H39.0929C39.2618 23.33 39.8204 21.8515 39.8204 20.6276C39.8204 19.1973 39.6797 17.4503 39.441 16.1301H19.8892Z" fill="#3086FF" />
      </g>
      <g filter="url(#memberframe-google-filter5_f)">
      <path d="M4.83653 6.42603C3.65145 7.74911 2.63904 9.23003 1.83632 10.8316C0.459145 13.5707 -0.294922 16.9006 -0.294922 20.1643C-0.294922 20.2103 -0.291192 20.2553 -0.290891 20.3012C0.319016 21.4945 8.13387 21.266 8.52777 20.3012C8.52727 20.2562 8.5223 20.2123 8.5223 20.1672C8.5223 18.8286 8.74393 17.8419 9.14789 16.6317C9.64624 15.139 10.4265 13.7644 11.4243 12.58C11.6505 12.2853 12.2538 11.6519 12.4298 11.2719C12.4969 11.1272 12.3081 11.046 12.2976 10.995C12.2858 10.938 12.0326 10.9839 11.9759 10.9414C11.7959 10.8067 11.4394 10.7363 11.2229 10.6737C10.7601 10.54 9.99326 10.2452 9.56731 9.93957C8.22089 8.97348 6.11969 7.8195 4.83653 6.42603Z" fill="url(#memberframe-google-paint4_radial)" />
      </g>
      <g filter="url(#memberframe-google-filter6_f)">
      <path d="M9.5963 11.0007C12.7185 12.9305 13.6164 10.0266 15.6922 9.11782L12.0812 1.47681C10.7529 2.04649 9.49794 2.75427 8.3335 3.58125C6.59451 4.81628 5.05884 6.32337 3.79028 8.03846L9.5963 11.0007Z" fill="url(#memberframe-google-paint5_radial)" />
      </g>
      <g filter="url(#memberframe-google-filter7_f)">
      <path d="M10.8669 30.4958C6.67573 32.0398 6.01958 32.0951 5.63379 34.7455C6.37102 35.4796 7.16313 36.1587 8.00486 36.7744C10.2635 38.4265 14.6081 40.6268 20.1645 40.6268C20.171 40.6268 20.1772 40.6262 20.1838 40.6262V32.0431C20.1796 32.0431 20.1747 32.0433 20.1705 32.0433C18.0899 32.0433 16.4272 31.4857 14.7225 30.5159C14.3021 30.2769 13.5396 30.9189 13.1519 30.6319C12.6173 30.236 11.3306 30.9729 10.8669 30.4958Z" fill="url(#memberframe-google-paint6_radial)" />
      </g>
      <g opacity="0.5" filter="url(#memberframe-google-filter8_f)">
      <path d="M17.7292 31.7727V40.4775C18.5067 40.5704 19.3158 40.6268 20.1645 40.6268C21.0154 40.6268 21.8385 40.5822 22.6383 40.5002V31.8314C21.742 31.9877 20.8978 32.0434 20.1706 32.0434C19.333 32.0434 18.5185 31.9439 17.7292 31.7727Z" fill="url(#memberframe-google-paint7_linear)" />
      </g>
      </g>
      <defs>
      <filter id="memberframe-google-filter0_f" x="-0.760851" y="19.8312" width="16.2888" height="15.1592" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
      <feFlood floodOpacity="0" result="BackgroundImageFix" />
      <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
      <feGaussianBlur stdDeviation="0.23504" result="effect1_foregroundBlur" />
      </filter>
      <filter id="memberframe-google-filter1_f" x="19.1532" y="-0.616808" width="15.1621" height="12.2654" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
      <feFlood floodOpacity="0" result="BackgroundImageFix" />
      <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
      <feGaussianBlur stdDeviation="0.23504" result="effect1_foregroundBlur" />
      </filter>
      <filter id="memberframe-google-filter2_f" x="4.25355" y="-0.642687" width="16.5478" height="13.5456" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
      <feFlood floodOpacity="0" result="BackgroundImageFix" />
      <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
      <feGaussianBlur stdDeviation="0.23504" result="effect1_foregroundBlur" />
      </filter>
      <filter id="memberframe-google-filter3_f" x="17.8744" y="20.1576" width="22.3806" height="20.9084" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
      <feFlood floodOpacity="0" result="BackgroundImageFix" />
      <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
      <feGaussianBlur stdDeviation="0.23504" result="effect1_foregroundBlur" />
      </filter>
      <filter id="memberframe-google-filter4_f" x="19.4191" y="15.66" width="20.8713" height="9.28244" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
      <feFlood floodOpacity="0" result="BackgroundImageFix" />
      <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
      <feGaussianBlur stdDeviation="0.23504" result="effect1_foregroundBlur" />
      </filter>
      <filter id="memberframe-google-filter5_f" x="-0.765001" y="5.95595" width="13.6794" height="15.6269" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
      <feFlood floodOpacity="0" result="BackgroundImageFix" />
      <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
      <feGaussianBlur stdDeviation="0.23504" result="effect1_foregroundBlur" />
      </filter>
      <filter id="memberframe-google-filter6_f" x="0.485433" y="-1.82804" width="18.5116" height="16.7823" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
      <feFlood floodOpacity="0" result="BackgroundImageFix" />
      <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
      <feGaussianBlur stdDeviation="1.65243" result="effect1_foregroundBlur" />
      </filter>
      <filter id="memberframe-google-filter7_f" x="5.16371" y="29.9913" width="15.4902" height="11.1054" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
      <feFlood floodOpacity="0" result="BackgroundImageFix" />
      <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
      <feGaussianBlur stdDeviation="0.23504" result="effect1_foregroundBlur" />
      </filter>
      <filter id="memberframe-google-filter8_f" x="17.2592" y="31.3026" width="5.84934" height="9.79416" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
      <feFlood floodOpacity="0" result="BackgroundImageFix" />
      <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
      <feGaussianBlur stdDeviation="0.23504" result="effect1_foregroundBlur" />
      </filter>
      <radialGradient id="memberframe-google-paint0_radial" cx="0" cy="0" r="1" gradientTransform="matrix(-0.821344 -20.0853 29.5307 -1.2053 14.8733 34.2177)" gradientUnits="userSpaceOnUse">
      <stop offset="0.141612" stopColor="#1ABD4D" />
      <stop offset="0.247515" stopColor="#6EC30D" />
      <stop offset="0.311547" stopColor="#8AC502" />
      <stop offset="0.366013" stopColor="#A2C600" />
      <stop offset="0.445673" stopColor="#C8C903" />
      <stop offset="0.540305" stopColor="#EBCB03" />
      <stop offset="0.615636" stopColor="#F7CD07" />
      <stop offset="0.699345" stopColor="#FDCD04" />
      <stop offset="0.771242" stopColor="#FDCE05" />
      <stop offset="0.860566" stopColor="#FFCE0A" />
      </radialGradient>
      <radialGradient id="memberframe-google-paint1_radial" cx="0" cy="0" r="1" gradientTransform="matrix(13.9487 -3.42079e-05 -1.96054e-05 17.997 33.2919 10.751)" gradientUnits="userSpaceOnUse">
      <stop offset="0.408458" stopColor="#FB4E5A" />
      <stop offset="1" stopColor="#FF4540" />
      </radialGradient>
      <radialGradient id="memberframe-google-paint2_radial" cx="0" cy="0" r="1" gradientTransform="matrix(-19.5431 10.8139 14.6883 26.4949 25.6745 -2.77774)" gradientUnits="userSpaceOnUse">
      <stop offset="0.231273" stopColor="#FF4541" />
      <stop offset="0.311547" stopColor="#FF4540" />
      <stop offset="0.457516" stopColor="#FF4640" />
      <stop offset="0.540305" stopColor="#FF473F" />
      <stop offset="0.699346" stopColor="#FF5138" />
      <stop offset="0.771242" stopColor="#FF5B33" />
      <stop offset="0.860566" stopColor="#FF6C29" />
      <stop offset="1" stopColor="#FF8C18" />
      </radialGradient>
      <radialGradient id="memberframe-google-paint3_radial" cx="0" cy="0" r="1" gradientTransform="matrix(-35.442 -46.222 -17.0778 13.0702 20.4744 37.9855)" gradientUnits="userSpaceOnUse">
      <stop offset="0.131546" stopColor="#0CBA65" />
      <stop offset="0.209784" stopColor="#0BB86D" />
      <stop offset="0.297297" stopColor="#09B479" />
      <stop offset="0.396257" stopColor="#08AD93" />
      <stop offset="0.477124" stopColor="#0AA6A9" />
      <stop offset="0.568425" stopColor="#0D9CC6" />
      <stop offset="0.667385" stopColor="#1893DD" />
      <stop offset="0.768727" stopColor="#258BF1" />
      <stop offset="0.858506" stopColor="#3086FF" />
      </radialGradient>
      <radialGradient id="memberframe-google-paint4_radial" cx="0" cy="0" r="1" gradientTransform="matrix(-2.50815 21.5982 29.8914 3.46468 18.4519 3.6366)" gradientUnits="userSpaceOnUse">
      <stop offset="0.366013" stopColor="#FF4E3A" />
      <stop offset="0.457516" stopColor="#FF8A1B" />
      <stop offset="0.540305" stopColor="#FFA312" />
      <stop offset="0.615636" stopColor="#FFB60C" />
      <stop offset="0.771242" stopColor="#FFCD0A" />
      <stop offset="0.860566" stopColor="#FECF0A" />
      <stop offset="0.915033" stopColor="#FECF08" />
      <stop offset="1" stopColor="#FDCD01" />
      </radialGradient>
      <radialGradient id="memberframe-google-paint5_radial" cx="0" cy="0" r="1" gradientTransform="matrix(-7.24986 8.01061 -22.6156 -20.4293 14.9249 3.41251)" gradientUnits="userSpaceOnUse">
      <stop offset="0.315904" stopColor="#FF4C3C" />
      <stop offset="0.603818" stopColor="#FF692C" />
      <stop offset="0.726837" stopColor="#FF7825" />
      <stop offset="0.884534" stopColor="#FF8D1B" />
      <stop offset="1" stopColor="#FF9F13" />
      </radialGradient>
      <radialGradient id="memberframe-google-paint6_radial" cx="0" cy="0" r="1" gradientTransform="matrix(-19.5431 -10.8139 14.6883 -26.4949 25.6744 43.1093)" gradientUnits="userSpaceOnUse">
      <stop offset="0.231273" stopColor="#0FBC5F" />
      <stop offset="0.311547" stopColor="#0FBC5F" />
      <stop offset="0.366013" stopColor="#0FBC5E" />
      <stop offset="0.457516" stopColor="#0FBC5D" />
      <stop offset="0.540305" stopColor="#12BC58" />
      <stop offset="0.699346" stopColor="#28BF3C" />
      <stop offset="0.771242" stopColor="#38C02B" />
      <stop offset="0.860566" stopColor="#52C218" />
      <stop offset="0.915033" stopColor="#67C30F" />
      <stop offset="1" stopColor="#86C504" />
      </radialGradient>
      <linearGradient id="memberframe-google-paint7_linear" x1="17.7292" y1="36.1997" x2="22.6383" y2="36.1997" gradientUnits="userSpaceOnUse">
      <stop stopColor="#0FBC5C" />
      <stop offset="1" stopColor="#0CBA65" />
      </linearGradient>
      </defs>
    </svg>
  ),
  apple: (
    <svg viewBox="0 0 36 44" aria-hidden="true" focusable="false" data-brand="apple">
      <path
        fill="currentColor"
        d="M34.8723 15.0118C31.9229 16.8235 30.1012 19.9294 30.1012 23.3804C30.1012 27.2627 32.4434 30.8 36 32.2667C35.306 34.5098 34.2651 36.5804 32.9639 38.4784C31.0554 41.1529 29.0602 43.9137 26.1108 43.9137C23.1614 43.9137 22.294 42.1882 18.8241 42.1882C15.441 42.1882 14.2265 44 11.4506 44C8.6747 44 6.76627 41.498 4.59759 38.3922C1.73494 34.0784 0.086747 29.0745 0 23.8118C0 15.2706 5.55181 10.698 11.1036 10.698C14.053 10.698 16.4819 12.5961 18.3036 12.5961C20.0386 12.5961 22.8145 10.6118 26.1108 10.6118C29.5807 10.5255 32.8771 12.1647 34.8723 15.0118ZM24.5494 6.98824C26.0241 5.26275 26.8048 3.10588 26.8916 0.862745C26.8916 0.603922 26.8916 0.258824 26.8048 0C24.2892 0.258824 21.947 1.46667 20.2988 3.36471C18.8241 5.00392 17.9566 7.07451 17.8699 9.31765C17.8699 9.57647 17.8699 9.83529 17.9566 10.0941C18.1301 10.0941 18.3904 10.1804 18.5639 10.1804C20.906 10.0078 23.0747 8.8 24.5494 6.98824Z"
      />
    </svg>
  ),
  github: (
    <svg viewBox="0 0 40 39" aria-hidden="true" focusable="false" data-brand="github">
      <path
        fill="currentColor"
        d="M16.7135 27.9844C11.6183 27.3668 8.02862 23.6999 8.02862 18.9522C8.02862 17.0223 8.72342 14.9379 9.8814 13.5483C9.37962 12.2746 9.45682 9.57261 10.0358 8.45323C11.5797 8.26024 13.6641 9.0708 14.8993 10.1902C16.3661 9.72701 17.91 9.49542 19.8014 9.49542C21.6928 9.49542 23.2367 9.72701 24.6263 10.1516C25.8229 9.0708 27.9458 8.26024 29.4898 8.45323C30.0302 9.49542 30.1074 12.1974 29.6056 13.5097C30.8408 14.9765 31.4969 16.9451 31.4969 18.9522C31.4969 23.6999 27.9072 27.2896 22.7349 27.9458C24.0473 28.795 24.9351 30.6478 24.9351 32.7707V36.7851C24.9351 37.943 25.9001 38.5992 27.0581 38.136C34.0445 35.4727 39.5256 28.4862 39.5256 19.84C39.5256 8.91641 30.6478 9.62484e-08 19.7242 0C8.80062 -9.62484e-08 9.62489e-08 8.91641 0 19.84C-7.55023e-08 28.409 5.44247 35.5113 12.7763 38.1746C13.8185 38.5606 14.8221 37.8658 14.8221 36.8237V33.7357C14.2817 33.9673 13.5869 34.1217 12.9693 34.1217C10.4218 34.1217 8.91641 32.7322 7.83563 30.146C7.41105 29.1038 6.94787 28.4862 6.06008 28.3704C5.5969 28.3318 5.44247 28.1388 5.44247 27.9072C5.44247 27.444 6.21447 27.0966 6.98647 27.0966C8.10585 27.0966 9.0708 27.7915 10.0744 29.2196C10.8464 30.339 11.6569 30.8408 12.6219 30.8408C13.5869 30.8408 14.2045 30.4934 15.0923 29.6056C15.7485 28.9494 16.2503 28.3704 16.7135 27.9844Z"
      />
    </svg>
  ),
  discord: (
    <svg viewBox="0 0 40 31" aria-hidden="true" focusable="false" data-brand="discord">
      <path
        fill="currentColor"
        d="M33.4601 2.72663C30.9409 1.5707 28.2394 0.719062 25.4148 0.231294C25.3633 0.22188 25.312 0.245406 25.2855 0.292458C24.938 0.9104 24.5532 1.71655 24.2837 2.35019C21.2457 1.89537 18.2232 1.89537 15.2475 2.35019C14.978 1.70247 14.5792 0.9104 14.2302 0.292458C14.2037 0.246976 14.1523 0.22345 14.1008 0.231294C11.2778 0.717504 8.57633 1.56914 6.05554 2.72663C6.03372 2.73604 6.01502 2.75174 6.0026 2.77211C0.878443 10.4275 -0.525279 17.8947 0.16334 25.2694C0.166456 25.3054 0.186709 25.3399 0.214752 25.3619C3.59553 27.8446 6.87038 29.3519 10.0844 30.351C10.1359 30.3667 10.1904 30.3478 10.2231 30.3055C10.9834 29.2672 11.6611 28.1725 12.2422 27.0212C12.2765 26.9538 12.2437 26.8738 12.1737 26.8472C11.0987 26.4394 10.0751 25.9422 9.09044 25.3776C9.01256 25.3321 9.00632 25.2207 9.07797 25.1674C9.28517 25.0121 9.49243 24.8506 9.69028 24.6874C9.72608 24.6577 9.77596 24.6514 9.81805 24.6702C16.2867 27.6235 23.2897 27.6235 29.682 24.6702C29.7241 24.6498 29.774 24.6561 29.8113 24.6859C30.0092 24.849 30.2164 25.0121 30.4252 25.1674C30.4968 25.2207 30.4922 25.3321 30.4143 25.3776C29.4296 25.9531 28.406 26.4394 27.3295 26.8456C27.2594 26.8723 27.2282 26.9538 27.2625 27.0212C27.8561 28.1709 28.5338 29.2656 29.2801 30.3039C29.3112 30.3478 29.3673 30.3667 29.4187 30.351C32.6484 29.3519 35.9232 27.8446 39.304 25.3619C39.3336 25.3399 39.3523 25.307 39.3554 25.2709C40.1795 16.745 37.975 9.33904 33.5115 2.77367C33.5006 2.75174 33.4819 2.73604 33.4601 2.72663ZM13.2082 20.779C11.2607 20.779 9.65599 18.991 9.65599 16.7952C9.65599 14.5994 11.2296 12.8115 13.2082 12.8115C15.2023 12.8115 16.7915 14.6151 16.7603 16.7952C16.7603 18.991 15.1867 20.779 13.2082 20.779ZM26.3417 20.779C24.3943 20.779 22.7896 18.991 22.7896 16.7952C22.7896 14.5994 24.3631 12.8115 26.3417 12.8115C28.336 12.8115 29.9251 14.6151 29.8939 16.7952C29.8939 18.991 28.336 20.779 26.3417 20.779Z"
      />
    </svg>
  ),
};

/**
 * Every visible string, as [sidebar title, default]. The Labels group edits
 * them; an empty field falls back to the default. `{name}` placeholders are
 * filled at render.
 *
 * Deliberately not here: the reset confirmation ("If {email} has an
 * account..."). Its wording is a security property, FP-02 section 3.4 rule 3:
 * a confident "we sent you a link" tells an attacker the address is
 * registered, so it is not creator-editable. Validation and server messages
 * are not here either; they are feedback, not design copy.
 */
const AUTH_LABELS: Record<string, readonly [string, string]> = {
  continueWith: ["Provider button", "Continue with {provider}"],
  divider: ["Divider", "or"],
  signInTab: ["Sign in tab", "Sign in"],
  signUpTab: ["Sign up tab", "Sign up"],
  emailLabel: ["Email label", "Email address"],
  emailPlaceholder: ["Email placeholder", "you@example.com"],
  passwordLabel: ["Password label", "Password"],
  newPasswordLabel: ["New password label", "New password"],
  confirmPasswordLabel: ["Confirm password label", "Confirm new password"],
  passwordsDiffer: ["Passwords differ", "The passwords do not match."],
  nameLabel: ["Name label", "Name (optional)"],
  remember: ["Remember me", "Remember me for 30 days"],
  signIn: ["Sign in button", "Sign in"],
  signingIn: ["Signing in", "Signing in"],
  createAccount: ["Create account button", "Create account"],
  creating: ["Creating", "Creating"],
  sendCode: ["Send code button", "Email me a code"],
  sending: ["Sending", "Sending"],
  // "If": a code goes only to a registered member, and the screen must not say which addresses are.
  codeLabel: ["Code label", "If {email} has an account, we sent it a {length} digit code. Enter it here."],
  verify: ["Verify button", "Verify code"],
  checking: ["Checking", "Checking"],
  resend: ["Resend", "Resend code"],
  resendIn: ["Resend countdown", "Resend in {seconds}s"],
  sendReset: ["Send reset button", "Send reset link"],
  setPassword: ["Set password button", "Set new password"],
  saving: ["Saving", "Saving"],
  forgotLink: ["Forgot link", "Forgot password?"],
  codeLink: ["Code link", "Email me a code instead"],
  passwordLink: ["Password link", "Use a password instead"],
  createLink: ["Create account link", "Create an account"],
  haveAccountLink: ["Have account link", "Already have an account? Sign in"],
  backLink: ["Back link", "Back to sign in"],
  signupTitle: ["Sign up title", "Create your account"],
  forgotTitle: ["Forgot title", "Reset your password"],
  forgotText: ["Forgot text", "Enter your email and we will send you a reset link."],
  resetTitle: ["New password title", "Choose a new password"],
  resetText: ["New password text", "Pick something you have not used on another site."],
  signedInTitle: ["Signed in title", "You Are Signed In"],
  signedInText: [
    "Signed in text",
    "Protected sections unlock the next time this page checks your membership.",
  ],
  inboxTitle: ["Check inbox title", "Check Your Inbox"],
  verifyTitle: ["Confirm email title", "Confirm your email"],
  verifyText: ["Confirm email text", "We sent a code to your inbox. Enter it to finish creating your account."],
  verifyButton: ["Confirm email button", "Confirm email"],
  verifiedNotice: ["Email confirmed message", "Email confirmed. Sign in to continue."],
  unverifiedNotice: ["Unconfirmed sign in message", "Confirm your email first. We sent a new code to your inbox."],
  changeEmail: ["Change email link", "Use a different email"],
  signInTitle: ["Sign in title", "Sign in to continue"],
};

const PROVIDER_LABELS: Record<OAuthProvider, string> = {
  google: "Google",
  apple: "Apple",
  github: "GitHub",
  discord: "Discord",
};

// ============================================================================
// COMPONENT
// ============================================================================

export interface MemberAuthProps extends MfAppearanceProps {
  authMode?: AuthDisplayMode;
  headline?: string;
  welcomeMessage?: string;
  emailEnabled?: boolean;
  googleEnabled?: boolean;
  appleEnabled?: boolean;
  githubEnabled?: boolean;
  discordEnabled?: boolean;
  accentColor?: string;
  borderRadius?: number;
  enablePasswordAuth?: boolean;
  defaultAuthMethod?: AuthMethod;
  /** Dedicated screens only. See `AuthConfig`. */
  loginPath?: string;
  signupPath?: string;
  resetPath?: string;
  otpPath?: string;
  /** Modal mode only. Framer wires this to an interaction. */
  onClose?: () => void;
  /** Modal triggers, 05-member-auth.md section 11. */
  modalTrigger?: ModalTrigger;
  modalTriggerId?: string;
  modalDelay?: number;
  modalScrollPercent?: number;
  modalOncePerSession?: boolean;
  /** Modal only: No draws a small chip on the canvas, for a popup kept in a menu. */
  modalCanvasPreview?: boolean;
}

type ModalTrigger = "click" | "load" | "scroll";

/** A click on a link to `#id`, or on a layer named `id` (`data-framer-name`). */
function isModalTrigger(target: EventTarget | null, id: string): boolean {
  let node = target instanceof Element ? target : null;
  while (node) {
    if (node.getAttribute("data-framer-name") === id) return true;
    if (node.tagName === "A") {
      const href = node.getAttribute("href") || "";
      if (href === "#" + id || href.endsWith("#" + id)) return true;
    }
    node = node.parentElement;
  }
  return false;
}

/*
  One popup per trigger, whichever copy of the component it comes from.

  A popup placed in a shared Navigation component, a leftover copy on the page,
  and the copies in hidden breakpoint variants all listen for the same click.
  The first copy that is actually showing claims the trigger and opens; the
  others see it taken and stay closed. The record is on `window`, not in this
  module, because Member Auth and each dedicated screen are separate files.
*/
const MODAL_REGISTRY_KEY = "__memberframeModals";

function modalRegistry(): Record<string, true> {
  const host = window as unknown as Record<string, Record<string, true> | undefined>;
  const existing = host[MODAL_REGISTRY_KEY];
  if (existing && typeof existing === "object") return existing;
  const created: Record<string, true> = {};
  host[MODAL_REGISTRY_KEY] = created;
  return created;
}

/** True if this copy may open the popup for `key`, which it now holds. */
function claimModal(key: string): boolean {
  const registry = modalRegistry();
  if (registry[key]) return false;
  registry[key] = true;
  return true;
}

function releaseModal(key: string): void {
  delete modalRegistry()[key];
}

/** False inside a hidden breakpoint variant (`display: none`) or a hidden layer. */
function isShowing(anchor: HTMLElement | null): boolean {
  if (!anchor || !anchor.isConnected) return false;
  if (typeof anchor.checkVisibility === "function") return anchor.checkVisibility();
  return anchor.getClientRects().length > 0;
}

/** Drawn here: Framer's bundled lucide-react may lack `X`. */
function MfCloseMark(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden={true} data-lucide="x">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

/** Set by the MemberFrame Builder on insert, never by hand (27-instance-seal.md). */
interface MfSealProps {
  mfSeal?: string;
}

/**
 * Fixed size by default, so the frame the creator draws is the card they get.
 * The card fills it and scrolls if the frame is shorter than the form; Fit and
 * Fill stay available in the sidebar.
 *
 * @framerIntrinsicWidth 400
 * @framerIntrinsicHeight 600
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
export default function MemberAuth(props: MemberAuthProps & MfSealProps) {
  const {
    authMode = CONFIG.authMode,
    headline = CONFIG.headline,
    welcomeMessage = CONFIG.welcomeMessage,
    emailEnabled: emailControl = CONFIG.emailEnabled,
    googleEnabled: googleControl = CONFIG.googleEnabled,
    appleEnabled: appleControl = CONFIG.appleEnabled,
    githubEnabled: githubControl = CONFIG.githubEnabled,
    discordEnabled: discordControl = CONFIG.discordEnabled,
    accentColor = CONFIG.accentColor,
    borderRadius = CONFIG.borderRadius,
    enablePasswordAuth: passwordControl = CONFIG.enablePasswordAuth,
    defaultAuthMethod = CONFIG.defaultAuthMethod,
    loginPath = CONFIG.loginPath,
    signupPath = CONFIG.signupPath,
    resetPath = CONFIG.resetPath,
    otpPath = CONFIG.otpPath,
    onClose,
    modalTrigger = CONFIG.modalTrigger,
    modalTriggerId = CONFIG.modalTriggerId,
    modalDelay = CONFIG.modalDelay,
    modalScrollPercent = CONFIG.modalScrollPercent,
    modalOncePerSession = CONFIG.modalOncePerSession,
    modalCanvasPreview = CONFIG.modalCanvasPreview,
    theme = "light",
    colors,
    typography,
    layout,
    spacing,
    labels,
  } = props;

  /** One label, with `{name}` placeholders filled. */
  const t = (key: string, values?: Record<string, string | number>): string => {
    const text = mfLabel(labels, AUTH_LABELS, key);
    return values ? mfFill(text, values) : text;
  };

  /*
    A dedicated screen fixes what the general controls would otherwise decide.
    Every one of the four is an email form, so email is on; the three password
    screens have password on; and the reset and code screens offer no provider
    buttons, because "Continue with Google" on a reset page signs someone in
    when they asked to reset. The controls these override are hidden in the
    sidebar for the dedicated components, so nothing appears to do nothing.
  */
  const screen = CONFIG.screen;
  const dedicated = screen !== "all";
  const emailEnabled = dedicated ? true : emailControl;
  // Member Login offers passwordless too (2026-10-18): it reads Password Auth
  // and Default Method like Member Auth. The other dedicated screens fix them.
  const passwordless = screen === "all" || screen === "login";
  const enablePasswordAuth = passwordless ? passwordControl : screen !== "otp";
  const providersAllowed = screen === "all" || screen === "login" || screen === "register";
  const googleEnabled = providersAllowed && googleControl;
  const appleEnabled = providersAllowed && appleControl;
  const githubEnabled = providersAllowed && githubControl;
  const discordEnabled = providersAllowed && discordControl;

  /**
   * A CSS-safe scope for this instance, so two sign-in boxes on one page with
   * different accents do not overwrite each other's custom properties. `useId`
   * returns a value containing colons, which are legal in a quoted attribute
   * selector but not worth relying on.
   */
  const rawId = useId();
  const scope = useMemo(() => `mfa${rawId.replace(/[^a-zA-Z0-9]/g, "")}`, [rawId]);

  const license = useMfLicense(CONFIG.apiBaseUrl, CONFIG.siteKey, props.mfSeal);
  const onCanvas = useMemo(() => {
    const target = RenderTarget.current();
    return target === RenderTarget.canvas || target === RenderTarget.thumbnail;
  }, []);

  // Modal triggers (05-member-auth.md section 11). Always shown on the canvas.
  const isModal = authMode === "modal";
  const [modalOpen, setModalOpen] = useState(false);
  const showCard = !isModal || onCanvas || modalOpen;
  const triggerId = String(modalTriggerId || "").trim().replace(/^#/, "");
  const modalKey = triggerId || "auto-" + modalTrigger;
  /** In place on the page, so a copy in a hidden breakpoint knows it is hidden. */
  const anchorRef = useRef<HTMLSpanElement>(null);
  /** The trigger this copy holds in the shared registry while its popup is open. */
  const heldKey = useRef<string | null>(null);

  /** Opens only from a copy that is showing, and only one copy per trigger. */
  const openModal = useCallback((): boolean => {
    if (heldKey.current) return true;
    if (!isShowing(anchorRef.current)) return false;
    if (!claimModal(modalKey)) return false;
    heldKey.current = modalKey;
    setModalOpen(true);
    return true;
  }, [modalKey]);

  const closeModal = useCallback(() => {
    if (heldKey.current) {
      releaseModal(heldKey.current);
      heldKey.current = null;
    }
    setModalOpen(false);
    onClose?.();
  }, [onClose]);

  // A copy removed while open (a page change) frees its trigger for the next.
  useEffect(
    () => () => {
      if (heldKey.current) releaseModal(heldKey.current);
      heldKey.current = null;
    },
    []
  );

  useEffect(() => {
    if (!isModal || onCanvas || typeof window === "undefined") return;
    const id = triggerId;
    const entry = window.location.pathname + "|" + (id || modalTrigger);
    const signedIn = () => {
      try {
        return window.localStorage.getItem(HINT_KEY) === "1";
      } catch {
        return false;
      }
    };
    const shown = (): string[] => {
      try {
        const list = JSON.parse(window.sessionStorage.getItem(MODAL_SHOWN_KEY) || "[]");
        return Array.isArray(list) ? list.filter((item): item is string => typeof item === "string") : [];
      } catch {
        return [];
      }
    };
    // Never by itself for a signed-in member; once per page per visit if asked.
    const openAutomatically = () => {
      if (signedIn()) return;
      const seen = shown();
      if (modalOncePerSession && seen.includes(entry)) return;
      // Recorded only by the copy that opened, not by a hidden one that could not.
      if (!openModal()) return;
      try {
        window.sessionStorage.setItem(MODAL_SHOWN_KEY, JSON.stringify([...seen, entry].slice(-50)));
      } catch {
        // Blocked storage only means it may show again.
      }
    };

    const cleanups: Array<() => void> = [];

    if (id !== "") {
      // Capture phase, so the trigger's own `#id` link never navigates.
      const onClick = (event: MouseEvent) => {
        if (!isModalTrigger(event.target, id)) return;
        event.preventDefault();
        event.stopPropagation();
        openModal();
      };
      const onHash = () => {
        if (window.location.hash === "#" + id) openModal();
      };
      document.addEventListener("click", onClick, true);
      window.addEventListener("hashchange", onHash);
      onHash();
      cleanups.push(() => {
        document.removeEventListener("click", onClick, true);
        window.removeEventListener("hashchange", onHash);
      });
    }

    if (modalTrigger === "load") {
      const seconds = Math.min(60, Math.max(0, Number(modalDelay) || 0));
      const timer = window.setTimeout(openAutomatically, seconds * 1000);
      cleanups.push(() => window.clearTimeout(timer));
    }

    if (modalTrigger === "scroll") {
      const depth = Math.min(100, Math.max(0, Number(modalScrollPercent) || 0));
      const onScroll = () => {
        const room = document.documentElement.scrollHeight - window.innerHeight;
        const reached = room <= 0 ? 100 : (window.scrollY / room) * 100;
        if (reached < depth) return;
        window.removeEventListener("scroll", onScroll);
        openAutomatically();
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
      cleanups.push(() => window.removeEventListener("scroll", onScroll));
    }

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [isModal, onCanvas, modalTrigger, triggerId, modalDelay, modalScrollPercent, modalOncePerSession, openModal]);

  useEffect(() => {
    if (!isModal || onCanvas || !modalOpen || typeof document === "undefined") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isModal, onCanvas, modalOpen]);

  const [state, setState] = useState<AuthState>({ phase: "idle" });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [oauthBusy, setOauthBusy] = useState<OAuthProvider | null>(null);
  const [policy, setPolicy] = useState<PasswordPolicy>(() => readPasswordPolicy(CONFIG.passwordPolicy));
  const policyLoaded = useRef(false);

  /* ---- FP-02 state ---- */

  /**
   * Read once, on mount, and never again.
   *
   * A URL carrying `?token=` can only be the creator's reset page, so the
   * component starts there rather than offering a sign-in form the visitor did
   * not ask for. Reading it in the initializer rather than an effect means the
   * first paint is already the right view.
   */
  const [resetToken, setResetToken] = useState<string | null>(() => readResetToken());

  const [view, setView] = useState<AuthView>(() => {
    if (screen === "login") return !enablePasswordAuth || defaultAuthMethod === "otp" ? "otp" : "password_signin";
    if (screen === "register") return "password_signup";
    if (screen === "otp") return "otp";
    if (screen === "reset") return readResetToken() !== null ? "reset" : "forgot";
    if (readResetToken() !== null) return "reset";
    if (!enablePasswordAuth) return "otp";
    return defaultAuthMethod === "password" ? "password_signin" : "otp";
  });

  /**
   * The plaintext password, for the length of one submit.
   *
   * FP-02 section 3.4 rule 1. It is cleared on success, on failure, and on every
   * view change, and it is never written to storage, a cookie, a log, or a URL.
   * A React state variable bound to the input is unavoidable; everything beyond
   * that is avoidable and avoided.
   */
  const [password, setPassword] = useState("");
  /** The reset form's second entry. Held and cleared exactly as `password` is. */
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  /** A success line above the form: the address was just confirmed. */
  const [notice, setNotice] = useState<string | null>(null);

  /** The sign-in tab this component opened, for the legacy popup message check. */
  const popupRef = useRef<Window | null>(null);
  /** True from the moment this tab starts a social sign in until it settles. */
  const oauthPendingRef = useRef(false);
  /** Read once, before the effects below strip it from the address bar. */
  const [handoff] = useState<OAuthHandoff | null>(readOAuthHandoff);
  const cardRef = useRef<HTMLDivElement>(null);

  /** F05: "A disabled provider does not render its button." */
  const providers = useMemo(() => {
    const enabled: OAuthProvider[] = [];
    if (googleEnabled) enabled.push("google");
    if (appleEnabled) enabled.push("apple");
    if (githubEnabled) enabled.push("github");
    if (discordEnabled) enabled.push("discord");
    return enabled;
  }, [googleEnabled, appleEnabled, githubEnabled, discordEnabled]);

  /**
   * Keep the view reachable when the creator changes the controls.
   *
   * On the canvas a creator flips `Password Auth` off in the sidebar while the
   * password form is showing. Without this the form stays, and the creator sees
   * a control that appears to do nothing. The same applies to turning email off,
   * which removes the field both email flows depend on.
   */
  useEffect(() => {
    // With email off there is no field for either flow, so no view is reachable
    // and the render falls through to SSO or to the "nothing is enabled" note.
    // Reassigning `view` here would be churn with nothing to show for it.
    if (!emailEnabled) return;
    if (enablePasswordAuth) return;

    // Password turned off. Every password view becomes the OTP one.
    if (view !== "otp") setView("otp");
  }, [enablePasswordAuth, emailEnabled, view]);

  /**
   * On the canvas, follow Default Method as the creator changes it, so the
   * sidebar's choice is the form they see. The published site keeps the
   * visitor's own place.
   */
  useEffect(() => {
    if (!onCanvas || !passwordless || !enablePasswordAuth) return;
    setView(defaultAuthMethod === "otp" ? "otp" : "password_signin");
  }, [onCanvas, passwordless, enablePasswordAuth, defaultAuthMethod]);

  /**
   * Clear the secret whenever the visitor moves.
   *
   * FP-02 section 3.4 rule 1. Leaving a typed password in state across a view
   * change means it survives in memory long after the form that collected it is
   * gone, and a stale value would be submitted by the next form that reads it.
   */
  useEffect(() => {
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setSubmitted(false);
  }, [view]);

  /** One tick a second, and only while a countdown is actually running. */
  const countdownActive =
    (state.phase === "code_sent" || state.phase === "verifying") &&
    secondsRemaining(state.resendAtMs, nowMs) > 0;

  useEffect(() => {
    if (!countdownActive) return;

    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [countdownActive]);

  // --------------------------------------------------------------------------
  // OAuth popup, and the origin check that makes it safe
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (onCanvas) return;

    const expectedOrigin = apiOrigin(CONFIG.apiBaseUrl);

    function onMessage(event: MessageEvent) {
      // 1. The origin must be exactly the API origin. PRD section 14.1 S8.
      //    An equality comparison, never a suffix test: `includes` would match
      //    `api.memberframe.framefic.com.attacker.example`.
      if (expectedOrigin === null || event.origin !== expectedOrigin) return;

      // 2. It must be the window this component opened, not any window.
      if (popupRef.current && event.source !== popupRef.current) return;

      // 3. It must be the message shape this component expects.
      const payload = event.data as { type?: unknown; ok?: unknown; reason?: unknown } | null;
      if (!payload || payload.type !== OAUTH_MESSAGE_TYPE) return;

      setOauthBusy(null);
      popupRef.current = null;
      oauthPendingRef.current = false;

      if (payload.ok === true) {
        setState({ phase: "signed_in" });
        notifySessionUpdated(true);
        redirectAfterAuth();
        return;
      }

      setState({
        phase: "error",
        message: "That sign in did not complete. Try again.",
        retryable: true,
      });
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onCanvas]);

  /*
    The other tab finished. Answer it, so it closes and returns the visitor
    here, then go where a sign in goes. Only the tab that started a sign in
    answers, so a second open copy of the page does not also navigate.
  */
  useEffect(() => {
    if (onCanvas || typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel(OAUTH_CHANNEL);

    channel.onmessage = (event: MessageEvent) => {
      const data = event.data as { type?: unknown; ok?: unknown; message?: unknown; id?: unknown } | null;
      if (!data || data.type !== "result" || !oauthPendingRef.current) return;

      oauthPendingRef.current = false;
      popupRef.current = null;
      channel.postMessage({ type: "ack", id: data.id });
      setOauthBusy(null);

      if (data.ok === true) {
        setState({ phase: "signed_in" });
        notifySessionUpdated(true);
        redirectAfterAuth();
        return;
      }

      setState({
        phase: "error",
        message: typeof data.message === "string" ? data.message : oauthFailureMessage("unknown"),
        retryable: true,
      });
    };

    return () => channel.close();
  }, [onCanvas]);

  /*
    The visitor came back to this tab without a result: they closed the
    sign-in tab or wandered off. Stop the spinner, quietly. A result that
    arrives later still settles it through the channel above.
  */
  useEffect(() => {
    if (onCanvas || oauthBusy === null) return;

    const onFocus = () => setOauthBusy(null);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [onCanvas, oauthBusy]);

  const startOAuth = useCallback(
    (provider: OAuthProvider) => {
      if (onCanvas) return;

      setState({ phase: "idle" });
      setOauthBusy(provider);

      // returnTo is this page, without its fragment. The API checks its
      // origin against the site's allowlist before it will send a code there.
      const query = new URLSearchParams();
      if (CONFIG.siteKey) query.set("siteKey", CONFIG.siteKey);
      query.set("returnTo", `${window.location.origin}${window.location.pathname}${window.location.search}`);
      const url = `${CONFIG.apiBaseUrl}${OAUTH_PATH_PREFIX}${provider}?${query.toString()}`;

      // A new tab, not a window. Passing size features ("width=480,...") is
      // what makes a browser open a separate window; with none it opens a tab.
      const tab = window.open(url, "memberframe-oauth");

      if (!tab) {
        // F05: "OAuth popup blocked by the browser produces an actionable
        // inline error, not a silent failure."
        setOauthBusy(null);
        setState({
          phase: "error",
          message: "Your browser blocked the sign in tab. Allow popups for this site, then try again.",
          retryable: true,
        });
        return;
      }

      popupRef.current = tab;
      oauthPendingRef.current = true;
    },
    [onCanvas]
  );

  /** A wrong confirmation code, shown under the code box while it stays open. */
  const [codeError, setCodeError] = useState<string | null>(null);
  /** The code step opened from a sign in, not a sign up, so the words fit. */
  const [unverifiedSignIn, setUnverifiedSignIn] = useState(false);

  /**
   * The address is confirmed. Next is the sign in form, wherever the creator
   * put it:
   *
   *   - one page for every step (`<MemberAuth>`): switch to sign in in place
   *   - separate pages: go to the sign in page, which shows the same message
   *     and fills in the address. The address travels in sessionStorage, not
   *     the URL, so it stays out of history and the `Referer` header.
   *
   * A dedicated sign up screen with no usable sign in page falls back to the
   * in-place form, so the visitor is never left on a dead end.
   */
  const emailConfirmed = useCallback(
    (address: string) => {
      setCode("");
      setCodeError(null);
      setUnverifiedSignIn(false);
      setPassword("");
      setConfirmPassword("");

      if (dedicated && screen !== "login" && linkablePath(loginPath, false)) {
        try {
          window.sessionStorage.setItem(VERIFIED_KEY, address);
        } catch {
          // Blocked storage: the sign in page loses its message, not its form.
        }
        setState({ phase: "idle" });
        goTo(loginPath);
        return;
      }

      setEmail(address);
      setView("password_signin");
      setNotice(t("verifiedNotice"));
      setState({ phase: "idle" });
    },
    // `t` reads the labels prop, which is stable for one render's purposes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dedicated, loginPath, screen, labels]
  );

  // --------------------------------------------------------------------------
  // Email code flow
  // --------------------------------------------------------------------------
  const sendCode = useCallback(async (purpose: CodePurpose = "signin", address: string = email) => {
    if (onCanvas) return;

    if (!looksLikeEmail(address)) {
      setState({ phase: "error", message: "Enter a valid email address.", retryable: true });
      return;
    }

    setState({ phase: "sending" });

    try {
      const response = await fetch(
        `${CONFIG.apiBaseUrl}${purpose === "verify" ? RESEND_VERIFICATION_PATH : SEND_OTP_PATH}`,
        {
          method: "POST",
          credentials: "include",
          headers: apiHeaders(true),
          body: JSON.stringify({ email: address.trim() }),
        }
      );

      if (response.status === 429) {
        setState({
          phase: "error",
          message: "Too many requests. Wait a minute, then try again.",
          retryable: true,
        });
        return;
      }

      if (!response.ok) {
        setState({
          phase: "error",
          message: "We could not send a code just now. Try again shortly.",
          retryable: true,
        });
        return;
      }

      const body = (await response.json().catch(() => ({}))) as { resendAfterSeconds?: number };
      const lock = Number.isFinite(body.resendAfterSeconds)
        ? Number(body.resendAfterSeconds)
        : RESEND_LOCK_SECONDS;

      setCode("");
      setNowMs(Date.now());
      setState({
        phase: "code_sent",
        email: address.trim(),
        resendAtMs: Date.now() + lock * 1000,
        purpose,
      });
    } catch {
      setState({
        phase: "error",
        message: "We could not reach the sign in service. Check your connection.",
        retryable: true,
      });
    }
  }, [email, onCanvas]);

  /** Back out of confirming, to correct a mistyped address. */
  const changeEmail = useCallback(() => {
    setCode("");
    setCodeError(null);
    setUnverifiedSignIn(false);
    setState({ phase: "idle" });
    setView(unverifiedSignIn ? "password_signin" : "password_signup");
  }, [unverifiedSignIn]);

  const verifyCode = useCallback(async () => {
    if (onCanvas) return;
    if (state.phase !== "code_sent") return;
    if (code.length !== CODE_LENGTH) return;

    const { email: pendingEmail, resendAtMs, purpose } = state;
    setState({ phase: "verifying", email: pendingEmail, resendAtMs, purpose });
    const confirming = purpose === "verify";

    try {
      const response = await fetch(`${CONFIG.apiBaseUrl}${confirming ? VERIFY_EMAIL_PATH : VERIFY_OTP_PATH}`, {
        method: "POST",
        // The session arrives as an HTTP-only cookie, per PRD section 14.1 S2.
        // This component never sees it, which is the point.
        credentials: "include",
        headers: apiHeaders(true),
        body: JSON.stringify({ email: pendingEmail, code }),
      });

      if (response.ok && confirming) {
        emailConfirmed(pendingEmail);
        return;
      }

      if (response.ok) {
        setState({ phase: "signed_in" });
        notifySessionUpdated(true);
        redirectAfterAuth();
        return;
      }

      const body = (await response.json().catch(() => ({}))) as { reason?: VerifyFailure };
      const reason: VerifyFailure = body.reason ?? "unknown";

      // F05: an expired code must read differently from a wrong one, and a dead
      // code differently again. A bare status cannot carry that, so the server
      // returns a reason and this maps it.
      // A wrong confirmation code keeps the code step open, so the visitor
      // can retype or resend without starting the sign up again.
      if (confirming && reason !== "too_many_attempts") {
        setCode("");
        setState({ phase: "code_sent", email: pendingEmail, resendAtMs, purpose });
        setNotice(null);
        setCodeError(verifyFailureMessage(reason));
        return;
      }

      setState({
        phase: "error",
        message: verifyFailureMessage(reason),
        retryable: reason !== "too_many_attempts",
      });
    } catch {
      setState({
        phase: "error",
        message: "We could not reach the sign in service. Check your connection.",
        retryable: true,
      });
    }
  }, [code, emailConfirmed, onCanvas, state]);

  // --------------------------------------------------------------------------
  // Password flows, feature plan FP-02
  // --------------------------------------------------------------------------

  /**
   * One POST, one error contract, one place the secret is cleared.
   *
   * All four password endpoints behave the same way from here: send JSON, take
   * a cookie on success, read a `reason` on failure. Writing that four times
   * invites three of them to drift, and the one that drifts is the one that
   * stops clearing the password.
   */
  const submitCredentials = useCallback(
    async (
      path: string,
      body: Record<string, unknown> | null,
      onOk: (data: Record<string, unknown>) => void,
      silentFail = false
    ) => {
      if (onCanvas) return;

      if (!silentFail) setState({ phase: "sending" });

      try {
        const response = await fetch(`${CONFIG.apiBaseUrl}${path}`, {
          method: "POST",
          // The session arrives as an HTTP-only cookie, per PRD section 14.1
          // S2. This component never sees it, which is the point.
          credentials: "include",
          headers: apiHeaders(true),
          body: JSON.stringify(body ?? {}),
        });

        // Whatever happened, the plaintext has served its purpose.
        setPassword("");
        setConfirmPassword("");
        setShowPassword(false);

        if (response.ok) {
          const data = ((await response.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
          noteAfterLoginPath(data);
          onOk(data);
          return;
        }

        if (silentFail) {
          setState({ phase: "idle" });
          return;
        }

        if (response.status === 429) {
          setState({
            phase: "error",
            message: "Too many attempts. Wait a few minutes, then try again.",
            retryable: true,
          });
          return;
        }

        const payload = (await response.json().catch(() => ({}))) as {
          reason?: PasswordFailure | "email_not_verified";
          resendAfterSeconds?: unknown;
        };

        // The right password for an address that was never confirmed. The
        // server has emailed a code; open the step that takes it.
        if (payload.reason === "email_not_verified" && typeof body?.["email"] === "string") {
          const wait = Number(payload.resendAfterSeconds);
          setCode("");
          setCodeError(null);
          setNotice(null);
          setNowMs(Date.now());
          setState({
            phase: "code_sent",
            email: body["email"],
            resendAtMs: Date.now() + (Number.isFinite(wait) ? wait : RESEND_LOCK_SECONDS) * 1000,
            purpose: "verify",
          });
          setUnverifiedSignIn(true);
          return;
        }

        // email_not_verified returned above, so what is left is a PasswordFailure.
        const reason = (payload.reason ?? "unknown") as PasswordFailure;

        setState({
          phase: "error",
          message: passwordFailureMessage(reason),
          retryable: reason !== "account_locked",
        });
      } catch {
        setPassword("");
        setConfirmPassword("");
        setShowPassword(false);
        if (silentFail) {
          setState({ phase: "idle" });
          return;
        }
        setState({
          phase: "error",
          message: "We could not reach the sign in service. Check your connection.",
          retryable: true,
        });
      }
    },
    [onCanvas]
  );

  // --------------------------------------------------------------------------
  // Check for existing active session on mount. If already signed in, auto-redirect
  // to afterLoginPath (or /dashboard) so logged-in members never see the login form.
  // --------------------------------------------------------------------------
  useEffect(() => {
    // A handoff is being finished by the effect below; a 401 from this check
    // landing after it would reset the form under the visitor. A reset link
    // is for setting a password, signed in or not: the member stays.
    if (onCanvas || handoff || readResetToken() !== null) return;

    void submitCredentials(
      SESSION_PATH,
      null,
      () => {
        setState({ phase: "signed_in" });
        notifySessionUpdated(true);
        // Not back to a page the shield just turned this member away from:
        // that page would send them here again, and round it would go.
        if (!recentlyDenied(afterLoginTarget())) leaveForAfterLogin();
      },
      true
    );
  }, [onCanvas, handoff, submitCredentials]);

  /*
    A sign up page confirmed this address and sent the visitor here, to the
    sign in page. Say so, and fill in the address. Read after mount rather
    than in a state initializer: the published page is prerendered, and the
    first client render has to match that HTML.
  */
  useEffect(() => {
    if (onCanvas || typeof window === "undefined") return;

    try {
      const confirmed = window.sessionStorage.getItem(VERIFIED_KEY);
      if (confirmed === null) return;
      window.sessionStorage.removeItem(VERIFIED_KEY);
      if (confirmed !== "") setEmail(confirmed);
      setView("password_signin");
      setNotice(t("verifiedNotice"));
    } catch {
      // Storage blocked: the sign in form still works, without the message.
    }
    // `t` reads the labels prop; the message is read once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCanvas]);

  /*
    This page is the sign-in tab, back from the provider with a code (or an
    error) in its fragment. Strip it from the address bar first, so it is not
    left in history, then exchange it through the same POST every other
    credential call uses. See OAUTH_CHANNEL for the whole flow.
  */
  useEffect(() => {
    if (onCanvas || !handoff) return;

    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`
    );

    const fail = (message: string) => {
      setState({ phase: "error", message, retryable: true });
      announceOAuthResult(false, message, () => undefined);
    };

    if ("error" in handoff) {
      fail(oauthFailureMessage(handoff.error));
      return;
    }

    let signedIn = false;
    void submitCredentials(
      OAUTH_EXCHANGE_PATH,
      { code: handoff.code },
      () => {
        signedIn = true;
        setState({ phase: "signed_in" });
        notifySessionUpdated(true);
        announceOAuthResult(true, "", redirectAfterAuth);
      }
    ).then(() => {
      if (!signedIn) fail(oauthFailureMessage("unknown"));
    });
  }, [onCanvas, handoff, submitCredentials]);

  const signInWithPassword = useCallback(() => {
    setSubmitted(true);

    if (!looksLikeEmail(email)) return;
    // Deliberately not validated against the policy. A member whose password
    // predates a rule change must still be able to sign in with it, and the
    // server is the only authority on whether it is correct.
    if (password === "") return;

    setNotice(null);
    void submitCredentials(
      LOGIN_PASSWORD_PATH,
      { email: email.trim(), password, rememberMe },
      () => {
        setState({ phase: "signed_in" });
        notifySessionUpdated(true);
        redirectAfterAuth();
      }
    );
  }, [email, password, rememberMe, submitCredentials]);

  const register = useCallback(() => {
    setSubmitted(true);

    if (!looksLikeEmail(email)) return;
    if (passwordProblems(password, email, policy).length > 0) return;

    void submitCredentials(
      REGISTER_PATH,
      // `name` is optional per FP-02 section 2.1, so an empty box sends null
      // rather than an empty string the backend would have to special-case.
      { email: email.trim(), password, name: name.trim() === "" ? null : name.trim() },
      (data) => {
        // The account exists but is not confirmed: no session yet. The API
        // emailed a code, so the next step is the box that takes it.
        if (data["verificationRequired"] === true) {
          const wait = Number(data["resendAfterSeconds"]);
          setCode("");
          setCodeError(null);
          setNowMs(Date.now());
          setUnverifiedSignIn(false);
          setState({
            phase: "code_sent",
            email: typeof data["email"] === "string" ? data["email"] : email.trim(),
            resendAtMs: Date.now() + (Number.isFinite(wait) ? wait : RESEND_LOCK_SECONDS) * 1000,
            purpose: "verify",
          });
          return;
        }

        setState({ phase: "signed_in" });
        notifySessionUpdated(true);
        redirectAfterAuth();
      }
    );
  }, [email, name, password, policy, submitCredentials]);

  /**
   * FP-02 section 2.3 and section 3.4 rule 3.
   *
   * The server always answers 200, and this always shows the same screen. An
   * unregistered address and a registered one are indistinguishable from here,
   * which is the whole requirement.
   */
  const requestPasswordReset = useCallback(() => {
    setSubmitted(true);

    if (!looksLikeEmail(email)) return;

    void submitCredentials(FORGOT_PASSWORD_PATH, { email: email.trim() }, () =>
      setState({ phase: "reset_requested", email: email.trim() })
    );
  }, [email, submitCredentials]);

  const completePasswordReset = useCallback(() => {
    setSubmitted(true);

    if (resetToken === null) return;
    if (passwordProblems(password, email, policy).length > 0) return;
    if (confirmPassword !== password) return;

    void submitCredentials(RESET_PASSWORD_PATH, { token: resetToken, newPassword: password }, () => {
      // Strip the token from the address bar. It is spent now, and leaving it
      // in the URL leaves it in the history entry and in the `Referer` of
      // anything this page loads next. See `05-member-auth.md` section 9.6.
      try {
        if (typeof window !== "undefined" && window.history?.replaceState) {
          window.history.replaceState({}, "", window.location.pathname);
        }
      } catch {
        // A sandboxed iframe can refuse this. The reset still succeeded, and
        // failing the whole flow over a cosmetic URL would be worse.
      }

      setResetToken(null);
      setState({ phase: "signed_in" });
      notifySessionUpdated(true);
      redirectAfterAuth();
    });
  }, [confirmPassword, email, password, policy, resetToken, submitCredentials]);

  // --------------------------------------------------------------------------
  // Modal keyboard behaviour. F05 requires Escape and a focus trap.
  // --------------------------------------------------------------------------
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (authMode !== "modal") return;

      if (event.key === "Escape") {
        event.stopPropagation();
        closeModal();
        return;
      }

      if (event.key !== "Tab") return;

      const card = cardRef.current;
      if (!card) return;

      const focusable = Array.from(
        card.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        )
      );

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      // Cycle rather than leave the dialog, which is what "traps focus" means.
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [authMode, closeModal]
  );

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  // Accent, radius, Colors, Typography, and Layout, sanitized by the shared
  // appearance block and scoped to this instance.
  const scopedVars =
    `[data-memberframe-auth="${MF_SCOPE_SLOT}"] { ` +
    mfAppearanceVars({
      accent: accentColor,
      radius: borderRadius,
      radiusMax: 24,
      shadowByDefault: true,
      colors,
      typography,
      layout,
      spacing,
    }) +
    " }";
  const styled = mfStyleScope("mfa", scopedVars);

  const busy = state.phase === "sending" || state.phase === "verifying";
  const remaining =
    state.phase === "code_sent" || state.phase === "verifying"
      ? secondsRemaining(state.resendAtMs, nowMs)
      : 0;

  const errorMessage = state.phase === "error" ? state.message : null;
  const awaitingCode = state.phase === "code_sent" || state.phase === "verifying";
  /** The code step is confirming a new account rather than signing in. */
  const confirmingEmail = awaitingCode && state.purpose === "verify";

  /* ---- FP-02 derived values ---- */

  /**
   * The password path is only reachable when there is an email field to type
   * into, because every one of its flows identifies the member by address.
   */
  const passwordPath = enablePasswordAuth && emailEnabled;

  /** Where a new password is being chosen, so where the meter belongs. */
  const choosingPassword = view === "password_signup" || view === "reset";

  // The site's password rules, set in MemberFrame, Settings, Membership. Asked
  // for only where a password is chosen, so sign in costs no request; until
  // then, the rules baked in when this file was written.
  useEffect(() => {
    if (onCanvas || !choosingPassword || policyLoaded.current) return;
    policyLoaded.current = true;
    void fetch(`${CONFIG.apiBaseUrl}${AUTH_CONFIG_PATH}`, { credentials: "omit", headers: apiHeaders(false) })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { passwordPolicy?: unknown } | null) => {
        if (body && body.passwordPolicy) setPolicy(readPasswordPolicy(body.passwordPolicy));
      })
      .catch(() => undefined);
  }, [onCanvas, choosingPassword]);

  const problems = choosingPassword
    ? passwordProblems(password, email, policy)
    : [];
  const rules = readPasswordPolicy(policy);
  const score = passwordScore(password);

  // Errors appear only after a submit attempt. Marking a field invalid while
  // someone is still typing the third character of an eight-character minimum
  // is noise, not help.
  const emailProblem = submitted && !looksLikeEmail(email);
  const passwordProblem = submitted && problems.length > 0;
  const emptyPasswordProblem = submitted && view === "password_signin" && password === "";
  const confirmProblem =
    view === "reset" && confirmPassword !== password && (submitted || (confirmPassword !== "" && confirmPassword.length >= password.length));

  /**
   * The creator's headline, except where it would be wrong.
   *
   * `headline` defaults to "Sign in to continue", which is the right thing to
   * say on the sign-in view and a confusing thing to say on a reset page the
   * visitor reached from an email. Those three views supply their own and leave
   * the creator's control governing the view it was written for.
   */
  // On a dedicated screen the headline control was written for that screen's
  // main view, so it governs there. Only the reset screen has a second view,
  // the new-password form an emailed link opens, and that keeps its own words.
  const primaryView: AuthView | null =
    screen === "login"
      ? "password_signin"
      : screen === "register"
        ? "password_signup"
        : screen === "reset"
          ? "forgot"
          : screen === "otp"
            ? "otp"
            : null;
  const creatorWords = view === primaryView;

  const viewHeadline = confirmingEmail
    ? t("verifyTitle")
    : creatorWords
    ? headline
    : view === "password_signup"
      ? t("signupTitle")
      : view === "forgot"
        ? t("forgotTitle")
        : view === "reset"
          ? t("resetTitle")
          : view === "password_signin" && primaryView !== null
            ? t("signInTitle")
            : headline;

  const viewWelcome = confirmingEmail
    ? unverifiedSignIn
      ? t("unverifiedNotice")
      : t("verifyText")
    : creatorWords
    ? welcomeMessage
    : view === "forgot"
      ? t("forgotText")
      : view === "reset"
        ? t("resetText")
        : welcomeMessage;

  /**
   * A link to another flow. In `<MemberAuth>` it switches the view in place;
   * on a dedicated screen it goes to that flow's page, or is not shown at all
   * when no usable page is configured.
   */
  /*
    A link to another flow. On Member Auth it switches the form in place. On a
    dedicated screen it goes to that flow's page; with `inline`, and no page
    set (or the page is this one), it switches in place instead, which is how
    Member Login moves between password and code in one card.
  */
  const flowLink = (label: string, toView: AuthView, toPath: string, onClick?: () => void, inline = false) => {
    const viaPage = dedicated && linkablePath(toPath, onCanvas);
    if (dedicated && !viaPage && !inline) return null;

    return (
      <button
        type="button"
        className="memberframe-auth-link"
        onClick={() => {
          onClick?.();
          if (viaPage) {
            if (!onCanvas) goTo(toPath);
          } else {
            setView(toView);
          }
        }}
      >
        {label}
      </button>
    );
  };

  /* ------------------------------------------------------------------------
     FP-02 form pieces
     ------------------------------------------------------------------------
     Built as values rather than inlined, because five views share the email
     field and three share the password field, and a copy per view is five
     places for the `autoComplete` attribute to be wrong in.
  */

  const emailField = (
    <>
      <label className="memberframe-auth-label" htmlFor={`${scope}-email`}>
        {t("emailLabel")}
      </label>
      <input
        id={`${scope}-email`}
        className={`memberframe-auth-input${emailProblem ? " is-invalid" : ""}`}
        type="email"
        autoComplete="email"
        placeholder={t("emailPlaceholder")}
        value={email}
        disabled={busy}
        aria-invalid={emailProblem || undefined}
        onChange={(event) => setEmail(event.currentTarget.value)}
      />
      {emailProblem ? (
        <p className="memberframe-auth-error">Enter a valid email address.</p>
      ) : null}
    </>
  );

  /**
   * The password row, with the show and hide toggle inside the field.
   *
   * `autoComplete` differs per view and that matters: `current-password` lets a
   * manager fill an existing secret, `new-password` lets it generate one. The
   * wrong value on a sign-up form makes a password manager offer the old
   * password for a new account.
   */
  const passwordField = (label: string, autoComplete: "current-password" | "new-password") => (
    <>
      <label className="memberframe-auth-label" htmlFor={`${scope}-password`}>
        {label}
      </label>
      <div className="memberframe-auth-secret">
        <input
          id={`${scope}-password`}
          className={`memberframe-auth-input${
            passwordProblem || emptyPasswordProblem ? " is-invalid" : ""
          }`}
          type={showPassword ? "text" : "password"}
          autoComplete={autoComplete}
          value={password}
          disabled={busy}
          aria-invalid={passwordProblem || emptyPasswordProblem || undefined}
          onChange={(event) => setPassword(event.currentTarget.value)}
        />
        <button
          type="button"
          className="memberframe-auth-peek"
          // The label says what the press will do, not what the state is. A
          // button reading "Hide" while the password is hidden is the usual bug.
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
          onClick={() => setShowPassword((current) => !current)}
        >
          {showPassword ? (
            <EyeOff stroke="currentColor" aria-hidden={true} />
          ) : (
            <Eye stroke="currentColor" aria-hidden={true} />
          )}
        </button>
      </div>

      {choosingPassword && password !== "" ? (
        <div className="memberframe-auth-meter">
          <div
            className="memberframe-auth-meter-track"
            role="img"
            aria-label={`Password strength: ${passwordScoreLabel(score)}`}
          >
            {[1, 2, 3, 4].map((segment) => (
              <span
                key={segment}
                className={`memberframe-auth-meter-seg${
                  score >= segment ? (score === 1 ? " is-weak" : " is-on") : ""
                }`}
              />
            ))}
          </div>
          <span className="memberframe-auth-meter-label">{passwordScoreLabel(score)}</span>
        </div>
      ) : null}

      {emptyPasswordProblem ? (
        <p className="memberframe-auth-error">Enter your password.</p>
      ) : null}

      {choosingPassword && !passwordProblem ? <p className="memberframe-auth-rules">{passwordRulesLine(rules)}</p> : null}

      {passwordProblem ? (
        <ul className="memberframe-auth-hints">
          {problems.map((problem) => (
            <li key={problem}>{passwordProblemMessage(problem, rules)}</li>
          ))}
        </ul>
      ) : null}
    </>
  );

  /**
   * `blocked` is separate from `busy` on purpose.
   *
   * A button disabled because nothing has been typed yet and a button disabled
   * because a request is in flight look identical and mean different things, and
   * collapsing them is how the OTP verify button loses its "six digits" guard.
   */
  const submitButton = (
    label: string,
    busyLabel: string,
    icon: React.ReactNode,
    onClick: () => void,
    blocked = false
  ) => (
    <button
      type="button"
      className="memberframe-auth-submit"
      disabled={busy || blocked}
      onClick={onClick}
    >
      {busy ? (
        <Loader2 className="memberframe-auth-spin" stroke="currentColor" aria-hidden={true} />
      ) : (
        icon
      )}
      <span>{busy ? busyLabel : label}</span>
    </button>
  );

  /**
   * Sign in and sign up as two tabs.
   *
   * Only shown on the two views it switches between. On forgot-password and on
   * the reset form a tab strip would offer to abandon a flow the visitor is
   * halfway through, so those views get a back link instead.
   */
  const authTabs =
    !dedicated && (view === "password_signin" || view === "password_signup") ? (
      <div className="memberframe-auth-tabs" role="tablist" aria-label="Sign in or sign up">
        <button
          type="button"
          role="tab"
          aria-selected={view === "password_signin"}
          className={`memberframe-auth-tab${view === "password_signin" ? " is-active" : ""}`}
          onClick={() => setView("password_signin")}
        >
          {t("signInTab")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "password_signup"}
          className={`memberframe-auth-tab${view === "password_signup" ? " is-active" : ""}`}
          onClick={() => setView("password_signup")}
        >
          {t("signUpTab")}
        </button>
      </div>
    ) : null;

  /** A row of flow links, or nothing when every link in it was hidden. */
  const linkRow = (...links: Array<React.ReactElement | null>) => {
    const shown = links.filter((link): link is React.ReactElement => link !== null);
    if (shown.length === 0) return null;

    return (
      <div className="memberframe-auth-links">
        {shown.map((link, index) => (
          <React.Fragment key={index}>{link}</React.Fragment>
        ))}
      </div>
    );
  };

  const emailBody = (() => {
    if (awaitingCode) {
      return (
        <>
          <label className="memberframe-auth-label" htmlFor={`${scope}-code`}>
            {t("codeLabel", { length: CODE_LENGTH, email: state.email })}
          </label>
          <input
            id={`${scope}-code`}
            className="memberframe-auth-input is-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            value={code}
            disabled={busy}
            aria-invalid={codeError !== null || undefined}
            onChange={(event) => {
              setCode(digitsOnly(event.currentTarget.value));
              setCodeError(null);
            }}
          />
          {codeError ? (
            <p className="memberframe-auth-error" role="alert">
              {codeError}
            </p>
          ) : null}
          {submitButton(
            confirmingEmail ? t("verifyButton") : t("verify"),
            t("checking"),
            <ArrowRight stroke="currentColor" aria-hidden={true} />,
            () => void verifyCode(),
            code.length !== CODE_LENGTH
          )}
          <button
            type="button"
            className="memberframe-auth-resend"
            disabled={remaining > 0 || busy}
            onClick={() => void sendCode(state.purpose ?? "signin", state.email)}
          >
            {remaining > 0 ? t("resendIn", { seconds: remaining }) : t("resend")}
          </button>
          {confirmingEmail ? (
            linkRow(
              <button type="button" className="memberframe-auth-link" disabled={busy} onClick={changeEmail}>
                {t("changeEmail")}
              </button>
            )
          ) : null}
        </>
      );
    }

    if (view === "reset") {
      return (
        <>
          {passwordField(t("newPasswordLabel"), "new-password")}
          <label className="memberframe-auth-label" htmlFor={`${scope}-confirm`}>
            {t("confirmPasswordLabel")}
          </label>
          <input
            id={`${scope}-confirm`}
            className={`memberframe-auth-input${confirmProblem ? " is-invalid" : ""}`}
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={confirmPassword}
            disabled={busy}
            aria-invalid={confirmProblem || undefined}
            aria-describedby={confirmProblem ? `${scope}-confirm-error` : undefined}
            onChange={(event) => setConfirmPassword(event.currentTarget.value)}
          />
          {confirmProblem ? (
            <p id={`${scope}-confirm-error`} className="memberframe-auth-error">
              {t("passwordsDiffer")}
            </p>
          ) : null}
          {submitButton(
            t("setPassword"),
            t("saving"),
            <ArrowRight stroke="currentColor" aria-hidden={true} />,
            completePasswordReset
          )}
        </>
      );
    }

    if (view === "forgot") {
      return (
        <>
          {emailField}
          {submitButton(
            t("sendReset"),
            t("sending"),
            <Mail stroke="currentColor" aria-hidden={true} />,
            requestPasswordReset
          )}
          {linkRow(flowLink(t("backLink"), "password_signin", loginPath))}
        </>
      );
    }

    if (view === "password_signup") {
      return (
        <>
          {emailField}
          <label className="memberframe-auth-label" htmlFor={`${scope}-name`}>
            {t("nameLabel")}
          </label>
          <input
            id={`${scope}-name`}
            className="memberframe-auth-input"
            type="text"
            autoComplete="name"
            value={name}
            disabled={busy}
            onChange={(event) => setName(event.currentTarget.value)}
          />
          {passwordField(t("passwordLabel"), "new-password")}
          {submitButton(
            t("createAccount"),
            t("creating"),
            <UserPlus stroke="currentColor" aria-hidden={true} />,
            register
          )}
          {/* The combined component has tabs for this; a dedicated page needs a way back. */}
          {dedicated
            ? linkRow(flowLink(t("haveAccountLink"), "password_signin", loginPath))
            : null}
        </>
      );
    }

    if (view === "password_signin") {
      return (
        <>
          {emailField}
          {passwordField(t("passwordLabel"), "current-password")}
          <label className="memberframe-auth-remember">
            <input
              type="checkbox"
              checked={rememberMe}
              disabled={busy}
              onChange={(event) => setRememberMe(event.currentTarget.checked)}
            />
            <span>{t("remember")}</span>
          </label>
          {submitButton(
            t("signIn"),
            t("signingIn"),
            <ArrowRight stroke="currentColor" aria-hidden={true} />,
            signInWithPassword
          )}
          {linkRow(
            flowLink(t("forgotLink"), "forgot", resetPath),
            flowLink(t("codeLink"), "otp", otpPath, undefined, screen === "login"),
            dedicated ? flowLink(t("createLink"), "password_signup", signupPath) : null
          )}
        </>
      );
    }

    // view === "otp"
    return (
      <>
        {emailField}
        {submitButton(
          t("sendCode"),
          t("sending"),
          <Mail stroke="currentColor" aria-hidden={true} />,
          () => void sendCode(),
          email.trim() === ""
        )}
        {screen === "login"
          ? enablePasswordAuth
            ? linkRow(
                flowLink(t("passwordLink"), "password_signin", "", undefined, true),
                flowLink(t("createLink"), "password_signup", signupPath)
              )
            : linkRow(flowLink(t("createLink"), "password_signup", signupPath))
          : passwordPath || dedicated
            ? linkRow(flowLink(t("passwordLink"), "password_signin", loginPath))
            : null}
      </>
    );
  })();

  const card = (
    <div className="memberframe-auth-card" ref={cardRef}>
      {isModal ? (
        <button type="button" className="memberframe-auth-close" aria-label="Close" onClick={closeModal}>
          <MfCloseMark />
        </button>
      ) : null}
      {state.phase === "signed_in" ? (
        <div className="memberframe-auth-done">
          <ShieldCheck stroke="currentColor" aria-hidden={true} />
          <h2 className="memberframe-auth-headline">{t("signedInTitle")}</h2>
          <p className="memberframe-auth-welcome">{t("signedInText")}</p>
        </div>
      ) : state.phase === "reset_requested" ? (
        /*
          FP-02 section 3.4 rule 3. This screen is identical whether or not the
          address has an account, and it says "if" rather than "we sent" for the
          same reason: a confident claim would tell an attacker the address is
          registered.
        */
        <div className="memberframe-auth-done">
          <MailCheck stroke="currentColor" aria-hidden={true} />
          <h2 className="memberframe-auth-headline">{t("inboxTitle")}</h2>
          <p className="memberframe-auth-welcome">
            {`If ${state.email} has an account, a reset link is on its way. The link works for 15 minutes.`}
          </p>
          {!dedicated || linkablePath(loginPath, onCanvas) ? (
            <button
              type="button"
              className="memberframe-auth-link"
              onClick={() => {
                if (dedicated) {
                  if (!onCanvas) goTo(loginPath);
                  return;
                }
                setState({ phase: "idle" });
                setView("password_signin");
              }}
            >
              <ArrowLeft stroke="currentColor" aria-hidden={true} />
              <span>{t("backLink")}</span>
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="memberframe-auth-head">
            <h2 className="memberframe-auth-headline">{viewHeadline}</h2>
            {viewWelcome ? <p className="memberframe-auth-welcome">{viewWelcome}</p> : null}
          </div>

          {emailEnabled && passwordPath && !awaitingCode ? authTabs : null}

          {notice && !awaitingCode ? (
            <p className="memberframe-auth-success" role="status">
              {notice}
            </p>
          ) : null}

          {emailEnabled ? (
            <div className="memberframe-auth-form">{emailBody}</div>
          ) : null}

          {errorMessage ? (
            <p className="memberframe-auth-error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          {/* Email first, then the providers (2026-10-20). */}
          {emailEnabled && providers.length > 0 && !awaitingCode ? (
            <div className="memberframe-auth-divider">
              <span>{t("divider")}</span>
            </div>
          ) : null}

          {providers.length > 0 && !awaitingCode ? (
            <div className="memberframe-auth-providers">
              {providers.map((provider) => (
                <button
                  key={provider}
                  type="button"
                  className={`memberframe-auth-provider is-${provider}`}
                  disabled={oauthBusy !== null || busy}
                  onClick={() => startOAuth(provider)}
                >
                  {oauthBusy === provider ? (
                    <Loader2 className="memberframe-auth-spin" stroke="currentColor" aria-hidden={true} />
                  ) : (
                    PROVIDER_MARKS[provider]
                  )}
                  <span>{t("continueWith", { provider: PROVIDER_LABELS[provider] })}</span>
                </button>
              ))}
            </div>
          ) : null}

          {!emailEnabled && providers.length === 0 ? (
            /*
              Every provider turned off. On the canvas this is a configuration
              the creator can fix, so say so. On a published page it would be a
              sign-in box with no way to sign in, which is worse than nothing.
            */
            <p className="memberframe-auth-note">
              No sign in method is enabled. Turn on email or a provider in the properties panel.
            </p>
          ) : null}

          {onCanvas ? (
            <p className="memberframe-auth-note">
              Preview only. Sign in runs on your published site.
            </p>
          ) : null}
        </>
      )}

    </div>
  );

  /*
    A popup kept in a menu would cover the header while it is designed, so Show
    On Canvas: No draws a chip in its place. Canvas only; the site is unchanged.
  */
  if (isModal && onCanvas && !modalCanvasPreview) {
    return (
      <div className={`memberframe-auth-root is-chip ${mfThemeClass(theme)}`} data-memberframe-auth={styled.scope}>
        <style>{mfThemeCss(".memberframe-auth-root")}</style>
        <style>{cssContent}</style>
        <style>{styled.css}</style>
        <span className="memberframe-auth-chip">
          {triggerId !== "" ? `Sign in popup, opens from #${triggerId}` : "Sign in popup"}
        </span>
        <MfLicenseLayer license={license} />
      </div>
    );
  }

  const root = (
    <div
      className={`memberframe-auth-root ${mfThemeClass(theme)}${authMode === "modal" ? " is-modal" : ""}${license === "trial" ? " has-mf-wm" : ""}`}
      onClick={
        isModal && !onCanvas
          ? (event) => {
              // A click on the dimmed backdrop, not inside the card, closes it.
              if (event.target === event.currentTarget) closeModal();
            }
          : undefined
      }
      data-memberframe-auth={styled.scope}
      role={authMode === "modal" ? "dialog" : undefined}
      aria-modal={authMode === "modal" ? true : undefined}
      aria-label={authMode === "modal" ? headline : undefined}
      onKeyDown={handleKeyDown}
    >
      <style>{mfThemeCss(".memberframe-auth-root")}</style>
      <style>{cssContent}</style>
      <style>{styled.css}</style>
      {card}

      <MfLicenseLayer license={license} />
    </div>
  );

  if (!isModal || onCanvas) return root;

  /*
    On a published page the popup renders into the page's body, so a menu with
    blur, a transform, or an appear effect cannot trap it in the header's box;
    its theme and scoped styles travel with it. In place stays only an empty
    anchor, which draws nothing until the trigger fires.
  */
  return (
    <>
      <span ref={anchorRef} className="memberframe-auth-anchor" aria-hidden={true} />
      {showCard && typeof document !== "undefined" ? createPortal(root, document.body) : null}
    </>
  );
}

// ============================================================================
// PROPERTY CONTROLS
// ============================================================================
// Ten rather than the five PRD section 9.2 lists. F05 requires that "a disabled
// provider does not render its button", and Framer has no multi-checkbox control
// type: an Enum picks one. Four booleans is the shape F05's own configuration
// flow describes, which is "enables or disables providers with checkboxes".

/** The reset and code screens show no provider buttons, so their toggles are hidden. */
const PROVIDERS_ALLOWED =
  CONFIG.screen === "all" || CONFIG.screen === "login" || CONFIG.screen === "register";

addPropertyControls(MemberAuth, mfControls({
  // The Builder's seal for this instance (27-instance-seal.md). Hidden: it is
  // set on insert and a pasted copy loses it.
  mfSeal: { type: ControlType.String, title: "Seal", hidden: () => true },
  authMode: {
    type: ControlType.Enum,
    title: "Display Mode",
    options: ["inline", "modal"],
    optionTitles: ["Inline On Page", "Modal Overlay"],
    defaultValue: CONFIG.authMode,
  },
  // Modal triggers (05-member-auth.md). Shown only for Modal Overlay.
  modalTrigger: {
    type: ControlType.Enum,
    title: "Opens",
    options: ["click", "load", "scroll"],
    optionTitles: ["On Click", "On Page Load", "On Scroll"],
    defaultValue: CONFIG.modalTrigger,
    hidden: (props) => props.authMode !== "modal",
  },
  modalTriggerId: {
    type: ControlType.String,
    title: "Trigger ID",
    placeholder: "sign-in",
    defaultValue: CONFIG.modalTriggerId,
    description: "Set a button's link to #sign-in, or name its layer sign-in. Clicking it opens this modal, whichever Opens you choose.",
    hidden: (props) => props.authMode !== "modal",
  },
  modalDelay: {
    type: ControlType.Number,
    title: "Delay",
    unit: "s",
    min: 0,
    max: 60,
    step: 0.5,
    displayStepper: true,
    defaultValue: CONFIG.modalDelay,
    hidden: (props) => props.authMode !== "modal" || props.modalTrigger !== "load",
  },
  modalScrollPercent: {
    type: ControlType.Number,
    title: "Scroll Depth",
    unit: "%",
    min: 0,
    max: 100,
    step: 5,
    defaultValue: CONFIG.modalScrollPercent,
    hidden: (props) => props.authMode !== "modal" || props.modalTrigger !== "scroll",
  },
  modalOncePerSession: {
    type: ControlType.Boolean,
    title: "Once Per Visit",
    defaultValue: CONFIG.modalOncePerSession,
    hidden: (props) => props.authMode !== "modal" || (props.modalTrigger !== "load" && props.modalTrigger !== "scroll"),
  },
  modalCanvasPreview: {
    type: ControlType.Boolean,
    title: "Show On Canvas",
    defaultValue: CONFIG.modalCanvasPreview,
    description: "No shows a small chip on the canvas instead of the card, for a popup kept in your menu. The live site is the same.",
    hidden: (props) => props.authMode !== "modal",
  },
  headline: {
    type: ControlType.String,
    title: "Headline",
    defaultValue: CONFIG.headline,
  },
  welcomeMessage: {
    type: ControlType.String,
    title: "Welcome Message",
    defaultValue: CONFIG.welcomeMessage,
  },
  emailEnabled: {
    type: ControlType.Boolean,
    title: "Email Sign In",
    hidden: () => CONFIG.screen !== "all",
    defaultValue: CONFIG.emailEnabled,
  },
  googleEnabled: {
    type: ControlType.Boolean,
    title: "Google",
    hidden: () => !PROVIDERS_ALLOWED,
    defaultValue: CONFIG.googleEnabled,
  },
  appleEnabled: {
    type: ControlType.Boolean,
    title: "Apple",
    hidden: () => !PROVIDERS_ALLOWED,
    defaultValue: CONFIG.appleEnabled,
  },
  githubEnabled: {
    type: ControlType.Boolean,
    title: "GitHub",
    hidden: () => !PROVIDERS_ALLOWED,
    defaultValue: CONFIG.githubEnabled,
  },
  discordEnabled: {
    type: ControlType.Boolean,
    title: "Discord",
    hidden: () => !PROVIDERS_ALLOWED,
    defaultValue: CONFIG.discordEnabled,
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
    max: 24,
    step: 1,
    unit: "px",
    defaultValue: CONFIG.borderRadius,
  },

  /* ---- Feature plan FP-02, bringing the count to thirteen ---- */

  enablePasswordAuth: {
    type: ControlType.Boolean,
    title: "Password Auth",
    hidden: () => CONFIG.screen !== "all" && CONFIG.screen !== "login",
    defaultValue: CONFIG.enablePasswordAuth,
  },
  defaultAuthMethod: {
    type: ControlType.Enum,
    title: "Default Method",
    options: ["password", "otp"],
    // PRD section 7.6 rule 4: never surface a raw enum value. `otp` in a
    // sidebar means nothing to a designer.
    optionTitles: ["Email & Password", "Passwordless Code"],
    defaultValue: CONFIG.defaultAuthMethod,
    hidden: (props) => (CONFIG.screen !== "all" && CONFIG.screen !== "login") || !props.enablePasswordAuth,
  },

  /* ---- Dedicated screens only: the pages their links go to ---- */

  loginPath: {
    type: ControlType.String,
    title: "Sign In Page",
    defaultValue: CONFIG.loginPath,
    hidden: () => CONFIG.screen === "all" || CONFIG.screen === "login",
  },
  signupPath: {
    type: ControlType.String,
    title: "Sign Up Page",
    defaultValue: CONFIG.signupPath,
    hidden: () => CONFIG.screen !== "login",
  },
  resetPath: {
    type: ControlType.String,
    title: "Reset Page",
    defaultValue: CONFIG.resetPath,
    hidden: () => CONFIG.screen !== "login",
  },
  otpPath: {
    type: ControlType.String,
    title: "Code Sign In Page",
    defaultValue: CONFIG.otpPath,
    hidden: () => CONFIG.screen !== "login",
  },

  /* ---- Shared appearance: Theme, Colors, Typography, Layout, then Labels ---- */

  ...mfAppearanceControls({ padding: 24, gap: 14, shadow: true }),
  labels: mfLabelControls(AUTH_LABELS),
}));
