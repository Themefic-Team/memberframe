/**
 * Custom profile fields. Feature plan FP-09, PRD feature F16.
 *
 * A creator defines a handful of member attributes, "Company", "Portfolio URL",
 * "Experience level", and members fill them in, during onboarding or later on
 * their dashboard. The DEFINITIONS live in the site settings document; the
 * VALUES live in `Member.metadata`, a JSON column on the member's own row. The
 * reasoning is in `docs/development-docs/06-connect-and-pages.md` section 3.
 *
 * ## Four copies of the rules, on purpose
 *
 * The backend's `lib/memberMetadata.ts` and `lib/siteSettings.ts` are the rule.
 * This file is the plugin's copy, which the field editor and the tests read.
 * `<MemberDashboard>` and `<OnboardingModal>` each carry a third and fourth,
 * because a canvas component is compiled by Framer alone and cannot import
 * from this repository.
 *
 * Every function marked PARITY below must stay byte-identical, comments and
 * whitespace aside, to its counterparts. `test/customFieldsParity.test.ts`
 * compares the two canvas copies with this one, and the backend's
 * `test/parity.test.ts` compares this one with the server. A rule that drifts
 * produces a form that accepts what the server refuses, or hides a field the
 * server still requires, with nothing on screen a member can act on.
 */

/** FP-09 section 2. A closed union: an unknown type has no control and no rule. */
export type CustomFieldType =
  | "text"
  | "textarea"
  | "url"
  | "phone"
  | "select"
  | "boolean"
  | "number";

export const CUSTOM_FIELD_TYPES: ReadonlyArray<CustomFieldType> = [
  "text",
  "textarea",
  "url",
  "phone",
  "select",
  "boolean",
  "number",
];

/** Creator-facing names. Never show the raw type string to anyone. */
export const CUSTOM_FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: "Short text",
  textarea: "Long text",
  url: "Web address",
  phone: "Phone number",
  select: "Dropdown",
  boolean: "Checkbox",
  number: "Number",
};

/**
 * Show a field only while another field holds a value.
 *
 * One level deep. The parent is an earlier dropdown or checkbox with no
 * condition of its own, and `value` is an option for a dropdown or `"true"` /
 * `"false"` for a checkbox. Conflict C31 records why this exists at all: the
 * plan's flow branches and the schema it specifies cannot.
 */
export interface FieldCondition {
  key: string;
  value: string;
}

/** One creator-defined attribute, as stored in the settings document. */
export interface CustomFieldDefinition {
  key: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  /** Only meaningful for `select`. */
  options: string[];
  placeholder: string;
  order: number;
  showWhen?: FieldCondition | null;
}

/** What a member's metadata column may hold. */
export type MetadataValue = string | number | boolean | null;
export type MemberMetadata = Record<string, MetadataValue>;

/** Same bounds as the server. Changing one here and not there is a parity failure. */
export const MAX_CUSTOM_FIELDS = 20;
export const MAX_FIELD_OPTIONS = 50;
export const MAX_FIELD_LABEL_LENGTH = 120;
export const MAX_TEXT_LENGTH = 255;
export const MAX_TEXTAREA_LENGTH = 2000;
export const MAX_URL_LENGTH = 2048;

const RESERVED_KEYS: ReadonlyArray<string> = ["__proto__", "constructor", "prototype"];

/**
 * PARITY with `isValidFieldKey` in the backend's `lib/siteSettings.ts`.
 *
 * Lowercase, digits, underscore, starting with a letter. The key becomes an
 * object key in a JSON column and a form field name, so a dot or a bracket
 * would let a creator define a key that reads like a path into something else.
 */
export function isValidFieldKey(value: string): boolean {
  if (!/^[a-z][a-z0-9_]{0,48}$/.test(value)) return false;
  return !RESERVED_KEYS.includes(value);
}

/**
 * A key derived from a label, for a field the creator has just added.
 *
 * "Portfolio URL" becomes `portfolio_url`. Accents are folded and anything that
 * survives as neither letter nor digit becomes an underscore, so a label in any
 * Latin script yields a usable key. A label with no Latin letters at all, say
 * one written in Japanese, yields `field`, and a numeric suffix keeps every key
 * unique. The creator can still edit the key before the first save.
 */
export function keyFromLabel(label: string, taken: ReadonlyArray<string>): string {
  const base =
    label
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^[^a-z]+/, "")
      .replace(/_+$/, "")
      .slice(0, 40) || "field";

  const safe = isValidFieldKey(base) ? base : "field";
  if (!taken.includes(safe)) return safe;

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${safe}_${suffix}`;
    if (!taken.includes(candidate)) return candidate;
  }

  return `${safe}_${taken.length + 1}`;
}

/**
 * PARITY with `isSafeUrl` in the backend's `lib/memberMetadata.ts`.
 *
 * http and https only. A portfolio URL is rendered as a link on the creator's
 * site and in the plugin's member flyout, and `javascript:` in an href is
 * script execution in both places.
 */
export function isSafeUrl(value: string): boolean {
  if (value.length > MAX_URL_LENGTH) return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** PARITY with `isPhoneLike` in the backend. E.164, loosely. */
export function isPhoneLike(value: string): boolean {
  return /^\+?[0-9][0-9\s\-().]{5,24}$/.test(value);
}

/**
 * PARITY with `checkValue` in the backend's `lib/memberMetadata.ts`.
 *
 * One value against one definition: the value to store, or a problem naming
 * the field. An empty string becomes null throughout, so "cleared" and "never
 * filled" are the same thing to every consumer.
 */
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
      // A required boolean means the box must be ticked, which is how a terms
      // checkbox is expressed. `false` is a value, so this is checked here
      // rather than by the null branch above.
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
      // Against the definition's own list. Without this a member could post any
      // string and the creator's "Industry" column would fill with free text.
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
      // Unreachable while `CustomFieldType` is closed, and present so that
      // adding a type without handling it fails here rather than silently
      // accepting anything for the new type.
      return { problem: `${field.label} cannot be saved.` };
  }
}

/** The exported face of `checkValue`, which keeps its server name for parity. */
export function checkFieldValue(
  field: CustomFieldDefinition,
  raw: unknown
): { value: MetadataValue } | { problem: string } {
  return checkValue(field, raw);
}

/**
 * PARITY with `isFieldVisible` in the backend.
 *
 * A conditional field applies only while its parent holds the expected value,
 * compared as a string so a boolean `true` matches the condition `"true"`. An
 * empty parent hides the child.
 */
export function isFieldVisible(
  field: CustomFieldDefinition,
  values: Readonly<Record<string, MetadataValue | undefined>>
): boolean {
  if (!field.showWhen) return true;

  const parent = values[field.showWhen.key];
  if (parent === null || parent === undefined) return false;

  return String(parent) === field.showWhen.value;
}

/**
 * PARITY with `conditionProblem` in the backend's `lib/siteSettings.ts`.
 *
 * Why a field's condition is unusable, or null. The server refuses a save that
 * fails this, so the editor runs it first and names the field.
 */
export function conditionProblem(
  fields: ReadonlyArray<CustomFieldDefinition>,
  index: number
): string | null {
  const field = fields[index];
  if (!field || !field.showWhen) return null;

  const parentIndex = fields.findIndex((candidate) => candidate.key === field.showWhen?.key);
  if (parentIndex === -1) return "The field this depends on no longer exists.";
  if (parentIndex >= index) return "A field can only depend on a field above it.";

  const parent = fields[parentIndex];
  if (!parent) return "The field this depends on no longer exists.";
  if (parent.showWhen) return "A field cannot depend on a field that is itself conditional.";

  if (parent.type === "boolean") {
    return field.showWhen.value === "true" || field.showWhen.value === "false"
      ? null
      : "Choose on or off for the checkbox this depends on.";
  }

  if (parent.type === "select") {
    return parent.options.includes(field.showWhen.value)
      ? null
      : "Choose one of the options of the dropdown this depends on.";
  }

  return "A field can only depend on a dropdown or a checkbox.";
}

// ============================================================================
// THE FIELD EDITOR
// ============================================================================

/** What is wrong with one definition, per control, for inline errors. */
export interface DefinitionProblems {
  label?: string;
  key?: string;
  options?: string;
  showWhen?: string;
}

/**
 * Every problem in the list the creator is editing, by index.
 *
 * The server's `validatePatch` refuses all of these, so this is a hint that
 * arrives before the round trip rather than a rule of its own. An empty object
 * at an index means that field is fine.
 */
export function definitionProblems(
  fields: ReadonlyArray<CustomFieldDefinition>
): DefinitionProblems[] {
  const seen = new Map<string, number>();

  return fields.map((field, index) => {
    const problems: DefinitionProblems = {};

    if (field.label.trim() === "") {
      problems.label = "Give this field a label.";
    } else if (field.label.length > MAX_FIELD_LABEL_LENGTH) {
      problems.label = "Keep the label under 120 characters.";
    }

    if (!isValidFieldKey(field.key)) {
      problems.key = "Use lowercase letters, digits, and underscores, starting with a letter.";
    } else if (seen.has(field.key)) {
      problems.key = `Field ${(seen.get(field.key) ?? 0) + 1} already uses this key.`;
    } else {
      seen.set(field.key, index);
    }

    if (field.type === "select") {
      const options = field.options.map((option) => option.trim());

      if (options.filter((option) => option !== "").length === 0) {
        problems.options = "Add at least one option.";
      } else if (options.some((option) => option === "")) {
        problems.options = "Fill in or remove the empty option.";
      } else if (new Set(options).size !== options.length) {
        problems.options = "Two options are the same.";
      } else if (options.length > MAX_FIELD_OPTIONS) {
        problems.options = `A dropdown can have at most ${MAX_FIELD_OPTIONS} options.`;
      }
    }

    const condition = conditionProblem(fields, index);
    if (condition) problems.showWhen = condition;

    return problems;
  });
}

export function hasDefinitionProblems(problems: ReadonlyArray<DefinitionProblems>): boolean {
  return problems.some((entry) => Object.keys(entry).length > 0);
}

/**
 * The list as it will be saved: order from position, options trimmed, and the
 * fields that only one type uses cleared on the others.
 *
 * Clearing matters for `options`. A field changed from a dropdown to short text
 * would otherwise carry its old options into the document forever, and a later
 * change back would resurrect a list the creator thought they had replaced.
 */
export function normalizeDefinitions(
  fields: ReadonlyArray<CustomFieldDefinition>
): CustomFieldDefinition[] {
  return fields.map((field, index) => {
    const normalized: CustomFieldDefinition = {
      key: field.key.trim(),
      label: field.label.trim(),
      type: field.type,
      required: field.required,
      options: field.type === "select" ? field.options.map((option) => option.trim()) : [],
      placeholder: field.type === "boolean" ? "" : field.placeholder.trim(),
      order: index,
    };

    if (field.showWhen) normalized.showWhen = { ...field.showWhen };
    return normalized;
  });
}

/**
 * Fields that other fields may depend on: earlier, a dropdown or a checkbox,
 * and not conditional themselves. Exactly the parents `conditionProblem`
 * accepts, so the editor never offers a choice the server would refuse.
 */
export function conditionParents(
  fields: ReadonlyArray<CustomFieldDefinition>,
  index: number
): CustomFieldDefinition[] {
  return fields
    .slice(0, index)
    .filter((field) => !field.showWhen && (field.type === "select" || field.type === "boolean"));
}

/**
 * Remove a field and every condition that pointed at it.
 *
 * A dependent field is kept and becomes always shown. Deleting it as well
 * would be a surprising second deletion, and leaving its condition in place
 * would make the whole list unsaveable until the creator found it.
 */
export function removeDefinition(
  fields: ReadonlyArray<CustomFieldDefinition>,
  index: number
): CustomFieldDefinition[] {
  const removed = fields[index];
  if (!removed) return [...fields];

  return fields
    .filter((_, position) => position !== index)
    .map((field) =>
      field.showWhen && field.showWhen.key === removed.key ? { ...field, showWhen: null } : field
    );
}

/**
 * Move a field up or down by one.
 *
 * Refused when it would put a dependent field above its parent, because
 * `conditionProblem` would then refuse the save and the creator would have to
 * work out why. Returns the list unchanged in that case.
 */
export function moveDefinition(
  fields: ReadonlyArray<CustomFieldDefinition>,
  index: number,
  direction: -1 | 1
): CustomFieldDefinition[] {
  const target = index + direction;
  if (target < 0 || target >= fields.length) return [...fields];

  const next = [...fields];
  const moving = next[index];
  const other = next[target];
  if (!moving || !other) return [...fields];

  next[index] = other;
  next[target] = moving;

  const broken = next.some((_, position) => conditionProblem(next, position) !== null);
  const wasBroken = fields.some((_, position) => conditionProblem(fields, position) !== null);

  return broken && !wasBroken ? [...fields] : next;
}

// ============================================================================
// THE MEMBER'S FORM
// ============================================================================

/**
 * What an HTML control holds, turned into what the server expects.
 *
 * Inputs hold strings. A number field's string becomes a number, and a string
 * that is not one is passed through unchanged so `checkValue` names the field
 * rather than this function guessing a zero.
 */
export function toSubmittedValue(
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

export interface ProfileValidation {
  /** The patch to send: visible fields only. */
  metadata: MemberMetadata;
  /** Keyed by field key, one message each. Empty means submit. */
  problems: Record<string, string>;
}

/**
 * Check a whole form before it is submitted.
 *
 * Only the visible fields are checked and only they are sent. A hidden field's
 * value is the server's to drop, and sending it would only invite a problem
 * report about a control the member cannot see. `keys` limits the check to one
 * step of the onboarding flow; omitted, every visible field is checked.
 */
export function validateProfile(
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

/**
 * Does this member still owe the creator an answer?
 *
 * True when a visible required field is empty. That is the only thing that
 * opens `<OnboardingModal>`: FP-09 section 3 sends a member with nothing
 * required straight into the site, and an optional field never traps anyone.
 */
export function needsOnboarding(
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

export interface OnboardingSteps {
  /** Fields a member must answer before continuing. Never skippable. */
  required: string[];
  /** Fields a member may skip. Skipping sends none of them. */
  optional: string[];
}

/**
 * Split the fields into the two question steps of `<OnboardingModal>`.
 *
 * A required field goes in the first, an optional one in the second, and a
 * conditional field goes wherever its parent went, whatever its own flag says.
 * Following the parent is the only placement that works: a child placed in an
 * earlier step than its parent could never be shown, because the answer that
 * shows it has not been asked yet.
 */
export function planSteps(fields: ReadonlyArray<CustomFieldDefinition>): OnboardingSteps {
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

/**
 * A stored value as a creator reads it in the member flyout.
 *
 * Never the raw value for a boolean or an empty one: "true" and "null" are
 * implementation details, and PRD section 7.6 rule 4 forbids showing those.
 */
export function displayValue(field: CustomFieldDefinition, value: MetadataValue | undefined): string {
  if (value === null || value === undefined || value === "") return "Not answered";
  if (field.type === "boolean") return value === true ? "Yes" : "No";
  return String(value);
}

/**
 * Read the definitions out of a settings document the panel did not validate.
 *
 * The document arrives from a JSON column through a cast, blocker B8, so a
 * missing or malformed list reads as no fields rather than breaking the tab.
 */
export function readDefinitions(value: unknown): CustomFieldDefinition[] {
  if (!Array.isArray(value)) return [];

  const fields: CustomFieldDefinition[] = [];

  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;

    const type = record["type"];
    const key = record["key"];
    const label = record["label"];
    if (typeof key !== "string" || typeof label !== "string") continue;
    if (typeof type !== "string" || !CUSTOM_FIELD_TYPES.includes(type as CustomFieldType)) continue;

    const condition = record["showWhen"];
    const showWhen =
      typeof condition === "object" &&
      condition !== null &&
      typeof (condition as Record<string, unknown>)["key"] === "string" &&
      typeof (condition as Record<string, unknown>)["value"] === "string"
        ? {
            key: (condition as Record<string, string>)["key"] ?? "",
            value: (condition as Record<string, string>)["value"] ?? "",
          }
        : null;

    fields.push({
      key,
      label,
      type: type as CustomFieldType,
      required: record["required"] === true,
      options: Array.isArray(record["options"])
        ? record["options"].filter((option): option is string => typeof option === "string")
        : [],
      placeholder: typeof record["placeholder"] === "string" ? record["placeholder"] : "",
      order: typeof record["order"] === "number" ? record["order"] : fields.length,
      showWhen,
    });
  }

  return fields;
}
