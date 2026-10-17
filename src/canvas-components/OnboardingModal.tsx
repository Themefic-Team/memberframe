/**
 * `<OnboardingModal>`, the progressive profile questionnaire. Feature plan
 * FP-09 section 3.1, PRD feature F16, task 6.3.
 *
 * ## This file leaves the repository
 *
 * Fourth component after `<MemberGate>`, `<MemberAuth>`, and
 * `<MemberDashboard>`, and everything in their headers applies here. It is
 * written into the creator's Framer project and runs on their published site,
 * so it may import only `react`, `framer`, and `lucide-react`, all styling goes
 * through `cssContent`, and the marked config block is the only region the
 * generator rewrites.
 *
 * ## When it opens
 *
 * Only for a signed-in member who has a visible required profile field with no
 * answer. That is the whole trigger, and it is deliberately narrow. FP-09
 * section 3 sends a member with nothing required straight into the site, so a
 * creator with only optional fields never puts a modal in front of anyone, and
 * a member who has answered is never asked again. Optional fields stay
 * reachable on `<MemberDashboard>` forever.
 *
 * A signed-out visitor, a network failure, and a server that does not answer
 * all render nothing. That is the degraded state PRD section 9.3 requirement 7
 * asks for, in the only form that suits a modal: a broken overlay over a
 * working page is worse than no overlay.
 *
 * ## The steps come from the field list, not from a property control
 *
 * PRD section 9.2 names a `steps` control. The fields are defined once, in the
 * plugin's Settings, Fields view, and a second list here would be a second
 * place to define them that could disagree with the first. Conflict C32. The
 * steps are derived instead: a welcome step for the member's name, a step for
 * the required fields, and a skippable step for the optional ones.
 *
 * ## The one browser storage call in a canvas component
 *
 * PRD F16: "partial progress survives a page reload mid-flow". The draft goes
 * to `sessionStorage` under a key naming the site and the member. It is the
 * member's own unsent answers, scoped to one tab, gone when the tab closes and
 * cleared the moment they are saved. The session itself is still an HTTP-only
 * cookie this file never sees, which is the rule PRD section 14.1 S2 states,
 * and `test/onboardingModal.test.ts` proves no other storage API is touched.
 */

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { addPropertyControls, ControlType, RenderTarget } from "framer";
import { ArrowLeft, Crown, Lock } from "lucide-react";

// ============================================================================
// LICENSING AND TRIAL STATE
// ============================================================================
// Rewritten in place by F19's `enforceLockState` regex patcher, so the four
// lines below must keep this exact shape. PRD section 9.3 requirement 3.
const IS_LOCKED = false;
const IS_TRIAL = false;
// @plugin-lock-state: unlocked
// @plugin-trial-state: paid

// @memberframe-appearance-start
// ============================================================================
// APPEARANCE, SHARED BY EVERY MEMBERFRAME CANVAS COMPONENT
// ============================================================================
// Byte-identical in every canvas component: MemberAuth, MemberDashboard,
// MemberGate, MemberPricing, OnboardingModal, MeteredPaywall,
// ProtectedDownload, BookmarkButton, and BookmarksTray. Held so by
// `test/canvasAppearanceParity.test.ts`, which also compiles this block and
// runs it. A canvas component is compiled by Framer alone and cannot import
// from this repository, so the copy is the architecture. Edit all or none.
//
// One vocabulary for every component. The Theme control picks a palette, the
// creator's Colors, Typography, and Layout groups override it, and every rule
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

  return lines.join(" ");
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
 * The shared property controls: Theme, Colors, Typography, Layout.
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

// ============================================================================
// CONTRACTS
// ============================================================================

/**
 * Every visible string, as [sidebar title, default]. The Labels group edits
 * them; an empty field falls back. `{current}` and `{total}` fill the step
 * counter. Save errors stay fixed: they are feedback, not design copy. The
 * questions themselves come from the plugin's Settings, Fields view.
 */
const ONBOARDING_LABELS: Record<string, readonly [string, string]> = {
  stepCounter: ["Step counter", "Step {current} of {total}"],
  requiredTitle: ["Required step title", "About you"],
  requiredText: ["Required step text", "These answers are needed to finish setting up your account."],
  optionalTitle: ["Optional step title", "A little more"],
  optionalText: [
    "Optional step text",
    "Optional. Skip any of these and answer them later from your account page.",
  ],
  nameLabel: ["Name label", "Your name"],
  optional: ["Optional marker", "Optional"],
  chooseOne: ["Select placeholder", "Choose one"],
  back: ["Back button", "Back"],
  skip: ["Skip button", "Skip for now"],
  continue: ["Continue button", "Continue"],
  finish: ["Finish button", "Finish"],
  saving: ["Saving", "Saving"],
};

interface OnboardingConfig {
  welcomeTitle: string;
  welcomeMessage: string;
  showStepIndicator: boolean;
  /** Offer "Skip for now" on the optional step. Required fields are never skippable. */
  allowSkip: boolean;
  /** Site-relative. Empty keeps the member on the page they were on. */
  completionRedirect: string;
  accentColor: string;
  borderRadius: number;
  apiBaseUrl: string;
  /** Public. Identifies the tenant; `Origin` is what authorizes. */
  siteKey: string;
}

// @memberframe-config-start
const CONFIG: OnboardingConfig = {
  welcomeTitle: "Welcome aboard",
  welcomeMessage: "A few quick questions help us tailor the site to you.",
  showStepIndicator: true,
  allowSkip: true,
  completionRedirect: "",
  accentColor: "#5271ff",
  borderRadius: 12,
  apiBaseUrl: "",
  siteKey: "",
};
// @memberframe-config-end

const PROFILE_PATH = "/api/member/profile";
const DRAFT_PREFIX = "memberframe:onboarding:";

// ============================================================================
// PROFILE FIELDS, DUPLICATED FROM src/utils/customFields.ts
// ============================================================================
// This file is compiled by Framer alone and cannot import from the repository.
// Every function in this block is held identical to the plugin's copy by
// `test/customFieldsParity.test.ts`, and the plugin's copy to the server's by
// the backend's parity test. Edit all of them or none.

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

interface OnboardingSteps {
  required: string[];
  optional: string[];
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

function needsOnboarding(
  fields: ReadonlyArray<CustomFieldDefinition>,
  values: Readonly<Record<string, MetadataValue | undefined>>
): boolean {
  return fields.some((field) => {
    if (!field.required || !isFieldVisible(field, values)) return false;
    const value = values[field.key];
    if (value === null || value === undefined) return true;
    if (field.type === "boolean") return value !== true;
    return String(value).trim() === "";
  });
}

function planSteps(fields: ReadonlyArray<CustomFieldDefinition>): OnboardingSteps {
  const required: string[] = [];
  const optional: string[] = [];

  for (const field of fields) {
    if (field.showWhen) continue;
    (field.required ? required : optional).push(field.key);
  }

  for (const field of fields) {
    if (!field.showWhen) continue;
    const parentKey = field.showWhen.key;
    if (required.includes(parentKey)) required.push(field.key);
    else if (optional.includes(parentKey)) optional.push(field.key);
  }

  const position = (key: string) => fields.findIndex((field) => field.key === key);
  required.sort((left, right) => position(left) - position(right));
  optional.sort((left, right) => position(left) - position(right));

  return { required, optional };
}

// ============================================================================
// HELPERS LOCAL TO THIS COMPONENT
// ============================================================================

/** Same check as the other three components: a value that could leave the site is not a path. */
function safePath(value: string): boolean {
  if (value === "" || !value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  if (value.indexOf("\\") !== -1) return false;
  return true;
}

function apiHeaders(withBody: boolean): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };

  if (withBody) headers["Content-Type"] = "application/json";
  if (CONFIG.siteKey !== "") headers["X-MemberFrame-Site"] = CONFIG.siteKey;

  return headers;
}

/**
 * The definitions out of a response this component did not write.
 *
 * Anything malformed is dropped rather than rendered: a field with no key saves
 * nowhere and one with an unknown type has no control.
 */
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

// ============================================================================
// THE DRAFT
// ============================================================================
// The only browser storage in this file, and every access is wrapped: Safari's
// private mode, a sandboxed iframe, and a full quota all throw, and a member
// who cannot have a draft should still be able to answer.

type StepId = "welcome" | "required" | "optional";

interface Draft {
  step: number;
  name: string;
  values: MemberMetadata;
}

function draftKey(memberId: string): string {
  return `${DRAFT_PREFIX}${CONFIG.siteKey || "site"}:${memberId}`;
}

function loadDraft(memberId: string, fields: ReadonlyArray<CustomFieldDefinition>): Draft | null {
  try {
    const raw = window.sessionStorage.getItem(draftKey(memberId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const known = new Set(fields.map((field) => field.key));
    const values: MemberMetadata = {};

    // Only keys the creator still defines. A draft written before a field was
    // deleted must not resurrect it into the patch.
    for (const [key, value] of Object.entries(readMetadata(parsed["values"]))) {
      if (known.has(key)) values[key] = value;
    }

    return {
      step: typeof parsed["step"] === "number" ? parsed["step"] : 0,
      name: typeof parsed["name"] === "string" ? parsed["name"] : "",
      values,
    };
  } catch {
    return null;
  }
}

function saveDraft(memberId: string, draft: Draft): void {
  try {
    window.sessionStorage.setItem(draftKey(memberId), JSON.stringify(draft));
  } catch {
    // Not having a draft is the degraded case, not an error.
  }
}

function clearDraft(memberId: string): void {
  try {
    window.sessionStorage.removeItem(draftKey(memberId));
  } catch {
    // Same as above.
  }
}

// ============================================================================
// STATE
// ============================================================================

type ModalState =
  | { phase: "checking" }
  | { phase: "hidden" }
  | {
      phase: "open";
      memberId: string;
      fields: CustomFieldDefinition[];
      steps: StepId[];
      plan: OnboardingSteps;
    };

// ============================================================================
// STYLES
// ============================================================================
// The palette is declared once on the root and every rule reads it, the same
// arrangement as `<MemberAuth>`. The creator's accent and radius arrive as
// scoped custom properties in a second style block, so nothing here is a
// `style={{ }}` even though two values are dynamic.

const cssContent = `
/*
  The palette comes from the shared appearance block (mfThemeCss): Theme plus
  the creator's Colors resolve into --mf-c-*. These names are kept so every
  rule below reads as it always did.
*/
.memberframe-onboarding-root {
  --memberframe-onboarding-accent: var(--mf-c-accent);
  --memberframe-onboarding-radius: var(--mf-c-radius);
  --memberframe-onboarding-surface: var(--mf-c-surface);
  --memberframe-onboarding-border: var(--mf-c-border);
  --memberframe-onboarding-title: var(--mf-c-text);
  --memberframe-onboarding-body: var(--mf-c-muted);
  --memberframe-onboarding-field: var(--mf-c-field);
  --memberframe-onboarding-on-accent: var(--mf-c-on-accent);
  --memberframe-onboarding-danger: var(--mf-c-danger);
  --memberframe-onboarding-scrim: var(--mf-c-backdrop);
  --memberframe-onboarding-shadow: var(--mf-c-shadow);

  box-sizing: border-box;
}

html.memberframe-onboarding-open { overflow: hidden; }

.memberframe-onboarding-root.is-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--memberframe-onboarding-scrim);
  -webkit-backdrop-filter: blur(var(--memberframe-onboarding-blur, 0px));
  backdrop-filter: blur(var(--memberframe-onboarding-blur, 0px));
  overflow-y: auto;
}

/* Inline is the canvas view: it fills the frame the creator sized. */
.memberframe-onboarding-root.is-inline {
  position: relative;
  width: 100%;
  height: 100%;
}

.memberframe-onboarding-root.is-inline .memberframe-onboarding-card {
  max-width: none;
  height: 100%;
  overflow-y: auto;
}

.memberframe-onboarding-card {
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: var(--mf-gap, 16px);
  width: 100%;
  max-width: 440px;
  margin: auto;
  padding: var(--mf-pad, 24px);
  border: var(--mf-border-width, 1px) solid var(--memberframe-onboarding-border);
  border-radius: var(--memberframe-onboarding-radius);
  background: var(--memberframe-onboarding-surface);
  box-shadow: var(--memberframe-onboarding-shadow);
  color: var(--memberframe-onboarding-title);
}

.memberframe-onboarding-progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.memberframe-onboarding-step-label {
  margin: 0;
  font-size: calc(12px * var(--mf-text-scale, 1));
  font-weight: 600;
  color: var(--memberframe-onboarding-body);
}

.memberframe-onboarding-dots {
  display: flex;
  gap: 6px;
}

.memberframe-onboarding-dot {
  flex: 1;
  height: 4px;
  border-radius: 999px;
  background: var(--memberframe-onboarding-border);
}

.memberframe-onboarding-dot.is-done,
.memberframe-onboarding-dot.is-current {
  background: var(--memberframe-onboarding-accent);
}

.memberframe-onboarding-title {
  margin: 0;
  font-size: calc(20px * var(--mf-text-scale, 1));
  font-weight: 650;
  line-height: 1.3;
  color: var(--memberframe-onboarding-title);
}

.memberframe-onboarding-title:focus { outline: none; }

.memberframe-onboarding-text {
  margin: 0;
  font-size: calc(14px * var(--mf-text-scale, 1));
  line-height: 1.5;
  color: var(--memberframe-onboarding-body);
}

.memberframe-onboarding-fields {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.memberframe-onboarding-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.memberframe-onboarding-label {
  font-size: calc(13px * var(--mf-text-scale, 1));
  font-weight: 600;
  color: var(--memberframe-onboarding-title);
}

.memberframe-onboarding-optional {
  margin-left: 6px;
  font-weight: 400;
  color: var(--memberframe-onboarding-body);
}

.memberframe-onboarding-input {
  box-sizing: border-box;
  width: 100%;
  min-height: 40px;
  padding: 9px 12px;
  border: 1px solid var(--memberframe-onboarding-border);
  border-radius: calc(var(--memberframe-onboarding-radius) - 4px);
  background: var(--memberframe-onboarding-field);
  color: var(--memberframe-onboarding-title);
  font: inherit;
  font-size: calc(14px * var(--mf-text-scale, 1));
}

textarea.memberframe-onboarding-input {
  min-height: 92px;
  resize: vertical;
}

.memberframe-onboarding-input:focus-visible {
  outline: none;
  border-color: var(--memberframe-onboarding-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--memberframe-onboarding-accent) 25%, transparent);
}

.memberframe-onboarding-input.is-invalid {
  border-color: var(--memberframe-onboarding-danger);
}

.memberframe-onboarding-check {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: calc(14px * var(--mf-text-scale, 1));
  line-height: 1.4;
  color: var(--memberframe-onboarding-title);
  cursor: pointer;
}

.memberframe-onboarding-check input {
  width: 18px;
  height: 18px;
  margin: 1px 0 0;
  accent-color: var(--memberframe-onboarding-accent);
}

.memberframe-onboarding-check input:focus-visible {
  outline: 2px solid var(--memberframe-onboarding-accent);
  outline-offset: 2px;
}

.memberframe-onboarding-error {
  margin: 0;
  font-size: calc(12px * var(--mf-text-scale, 1));
  line-height: 1.4;
  color: var(--memberframe-onboarding-danger);
}

.memberframe-onboarding-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.memberframe-onboarding-spacer { flex: 1; }

.memberframe-onboarding-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 40px;
  padding: 0 16px;
  border: 1px solid var(--memberframe-onboarding-border);
  border-radius: calc(var(--memberframe-onboarding-radius) - 4px);
  background: transparent;
  color: var(--memberframe-onboarding-title);
  font: inherit;
  font-size: calc(14px * var(--mf-text-scale, 1));
  font-weight: 500;
  cursor: pointer;
}

.memberframe-onboarding-button svg { width: 16px; height: 16px; stroke: currentColor; }

.memberframe-onboarding-button:disabled { opacity: 0.55; cursor: default; }

.memberframe-onboarding-button:focus-visible {
  outline: 2px solid var(--memberframe-onboarding-accent);
  outline-offset: 2px;
}

.memberframe-onboarding-button.is-quiet {
  border-color: transparent;
  color: var(--memberframe-onboarding-body);
}

.memberframe-onboarding-button.is-primary {
  border-color: var(--memberframe-onboarding-accent);
  background: var(--memberframe-onboarding-accent);
  color: var(--memberframe-onboarding-on-accent);
  font-weight: 600;
}

.memberframe-onboarding-button.is-primary:hover:not(:disabled) { filter: brightness(1.07); }

.memberframe-onboarding-note {
  margin: 0;
  font-size: calc(12px * var(--mf-text-scale, 1));
  color: var(--memberframe-onboarding-body);
}

.memberframe-onboarding-watermark {
  position: absolute;
  right: 10px;
  bottom: 10px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: calc(10px * var(--mf-text-scale, 1));
  font-weight: 600;
  text-decoration: none;
  color: var(--memberframe-onboarding-on-accent);
  background: var(--memberframe-onboarding-scrim);
}

.memberframe-onboarding-watermark svg { width: 10px; height: 10px; stroke: currentColor; }

.memberframe-onboarding-locked {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}

.memberframe-onboarding-locked svg { width: 22px; height: 22px; stroke: currentColor; }
`;

// ============================================================================
// THE PREVIEW SHOWN ON THE FRAMER CANVAS
// ============================================================================
// No visitor and no cookie on the canvas, so a real request would always
// resolve signed out and the modal would never appear for the creator to style.

const PREVIEW_FIELDS: CustomFieldDefinition[] = [
  { key: "company", label: "Company", type: "text", required: true, options: [], placeholder: "Acme Design Co" },
  {
    key: "role",
    label: "What describes you best?",
    type: "select",
    required: true,
    options: ["Freelancer", "Agency", "In-house team"],
    placeholder: "",
  },
  {
    key: "team_size",
    label: "Team size",
    type: "number",
    required: false,
    options: [],
    placeholder: "8",
    showWhen: { key: "role", value: "Agency" },
  },
  { key: "portfolio_url", label: "Portfolio URL", type: "url", required: false, options: [], placeholder: "https://" },
];

// ============================================================================
// ONE CONTROL
// ============================================================================

interface FieldControlProps {
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

function FieldControl({
  id,
  field,
  value,
  error,
  disabled,
  onChange,
  optionalLabel,
  chooseLabel,
}: FieldControlProps): React.ReactElement {
  const errorId = `${id}-error`;
  const described = error ? errorId : undefined;
  const text = value === null || value === undefined ? "" : String(value);
  const inputClass = `memberframe-onboarding-input${error ? " is-invalid" : ""}`;

  if (field.type === "boolean") {
    return (
      <div className="memberframe-onboarding-field">
        <label className="memberframe-onboarding-check" htmlFor={id}>
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
        {error ? (
          <p className="memberframe-onboarding-error" id={errorId}>
            {error}
          </p>
        ) : null}
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
        autoComplete={field.type === "phone" ? "tel" : field.type === "url" ? "url" : undefined}
        value={text}
        placeholder={field.placeholder}
        maxLength={field.type === "url" ? MAX_URL_LENGTH : field.type === "number" ? undefined : MAX_TEXT_LENGTH}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    );
  }

  return (
    <div className="memberframe-onboarding-field">
      <label className="memberframe-onboarding-label" htmlFor={id}>
        {field.label}
        {field.required ? null : <span className="memberframe-onboarding-optional">{optionalLabel}</span>}
      </label>
      {control}
      {error ? (
        <p className="memberframe-onboarding-error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Fixed size by default on the canvas, where it renders inline and fills the
 * frame. On the published site it is an overlay, so the frame size only
 * governs the canvas preview.
 *
 * @framerIntrinsicWidth 440
 * @framerIntrinsicHeight 560
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
export default function OnboardingModal(
  props: Partial<OnboardingConfig> & MfAppearanceProps & { backdropBlur?: number }
): React.ReactElement | null {
  const config: OnboardingConfig = { ...CONFIG, ...props };
  const { theme = "light", colors, typography, layout, labels } = props;
  /** Blurs the page behind the modal. Not in CONFIG: no plugin field sets it. */
  const backdropBlur = Math.round(mfNumber(props.backdropBlur, 0, 20, 0));
  const t = (key: string, values?: Record<string, string | number>): string => {
    const text = mfLabel(labels, ONBOARDING_LABELS, key);
    return values ? mfFill(text, values) : text;
  };
  const onCanvas = RenderTarget.current() === RenderTarget.canvas;

  const rawId = useId();
  const scope = useMemo(() => `mfo${rawId.replace(/[^a-zA-Z0-9]/g, "")}`, [rawId]);

  const [state, setState] = useState<ModalState>({ phase: "checking" });
  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState("");
  const [values, setValues] = useState<MemberMetadata>({});
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const base = (config.apiBaseUrl || "").replace(/\/+$/, "");

  // --------------------------------------------------------------------------
  // Decide whether to open
  // --------------------------------------------------------------------------

  useEffect(() => {
    if (onCanvas) {
      const plan = planSteps(PREVIEW_FIELDS);
      setState({ phase: "open", memberId: "preview", fields: PREVIEW_FIELDS, steps: ["welcome", "required", "optional"], plan });
      setStepIndex(1);
      setValues({ role: "Agency" });
      return;
    }

    if (base === "") {
      // Not connected when deployed. Nothing a member can do about it, so
      // nothing is shown to them.
      setState({ phase: "hidden" });
      return;
    }

    let active = true;

    void (async () => {
      try {
        const response = await fetch(`${base}${PROFILE_PATH}`, {
          credentials: "include",
          headers: apiHeaders(false),
        });

        if (!active) return;
        if (!response.ok) {
          // 401 is a visitor who is not signed in; anything else is a failure.
          // Both mean no modal.
          setState({ phase: "hidden" });
          return;
        }

        const body = (await response.json()) as {
          member?: { memberId?: string; name?: string | null };
          fields?: unknown;
          metadata?: unknown;
        };
        if (!active) return;

        const fields = readFields(body.fields);
        const stored = readMetadata(body.metadata);
        const memberId = body.member?.memberId ?? "";

        if (memberId === "" || !needsOnboarding(fields, stored)) {
          setState({ phase: "hidden" });
          return;
        }

        const plan = planSteps(fields);
        const steps: StepId[] = ["welcome"];
        if (plan.required.length > 0) steps.push("required");
        if (plan.optional.length > 0) steps.push("optional");

        const draft = loadDraft(memberId, fields);

        setName(draft?.name ?? body.member?.name ?? "");
        setValues({ ...stored, ...(draft?.values ?? {}) });
        setStepIndex(Math.max(0, Math.min(steps.length - 1, draft?.step ?? 0)));
        setState({ phase: "open", memberId, fields, steps, plan });
      } catch {
        if (active) setState({ phase: "hidden" });
      }
    })();

    return () => {
      active = false;
    };
  }, [base, onCanvas]);

  const open = state.phase === "open";
  const overlay = open && !onCanvas;

  // --------------------------------------------------------------------------
  // Keep the draft, lock the page scroll, move focus
  // --------------------------------------------------------------------------

  useEffect(() => {
    if (state.phase !== "open" || onCanvas) return;
    saveDraft(state.memberId, { step: stepIndex, name, values });
  }, [name, onCanvas, state, stepIndex, values]);

  useEffect(() => {
    if (!overlay || typeof document === "undefined") return;
    document.documentElement.classList.add("memberframe-onboarding-open");
    return () => document.documentElement.classList.remove("memberframe-onboarding-open");
  }, [overlay]);

  useEffect(() => {
    // Focus the step heading on every step change, so a screen reader reads
    // the new step from its title and the "Step 2 of 3" line above it.
    if (overlay) headingRef.current?.focus();
  }, [overlay, stepIndex]);

  // --------------------------------------------------------------------------
  // Actions
  // --------------------------------------------------------------------------

  const fields = state.phase === "open" ? state.fields : [];
  const steps = state.phase === "open" ? state.steps : [];
  const step: StepId = steps[stepIndex] ?? "welcome";
  const isLast = stepIndex === steps.length - 1;

  const stepKeys = useCallback(
    (id: StepId): string[] => {
      if (state.phase !== "open") return [];
      return id === "required" ? state.plan.required : id === "optional" ? state.plan.optional : [];
    },
    [state]
  );

  const setValue = useCallback((key: string, value: MetadataValue) => {
    setValues((current) => ({ ...current, [key]: value }));
    setProblems((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  const submit = useCallback(
    async (answeredSteps: StepId[]) => {
      if (state.phase !== "open" || onCanvas) return;

      const keys = answeredSteps.flatMap((id) => stepKeys(id));
      const checked = validateProfile(fields, values, keys);

      if (Object.keys(checked.problems).length > 0) {
        // Reachable after a reload restored a later step over an earlier one
        // that was never finished. Go back to where the problem is.
        setProblems(checked.problems);
        const target = steps.findIndex((id) => stepKeys(id).some((key) => key in checked.problems));
        if (target !== -1) setStepIndex(target);
        return;
      }

      setSubmitting(true);
      setFailure(null);

      try {
        const response = await fetch(`${base}${PROFILE_PATH}`, {
          method: "PATCH",
          credentials: "include",
          headers: apiHeaders(true),
          body: JSON.stringify({
            ...(name.trim() !== "" ? { name: name.trim() } : {}),
            metadata: checked.metadata,
          }),
        });

        if (response.status === 400) {
          const body = (await response.json().catch(() => ({}))) as {
            problems?: Array<{ key?: string; message?: string }>;
          };
          const mapped: Record<string, string> = {};
          for (const problem of body.problems ?? []) {
            if (problem.key && problem.message) mapped[problem.key] = problem.message;
          }

          setProblems(mapped);
          // Back to the first step holding a problem, so the message is on
          // screen next to the field it names.
          const target = steps.findIndex((id) => stepKeys(id).some((key) => key in mapped));
          if (target !== -1) setStepIndex(target);
          setFailure(Object.keys(mapped).length > 0 ? null : "Some answers could not be saved. Check them and try again.");
          return;
        }

        if (response.status === 401) {
          // Signed out mid-flow, say in another tab. The answers are kept in
          // the draft and the modal closes, because nothing here can save them.
          setState({ phase: "hidden" });
          return;
        }

        if (!response.ok) {
          setFailure("Your answers could not be saved. Check your connection and try again.");
          return;
        }

        clearDraft(state.memberId);
        setState({ phase: "hidden" });

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("memberframe:profile-updated"));
          if (safePath(config.completionRedirect)) window.location.assign(config.completionRedirect);
        }
      } catch {
        setFailure("Your answers could not be saved. Check your connection and try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [base, config.completionRedirect, fields, name, onCanvas, state, stepKeys, steps, values]
  );

  const handleContinue = useCallback(() => {
    const keys = stepKeys(step);
    const checked = validateProfile(fields, values, keys);

    if (Object.keys(checked.problems).length > 0) {
      setProblems(checked.problems);
      return;
    }

    setProblems({});

    if (isLast) {
      void submit(steps.slice(0, stepIndex + 1));
    } else {
      setStepIndex(stepIndex + 1);
    }
  }, [fields, isLast, step, stepIndex, stepKeys, steps, submit, values]);

  const handleSkip = useCallback(() => {
    // Skipping sends none of this step's answers, so nothing in it is checked
    // and nothing in it can block completion. PRD F16 acceptance criterion 2.
    setProblems({});
    void submit(steps.slice(0, stepIndex));
  }, [stepIndex, steps, submit]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!overlay || event.key !== "Tab") return;

      const card = cardRef.current;
      if (!card) return;

      const focusable = Array.from(
        card.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]'
        )
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      // Escape deliberately does nothing: the modal opens only because a
      // required answer is missing, and the optional step has its own skip.
      if (event.shiftKey && (active === first || active === headingRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [overlay]
  );

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  // Accent, radius, Colors, Typography, and Layout, sanitized by the shared
  // appearance block and scoped to this instance.
  const scopedVars =
    `[data-memberframe-onboarding="${scope}"] { ` +
    mfAppearanceVars({
      accent: config.accentColor,
      radius: config.borderRadius,
      radiusMax: 32,
      shadowByDefault: true,
      colors,
      typography,
      layout,
    }) +
    ` --memberframe-onboarding-blur: ${backdropBlur}px; }`;
  const themeClass = mfThemeClass(theme);
  const themeStyle = <style>{mfThemeCss(".memberframe-onboarding-root")}</style>;

  const watermark =
    IS_TRIAL && !IS_LOCKED ? (
      <a className="memberframe-onboarding-watermark" href="https://framefic.com" target="_blank" rel="noopener noreferrer">
        <Crown stroke="currentColor" aria-hidden={true} />
        <span>Trial Version</span>
      </a>
    ) : null;

  if (IS_LOCKED) {
    // Only on the canvas: a member is never shown a licensing message.
    if (!onCanvas) return null;
    return (
      <div className={`memberframe-onboarding-root is-inline ${themeClass}`} data-memberframe-onboarding={scope}>
        {themeStyle}
        <style>{cssContent}</style>
        <style>{scopedVars}</style>
        <div className="memberframe-onboarding-card">
          <div className="memberframe-onboarding-locked">
            <Lock stroke="currentColor" aria-hidden={true} />
            <h2 className="memberframe-onboarding-title">Component Locked</h2>
            <p className="memberframe-onboarding-text">
              Open the MemberFrame plugin to activate your license or start a free trial.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (state.phase !== "open") return null;

  const headingId = `${scope}-heading`;
  const visibleKeys = stepKeys(step).filter((key) => {
    const field = fields.find((entry) => entry.key === key);
    return field ? isFieldVisible(field, values) : false;
  });

  const title =
    step === "welcome"
      ? config.welcomeTitle
      : step === "required"
        ? t("requiredTitle")
        : t("optionalTitle");

  const intro =
    step === "welcome"
      ? config.welcomeMessage
      : step === "required"
        ? t("requiredText")
        : t("optionalText");

  return (
    <div
      className={`memberframe-onboarding-root ${overlay ? "is-overlay" : "is-inline"} ${themeClass}`}
      data-memberframe-onboarding={scope}
      onKeyDown={handleKeyDown}
    >
      {themeStyle}
      <style>{cssContent}</style>
      <style>{scopedVars}</style>

      <div
        ref={cardRef}
        className="memberframe-onboarding-card"
        role={overlay ? "dialog" : undefined}
        aria-modal={overlay ? true : undefined}
        aria-labelledby={headingId}
      >
        {config.showStepIndicator && steps.length > 1 ? (
          <div className="memberframe-onboarding-progress">
            <p className="memberframe-onboarding-step-label" aria-live="polite">
              {t("stepCounter", { current: stepIndex + 1, total: steps.length })}
            </p>
            <div className="memberframe-onboarding-dots" aria-hidden={true}>
              {steps.map((id, position) => (
                <span
                  key={id}
                  className={`memberframe-onboarding-dot${
                    position < stepIndex ? " is-done" : position === stepIndex ? " is-current" : ""
                  }`}
                />
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <h2 className="memberframe-onboarding-title" id={headingId} ref={headingRef} tabIndex={-1}>
            {title}
          </h2>
          <p className="memberframe-onboarding-text">{intro}</p>
        </div>

        <form
          className="memberframe-onboarding-fields"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            handleContinue();
          }}
        >
          {step === "welcome" ? (
            <div className="memberframe-onboarding-field">
              <label className="memberframe-onboarding-label" htmlFor={`${scope}-name`}>
                {t("nameLabel")}
                <span className="memberframe-onboarding-optional">{t("optional")}</span>
              </label>
              <input
                id={`${scope}-name`}
                className="memberframe-onboarding-input"
                type="text"
                autoComplete="name"
                maxLength={255}
                value={name}
                disabled={submitting}
                onChange={(event) => setName(event.currentTarget.value)}
              />
            </div>
          ) : (
            visibleKeys.map((key) => {
              const field = fields.find((entry) => entry.key === key);
              if (!field) return null;
              return (
                <FieldControl
                  key={key}
                  id={`${scope}-${key}`}
                  field={field}
                  value={values[key]}
                  error={problems[key]}
                  disabled={submitting}
                  onChange={(value) => setValue(key, value)}
                  optionalLabel={t("optional")}
                  chooseLabel={t("chooseOne")}
                />
              );
            })
          )}

          {failure ? (
            <p className="memberframe-onboarding-error" role="alert">
              {failure}
            </p>
          ) : null}

          <div className="memberframe-onboarding-actions">
            {stepIndex > 0 ? (
              <button
                type="button"
                className="memberframe-onboarding-button is-quiet"
                disabled={submitting}
                onClick={() => {
                  setProblems({});
                  setStepIndex(stepIndex - 1);
                }}
              >
                <ArrowLeft aria-hidden={true} />
                {t("back")}
              </button>
            ) : null}

            <span className="memberframe-onboarding-spacer" />

            {step === "optional" && config.allowSkip ? (
              <button
                type="button"
                className="memberframe-onboarding-button is-quiet"
                disabled={submitting}
                onClick={handleSkip}
              >
                {t("skip")}
              </button>
            ) : null}

            <button type="submit" className="memberframe-onboarding-button is-primary" disabled={submitting}>
              {submitting ? t("saving") : isLast ? t("finish") : t("continue")}
            </button>
          </div>

          {onCanvas ? (
            <p className="memberframe-onboarding-note">
              Preview only. On your site this opens for signed-in members who have not answered a required field.
            </p>
          ) : null}
        </form>

        {watermark}
      </div>
    </div>
  );
}

// ============================================================================
// PROPERTY CONTROLS
// ============================================================================
// `apiBaseUrl` and `siteKey` are absent for the same reason as on the other
// components: both belong to the connection, the generator bakes them in, and
// a creator editing either by hand would break the modal with no way to know
// why. The fields themselves are absent too, conflict C32: they are defined in
// the plugin's Settings, Fields view and read from the server at runtime.

addPropertyControls(OnboardingModal, {
  welcomeTitle: {
    type: ControlType.String,
    title: "Welcome Title",
    defaultValue: CONFIG.welcomeTitle,
  },
  welcomeMessage: {
    type: ControlType.String,
    title: "Welcome Text",
    defaultValue: CONFIG.welcomeMessage,
  },
  showStepIndicator: {
    type: ControlType.Boolean,
    title: "Step Indicator",
    defaultValue: CONFIG.showStepIndicator,
  },
  allowSkip: {
    type: ControlType.Boolean,
    title: "Allow Skip",
    defaultValue: CONFIG.allowSkip,
  },
  completionRedirect: {
    type: ControlType.String,
    title: "After Finish Page",
    defaultValue: CONFIG.completionRedirect,
  },
  backdropBlur: {
    type: ControlType.Number,
    title: "Backdrop Blur",
    min: 0,
    max: 20,
    step: 1,
    unit: "px",
    defaultValue: 0,
  },
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

  ...mfAppearanceControls({ padding: 24, gap: 16, shadow: true }),
  labels: mfLabelControls(ONBOARDING_LABELS),
});
