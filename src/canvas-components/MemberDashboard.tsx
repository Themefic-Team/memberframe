/**
 * `<MemberDashboard>`, the member's own account page. Feature plan FP-08,
 * PRD feature F06.
 *
 * ## This file leaves the repository
 *
 * Third component after `<MemberGate>` and `<MemberAuth>`, and everything in
 * their headers applies here. It is written into the creator's Framer project
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
 * told a visitor whether they were signed in. `<MemberGate>` shows locked or
 * unlocked content, which says something about the content and nothing about
 * the person: a visitor seeing a locked panel cannot tell whether they are
 * signed out, signed in at the wrong tier, or looking at a broken page. This
 * component names the state in words, every time, in all five cases.
 *
 * ## What it deliberately does not do yet
 *
 * FP-08 specifies billing and invoice tabs. Both need the `subscriptions` and
 * `invoices` tables, which are backend PRD phase B3 and do not exist. So the
 * billing section renders an honest "not available yet" rather than an empty
 * table or, worse, plausible-looking zeroes. A member reading "$0.00 / Next
 * billing: never" would reasonably conclude their subscription had lapsed.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { addPropertyControls, ControlType, RenderTarget } from "framer";
import { LogOut, ShieldCheck, User } from "lucide-react";

// ============================================================================
// LICENSING AND TRIAL STATE
// ============================================================================
// Rewritten in place by F19's `enforceLockState` regex patcher, so the four
// lines below must keep this exact shape. PRD section 9.3 requirement 3.
const IS_LOCKED = false;
const IS_TRIAL = false;
// @plugin-lock-state: unlocked
// @plugin-trial-state: paid

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
function statusLabel(status: MemberStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "trialing":
      return "In trial";
    case "past_due":
      return "Payment failed";
    case "canceled":
      return "Canceled";
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

  return headers;
}

/**
 * A CSS colour the creator picked, made safe to put in a style block.
 *
 * `ControlType.Color` hands back a string the creator controls, and it is
 * interpolated into a `<style>` element, which makes it an injection surface:
 * a value containing `}` could close the rule and open another. Only the forms
 * a colour picker actually produces are allowed through, and anything else
 * falls back to the brand colour.
 */
function safeColor(value: string, fallback: string): string {
  const trimmed = String(value ?? "").trim();

  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed;
  if (/^rgba?\(\s*[\d.\s,%/]+\)$/.test(trimmed)) return trimmed;
  if (/^hsla?\(\s*[\d.\s,%/degrad]+\)$/.test(trimmed)) return trimmed;

  return fallback;
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
}

function ProfileControl({ id, field, value, error, disabled, onChange }: ProfileControlProps): React.ReactElement {
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
        <option value="">Choose one</option>
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
        {field.required ? null : <span className="mf-dash-optional">Optional</span>}
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

function cssContent(accent: string, radius: number): string {
  return `
.mf-dash {
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #16181d;
  background: #ffffff;
  border: 1px solid rgba(22, 24, 29, 0.1);
  border-radius: ${radius}px;
  padding: 24px;
  max-width: 560px;
  width: 100%;
  box-sizing: border-box;
}
@media (prefers-color-scheme: dark) {
  .mf-dash {
    color: #f4f5f7;
    background: #16181d;
    border-color: rgba(244, 245, 247, 0.12);
  }
}
.mf-dash-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}
.mf-dash-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  border-radius: 999px;
  background: ${accent};
  color: #ffffff;
  font-weight: 600;
  font-size: 15px;
}
.mf-dash-avatar svg { width: 20px; height: 20px; stroke: currentColor; }
.mf-dash-title { margin: 0; font-size: 17px; font-weight: 600; }
.mf-dash-sub { margin: 2px 0 0; font-size: 13px; opacity: 0.7; word-break: break-all; }
.mf-dash-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid rgba(128, 128, 128, 0.18);
  font-size: 14px;
}
.mf-dash-row-label { opacity: 0.7; }
.mf-dash-row-value { font-weight: 500; text-align: right; }
.mf-dash-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  background: ${accent};
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
}
.mf-dash-note {
  margin: 16px 0 0;
  padding: 12px;
  border-radius: ${Math.max(0, radius - 4)}px;
  background: rgba(128, 128, 128, 0.1);
  font-size: 13px;
  line-height: 1.5;
  opacity: 0.85;
}
.mf-dash-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  margin-top: 20px;
  padding: 11px 16px;
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: ${Math.max(0, radius - 4)}px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}
.mf-dash-button:hover:not(:disabled) { background: rgba(128, 128, 128, 0.12); }
.mf-dash-button:disabled { opacity: 0.55; cursor: default; }
.mf-dash-button svg { width: 16px; height: 16px; stroke: currentColor; }
.mf-dash-button-primary {
  background: ${accent};
  border-color: ${accent};
  color: #ffffff;
}
.mf-dash-button-primary:hover:not(:disabled) { filter: brightness(1.07); }
.mf-dash-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  padding: 16px 0;
}
.mf-dash-state svg { width: 26px; height: 26px; stroke: currentColor; opacity: 0.6; }
.mf-dash-state p { margin: 0; font-size: 14px; line-height: 1.5; opacity: 0.8; }
.mf-dash-profile {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 4px;
  padding-top: 16px;
  border-top: 1px solid rgba(128, 128, 128, 0.18);
}
.mf-dash-profile-title { margin: 0; font-size: 15px; font-weight: 600; }
.mf-dash-field { display: flex; flex-direction: column; gap: 6px; }
.mf-dash-label { font-size: 13px; font-weight: 500; }
.mf-dash-optional { margin-left: 6px; font-weight: 400; opacity: 0.65; }
.mf-dash-input {
  box-sizing: border-box;
  width: 100%;
  min-height: 40px;
  padding: 9px 12px;
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: ${Math.max(0, radius - 4)}px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 14px;
}
textarea.mf-dash-input { min-height: 88px; resize: vertical; }
.mf-dash-input:focus-visible {
  outline: none;
  border-color: ${accent};
  box-shadow: 0 0 0 3px color-mix(in srgb, ${accent} 25%, transparent);
}
.mf-dash-input.is-invalid { border-color: #dc2626; }
.mf-dash-check { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; cursor: pointer; }
.mf-dash-check input { width: 18px; height: 18px; margin: 1px 0 0; accent-color: ${accent}; }
.mf-dash-check input:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px; }
.mf-dash-error { margin: 0; font-size: 12px; line-height: 1.4; color: #dc2626; }
.mf-dash-saved { margin: 0; font-size: 13px; opacity: 0.8; }
.mf-dash-button:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px; }
@media (prefers-color-scheme: dark) {
  .mf-dash-input.is-invalid { border-color: #f87171; }
  .mf-dash-error { color: #f87171; }
}
`.trim();
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * @framerIntrinsicWidth 480
 * @framerIntrinsicHeight 360
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight auto
 */
export default function MemberDashboard(props: Partial<DashboardConfig>): React.ReactElement {
  const config: DashboardConfig = { ...CONFIG, ...props };

  const [state, setState] = useState<DashboardState>({ phase: "loading" });
  const [busy, setBusy] = useState(false);

  const [profile, setProfile] = useState<ProfileState>({ phase: "idle" });
  const [profileName, setProfileName] = useState("");
  const [profileValues, setProfileValues] = useState<MemberMetadata>({});
  const [profileProblems, setProfileProblems] = useState<Record<string, string>>({});
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [profileReload, setProfileReload] = useState(0);

  const accent = useMemo(() => safeColor(config.accentColor, "#5271ff"), [config.accentColor]);
  const radius = useMemo(
    () => Math.max(0, Math.min(32, Number(config.borderRadius) || 0)),
    [config.borderRadius]
  );

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
      return;
    }

    let active = true;
    const base = (config.apiBaseUrl || ENV_API_BASE_URL || "http://127.0.0.1:4001").replace(/\/+$/, "");

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
      return;
    }

    let active = true;
    const base = (config.apiBaseUrl || ENV_API_BASE_URL || "http://127.0.0.1:4001").replace(/\/+$/, "");

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
  }, [config.apiBaseUrl, config.showProfile, onCanvas, profileReload, signedInMemberId, signedInName]);

  // `<OnboardingModal>` on the same page announces a save. Reloading here keeps
  // the two from showing a member different answers side by side.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reload = () => setProfileReload((count) => count + 1);
    window.addEventListener("memberframe:profile-updated", reload);
    return () => window.removeEventListener("memberframe:profile-updated", reload);
  }, []);

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
      const base = (config.apiBaseUrl || ENV_API_BASE_URL || "http://127.0.0.1:4001").replace(/\/+$/, "");
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
      setProfileNotice({ ok: true, text: "Profile saved." });

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
  }, [config.apiBaseUrl, onCanvas, profile, profileName, profileValues]);

  // ------------------------------------------------------------------------
  // Sign out
  // ------------------------------------------------------------------------

  const handleSignOut = useCallback(async () => {
    if (onCanvas) return;

    setBusy(true);

    try {
      const base = (config.apiBaseUrl || ENV_API_BASE_URL || "http://127.0.0.1:4001").replace(/\/+$/, "");
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

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("memberframe:session-updated", { detail: { signedIn: false } })
      );
    }

    if (safePath(config.afterLogoutPath)) navigate(config.afterLogoutPath);
  }, [config.afterLogoutPath, config.apiBaseUrl, onCanvas]);

  // ------------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------------

  const style = <style>{cssContent(accent, radius)}</style>;

  if (IS_LOCKED) {
    return (
      <div className="mf-dash">
        {style}
        <div className="mf-dash-state">
          <ShieldCheck aria-hidden={true} />
          <p>This component needs a MemberFrame license.</p>
        </div>
      </div>
    );
  }

  if (state.phase === "loading") {
    return (
      <div className="mf-dash">
        {style}
        <div className="mf-dash-state">
          <p>Checking your account.</p>
        </div>
      </div>
    );
  }

  if (state.phase === "misconfigured") {
    // Addressed to the creator, not the visitor, because only a creator can
    // fix it and only a creator sees it before the site is published.
    return (
      <div className="mf-dash">
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
      <div className="mf-dash">
        {style}
        <div className="mf-dash-state">
          <p>Your account could not be loaded. Check your connection and try again.</p>
        </div>
      </div>
    );
  }

  if (state.phase === "signed_out") {
    return (
      <div className="mf-dash">
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
            Sign in
          </button>
        ) : null}
      </div>
    );
  }

  const { member, tiers } = state;
  const displayName = member.name && member.name.trim() !== "" ? member.name : member.email;
  const initial = displayName.trim().charAt(0).toUpperCase() || "M";

  return (
    <div className="mf-dash">
      {style}

      <div className="mf-dash-head">
        <span className="mf-dash-avatar">{initial}</span>
        <div>
          <p className="mf-dash-title">{config.headline}</p>
          <p className="mf-dash-sub">{displayName}</p>
        </div>
      </div>

      <div className="mf-dash-row">
        <span className="mf-dash-row-label">Email</span>
        <span className="mf-dash-row-value">{member.email}</span>
      </div>

      {config.showTier ? (
        <div className="mf-dash-row">
          <span className="mf-dash-row-label">Membership</span>
          <span className="mf-dash-row-value">
            <span className="mf-dash-badge">{tierName(member.activeTier, tiers)}</span>
          </span>
        </div>
      ) : null}

      <div className="mf-dash-row">
        <span className="mf-dash-row-label">Status</span>
        <span className="mf-dash-row-value">{statusLabel(member.status)}</span>
      </div>

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
            Profile
          </p>

          {profile.phase === "loading" ? (
            <p className="mf-dash-saved">Loading your profile.</p>
          ) : profile.phase === "unavailable" ? (
            <p className="mf-dash-saved">Your profile could not be loaded. Refresh the page to try again.</p>
          ) : (
            <>
              <div className="mf-dash-field">
                <label className="mf-dash-label" htmlFor={`mf-dash-name-${member.memberId}`}>
                  Name
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
                {profileSaving ? "Saving" : "Save profile"}
              </button>
            </>
          )}
        </form>
      ) : null}

      {config.showBilling ? (
        /*
         * Honest rather than empty. FP-08 specifies plan, renewal date, payment
         * method, and invoices, and every one of those needs the subscriptions
         * and invoices tables, which are backend PRD phase B3 and do not exist.
         * Rendering zeroes would tell a paying member their subscription had
         * lapsed.
         */
        <p className="mf-dash-note">
          Billing details and invoices arrive with payments. Your membership and access are
          shown above and are up to date.
        </p>
      ) : null}

      {config.showSignOut ? (
        <button
          type="button"
          className="mf-dash-button"
          disabled={busy}
          onClick={() => void handleSignOut()}
        >
          <LogOut aria-hidden={true} />
          {busy ? "Signing out" : "Sign out"}
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

addPropertyControls(MemberDashboard, {
  headline: {
    type: ControlType.String,
    title: "Headline",
    defaultValue: "Your account",
  },
  showTier: {
    type: ControlType.Boolean,
    title: "Show tier",
    defaultValue: true,
  },
  showBilling: {
    type: ControlType.Boolean,
    title: "Billing note",
    defaultValue: true,
  },
  showSignOut: {
    type: ControlType.Boolean,
    title: "Sign out",
    defaultValue: true,
  },
  showProfile: {
    type: ControlType.Boolean,
    title: "Profile form",
    defaultValue: true,
  },
  signedOutMessage: {
    type: ControlType.String,
    title: "Signed out",
    defaultValue: "Sign in to see your account.",
  },
  loginPath: {
    type: ControlType.String,
    title: "Login path",
    defaultValue: "/login",
  },
  afterLogoutPath: {
    type: ControlType.String,
    title: "After sign out",
    defaultValue: "/",
  },
  accentColor: {
    type: ControlType.Color,
    title: "Accent",
    defaultValue: "#5271ff",
  },
  borderRadius: {
    type: ControlType.Number,
    title: "Corner radius",
    defaultValue: 12,
    min: 0,
    max: 32,
    unit: "px",
  },
});

void IS_TRIAL;
