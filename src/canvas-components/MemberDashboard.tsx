/**
 * `<MemberDashboard>`, the member's own account page. Feature plan FP-08,
 * PRD feature F06.
 *
 * ## This file leaves the repository
 *
 * Everything in `<MemberAuth>`'s header applies here. It is written into the creator's Framer project
 * and runs on their published site, so it may import only `react`, `framer`,
 * and `lucide-react`, all styling goes through one `cssContent` string, and the
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
 * ## What it deliberately does not do yet
 *
 * FP-08 specifies billing and invoice tabs. Both need the `subscriptions` and
 * `invoices` tables, which are backend PRD phase B3 and do not exist. So the
 * billing section renders an honest "not available yet" rather than an empty
 * table or, worse, plausible-looking zeroes. A member reading "$0.00 / Next
 * billing: never" would reasonably conclude their subscription had lapsed.
 */

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { addPropertyControls, ControlType, RenderTarget } from "framer";
import { CreditCard, LogOut, ShieldCheck, User } from "lucide-react";

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

const ENV_API_BASE_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_APP_BASE_URL)) ||
  "";

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
      out[key] = entry;
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

/*
 * The stylesheet, static. It used to be a function that interpolated the accent
 * and radius into the text, with its own hardcoded palette and font and a
 * prefers-color-scheme block that only touched the error colour. Now the
 * shared appearance block (mfThemeCss) resolves Theme plus the creator's
 * Colors, Typography, and Layout into --mf-c-* and --mf-*, and every rule
 * reads those, the same as the other three components.
 */
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
}
.mf-dash-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: var(--mf-gap, 20px);
}
.mf-dash-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  border-radius: 999px;
  background: var(--mf-c-accent);
  color: var(--mf-c-on-accent);
  font-weight: 600;
  font-size: calc(15px * var(--mf-text-scale, 1));
}
.mf-dash-avatar svg { width: 20px; height: 20px; stroke: currentColor; }
.mf-dash-title { margin: 0; font-size: calc(17px * var(--mf-text-scale, 1)); font-weight: 600; }
.mf-dash-sub { margin: 2px 0 0; font-size: calc(13px * var(--mf-text-scale, 1)); color: var(--mf-c-muted); word-break: break-all; }
.mf-dash-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--mf-c-border);
  font-size: calc(14px * var(--mf-text-scale, 1));
}
.mf-dash-row-label { color: var(--mf-c-muted); }
.mf-dash-row-value { font-weight: 500; text-align: right; }
.mf-dash-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--mf-c-accent);
  color: var(--mf-c-on-accent);
  font-size: calc(12px * var(--mf-text-scale, 1));
  font-weight: 600;
}
.mf-dash-note {
  margin: 16px 0 0;
  padding: 12px;
  border-radius: max(0px, calc(var(--mf-c-radius) - 4px));
  background: var(--mf-c-field);
  color: var(--mf-c-muted);
  font-size: calc(13px * var(--mf-text-scale, 1));
  line-height: 1.5;
}
.mf-dash-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  margin-top: var(--mf-gap, 20px);
  padding: 11px 16px;
  border: 1px solid var(--mf-c-border);
  border-radius: max(0px, calc(var(--mf-c-radius) - 4px));
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: calc(14px * var(--mf-text-scale, 1));
  font-weight: 500;
  cursor: pointer;
}
.mf-dash-button:hover:not(:disabled) { background: var(--mf-c-field); }
.mf-dash-button:disabled { opacity: 0.55; cursor: default; }
.mf-dash-button svg { width: 16px; height: 16px; stroke: currentColor; }
.mf-dash-button:focus-visible { outline: 2px solid var(--mf-c-accent); outline-offset: 2px; }
.mf-dash-button-primary {
  background: var(--mf-c-accent);
  border-color: var(--mf-c-accent);
  color: var(--mf-c-on-accent);
}
.mf-dash-button-primary:hover:not(:disabled) { background: var(--mf-c-accent); filter: brightness(1.07); }
.mf-dash-button-text { border-color: transparent; color: var(--mf-c-muted); }
.mf-dash-button-text:hover:not(:disabled) { background: transparent; color: var(--mf-c-text); }
.mf-dash-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  padding: 16px 0;
}
.mf-dash-state svg { width: 26px; height: 26px; stroke: currentColor; color: var(--mf-c-muted); }
.mf-dash-state p { margin: 0; font-size: calc(14px * var(--mf-text-scale, 1)); line-height: 1.5; color: var(--mf-c-muted); }
.mf-dash-profile {
  display: flex;
  flex-direction: column;
  gap: var(--mf-gap, 14px);
  margin-top: 4px;
  padding-top: 16px;
  border-top: 1px solid var(--mf-c-border);
}
.mf-dash-profile-title { margin: 0; font-size: calc(15px * var(--mf-text-scale, 1)); font-weight: 600; }
.mf-dash-field { display: flex; flex-direction: column; gap: 6px; }
.mf-dash-label { font-size: calc(13px * var(--mf-text-scale, 1)); font-weight: 500; }
.mf-dash-optional { margin-left: 6px; font-weight: 400; color: var(--mf-c-muted); }
.mf-dash-input {
  box-sizing: border-box;
  width: 100%;
  min-height: 40px;
  padding: 9px 12px;
  border: 1px solid var(--mf-c-border);
  border-radius: max(0px, calc(var(--mf-c-radius) - 4px));
  background: var(--mf-c-field);
  color: inherit;
  font: inherit;
  font-size: calc(14px * var(--mf-text-scale, 1));
}
textarea.mf-dash-input { min-height: 88px; resize: vertical; }
.mf-dash-input:focus-visible {
  outline: none;
  border-color: var(--mf-c-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--mf-c-accent) 25%, transparent);
}
.mf-dash-input.is-invalid { border-color: var(--mf-c-danger); }
.mf-dash-check { display: flex; align-items: flex-start; gap: 10px; font-size: calc(14px * var(--mf-text-scale, 1)); cursor: pointer; }
.mf-dash-check input { width: 18px; height: 18px; margin: 1px 0 0; accent-color: var(--mf-c-accent); }
.mf-dash-check input:focus-visible { outline: 2px solid var(--mf-c-accent); outline-offset: 2px; }
.mf-dash-error { margin: 0; font-size: calc(12px * var(--mf-text-scale, 1)); line-height: 1.4; color: var(--mf-c-danger); }
.mf-dash-saved { margin: 0; font-size: calc(13px * var(--mf-text-scale, 1)); color: var(--mf-c-muted); }
.mf-dash-billing { margin-top: var(--mf-gap, 20px); display: flex; flex-direction: column; gap: 10px; }
.mf-dash-billing-plan { display: flex; flex-direction: column; gap: 10px; }
.mf-dash-billing-plan .mf-dash-button { margin-top: 0; }
.mf-dash-history { display: flex; flex-direction: column; gap: 2px; margin-top: 6px; }
/* The subscription popup (2026-10-20). */
.mf-dash-modal {
  position: fixed; inset: 0; z-index: 2147483000; display: flex; align-items: center; justify-content: center;
  padding: 24px; background: var(--mf-c-backdrop, rgba(15, 18, 24, 0.55));
}
.mf-dash-modal-card {
  box-sizing: border-box; width: 100%; max-width: 460px; max-height: 100%; overflow-y: auto;
  display: flex; flex-direction: column; gap: 16px; padding: var(--mf-pad, 24px);
  color: var(--mf-c-text); background: var(--mf-c-surface); border: 1px solid var(--mf-c-border);
  border-radius: var(--mf-c-radius); box-shadow: 0 24px 48px -12px rgba(15, 18, 24, 0.35); text-align: left;
}
.mf-dash-modal-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.mf-dash-modal-head .mf-dash-profile-title { margin: 0; }
.mf-dash-modal-close {
  appearance: none; display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px;
  padding: 0; border: 0; border-radius: 8px; background: transparent; color: var(--mf-c-muted); cursor: pointer;
}
.mf-dash-modal-close:hover { background: var(--mf-c-field); color: var(--mf-c-text); }
.mf-dash-modal-close svg { width: 16px; height: 16px; stroke: currentColor; }
.mf-dash-modal-plan, .mf-dash-modal-section { display: flex; flex-direction: column; gap: 6px; }
.mf-dash-modal-section { padding-top: 12px; border-top: 1px solid var(--mf-c-border); }
.mf-dash-modal-actions { display: flex; flex-direction: column; gap: 8px; }
.mf-dash-modal-actions .mf-dash-button { margin-top: 0; }
.mf-dash-button.mf-dash-button-small { width: auto; margin-top: 0; padding: 6px 12px; flex-shrink: 0; }
.mf-dash-button-danger { color: var(--mf-c-danger); border-color: var(--mf-c-border); }
.mf-dash-button-danger:hover:not(:disabled) { border-color: var(--mf-c-danger); background: transparent; }
.mf-dash-button-danger.is-solid { color: #ffffff; background: var(--mf-c-danger); border-color: var(--mf-c-danger); }
.mf-dash-button-danger.is-solid:hover:not(:disabled) { background: var(--mf-c-danger); filter: brightness(1.06); }
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
  border-radius: max(0px, calc(var(--mf-c-radius) - 4px)); background: var(--mf-c-field);
  font-size: calc(12px * var(--mf-text-scale, 1));
}
.mf-dash-history-row .mf-dash-row-label { display: flex; flex-direction: column; gap: 2px; }
.mf-dash-link { color: var(--mf-c-accent); text-decoration: underline; }
`;

// ============================================================================
// COMPONENT
// ============================================================================

/** Set by the MemberFrame Builder on insert, never by hand (27-instance-seal.md). */
interface MfSealProps {
  mfSeal?: string;
}

/**
 * Fixed width, height from its content (2026-10-20): the page scrolls, not the
 * panel. A fixed height chosen in the sidebar still works, and scrolls inside.
 *
 * @framerIntrinsicWidth 480
 * @framerIntrinsicHeight 560
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-auto
 */
export default function MemberDashboard(
  props: Partial<DashboardConfig> & MfAppearanceProps & DashboardDisplayProps & MfSealProps
): React.ReactElement {
  const config: DashboardConfig = { ...CONFIG, ...props };
  const { theme = "light", colors, typography, layout, spacing, labels } = props;
  const { showAvatar = true, showEmail = true, showStatus = true, signOutStyle = "outline" } = props;
  const { showPaymentHistory = true, allowCancel = true } = props;
  const t = (key: string) => mfLabel(labels, DASH_LABELS, key);

  /** A CSS-safe per-instance scope, as in the other three components. */
  const rawId = useId();
  const scope = useMemo(() => `mfd${rawId.replace(/[^a-zA-Z0-9]/g, "")}`, [rawId]);

  const [state, setState] = useState<DashboardState>({ phase: "loading" });
  const [busy, setBusy] = useState(false);

  const [profile, setProfile] = useState<ProfileState>({ phase: "idle" });
  const [profileName, setProfileName] = useState("");
  const [profileValues, setProfileValues] = useState<MemberMetadata>({});
  const [profileProblems, setProfileProblems] = useState<Record<string, string>>({});
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const [billing, setBilling] = useState<BillingState>({ phase: "idle" });
  const [billingBusy, setBillingBusy] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  /** The subscription popup (2026-10-20): plan, change plan, every payment. */
  const [billingOpen, setBillingOpen] = useState(false);
  /** A plan picked to switch to: loading its numbers, then waiting for Confirm. */
  const [switchTo, setSwitchTo] = useState<{
    key: string;
    name: string;
    kind: "loading" | "change" | "downgrade" | "choose";
    summary?: { amountMinor: number; currency: string; creditMinor?: number; dueMinor?: number; creditFrom?: string | null; interval: string };
    effectiveAt?: string | null;
  } | null>(null);
  const [billingNotice, setBillingNotice] = useState<{ text: string; error: boolean } | null>(null);
  const billingRef = useRef<HTMLDivElement>(null);


  const license = useMfLicense(CONFIG.apiBaseUrl, CONFIG.siteKey, props.mfSeal);
  const onCanvas = RenderTarget.current() === RenderTarget.canvas;

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
          const next = JSON.stringify(tiers);
          if (next === shown) return;
          shown = next;
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
    setState({ phase: "signed_out" });
    syncShieldSession(false);

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("memberframe:session-updated", { detail: { signedIn: false } })
      );
    }

    if (safePath(config.afterLogoutPath)) navigate(config.afterLogoutPath);
  }, [config.afterLogoutPath, config.apiBaseUrl, onCanvas]);

  // ------------------------------------------------------------------------
  // Billing, FP-16
  // ------------------------------------------------------------------------

  // `signedInMemberId` is declared with the profile effects above.

  useEffect(() => {
    if (!config.showBilling || signedInMemberId === null) return;

    // A representative plan on the canvas, so the section can be designed.
    if (onCanvas) {
      setBilling({
        phase: "ready",
        summary: {
          subscription: {
            tierName: "Silver",
            interval: "month",
            status: "active",
            amountMinor: 900,
            currency: "USD",
            currentPeriodEnd: new Date(Date.now() + 18 * 86_400_000).toISOString(),
            gracePeriodEndsAt: null,
            cancelAtPeriodEnd: false,
            mode: "live",
            canCancel: true,
            canResume: false,
            canManage: true,
          },
          payments: [
            { id: "p1", amountMinor: 900, currency: "USD", status: "paid", receiptUrl: null, paidAt: new Date(Date.now() - 12 * 86_400_000).toISOString() },
          ],
          pricingPath: "/pricing",
        },
      });
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
  }, [config.apiBaseUrl, config.showBilling, onCanvas, signedInMemberId]);

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

  // The popup keeps the page still behind it and starts on its close button.
  useEffect(() => {
    if (!billingOpen || onCanvas || typeof document === "undefined") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    billingRef.current?.querySelector<HTMLElement>("button")?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, [billingOpen, onCanvas]);

  const closeBilling = useCallback(() => {
    setBillingOpen(false);
    setSwitchTo(null);
    setConfirmingCancel(false);
    setBillingNotice(null);
  }, []);

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
  const rootClass = `mf-dash ${mfThemeClass(theme)}`;
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
          <p>{config.signedOutMessage}</p>
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
  const initial = displayName.trim().charAt(0).toUpperCase() || "M";

  return (
    <div className={rootClass} data-mf-dash={styled.scope}>
      {style}

      <div className="mf-dash-head">
        {showAvatar ? <span className="mf-dash-avatar">{initial}</span> : null}
        <div>
          <p className="mf-dash-title">{config.headline}</p>
          <p className="mf-dash-sub">{displayName}</p>
        </div>
      </div>

      {showEmail ? (
        <div className="mf-dash-row">
          <span className="mf-dash-row-label">{t("emailRow")}</span>
          <span className="mf-dash-row-value">{member.email}</span>
        </div>
      ) : null}

      {config.showTier ? (
        <div className="mf-dash-row">
          <span className="mf-dash-row-label">{t("membershipRow")}</span>
          <span className="mf-dash-row-value">
            <span className="mf-dash-badge">{tierName(member.activeTier, tiers)}</span>
          </span>
        </div>
      ) : null}

      {showStatus ? (
        <div className="mf-dash-row">
          <span className="mf-dash-row-label">{t("statusRow")}</span>
          <span className="mf-dash-row-value">{statusLabel(member.status, labels)}</span>
        </div>
      ) : null}

      {config.showProfile && profile.phase !== "idle" ? (
        <form
          className="mf-dash-profile"
          noValidate
          aria-labelledby={`mf-dash-profile-${member.memberId}`}
          onSubmit={(event) => {
            event.preventDefault();
            void handleSaveProfile();
          }}
        >
          <p className="mf-dash-profile-title" id={`mf-dash-profile-${member.memberId}`}>
            {t("profileTitle")}
          </p>

          {profile.phase === "loading" ? (
            <p className="mf-dash-saved">{t("profileLoading")}</p>
          ) : profile.phase === "unavailable" ? (
            <p className="mf-dash-saved">{t("profileUnavailable")}</p>
          ) : (
            <>
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

              <button
                type="submit"
                className="mf-dash-button mf-dash-button-primary"
                disabled={profileSaving || onCanvas}
              >
                {profileSaving ? t("saving") : t("saveProfile")}
              </button>
            </>
          )}
        </form>
      ) : null}

      {config.showBilling && billing.phase !== "idle" ? (
        <section className="mf-dash-billing" aria-labelledby={`mf-dash-billing-${member.memberId}`}>
          <p className="mf-dash-profile-title" id={`mf-dash-billing-${member.memberId}`}>
            {t("billingTitle")}
          </p>

          {billing.phase === "loading" ? (
            <p className="mf-dash-saved">{t("profileLoading")}</p>
          ) : billing.phase === "failed" ? (
            <p className="mf-dash-saved">{t("billingFailed")}</p>
          ) : billing.summary.subscription === null ? (
            <div className="mf-dash-billing-plan">
              <p className="mf-dash-note">{t("noPlan")}</p>
              {safePath(billing.summary.pricingPath) ? (
                <button
                  type="button"
                  className="mf-dash-button mf-dash-button-primary"
                  onClick={() => navigate(billing.summary.pricingPath)}
                >
                  {t("seePlans")}
                </button>
              ) : null}
            </div>
          ) : (
            (() => {
              const plan = billing.summary.subscription;
              const pastDue = plan.status === "past_due";
              return (
                <div className="mf-dash-billing-plan">
                  <div className="mf-dash-row">
                    <span className="mf-dash-row-label">
                      {plan.tierName}
                      {plan.mode === "test" ? <span className="mf-dash-optional">{t("testPurchase")}</span> : null}
                    </span>
                    <span className="mf-dash-row-value">
                      {formatMoney(plan.amountMinor, plan.currency)}
                      {plan.interval === "month" ? " / month" : plan.interval === "year" ? " / year" : ""}
                    </span>
                  </div>

                  <p className={pastDue ? "mf-dash-error" : "mf-dash-saved"} role={pastDue ? "alert" : undefined}>
                    {pastDue
                      ? t("pastDue").split("{date}").join(formatDate(plan.gracePeriodEndsAt))
                      : plan.interval === "lifetime"
                        ? t("lifetime")
                        : plan.cancelAtPeriodEnd
                          ? t("endsOn").split("{date}").join(formatDate(plan.currentPeriodEnd))
                          : renewalOverdue(plan.currentPeriodEnd)
                            ? t("renewalPending")
                            : t("renewsOn").split("{date}").join(formatDate(plan.currentPeriodEnd))}
                  </p>

                  {/* A failed payment goes straight to the card update; everything
                      else opens the subscription popup. */}
                  {pastDue && plan.canManage ? (
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
                  <button
                    type="button"
                    className="mf-dash-button"
                    disabled={onCanvas}
                    onClick={() => setBillingOpen(true)}
                  >
                    <CreditCard aria-hidden={true} />
                    {t("manageBilling")}
                  </button>

                </div>
              );
            })()
          )}

          {billingOpen && billing.phase === "ready" && billing.summary.subscription ? (
            (() => {
              const plan = billing.summary.subscription;
              const summary = billing.summary;
              const currentRank = (summary.plans ?? []).find((option) => option.key === plan.tierKey)?.rank ?? -1;
              // Paid plans priced for this period, other than the current one.
              const period = plan.interval === "year" ? "year" : plan.interval === "lifetime" ? "lifetime" : "month";
              const others = (summary.plans ?? []).filter(
                (option) => option.rank > 0 && option.key !== plan.tierKey && option.prices[period] !== null
              );
              return (
                <div
                  className="mf-dash-modal"
                  onClick={(event) => {
                    if (event.target === event.currentTarget) closeBilling();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.stopPropagation();
                      closeBilling();
                    }
                  }}
                >
                  <div
                    className="mf-dash-modal-card"
                    ref={billingRef}
                    role="dialog"
                    aria-modal={true}
                    aria-labelledby={`mf-dash-sub-${member.memberId}`}
                  >
                    <div className="mf-dash-modal-head">
                      <p className="mf-dash-profile-title" id={`mf-dash-sub-${member.memberId}`}>
                        {t("subscriptionTitle")}
                      </p>
                      <button type="button" className="mf-dash-modal-close" aria-label={t("closeBilling")} onClick={closeBilling}>
                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" aria-hidden={true} data-lucide="x">
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                      </button>
                    </div>

                    <div className="mf-dash-modal-plan">
                      <div className="mf-dash-row">
                        <span className="mf-dash-row-label">
                          {plan.tierName}
                          {plan.mode === "test" ? <span className="mf-dash-optional">{t("testPurchase")}</span> : null}
                        </span>
                        <span className="mf-dash-row-value">
                          {formatMoney(plan.amountMinor, plan.currency)}
                          {plan.interval === "month" ? " / month" : plan.interval === "year" ? " / year" : ""}
                        </span>
                      </div>
                      {plan.gateway ? (
                        <p className="mf-dash-saved">{t("paidWith").split("{gateway}").join(gatewayName(plan.gateway))}</p>
                      ) : null}
                      {plan.scheduledTierName ? (
                        <div className="mf-dash-scheduled" role="status">
                          <span>
                            {t("changesTo").split("{tier}").join(plan.scheduledTierName).split("{date}").join(formatDate(plan.currentPeriodEnd))}
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
                      <p className="mf-dash-saved">
                        {plan.interval === "lifetime"
                          ? t("lifetime")
                          : plan.cancelAtPeriodEnd
                            ? t("endsOn").split("{date}").join(formatDate(plan.currentPeriodEnd))
                            : renewalOverdue(plan.currentPeriodEnd)
                            ? t("renewalPending")
                            : t("renewsOn").split("{date}").join(formatDate(plan.currentPeriodEnd))}
                      </p>
                      <div className="mf-dash-modal-actions">
                        {plan.canManage ? (
                          <button
                            type="button"
                            className="mf-dash-button"
                            disabled={billingBusy}
                            onClick={() => void billingAction("portal")}
                          >
                            <CreditCard aria-hidden={true} />
                            {t("updateMethod")}
                          </button>
                        ) : null}
                        {plan.canResume ? (
                          <button
                            type="button"
                            className="mf-dash-button mf-dash-button-primary"
                            disabled={billingBusy}
                            onClick={() => void billingAction("resume")}
                          >
                            {t("resumePlan")}
                          </button>
                        ) : null}
                        {allowCancel && plan.canCancel && !confirmingCancel ? (
                          <button
                            type="button"
                            className="mf-dash-button mf-dash-button-danger"
                            disabled={billingBusy}
                            onClick={() => setConfirmingCancel(true)}
                          >
                            {t("cancelPlan")}
                          </button>
                        ) : null}
                        {allowCancel && plan.canCancel && confirmingCancel ? (
                          // Cancel asks once, in place, with what it means.
                          <div className="mf-dash-confirm" role="group" aria-label={t("cancelPlan")}>
                            <p className="mf-dash-confirm-title">{t("cancelQuestion").split("{tier}").join(plan.tierName)}</p>
                            <p className="mf-dash-note">{t("cancelKeeps").split("{date}").join(formatDate(plan.currentPeriodEnd))}</p>
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
                      </div>
                    </div>

                    {billingNotice ? (
                      <p className={billingNotice.error ? "mf-dash-error" : "mf-dash-saved"} role={billingNotice.error ? "alert" : "status"}>
                        {billingNotice.text}
                      </p>
                    ) : null}

                    {others.length > 0 && plan.interval !== "lifetime" ? (
                      <div className="mf-dash-modal-section">
                        <p className="mf-dash-label">{t("changePlan")}</p>
                        {others.map((option) => {
                          const up = option.rank > currentRank;
                          return (
                            <div className="mf-dash-row" key={option.key}>
                              <span className="mf-dash-row-label">
                                {option.name}
                                <span className="mf-dash-optional">
                                  {formatMoney(option.prices[period] ?? 0, option.currency)}
                                  {period === "month" ? " / month" : " / year"}
                                </span>
                              </span>
                              <button
                                type="button"
                                className={`mf-dash-button mf-dash-button-small${up ? " mf-dash-button-primary" : ""}`}
                                disabled={billingBusy || switchTo?.kind === "loading" || Boolean(plan.scheduledTierName && !up)}
                                onClick={() => void previewChange(option.key, option.name, period)}
                              >
                                {up ? t("upgrade") : t("downgrade")}
                              </button>
                            </div>
                          );
                        })}

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
                                    <span className="mf-dash-muted">{t("creditLine").split("{plan}").join(switchTo.summary.creditFrom ?? plan.tierName)}</span>
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
                                onClick={() => void confirmChange(summary.pricingPath)}
                              >
                                {switchTo.kind === "downgrade" ? t("confirmDowngrade") : t("confirmUpgrade")}
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {showPaymentHistory && (summary.history?.plans.length ?? 0) > 0 ? (
                      <div className="mf-dash-modal-section">
                        <p className="mf-dash-label">{t("plansTitle")}</p>
                        {summary.history!.plans.map((entry, index) => (
                          <div className="mf-dash-row mf-dash-history-row" key={`plan-${index}`}>
                            <span className="mf-dash-row-label">
                              {entry.planName}
                              {entry.interval === "month" ? ", monthly" : entry.interval === "year" ? ", yearly" : ", lifetime"}
                              <span className="mf-dash-optional">
                                {[gatewayName(entry.gateway), formatDate(entry.startedAt), entry.mode === "test" ? t("testPurchase") : null]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </span>
                            <span className="mf-dash-row-value">{entry.status === "ended" ? t("planEnded") : t("planActive")}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {showPaymentHistory && (summary.history?.credits.length ?? 0) > 0 ? (
                      <div className="mf-dash-modal-section">
                        {summary.history!.credits.map((credit, index) => (
                          <div className="mf-dash-row mf-dash-history-row" key={`credit-${index}`}>
                            <span className="mf-dash-row-label">
                              {t("creditedLine")}
                              <span className="mf-dash-optional">
                                {[credit.planName, gatewayName(credit.gateway), formatDate(credit.at)].filter(Boolean).join(" · ")}
                              </span>
                            </span>
                            <span className="mf-dash-row-value">-{formatMoney(credit.amountMinor, credit.currency)}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {showPaymentHistory && summary.payments.length > 0 ? (
                      <div className="mf-dash-modal-section">
                        <p className="mf-dash-label">{t("history")}</p>
                        {summary.payments.map((payment) => (
                          <div className="mf-dash-row mf-dash-history-row" key={payment.id}>
                            <span className="mf-dash-row-label">
                              {formatDate(payment.paidAt)}
                              <span className="mf-dash-optional">
                                {[payment.planName, gatewayName(payment.gateway), payment.mode === "test" ? t("testPurchase") : null]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </span>
                            <span className="mf-dash-row-value">
                              {payment.status === "refunded" ? `${t("refunded")} ` : ""}
                              {payment.status === "credited" ? "-" : ""}
                              {formatMoney(payment.amountMinor, payment.currency)}
                              {payment.receiptUrl && /^https:\/\//.test(payment.receiptUrl) ? (
                                <>
                                  {" "}
                                  <a className="mf-dash-link" href={payment.receiptUrl} target="_blank" rel="noopener noreferrer">
                                    {t("receipt")}
                                  </a>
                                </>
                              ) : null}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })()
          ) : null}
        </section>
      ) : null}

      {config.showSignOut ? (
        <button
          type="button"
          className={
            signOutStyle === "filled"
              ? "mf-dash-button mf-dash-button-primary"
              : signOutStyle === "text"
                ? "mf-dash-button mf-dash-button-text"
                : "mf-dash-button"
          }
          disabled={busy}
          onClick={() => void handleSignOut()}
        >
          <LogOut aria-hidden={true} />
          {busy ? t("signingOut") : t("signOut")}
        </button>
      ) : null}
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

addPropertyControls(MemberDashboard, mfControls({
  // The Builder's seal for this instance (27-instance-seal.md). Hidden: it is
  // set on insert and a pasted copy loses it.
  mfSeal: { type: ControlType.String, title: "Seal", hidden: () => true },
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

  /* ---- What the panel shows ---- */

  showAvatar: {
    type: ControlType.Boolean,
    title: "Avatar",
    defaultValue: true,
  },
  showEmail: {
    type: ControlType.Boolean,
    title: "Email Row",
    defaultValue: true,
  },
  showTier: {
    type: ControlType.Boolean,
    title: "Membership Row",
    defaultValue: CONFIG.showTier,
  },
  showStatus: {
    type: ControlType.Boolean,
    title: "Status Row",
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

  /* ---- Shared appearance: Theme, Colors, Typography, Layout, then Labels ---- */

  ...mfAppearanceControls({ padding: 24, gap: 20, shadow: false }),
  labels: mfLabelControls(DASH_LABELS),
}));

