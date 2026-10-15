/**
 * `<MemberAuth>`, passwordless sign-in. PRD task 2.5, feature F05.
 *
 * ## This file leaves the repository
 *
 * Second component after `<MemberGate>`, and everything in that file's header
 * applies here: it is written into the creator's Framer project and runs on
 * their published site, it may import only `react`, `framer`, and
 * `lucide-react`, all styling is one `cssContent` string, and the marked config
 * block is the only part the generator rewrites.
 *
 * ## Two things make this riskier than the gate
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
 *
 * It does not count verification attempts and it does not rate limit. F05's
 * three-attempt rule is a server rule, because the code is hashed at rest and
 * only the server can count tries against it. Rate limiting is F21, task 4.10.
 * The 60 second resend lock here is a courtesy, not a control.
 */

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
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
  requirePasswordStrength: boolean;
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
  requirePasswordStrength: true,
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

function notifySessionUpdated(signedIn = true): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("memberframe:session-updated", { detail: { signedIn } })
    );
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
function redirectAfterAuth(): void {
  const path = CONFIG.afterLoginPath || "/dashboard";

  if (path === "" || !path.startsWith("/")) return;
  if (path.startsWith("//") || path.includes("\\")) return;
  if (typeof window === "undefined") return;
  if (window.location.pathname === path) return;

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
  | { phase: "code_sent"; email: string; resendAtMs: number }
  | { phase: "verifying"; email: string; resendAtMs: number }
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

/** Why a password submit was refused by the server. FP-02 section 3.3. */
type PasswordFailure =
  | "invalid_credentials"
  | "account_locked"
  | "email_already_exists"
  | "weak_password"
  | "token_expired"
  | "invalid_token"
  | "unknown";

// ============================================================================
// PURE HELPERS
// ============================================================================

/**
 * Is this a colour, and nothing but a colour?
 *
 * The same whitelist the generator applies, repeated here because a prop can be
 * bound to a Framer variable at runtime, which the generator never sees. A
 * brace, a semicolon, or a comment opener has no place in a colour, so the
 * value is rejected rather than escaped.
 */
function safeColor(value: string, fallback: string): string {
  const colour = String(value ?? "").trim();

  if (colour === "" || colour.length > 32) return fallback;
  if (/^#[0-9a-fA-F]{3,8}$/.test(colour)) return colour;
  if (/^rgba?\(\s*[\d.%\s,/]+\)$/.test(colour)) return colour;
  if (/^hsla?\(\s*[\d.%\s,/deg]+\)$/.test(colour)) return colour;

  return fallback;
}

function clampRadius(value: number): number {
  if (!Number.isFinite(value)) return CONFIG.borderRadius;
  return Math.min(24, Math.max(0, Math.round(value)));
}

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
  | "contains_email"
  | "too_common";

type PasswordScore = 0 | 1 | 2 | 3 | 4;

function passwordProblems(
  password: string,
  email: string,
  requireStrength: boolean
): ReadonlyArray<PasswordProblem> {
  const problems: PasswordProblem[] = [];
  const value = String(password ?? "");

  if (value.length < PASSWORD_MIN_LENGTH) problems.push("too_short");
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

  if (requireStrength) {
    if (!/[a-zA-Z]/.test(value)) problems.push("needs_letter");
    if (!/[0-9]/.test(value)) problems.push("needs_number");
  }

  return problems;
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

function passwordProblemMessage(problem: PasswordProblem): string {
  switch (problem) {
    case "too_short":
      return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
    case "too_long":
      return `Keep it under ${PASSWORD_MAX_LENGTH} characters.`;
    case "needs_letter":
      return "Add at least one letter.";
    case "needs_number":
      return "Add at least one number.";
    case "contains_email":
      return "Do not use your email address in your password.";
    case "too_common":
      return "That password is too easy to guess. Pick another.";
  }
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
// Same constraint as the gate: `design-tokens.css` is the plugin panel's and
// does not exist on a published site, so the palette is declared on the
// component root and every rule reads it. The two creator-controlled values
// arrive as scoped custom properties, which is why there is no `style={{ }}`
// here even though two values are dynamic.

const cssContent = `
.memberframe-auth-root {
  --memberframe-auth-accent: #5271ff;
  --memberframe-auth-radius: 10px;
  --memberframe-auth-surface: #ffffff;
  --memberframe-auth-border: rgba(16, 24, 40, 0.12);
  --memberframe-auth-title: #18202b;
  --memberframe-auth-body: #5b6472;
  --memberframe-auth-field: #f4f5f7;
  --memberframe-auth-on-accent: #ffffff;
  --memberframe-auth-danger: #dc2626;
  --memberframe-auth-shadow: 0 12px 32px rgba(16, 24, 40, 0.14);

  box-sizing: border-box;
  width: 100%;
  font-family: var(--framer-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
}

@media (prefers-color-scheme: dark) {
  .memberframe-auth-root {
    --memberframe-auth-surface: #1b1f27;
    --memberframe-auth-border: rgba(255, 255, 255, 0.14);
    --memberframe-auth-title: #edf0f7;
    --memberframe-auth-body: #b7bfcd;
    --memberframe-auth-field: #23272f;
    --memberframe-auth-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  }
}

.memberframe-auth-root.is-modal {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 17, 23, 0.55);
}

.memberframe-auth-card {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  max-width: 360px;
  padding: 24px;
  border: 1px solid var(--memberframe-auth-border);
  border-radius: calc(var(--memberframe-auth-radius) + 4px);
  background: var(--memberframe-auth-surface);
  box-shadow: var(--memberframe-auth-shadow);
}

.memberframe-auth-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.memberframe-auth-headline {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--memberframe-auth-title);
}

.memberframe-auth-welcome {
  margin: 0;
  font-size: 13px;
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
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.1s ease;
}

.memberframe-auth-provider:hover {
  border-color: var(--memberframe-auth-accent);
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

.memberframe-auth-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
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
  font-size: 12px;
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
  font-size: 14px;
}

.memberframe-auth-input:focus-visible {
  outline: none;
  border-color: var(--memberframe-auth-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--memberframe-auth-accent) 25%, transparent);
}

.memberframe-auth-input.is-code {
  font-family: var(--framer-font-family-mono, ui-monospace, monospace);
  font-size: 20px;
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
  font-size: 11px;
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
  font-size: 11px;
  line-height: 1.45;
  color: var(--memberframe-auth-danger);
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
  font-size: 13px;
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
  font-size: 12px;
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
  font-size: 12px;
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
  font-size: 14px;
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
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.memberframe-auth-resend:disabled {
  color: var(--memberframe-auth-body);
  cursor: default;
}

.memberframe-auth-error {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--memberframe-auth-danger);
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
  font-size: 11px;
  line-height: 1.45;
  text-align: center;
  color: var(--memberframe-auth-body);
}

.memberframe-auth-prolock {
  box-sizing: border-box;
  position: absolute;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 17, 23, 0.72);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.memberframe-auth-watermark {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  align-self: center;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  text-decoration: none;
  color: var(--memberframe-auth-on-accent);
  background: rgba(15, 17, 23, 0.82);
}
`;

// ============================================================================
// PROVIDER MARKS
// ============================================================================
// Monochrome single-path marks using `fill="currentColor"`.
//
// A deviation worth naming. The icon standard says Lucide React or Framer SVG
// with `stroke="currentColor"`, and Lucide carries no brand marks: it removed
// them. A brand glyph is a filled shape rather than a line, so `fill` is the
// equivalent that keeps the rule's intent, which is that an icon inherits theme
// colour and is never an emoji or a raster.
//
// Each provider publishes brand guidelines governing how its mark may appear on
// a sign-in button. That review is a human task, recorded in
// `docs/development-docs/05-member-auth.md` section 7.

const PROVIDER_MARKS: Record<OAuthProvider, React.ReactNode> = {
  google: (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 11v3.2h5.3c-.2 1.4-1.6 4.1-5.3 4.1-3.2 0-5.8-2.6-5.8-5.9S8.8 6.5 12 6.5c1.8 0 3 .8 3.7 1.4l2.5-2.4C16.6 4 14.5 3 12 3 7 3 3 7 3 12s4 9 9 9c5.2 0 8.6-3.6 8.6-8.7 0-.6 0-1-.1-1.3H12z"
      />
    </svg>
  ),
  apple: (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M16.3 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.5-.2-2.9.9-3.7.9-.8 0-2-.8-3.2-.8-1.7 0-3.4 1.4-3.4 4 0 1.6.6 3.3 1.4 4.4.7 1 1.4 1.9 2.4 1.9.9 0 1.3-.6 2.5-.6s1.5.6 2.5.6c1 0 1.7-.9 2.4-1.9.5-.8.8-1.5 1-1.9-1.9-.7-2.1-2.5-2.1-3.3zM14.3 6c.6-.7 1-1.6.9-2.6-.9.1-1.9.6-2.5 1.3-.5.6-1 1.6-.9 2.5 1 .1 2-.5 2.5-1.2z"
      />
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 00-3.2 19.5c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.3-3.4-1.3-.4-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.4-2.2-.2-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1a9.4 9.4 0 015 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.8-4.6 5 .4.3.7 1 .7 2v2.9c0 .3.2.6.7.5A10 10 0 0012 2z"
      />
    </svg>
  ),
  discord: (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M19.3 5.6A16 16 0 0015.2 4.3l-.3.7a12 12 0 00-5.8 0l-.3-.7a16 16 0 00-4.1 1.3C2.2 9.3 1.5 12.9 1.9 16.4a16 16 0 004.8 2.4l.6-1a10 10 0 01-1.6-.8l.4-.3a11.4 11.4 0 009.8 0l.4.3c-.5.3-1 .6-1.6.8l.6 1a16 16 0 004.8-2.4c.5-4-.6-7.6-2.8-10.8zM8.7 14.3c-.9 0-1.7-.9-1.7-1.9s.8-1.9 1.7-1.9 1.7.9 1.7 1.9-.8 1.9-1.7 1.9zm6.6 0c-.9 0-1.7-.9-1.7-1.9s.8-1.9 1.7-1.9 1.7.9 1.7 1.9-.8 1.9-1.7 1.9z"
      />
    </svg>
  ),
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

export interface MemberAuthProps {
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
  requirePasswordStrength?: boolean;
  /** Dedicated screens only. See `AuthConfig`. */
  loginPath?: string;
  signupPath?: string;
  resetPath?: string;
  otpPath?: string;
  /** Modal mode only. Framer wires this to an interaction. */
  onClose?: () => void;
}

export default function MemberAuth(props: MemberAuthProps) {
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
    requirePasswordStrength = CONFIG.requirePasswordStrength,
    loginPath = CONFIG.loginPath,
    signupPath = CONFIG.signupPath,
    resetPath = CONFIG.resetPath,
    otpPath = CONFIG.otpPath,
    onClose,
  } = props;

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
  const enablePasswordAuth = dedicated ? screen !== "otp" : passwordControl;
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

  const onCanvas = useMemo(() => {
    const target = RenderTarget.current();
    return target === RenderTarget.canvas || target === RenderTarget.thumbnail;
  }, []);

  const [state, setState] = useState<AuthState>({ phase: "idle" });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [oauthBusy, setOauthBusy] = useState<OAuthProvider | null>(null);

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
    if (screen === "login") return "password_signin";
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
  const [name, setName] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const popupRef = useRef<Window | null>(null);
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
   * Clear the secret whenever the visitor moves.
   *
   * FP-02 section 3.4 rule 1. Leaving a typed password in state across a view
   * change means it survives in memory long after the form that collected it is
   * gone, and a stale value would be submitted by the next form that reads it.
   */
  useEffect(() => {
    setPassword("");
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

  const startOAuth = useCallback(
    (provider: OAuthProvider) => {
      if (onCanvas) return;

      setState({ phase: "idle" });
      setOauthBusy(provider);

      const siteQuery = CONFIG.siteKey ? `?siteKey=${encodeURIComponent(CONFIG.siteKey)}` : "";
      const url = `${CONFIG.apiBaseUrl}${OAUTH_PATH_PREFIX}${provider}${siteQuery}`;
      const popup = window.open(url, "memberframe-oauth", "width=480,height=640");

      if (!popup) {
        // F05: "OAuth popup blocked by the browser produces an actionable
        // inline error, not a silent failure."
        setOauthBusy(null);
        setState({
          phase: "error",
          message: "Your browser blocked the sign in window. Allow popups for this site, then try again.",
          retryable: true,
        });
        return;
      }

      popupRef.current = popup;
    },
    [onCanvas]
  );

  // --------------------------------------------------------------------------
  // Email code flow
  // --------------------------------------------------------------------------
  const sendCode = useCallback(async () => {
    if (onCanvas) return;

    if (!looksLikeEmail(email)) {
      setState({ phase: "error", message: "Enter a valid email address.", retryable: true });
      return;
    }

    setState({ phase: "sending" });

    try {
      const response = await fetch(`${CONFIG.apiBaseUrl}${SEND_OTP_PATH}`, {
        method: "POST",
        credentials: "include",
        headers: apiHeaders(true),
        body: JSON.stringify({ email: email.trim() }),
      });

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
      setState({ phase: "code_sent", email: email.trim(), resendAtMs: Date.now() + lock * 1000 });
    } catch {
      setState({
        phase: "error",
        message: "We could not reach the sign in service. Check your connection.",
        retryable: true,
      });
    }
  }, [email, onCanvas]);

  const verifyCode = useCallback(async () => {
    if (onCanvas) return;
    if (state.phase !== "code_sent") return;
    if (code.length !== CODE_LENGTH) return;

    const { email: pendingEmail, resendAtMs } = state;
    setState({ phase: "verifying", email: pendingEmail, resendAtMs });

    try {
      const response = await fetch(`${CONFIG.apiBaseUrl}${VERIFY_OTP_PATH}`, {
        method: "POST",
        // The session arrives as an HTTP-only cookie, per PRD section 14.1 S2.
        // This component never sees it, which is the point.
        credentials: "include",
        headers: apiHeaders(true),
        body: JSON.stringify({ email: pendingEmail, code }),
      });

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
  }, [code, onCanvas, state]);

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
      onOk: () => void,
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
        setShowPassword(false);

        if (response.ok) {
          onOk();
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

        const payload = (await response.json().catch(() => ({}))) as { reason?: PasswordFailure };
        const reason: PasswordFailure = payload.reason ?? "unknown";

        setState({
          phase: "error",
          message: passwordFailureMessage(reason),
          retryable: reason !== "account_locked",
        });
      } catch {
        setPassword("");
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
    if (onCanvas) return;

    void submitCredentials(
      SESSION_PATH,
      null,
      () => {
        setState({ phase: "signed_in" });
        notifySessionUpdated(true);
        redirectAfterAuth();
      },
      true
    );
  }, [onCanvas, submitCredentials]);

  const signInWithPassword = useCallback(() => {
    setSubmitted(true);

    if (!looksLikeEmail(email)) return;
    // Deliberately not validated against the policy. A member whose password
    // predates a rule change must still be able to sign in with it, and the
    // server is the only authority on whether it is correct.
    if (password === "") return;

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
    if (passwordProblems(password, email, requirePasswordStrength).length > 0) return;

    void submitCredentials(
      REGISTER_PATH,
      // `name` is optional per FP-02 section 2.1, so an empty box sends null
      // rather than an empty string the backend would have to special-case.
      { email: email.trim(), password, name: name.trim() === "" ? null : name.trim() },
      () => {
        setState({ phase: "signed_in" });
        notifySessionUpdated(true);
        redirectAfterAuth();
      }
    );
  }, [email, name, password, requirePasswordStrength, submitCredentials]);

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
    if (passwordProblems(password, email, requirePasswordStrength).length > 0) return;

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
  }, [email, password, requirePasswordStrength, resetToken, submitCredentials]);

  // --------------------------------------------------------------------------
  // Modal keyboard behaviour. F05 requires Escape and a focus trap.
  // --------------------------------------------------------------------------
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (authMode !== "modal") return;

      if (event.key === "Escape") {
        event.stopPropagation();
        onClose?.();
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
    [authMode, onClose]
  );

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  const accent = safeColor(accentColor, CONFIG.accentColor);
  const radius = clampRadius(borderRadius);
  const scopedVars =
    `[data-memberframe-auth="${scope}"] ` +
    `{ --memberframe-auth-accent: ${accent}; --memberframe-auth-radius: ${radius}px; }`;

  const busy = state.phase === "sending" || state.phase === "verifying";
  const remaining =
    state.phase === "code_sent" || state.phase === "verifying"
      ? secondsRemaining(state.resendAtMs, nowMs)
      : 0;

  const errorMessage = state.phase === "error" ? state.message : null;
  const awaitingCode = state.phase === "code_sent" || state.phase === "verifying";

  /* ---- FP-02 derived values ---- */

  /**
   * The password path is only reachable when there is an email field to type
   * into, because every one of its flows identifies the member by address.
   */
  const passwordPath = enablePasswordAuth && emailEnabled;

  /** Where a new password is being chosen, so where the meter belongs. */
  const choosingPassword = view === "password_signup" || view === "reset";

  const problems = choosingPassword
    ? passwordProblems(password, email, requirePasswordStrength)
    : [];
  const score = passwordScore(password);

  // Errors appear only after a submit attempt. Marking a field invalid while
  // someone is still typing the third character of an eight-character minimum
  // is noise, not help.
  const emailProblem = submitted && !looksLikeEmail(email);
  const passwordProblem = submitted && problems.length > 0;
  const emptyPasswordProblem = submitted && view === "password_signin" && password === "";

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

  const viewHeadline = creatorWords
    ? headline
    : view === "password_signup"
      ? "Create your account"
      : view === "forgot"
        ? "Reset your password"
        : view === "reset"
          ? "Choose a new password"
          : headline;

  const viewWelcome = creatorWords
    ? welcomeMessage
    : view === "forgot"
      ? "Enter your email and we will send you a reset link."
      : view === "reset"
        ? "Pick something you have not used on another site."
        : welcomeMessage;

  /**
   * A link to another flow. In `<MemberAuth>` it switches the view in place;
   * on a dedicated screen it goes to that flow's page, or is not shown at all
   * when no usable page is configured.
   */
  const flowLink = (label: string, toView: AuthView, toPath: string, onClick?: () => void) => {
    if (dedicated && !linkablePath(toPath, onCanvas)) return null;

    return (
      <button
        type="button"
        className="memberframe-auth-link"
        onClick={() => {
          onClick?.();
          if (dedicated) {
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
        Email address
      </label>
      <input
        id={`${scope}-email`}
        className={`memberframe-auth-input${emailProblem ? " is-invalid" : ""}`}
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
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

      {passwordProblem ? (
        <ul className="memberframe-auth-hints">
          {problems.map((problem) => (
            <li key={problem}>{passwordProblemMessage(problem)}</li>
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
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "password_signup"}
          className={`memberframe-auth-tab${view === "password_signup" ? " is-active" : ""}`}
          onClick={() => setView("password_signup")}
        >
          Sign up
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
            {`Enter the ${CODE_LENGTH} digit code sent to ${state.email}`}
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
            onChange={(event) => setCode(digitsOnly(event.currentTarget.value))}
          />
          {submitButton(
            "Verify code",
            "Checking",
            <ArrowRight stroke="currentColor" aria-hidden={true} />,
            () => void verifyCode(),
            code.length !== CODE_LENGTH
          )}
          <button
            type="button"
            className="memberframe-auth-resend"
            disabled={remaining > 0 || busy}
            onClick={() => void sendCode()}
          >
            {remaining > 0 ? `Resend in ${remaining}s` : "Resend code"}
          </button>
        </>
      );
    }

    if (view === "reset") {
      return (
        <>
          {passwordField("New password", "new-password")}
          {submitButton(
            "Set new password",
            "Saving",
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
            "Send reset link",
            "Sending",
            <Mail stroke="currentColor" aria-hidden={true} />,
            requestPasswordReset
          )}
          {linkRow(flowLink("Back to sign in", "password_signin", loginPath))}
        </>
      );
    }

    if (view === "password_signup") {
      return (
        <>
          {emailField}
          <label className="memberframe-auth-label" htmlFor={`${scope}-name`}>
            Name (optional)
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
          {passwordField("Password", "new-password")}
          {submitButton(
            "Create account",
            "Creating",
            <UserPlus stroke="currentColor" aria-hidden={true} />,
            register
          )}
          {/* The combined component has tabs for this; a dedicated page needs a way back. */}
          {dedicated
            ? linkRow(flowLink("Already have an account? Sign in", "password_signin", loginPath))
            : null}
        </>
      );
    }

    if (view === "password_signin") {
      return (
        <>
          {emailField}
          {passwordField("Password", "current-password")}
          <label className="memberframe-auth-remember">
            <input
              type="checkbox"
              checked={rememberMe}
              disabled={busy}
              onChange={(event) => setRememberMe(event.currentTarget.checked)}
            />
            <span>Remember me for 30 days</span>
          </label>
          {submitButton(
            "Sign in",
            "Signing in",
            <ArrowRight stroke="currentColor" aria-hidden={true} />,
            signInWithPassword
          )}
          {linkRow(
            flowLink("Forgot password?", "forgot", resetPath),
            flowLink("Email me a code instead", "otp", otpPath),
            dedicated ? flowLink("Create an account", "password_signup", signupPath) : null
          )}
        </>
      );
    }

    // view === "otp"
    return (
      <>
        {emailField}
        {submitButton(
          "Email me a code",
          "Sending",
          <Mail stroke="currentColor" aria-hidden={true} />,
          () => void sendCode(),
          email.trim() === ""
        )}
        {passwordPath || dedicated
          ? linkRow(flowLink("Use a password instead", "password_signin", loginPath))
          : null}
      </>
    );
  })();

  const card = (
    <div className="memberframe-auth-card" ref={cardRef}>
      {state.phase === "signed_in" ? (
        <div className="memberframe-auth-done">
          <ShieldCheck stroke="currentColor" aria-hidden={true} />
          <h2 className="memberframe-auth-headline">You Are Signed In</h2>
          <p className="memberframe-auth-welcome">
            Protected sections unlock the next time this page checks your membership.
          </p>
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
          <h2 className="memberframe-auth-headline">Check Your Inbox</h2>
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
              <span>Back to sign in</span>
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="memberframe-auth-head">
            <h2 className="memberframe-auth-headline">{viewHeadline}</h2>
            {viewWelcome ? <p className="memberframe-auth-welcome">{viewWelcome}</p> : null}
          </div>

          {providers.length > 0 ? (
            <div className="memberframe-auth-providers">
              {providers.map((provider) => (
                <button
                  key={provider}
                  type="button"
                  className="memberframe-auth-provider"
                  disabled={oauthBusy !== null || busy}
                  onClick={() => startOAuth(provider)}
                >
                  {oauthBusy === provider ? (
                    <Loader2 className="memberframe-auth-spin" stroke="currentColor" aria-hidden={true} />
                  ) : (
                    PROVIDER_MARKS[provider]
                  )}
                  <span>{`Continue with ${PROVIDER_LABELS[provider]}`}</span>
                </button>
              ))}
            </div>
          ) : null}

          {emailEnabled && providers.length > 0 ? (
            <div className="memberframe-auth-divider">
              <span>or</span>
            </div>
          ) : null}

          {emailEnabled && passwordPath && !awaitingCode ? authTabs : null}

          {emailEnabled ? (
            <div className="memberframe-auth-form">{emailBody}</div>
          ) : null}

          {errorMessage ? (
            <p className="memberframe-auth-error" role="alert">
              {errorMessage}
            </p>
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

      {IS_TRIAL && !IS_LOCKED ? (
        <a
          className="memberframe-auth-watermark"
          href="https://framefic.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          <ShieldCheck stroke="currentColor" aria-hidden={true} />
          <span>Trial Version</span>
        </a>
      ) : null}
    </div>
  );

  return (
    <div
      className={`memberframe-auth-root${authMode === "modal" ? " is-modal" : ""}`}
      data-memberframe-auth={scope}
      role={authMode === "modal" ? "dialog" : undefined}
      aria-modal={authMode === "modal" ? true : undefined}
      aria-label={authMode === "modal" ? headline : undefined}
      onKeyDown={handleKeyDown}
    >
      <style>{cssContent}</style>
      <style>{scopedVars}</style>
      {card}

      {IS_LOCKED ? (
        <div className="memberframe-auth-prolock">
          <div className="memberframe-auth-card">
            <h2 className="memberframe-auth-headline">Component Locked</h2>
            <p className="memberframe-auth-welcome">
              Open the MemberFrame plugin to activate your license or start a free trial.
            </p>
          </div>
        </div>
      ) : null}
    </div>
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

addPropertyControls(MemberAuth, {
  authMode: {
    type: ControlType.Enum,
    title: "Display Mode",
    options: ["inline", "modal"],
    optionTitles: ["Inline On Page", "Modal Overlay"],
    defaultValue: CONFIG.authMode,
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
    hidden: () => CONFIG.screen !== "all",
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
    hidden: (props) => CONFIG.screen !== "all" || !props.enablePasswordAuth,
  },
  requirePasswordStrength: {
    type: ControlType.Boolean,
    title: "Strong Password",
    defaultValue: CONFIG.requirePasswordStrength,
    hidden: (props) =>
      CONFIG.screen === "all" ? !props.enablePasswordAuth : CONFIG.screen !== "register" && CONFIG.screen !== "reset",
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
});
