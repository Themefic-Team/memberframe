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
 * ## Where the article is
 *
 * Nothing to set and no code override, on any page (2026-10-22): the paywall
 * locks the layer right above it in its stack, a CMS post body, a text block,
 * a stack, a grid, or a list. With nothing right above, it takes the nearest
 * shown text block above it with two or more paragraphs, down to the paywall
 * before it. So several paywalls on a page each protect their own layer. It
 * cuts and frosts that layer with CSS scoped to this instance, and shows its
 * own card.
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
  // @memberframe-dev-only-start
  if (base.indexOf(".ngrok") !== -1) headers["ngrok-skip-browser-warning"] = "1";
  // @memberframe-dev-only-end
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
.mf-lic { position: absolute; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center; padding: 12px; box-sizing: border-box; background: rgba(15, 16, 20, 0.28); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); border-radius: inherit; container-type: size; }
.mf-lic-card { display: flex; flex-direction: column; align-items: center; gap: 8px; max-width: 320px; padding: 18px 20px; border-radius: 14px; background: #121214; border: 1px dashed rgba(255, 255, 255, 0.25); color: #ffffff; text-align: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, Helvetica, Arial, sans-serif; box-shadow: 0 12px 32px -12px rgba(0, 0, 0, 0.5); }
.mf-lic-icon { width: 40px; height: 40px; border-radius: 50%; background: rgba(255, 255, 255, 0.1); display: flex; align-items: center; justify-content: center; }
.mf-lic-title { margin: 0; font-size: 14px; font-weight: 700; line-height: 1.3; }
.mf-lic-text { margin: 0; font-size: 12px; line-height: 1.5; color: #94a3b8; }
@container (max-height: 150px) { .mf-lic-card { flex-direction: row; padding: 8px 12px; gap: 8px; } .mf-lic-icon { width: 24px; height: 24px; } .mf-lic-icon svg { width: 14px; height: 14px; } .mf-lic-text { display: none; } .mf-lic-title { font-size: 12px; } }
@container (max-height: 64px) or (max-width: 140px) { .mf-lic { padding: 0; } .mf-lic-card { padding: 0; background: transparent; border: 0; box-shadow: none; } .mf-lic-title, .mf-lic-text { display: none; } .mf-lic-icon { width: 24px; height: 24px; background: rgba(18, 18, 20, 0.85); } .mf-lic-icon svg { width: 14px; height: 14px; } }
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
    <div className="mf-lic" role="note" aria-label={copy.title}>
      <div className="mf-lic-card">
        <span className="mf-lic-icon" aria-hidden={true}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#708AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="lock">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </span>
        <p className="mf-lic-title">{copy.title}</p>
        <p className="mf-lic-text">{copy.text.split("{host}").join(mfPageHost())}</p>
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

// @memberframe-schema-start
// ============================================================================
// SCHEMA.ORG PAYWALL MARKUP, PRD F08
// ============================================================================
// Held to its expected shape by `test/softPaywall.test.ts`. One script per page, added to the head on the
// published site only: the canvas is not a page Google reads.

const MF_GATED_BODY_CLASS = "memberframe-gated-body";
/** Added by the PaywallArticle override in MemberArticle.tsx. One per page. */
const MF_LINKED_ARTICLE_CLASS = "mf-paywall-article";
/** Marks the layer a paywall protects, with that paywall's id. */
const MF_ARTICLE_ATTR = "data-mf-paywall-article";
/** Marks a layer after a paywall set to hide what is below it, with that paywall's id. */
const MF_BELOW_ATTR = "data-mf-paywall-below";
const MF_SCHEMA_ID = "memberframe-paywall-schema";
const MF_SCHEMA_TYPES = ["Article", "NewsArticle", "BlogPosting", "CreativeWork", "WebPage"];

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

/** Shown on this viewport: Framer keeps hidden copies of a layer for other breakpoints. */
function mfShown(element: Element): boolean {
  return typeof element.getClientRects !== "function" || element.getClientRects().length > 0;
}

/** A Framer text block. */
const MF_TEXT_BLOCK = '[data-framer-component-type="RichTextContainer"]';

/** Markup beside layers, never a layer. */
function mfIsMarkup(element: Element): boolean {
  const tag = element.tagName;
  return tag === "STYLE" || tag === "SCRIPT" || tag === "LINK" || tag === "TEMPLATE";
}

/**
 * Framer's breakpoint wrapper (`.ssr-variant`) has no box of its own
 * (`display: contents`), so the browser reports no rectangles for it. It is
 * looked through, never taken for a copy hidden for another breakpoint.
 */
function mfBoxless(element: Element): boolean {
  return typeof window !== "undefined" && window.getComputedStyle(element).display === "contents";
}

/**
 * The layers directly in `parent`, as the Layers panel shows them: boxless
 * wrappers looked through, markup and copies hidden for another breakpoint
 * left out.
 */
function mfLayersIn(parent: Element): Element[] {
  const layers: Element[] = [];
  for (const child of Array.from(parent.children)) {
    if (mfIsMarkup(child)) continue;
    if (mfBoxless(child)) layers.push(...mfLayersIn(child));
    else if (mfShown(child)) layers.push(child);
  }
  return layers;
}

/** Two separate elements, neither inside the other. */
function mfApart(a: Element, b: Element): boolean {
  return a !== b && !a.contains(b) && !b.contains(a);
}

/**
 * The paywall's own place in its stack: the outermost of the wrappers Framer
 * puts round a component (its container, a breakpoint's variant). Never out
 * of a stack holding other layers.
 */
function ownSlot(root: Element): Element {
  let node = root;
  for (let depth = 0; depth < 8; depth += 1) {
    const parent = node.parentElement;
    if (!parent || parent === document.body) break;
    const from = node;
    if (mfLayersIn(parent).some((layer) => mfApart(layer, from))) break;
    node = parent;
  }
  return node;
}

/** The layers in the paywall's stack before it, nearest last. */
function layersBefore(slot: Element): Element[] {
  const parent = slot.parentElement;
  if (!parent) return [];
  return mfLayersIn(parent).filter(
    (layer) => mfApart(layer, slot) && Boolean(layer.compareDocumentPosition(slot) & Node.DOCUMENT_POSITION_FOLLOWING)
  );
}

/** Shorter than this, a layer is a "View all" row, a divider, or a button, not content to lock. */
const MF_MIN_LAYER_PX = 120;

/** Content worth locking: a text block of two or more paragraphs, or a layer of some height. */
function mfSubstantial(element: Element): boolean {
  if (element.matches(MF_TEXT_BLOCK) && element.querySelectorAll("p").length >= 2) return true;
  return element.getBoundingClientRect().height >= MF_MIN_LAYER_PX;
}

/**
 * The layer right above the paywall in its stack (21-blog-paywalls.md 9),
 * skipping copies hidden for another breakpoint and up to three small layers
 * such as a "View all" row (9.3). A paywall first in its stack takes nothing
 * from the section before it.
 */
function layerAbove(root: Element): HTMLElement | null {
  const before = layersBefore(ownSlot(root));
  let skipped = 0;
  for (let index = before.length - 1; index >= 0; index -= 1) {
    if (mfSubstantial(before[index]!)) return before[index] as HTMLElement;
    skipped += 1;
    if (skipped > 3) return null;
  }
  return null;
}

/** The small layers skipped between the protected layer and the paywall: hidden while it is locked. */
function layersBetween(layer: Element, root: Element): HTMLElement[] {
  const before = layersBefore(ownSlot(root));
  const at = before.indexOf(layer);
  return at === -1 ? [] : (before.slice(at + 1) as HTMLElement[]);
}

/** A footer: kept by Below Paywall: Hide. Framer publishes one as a `footer` element. */
const MF_FOOTER = 'footer, [data-framer-name*="footer" i]';

/**
 * What Below Paywall: Hide hides (21-blog-paywalls.md 9.3): everything on the
 * page after the paywall that starts at or below it, from its own stack up to
 * the page. A column beside it, a footer, and anything fixed or sticky (a
 * navigation bar, a badge) are kept. Copies hidden for another breakpoint are
 * included, so a breakpoint change never shows them.
 */
function layersBelow(root: Element): HTMLElement[] {
  const slot = ownSlot(root);
  const top = slot.getBoundingClientRect().top;
  const below: HTMLElement[] = [];
  const take = (element: Element) => {
    if (mfIsMarkup(element) || element.matches(MF_FOOTER)) return;
    // A breakpoint wrapper has no box to measure: decide for what is in it.
    if (mfBoxless(element)) {
      Array.from(element.children).forEach(take);
      return;
    }
    if (mfShown(element)) {
      const position = window.getComputedStyle(element).position;
      if (position === "fixed" || position === "sticky") return;
      if (element.getBoundingClientRect().top < top - 1) return;
    }
    // A wrapper round the footer: hide what is in it, keep the footer.
    if (element.querySelector(MF_FOOTER)) {
      Array.from(element.children).forEach(take);
      return;
    }
    below.push(element as HTMLElement);
  };
  let node: Element = slot;
  for (let depth = 0; depth < 16; depth += 1) {
    for (let next = node.nextElementSibling; next; next = next.nextElementSibling) take(next);
    const parent = node.parentElement;
    if (!parent || parent === document.body || parent.id === "main" || parent.hasAttribute("data-framer-root")) break;
    node = parent;
  }
  return below;
}

/**
 * A layer's parts: a text block's paragraphs, else the items of a stack,
 * grid, or list, looking through breakpoint wrappers and wrappers that hold a
 * single layer.
 */
function previewItems(layer: Element): Element[] {
  let box = layer;
  for (let depth = 0; depth < 6; depth += 1) {
    if (box.matches(MF_TEXT_BLOCK)) return Array.from(box.querySelectorAll("p"));
    const items = mfLayersIn(box);
    if (items.length !== 1) return items;
    box = items[0]!;
  }
  return [];
}

/**
 * What Free Preview counts in the protected layer. With too few parts to cut
 * after `wanted` of them, the last part is opened: a section of a heading and
 * a grid counts the heading, then the grid's cards.
 */
function previewUnits(layer: Element, wanted = 0): Element[] {
  let units = previewItems(layer);
  for (let depth = 0; depth < 4 && units.length > 0 && units.length <= wanted; depth += 1) {
    const inner = previewItems(units[units.length - 1]!);
    if (inner.length < 2) break;
    units = units.slice(0, -1).concat(inner);
  }
  return units;
}

// @memberframe-redact-start
/*
  Locked content out of the live page (2026-10-22). CSS alone keeps the words
  past the cut, and the layers hidden below, in the page, where unticking a
  style in the browser's tools shows them. So while the paywall is locked,
  their text is scrambled in place (letters and digits swapped, spaces and
  punctuation kept, so the frosted part still looks like text) and their
  images, videos, and frames lose their sources, alt text, and titles. The
  real values stay in this file's memory and come back on access.

  In place, never removed: the nodes are React's, which updates and removes
  them later; a node taken out makes that throw. And only once React has
  taken a node over, which it marks on the node: text changed before then is
  a hydration mismatch. The Route Shield does the same for section locks.
  The page's HTML source still has what Framer wrote there.
*/
const MF_REDACT_SKIP: Record<string, true> = { STYLE: true, SCRIPT: true, NOSCRIPT: true, TEMPLATE: true };
const MF_REDACT_ATTRS = ["src", "srcset", "poster", "alt", "title", "aria-label"];
const MF_BLANK_IMAGE = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const mfRedactions: WeakMap<Node, { real: string; fake: string } | Record<string, { real: string; fake: string }>> | null =
  typeof WeakMap === "function" ? new WeakMap() : null;

/** Letters and digits swapped for random ones; spaces and punctuation kept. */
function mfScramble(text: string): string {
  let out = "";
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code >= 65 && code <= 90) out += String.fromCharCode(65 + Math.floor(Math.random() * 26));
    else if (code >= 97 && code <= 122) out += String.fromCharCode(97 + Math.floor(Math.random() * 26));
    else if (code >= 48 && code <= 57) out += String.fromCharCode(48 + Math.floor(Math.random() * 10));
    else if (code > 127 && text.charAt(index).trim() !== "") out += "x";
    else out += text.charAt(index);
  }
  return out;
}

/** React has taken this element over: it marks its nodes with its own keys. */
function mfHydrated(element: Element): boolean {
  return Object.keys(element).some((key) => key.indexOf("__reactFiber$") === 0 || key.indexOf("__reactInternalInstance$") === 0);
}

function mfBlankFor(element: Element, name: string): string {
  if (name === "src" && element.nodeName === "IMG") return MF_BLANK_IMAGE;
  if (name === "src" && element.nodeName === "IFRAME") return "about:blank";
  return "";
}

/**
 * Scramble what `hide` says, restore the rest, through a layer's hydrated
 * nodes. Idempotent: a node already scrambled is left; new text React wrote
 * since is kept as the real value and scrambled again.
 */
function mfRedactTree(root: Node, hide: (node: Node) => boolean): void {
  const store = mfRedactions;
  if (!store) return;
  const visit = (node: Node) => {
    if (node.nodeType === 3) {
      const entry = store.get(node) as { real: string; fake: string } | undefined;
      const text = node.nodeValue ?? "";
      if (!hide(node)) {
        if (entry && text === entry.fake) node.nodeValue = entry.real;
        if (entry) store.delete(node);
        return;
      }
      if (text.trim() === "" || (entry && entry.fake === text)) return;
      const fake = mfScramble(text);
      store.set(node, { real: text, fake });
      node.nodeValue = fake;
      return;
    }
    if (node.nodeType !== 1) return;
    const element = node as Element;
    if (MF_REDACT_SKIP[element.nodeName] || !mfHydrated(element)) return;
    const saved = (store.get(element) as Record<string, { real: string; fake: string }> | undefined) ?? {};
    if (hide(element)) {
      for (const name of MF_REDACT_ATTRS) {
        const value = element.getAttribute(name);
        const blank = mfBlankFor(element, name);
        if (value === null || value === blank) continue;
        saved[name] = { real: value, fake: blank };
        element.setAttribute(name, blank);
      }
      if (Object.keys(saved).length > 0) store.set(element, saved);
    } else if (store.has(element)) {
      for (const name of Object.keys(saved)) {
        if (element.getAttribute(name) === saved[name]!.fake) element.setAttribute(name, saved[name]!.real);
      }
      store.delete(element);
    }
    for (let child = element.firstChild; child; child = child.nextSibling) visit(child);
  };
  visit(root);
}
// @memberframe-redact-end

/**
 * The layer this paywall protects, with no setting and no code override
 * (21-blog-paywalls.md 8 and 9). A layer with the old PaywallArticle override
 * comes first; then the layer right above it; then the nearest shown text
 * block above it with two or more paragraphs (a heading block has none). The
 * search stops at the paywall before it, and skips a layer another paywall has
 * marked, so several paywalls on one page each take their own. A copy of the
 * paywall hidden for another breakpoint takes nothing.
 */
function findArticle(root: Element | null, ownId: string): HTMLElement | null {
  if (typeof document === "undefined" || !root || !mfShown(root)) return null;
  const before = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  // The paywall before this one, in page order: the start of this one's range.
  const roots = Array.from(document.querySelectorAll(".mf-meter")).filter((other) => other !== root && before(other, root));
  const start = roots[roots.length - 1] ?? null;
  const inRange = (element: HTMLElement) =>
    before(element, root) && !element.contains(root) && (!start || (before(start, element) && !element.contains(start)));
  const free = (element: HTMLElement) => {
    const owner = element.getAttribute(MF_ARTICLE_ATTR);
    return owner === null || owner === "" || owner === ownId;
  };
  const usable = (element: HTMLElement) => mfShown(element) && inRange(element) && free(element);
  const tagged = Array.from(document.querySelectorAll<HTMLElement>(`.${MF_LINKED_ARTICLE_CLASS}`)).filter(usable);
  if (tagged.length > 0) return tagged[tagged.length - 1]!;
  const above = layerAbove(root);
  if (above && free(above) && !above.matches(".mf-meter") && !above.querySelector(".mf-meter")) return above;
  const blocks = Array.from(document.querySelectorAll<HTMLElement>(MF_TEXT_BLOCK)).filter(
    (element) => usable(element) && element.querySelectorAll("p").length >= 2
  );
  return blocks[blocks.length - 1] ?? null;
}

type TierKey = "free_member" | "tier_1" | "tier_2" | "vip" | (string & {});
type RequiredTier = "anyone" | "signed_in" | TierKey;
type MemberStatus = "active" | "trialing" | "past_due" | "canceled";
/** Who reads without a meter: any paid plan, any signed-in member, or a tier and up. */
type UnlimitedTier = "any_paid" | "signed_in" | "chosen" | TierKey;
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

// The generator writes the API address into CONFIG. No import.meta here: a
// Framer code file has no Vite env, and Framer reports the read as an error.
const ENV_API_BASE_URL = "";

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
  // "any_paid": any tier above the lowest one, which is Free.
  if (requiredTier === "any_paid") {
    const held = tiers.find((tier) => tier.key === session.activeTier);
    return held !== undefined && tiers.some((tier) => tier.rank < held.rank);
  }

  // "only:a,b": exactly these tiers, not "or higher". A key the site no
  // longer has matches nobody, so a deleted tier fails closed.
  if (requiredTier.startsWith("only:")) {
    return requiredTier
      .slice(5)
      .split(",")
      .some((key) => key === session.activeTier && tiers.some((tier) => tier.key === key));
  }

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
  // isEntitled knows "any_paid" and "only:a,b" (Chosen Tiers, built from Full Access Tiers).
  return isEntitled(session, unlimited, tiers);
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
  // @memberframe-dev-only-start
  // A free ngrok tunnel answers a browser with its warning page, not the API,
  // unless the request asks it not to. Only sent to an ngrok address.
  if (CONFIG.apiBaseUrl.indexOf(".ngrok") !== -1) headers["ngrok-skip-browser-warning"] = "1";
  // @memberframe-dev-only-end
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
  box-sizing: border-box;
  /* Its own block: the card's negative margin stays inside, never moves the root. */
  display: flow-root;
  position: relative;
  width: 100%;
  min-width: 240px;
  color: var(--mf-c-text);
  font-size: calc(14px * var(--mf-text-scale, 1));
  line-height: 1.5;
}
.mf-meter.is-linked { min-width: 0; }
/*
  The card is glass (2026-10-22): the surface colour at Card Opacity, what is
  behind it blurred by Card Blur and a little saturated, a light inner edge.
  On the site it rises over the frost at the bottom of the locked layer; on
  the canvas it sits where it is.
*/
.mf-meter-card {
  box-sizing: border-box; position: relative; z-index: 2;
  display: flex; flex-direction: column; align-items: center; gap: var(--mf-gap, 10px);
  max-width: 420px; margin: 0 auto; padding: var(--mf-pad, 24px);
  text-align: center; color: var(--mf-c-text);
  background: color-mix(in srgb, var(--mf-c-surface) var(--mf-card-alpha, 80%), transparent);
  -webkit-backdrop-filter: blur(var(--mf-card-blur, 16px)) saturate(160%); backdrop-filter: blur(var(--mf-card-blur, 16px)) saturate(160%);
  border: var(--mf-border-width, 1px) solid color-mix(in srgb, var(--mf-c-border) 70%, transparent);
  border-radius: var(--mf-c-radius);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--mf-c-surface) 60%, transparent), var(--mf-c-shadow);
}
.mf-meter:not(.is-canvas) .mf-meter-card { margin-top: var(--mf-card-shift, 0px); }
/*
  The frost band: blurs the locked content behind it, more towards the bottom,
  and fades it into the page's colour, so the cut has no hard edge.
*/
.mf-meter-frost {
  position: absolute; z-index: 1; pointer-events: none;
  top: var(--mf-frost-top, 0px); left: var(--mf-frost-left, 0px);
  width: var(--mf-frost-width, 100%); height: var(--mf-frost-height, 0px);
  -webkit-backdrop-filter: blur(var(--mf-frost-blur, 10px)); backdrop-filter: blur(var(--mf-frost-blur, 10px));
  background: linear-gradient(to bottom, transparent 0%,
    color-mix(in srgb, var(--mf-frost-color, #ffffff) 45%, transparent) 50%,
    color-mix(in srgb, var(--mf-frost-color, #ffffff) 92%, transparent) 88%, var(--mf-frost-color, #ffffff) 100%);
  -webkit-mask-image: linear-gradient(to bottom, transparent, #000 35%); mask-image: linear-gradient(to bottom, transparent, #000 35%);
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
  upgradeTitle: ["Upgrade title", "Upgrade to keep reading"],
  upgradeText: ["Upgrade text", "Your plan does not include this article."],
  signInLink: ["Sign in link", "Already a member? Sign in"],
};

/** The Read More Teaser's card, by default. Its words moved from Labels to Lock Title and Lock Message. */
const TEASER_TITLE = "Keep reading";
const TEASER_TEXT = "Join to unlock the rest of this article.";

/**
 * The teaser card's words: the sidebar's own, else what an older instance set
 * under Labels (teaserTitle, teaserText), else the default.
 */
function teaserWords(own: string | undefined, older: unknown, standard: string): string {
  if (typeof own === "string" && own.trim() !== "" && own !== standard) return own;
  if (typeof older === "string" && older.trim() !== "") return older;
  return standard;
}

/** The lock card's reason. */
type LockReason = "meter" | "teaser" | "upgrade";

type View =
  | { phase: "checking" }
  | { phase: "open"; meter: MeterAnswer | null }
  | { phase: "locked"; reason: LockReason; signedIn: boolean };

/*
  The sidebar keeps what a creator changes (2026-10-20, 21-blog-paywalls.md).
  Fixed instead of asked: the protected layer is the one right above the
  paywall (see findArticle); the article id is the page path; a 320px preview
  for a short layer; an 8px frost; the sign in link for signed-out visitors;
  the sign in and pricing pages from the site's settings; the SEO markup on.
  The canvas always shows the lock card, as visitors see it (2026-10-22).
*/
export interface MeteredPaywallProps extends MfAppearanceProps {
  mode?: PaywallMode;
  freeQuotaCount?: number;
  quotaPeriod?: QuotaPeriod;
  unlimitedTier?: UnlimitedTier;
  /** With Full Access For set to Chosen Tiers: exactly these tiers (19-section-locks.md 8). */
  fullAccessTiers?: ReadonlyArray<string>;
  previewParagraphs?: number;
  showCounterPill?: boolean;
  ctaLabel?: string;
  cardTitle?: string;
  cardDescription?: string;
  /** The Read More Teaser's card, shown as Lock Title and Lock Message in that mode. */
  teaserCardTitle?: string;
  teaserCardDescription?: string;
  /** Hide: while locked, everything below the paywall on the page is hidden too, but the footer. */
  belowPaywall?: "show" | "hide";
  /** The frost over the locked content, and the card's own glass (21-blog-paywalls.md 9.5). */
  glass?: { contentBlur?: number; cardBlur?: number; cardOpacity?: number } | null;
  accentColor?: string;
  borderRadius?: number;
}

/*
  The frosted edge (2026-10-22): this much of the next paragraph or item shows
  past the free ones, under a frost band up to MF_FROST_PX tall that blurs it
  and fades it into the page, and the card rises up to MF_OVERLAP_PX over it.
*/
const MF_PEEK_PX = 120;
const MF_FROST_PX = 260;
const MF_OVERLAP_PX = 96;

/** The colour the page shows behind a layer, for the frost to fade into. White when none is set. */
function mfBackdropColor(element: Element): string {
  let at: Element | null = element;
  while (at !== null) {
    const color = window.getComputedStyle(at).backgroundColor || "";
    const match = /^rgba?\(([\d.,\s/%]+)\)$/.exec(color);
    const parts = match ? match[1]!.split(/[\s,/]+/).filter(Boolean) : [];
    if (match && !(parts.length >= 4 && parseFloat(parts[3]!) === 0)) return color;
    at = at.parentElement;
  }
  return "rgb(255, 255, 255)";
}

/** The preview for a layer with no more paragraphs or items than Free Preview. */
const PREVIEW_FALLBACK_PX = 320;


function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden={true} data-lucide="x">
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
    mode = "metered",
    freeQuotaCount = CONFIG.freeQuotaCount,
    quotaPeriod = CONFIG.quotaPeriod,
    unlimitedTier: unlimitedChoice = "any_paid",
    fullAccessTiers,
    previewParagraphs = 2,
    showCounterPill = CONFIG.showCounterPill,
    ctaLabel = CONFIG.ctaLabel,
    cardTitle = CONFIG.cardTitle,
    cardDescription = CONFIG.cardDescription,
    teaserCardTitle,
    teaserCardDescription,
    belowPaywall = "show",
    glass,
    accentColor = CONFIG.accentColor,
    borderRadius = CONFIG.borderRadius,
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

  // Chosen Tiers: exactly the tiers picked, as "only:a,b"; none picked matches nobody.
  const unlimitedTier: UnlimitedTier =
    unlimitedChoice === "chosen"
      ? (`only:${(Array.isArray(fullAccessTiers) ? fullAccessTiers : []).filter((key) => typeof key === "string" && key !== "").join(",")}` as UnlimitedTier)
      : unlimitedChoice;
  const pricingPath = CONFIG.pricingPath;
  const loginPath = CONFIG.loginPath;
  const limit = Math.round(mfNumber(freeQuotaCount, 1, METER_MAX_QUOTA, 3));
  const period: QuotaPeriod = quotaPeriod === "weekly" ? "weekly" : "monthly";
  const periodWord = t(period === "weekly" ? "periodWeek" : "periodMonth");
  const slug = useMemo(() => articleSlug("", typeof window === "undefined" ? "/" : window.location.pathname), []);

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

  // On the canvas: the lock card, as visitors will see it, to style there.
  const effective: View = onCanvas ? { phase: "locked", reason: mode === "teaser" ? "teaser" : "meter", signedIn: false } : view;
  const cut = effective.phase !== "open";

  // ---- Where the preview ends: after N paragraphs, or at a fixed height ----
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [linkedArticle, setLinkedArticle] = useState<HTMLElement | null>(null);
  // Bumped when fonts or the page finish loading, so the cut is measured again.
  const [settled, setSettled] = useState(0);

  // This paywall's own id, made after mount so the server's HTML and the
  // first render agree. Its article carries it, and its CSS names only it, so
  // several paywalls on one page never cut each other's article.
  const [instanceId, setInstanceId] = useState("");
  // Only the first paywall on a page shows the meter's counter pill.
  const [leadsPage, setLeadsPage] = useState(true);

  // The article: see findArticle. Marked with an attribute React does not
  // manage, so a re-render never drops it. Again on resize: another breakpoint
  // shows other layers.
  useBrowserLayoutEffect(() => {
    if (onCanvas) {
      setLinkedArticle(null);
      return;
    }
    const id = `mfp${Math.random().toString(36).slice(2, 10)}`;
    setInstanceId(id);
    const pick = () => {
      setLinkedArticle(findArticle(rootRef.current, id));
      // A copy hidden for another breakpoint never leads.
      setLeadsPage(Array.from(document.querySelectorAll(".mf-meter")).find(mfShown) === rootRef.current);
    };
    pick();
    window.addEventListener("resize", pick);
    return () => window.removeEventListener("resize", pick);
  }, [onCanvas]);

  // The layer's own bottom margin, which the cut's margin is added to. Read
  // before the mark, while this paywall's CSS does not reach the layer yet.
  const [baseMargin, setBaseMargin] = useState(0);

  useBrowserLayoutEffect(() => {
    if (!linkedArticle || !instanceId) return;
    setBaseMargin(parseFloat(window.getComputedStyle(linkedArticle).marginBottom) || 0);
    linkedArticle.setAttribute(MF_ARTICLE_ATTR, instanceId);
    // The class the SEO markup points at, on a found article as on a tagged one.
    linkedArticle.classList.add(MF_GATED_BODY_CLASS);
    // Only its own mark: another paywall may have taken the layer since.
    return () => {
      if (linkedArticle.getAttribute(MF_ARTICLE_ATTR) === instanceId) linkedArticle.removeAttribute(MF_ARTICLE_ATTR);
    };
  }, [linkedArticle, instanceId]);

  // Hidden while it is not open: the small layers skipped between the locked
  // layer and the paywall, and with Below Paywall: Hide everything below it
  // on the page (21-blog-paywalls.md 9.3). They carry this paywall's id, and
  // its CSS hides them. Found again on resize, where the layout changes; the
  // old marks go first, so what was hidden is measured where it really is.
  const hideBelow = belowPaywall === "hide";
  useBrowserLayoutEffect(() => {
    const root = rootRef.current;
    if (onCanvas || !linkedArticle || !instanceId || !root) return;
    let marked: HTMLElement[] = [];
    const clear = () => {
      for (const layer of marked) if (layer.getAttribute(MF_BELOW_ATTR) === instanceId) layer.removeAttribute(MF_BELOW_ATTR);
      marked = [];
    };
    const mark = () => {
      clear();
      marked = layersBetween(linkedArticle, root).concat(hideBelow ? layersBelow(root) : []);
      for (const layer of marked) layer.setAttribute(MF_BELOW_ATTR, instanceId);
    };
    mark();
    window.addEventListener("resize", mark);
    return () => {
      window.removeEventListener("resize", mark);
      clear();
    };
  }, [onCanvas, hideBelow, linkedArticle, instanceId]);

  // ---- F08: the paywall markup, once a layer is protected ----
  // Article for a text block, as a post body is; WebPage for anything else.
  useEffect(() => {
    if (onCanvas || !linkedArticle) return;
    mfInjectPaywallSchema(linkedArticle.matches(MF_TEXT_BLOCK) ? "Article" : "WebPage");
  }, [onCanvas, linkedArticle]);

  // A late web font changes paragraph heights; measure once it is in.
  useEffect(() => {
    if (onCanvas || typeof window === "undefined") return;
    const bump = () => setSettled((value) => value + 1);
    const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
    if (fonts?.ready) void fonts.ready.then(bump);
    window.addEventListener("load", bump);
    return () => window.removeEventListener("load", bump);
  }, [onCanvas]);

  // So do images loading and a new breakpoint. The cut never changes the
  // layer's own size, so this cannot feed itself.
  useEffect(() => {
    if (!linkedArticle || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setSettled((value) => value + 1));
    observer.observe(linkedArticle);
    return () => observer.disconnect();
  }, [linkedArticle]);

  const [cutAt, setCutAt] = useState<number>(PREVIEW_FALLBACK_PX);
  // The layer's full height, laid out as designed.
  const [layerHeight, setLayerHeight] = useState(0);
  // How far down the layer the free part ends: below it, content is scrambled while locked.
  const [freeHeight, setFreeHeight] = useState(PREVIEW_FALLBACK_PX - MF_PEEK_PX);

  // Locked text is visible as a teaser but not reachable: `inert` keeps focus
  // and screen readers out of what the frost covers (F08), and the lock card
  // is the next thing they reach. Set on the node, which every React accepts.
  const locked = effective.phase === "locked";
  useBrowserLayoutEffect(() => {
    const body = linkedArticle;
    if (!body) return;
    if (locked) body.setAttribute("inert", "");
    else body.removeAttribute("inert");
  }, [locked, linkedArticle]);

  useBrowserLayoutEffect(() => {
    const body = linkedArticle;
    if (!cut || !body) {
      setCutAt(PREVIEW_FALLBACK_PX);
      return;
    }
    // Free Preview: paragraphs of a text block, items of anything else.
    // Measured on the layout as designed: the cut only hides, never resizes.
    const wanted = Math.round(mfNumber(previewParagraphs, 1, 20, 2));
    const box = body.getBoundingClientRect();
    setLayerHeight(Math.round(box.height));
    const units = previewUnits(body, wanted);
    if (units.length <= wanted) {
      setCutAt(PREVIEW_FALLBACK_PX);
      setFreeHeight(PREVIEW_FALLBACK_PX - MF_PEEK_PX);
      return;
    }
    const top = box.top;
    // The lowest of the free ones: grid items sit side by side.
    const bottom = Math.max(...units.slice(0, wanted).map((unit) => unit.getBoundingClientRect().bottom));
    setFreeHeight(Math.max(0, Math.round(bottom - top)));
    // A little of the next one shows under the frost, as a teaser should.
    setCutAt(Math.max(80, Math.round(bottom - top + MF_PEEK_PX)));
  }, [cut, previewParagraphs, linkedArticle, settled]);

  // ---- While locked, take the locked content out of the live page ----
  // Past the free part of the layer, and every layer hidden with it. Again
  // when React writes into them; restored on access, or when the paywall goes.
  useEffect(() => {
    const layer = linkedArticle;
    if (onCanvas || !layer || !instanceId || typeof window === "undefined") return;
    const hidden = () => Array.from(document.querySelectorAll(`[${MF_BELOW_ATTR}="${instanceId}"]`));
    const restoreAll = (extra: Element[] = []) => {
      mfRedactTree(layer, () => false);
      for (const element of extra.concat(hidden())) mfRedactTree(element, () => false);
    };
    if (!locked) {
      restoreAll();
      return;
    }
    let frame = 0;
    let lastHidden: Element[] = [];
    const pass = () => {
      frame = 0;
      const edge = layer.getBoundingClientRect().top + freeHeight;
      mfRedactTree(layer, (node) => {
        const element = node.nodeType === 3 ? node.parentElement : (node as Element);
        return Boolean(element && element !== layer && element.getBoundingClientRect().top >= edge);
      });
      const now = hidden();
      for (const element of lastHidden) if (now.indexOf(element) === -1) mfRedactTree(element, () => false);
      for (const element of now) mfRedactTree(element, () => true);
      lastHidden = now;
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(pass);
    };
    pass();
    const observer = typeof MutationObserver === "function" ? new MutationObserver(schedule) : null;
    const watch = { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: MF_REDACT_ATTRS };
    observer?.observe(layer, watch);
    for (const element of lastHidden) observer?.observe(element, watch);
    // Hydration finishes in parts after the page loads: look again as it goes.
    const timers = [800, 2000, 5000].map((delay) => window.setTimeout(schedule, delay));
    return () => {
      observer?.disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
      if (frame) window.cancelAnimationFrame(frame);
      restoreAll(lastHidden);
    };
  }, [onCanvas, locked, linkedArticle, instanceId, freeHeight, settled, hideBelow]);

  /*
    The frost band (2026-10-22): this component's own element, laid over the
    bottom of the locked layer, which blurs what is behind it and fades it
    into the page's colour, so the cut never shows a hard edge. Its own
    element, not a mask or ::after on the creator's layer, which Framer's own
    styles can override. Placed from the layer's and this root's boxes, so a
    stack's gap between them does not matter; measured after the cut is set.
  */
  const [frost, setFrost] = useState<{ edge: number; left: number; width: number; color: string } | null>(null);
  useBrowserLayoutEffect(() => {
    const root = rootRef.current;
    if (onCanvas || !cut || !linkedArticle || !root) {
      setFrost(null);
      return;
    }
    const layerBox = linkedArticle.getBoundingClientRect();
    const rootBox = root.getBoundingClientRect();
    const next = {
      edge: Math.round(layerBox.top + Math.min(cutAt, layerBox.height) - rootBox.top),
      left: Math.round(layerBox.left - rootBox.left),
      width: Math.round(layerBox.width),
      color: mfBackdropColor(linkedArticle),
    };
    setFrost((previous) =>
      previous && previous.edge === next.edge && previous.left === next.left && previous.width === next.width && previous.color === next.color
        ? previous
        : next
    );
  }, [onCanvas, cut, cutAt, layerHeight, linkedArticle, settled]);

  // Glass: the frost's blur, and the card's blur and opacity.
  const contentBlur = Math.round(mfNumber(glass?.contentBlur, 0, 30, CONFIG.blurIntensity));
  const cardBlur = Math.round(mfNumber(glass?.cardBlur, 0, 40, 16));
  const cardOpacity = Math.round(mfNumber(glass?.cardOpacity, 30, 100, 80));
  const frostHeight = Math.min(MF_FROST_PX, Math.round(cutAt * 0.75));
  const overlap = Math.min(MF_OVERLAP_PX, Math.round(cutAt * 0.4));
  const scopedCss =
    `[data-mf-meter="${MF_SCOPE_SLOT}"] { --mf-card-blur: ${cardBlur}px; --mf-card-alpha: ${cardOpacity}%; ` +
    (frost
      ? `--mf-frost-top: ${frost.edge - frostHeight}px; --mf-frost-left: ${frost.left}px; --mf-frost-width: ${frost.width}px; ` +
        `--mf-frost-height: ${frostHeight}px; --mf-frost-color: ${frost.color}; --mf-frost-blur: ${contentBlur}px; ` +
        `--mf-card-shift: ${frost.edge - overlap}px; `
      : "") +
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
  const styled = mfStyleScope("mfm", scopedCss);

  /*
    Not open: hide the protected layer below the preview. The layer keeps its
    designed size and layout (a max-height squeezed a Framer grid's rows): it
    is clipped, and a negative bottom margin, the hidden height, pulls what
    follows up to the cut. The frost band above covers the edge.
  */
  const target = `[${MF_ARTICLE_ATTR}="${instanceId}"]`;
  const hiddenPx = Math.max(0, layerHeight - cutAt);
  const linkedCss =
    !onCanvas && cut && instanceId
      ? `${target} { clip-path: inset(0 0 calc(100% - ${cutAt}px) 0) !important; margin-bottom: ${baseMargin - hiddenPx}px !important; }` +
        ` [${MF_BELOW_ATTR}="${instanceId}"] { display: none !important; }`
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
    const older = labels as Record<string, unknown> | null | undefined;
    const title =
      reason === "meter"
        ? mfFill(cardTitle, values)
        : reason === "upgrade"
          ? t("upgradeTitle")
          : teaserWords(teaserCardTitle, older?.teaserTitle, TEASER_TITLE);
    const text =
      reason === "meter"
        ? mfFill(cardDescription, values)
        : reason === "upgrade"
          ? t("upgradeText")
          : teaserWords(teaserCardDescription, older?.teaserText, TEASER_TEXT);
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
        {!signedIn ? (
          <button type="button" className="mf-meter-link" onClick={goSignIn}>
            {t("signInLink")}
          </button>
        ) : null}
      </div>
    );
  }

  function pill(meter: MeterAnswer) {
    if (!showCounterPill || pillClosed || meter.position === null || !leadsPage) return null;
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
    // On the canvas: only the card the visitor will see, so it can be designed
    // here with the sidebar's Theme, Colors, Typography, Layout, and Labels.
    if (onCanvas) return lockCard(mode === "teaser" ? "teaser" : "meter", false);
    // Nothing to protect on this page: nothing to lock, so no card under a page
    // anyone can read in full, and no pill counting it.
    if (!linkedArticle) return null;
    return (
      <React.Fragment>
        {cut && frost ? <div className="mf-meter-frost" aria-hidden={true} /> : null}
        {locked ? lockCard(effective.reason, effective.signedIn) : null}
        {effective.phase === "open" && effective.meter ? pill(effective.meter) : null}
      </React.Fragment>
    );
  }

  return (
    <div
      ref={rootRef}
      className={`mf-meter ${MF_THEME_CLASS}${onCanvas ? " is-canvas" : ""} is-linked`}
      data-mf-meter={styled.scope}
    >
      <style>{mfThemeCss(".mf-meter")}</style>
      <style>{cssContent}</style>
      <style>{styled.css}</style>
      {linkedCss ? <style>{linkedCss}</style> : null}
      {body()}
      <MfLicenseLayer license={license} />
    </div>
  );
}

// ============================================================================
// PROPERTY CONTROLS, PRD F07
// ============================================================================

addPropertyControls(MeteredPaywall, mfControls({
  // The Builder's seal for this instance (27-instance-seal.md). Hidden: it is
  // set on insert and a pasted copy loses it.
  mfSeal: { type: ControlType.String, title: "Seal", hidden: () => true },
  mode: {
    type: ControlType.Enum,
    title: "Paywall Type",
    options: ["metered", "teaser"],
    optionTitles: ["Free Articles Meter", "Read More Teaser"],
    defaultValue: "metered",
    description: "Locks the layer right above it, on any page. Meter: a few free pages, then locked. Teaser: the start is always free.",
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
    options: ["signed_in", "any_paid", "tier_1", "tier_2", "vip", "chosen"],
    optionTitles: ["Any signed-in member", "Any paid plan", "Silver members or higher", "Gold members or higher", "VIP members or higher", "Only chosen tiers…"],
    defaultValue: "any_paid",
    description: "Who reads every article in full. The same choices as page and section locks; Only chosen tiers means exactly the ones you pick.",
  },
  fullAccessTiers: {
    type: ControlType.Array,
    title: "Chosen Tiers",
    control: {
      type: ControlType.Enum,
      // The generator replaces these two lines with the site's tiers. Keep them on one line each.
      options: ["free_member", "tier_1", "tier_2", "vip"],
      optionTitles: ["Free Member", "Tier 1: Silver", "Tier 2: Gold", "VIP Member"],
    },
    defaultValue: [],
    hidden: (props) => props.unlimitedTier !== "chosen",
  },
  previewParagraphs: {
    type: ControlType.Number,
    title: "Free Preview",
    min: 1,
    max: 20,
    step: 1,
    displayStepper: true,
    defaultValue: 2,
    description: "Paragraphs of a text block, or items of a stack, grid, or list, shown before the frost.",
  },
  belowPaywall: {
    type: ControlType.Enum,
    title: "Below Paywall",
    options: ["show", "hide"],
    optionTitles: ["Show", "Hide"],
    displaySegmentedControl: true,
    defaultValue: "show",
    description: "Hide: visitors without access see nothing below the paywall on the page, except the footer.",
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
  // The same two, for the Read More Teaser's card.
  teaserCardTitle: {
    type: ControlType.String,
    title: "Lock Title",
    defaultValue: TEASER_TITLE,
    hidden: (props) => props.mode !== "teaser",
  },
  teaserCardDescription: {
    type: ControlType.String,
    title: "Lock Message",
    displayTextArea: true,
    defaultValue: TEASER_TEXT,
    hidden: (props) => props.mode !== "teaser",
  },
  ctaLabel: {
    type: ControlType.String,
    title: "Unlock Button",
    defaultValue: CONFIG.ctaLabel,
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
  glass: {
    type: ControlType.Object,
    title: "Glass",
    buttonTitle: "Blur",
    controls: {
      contentBlur: { type: ControlType.Number, title: "Content Blur", min: 0, max: 30, step: 1, unit: "px", defaultValue: 10 },
      cardBlur: { type: ControlType.Number, title: "Card Blur", min: 0, max: 40, step: 1, unit: "px", defaultValue: 16 },
      cardOpacity: { type: ControlType.Number, title: "Card Opacity", min: 30, max: 100, step: 1, unit: "%", defaultValue: 80 },
    },
  },
  ...mfAppearanceControls({ padding: 24, gap: 10, shadow: true }),
  labels: mfLabelControls(METER_LABELS),
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

function Lock({ className }: InlineIconProps): React.ReactElement {
  return (
    <svg className={iconClass("lock", className)} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden={true} data-lucide="lock">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
